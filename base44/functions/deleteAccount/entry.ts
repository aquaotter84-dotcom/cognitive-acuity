import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// True account deletion: erases every record the calling user owns across the
// COGNOS data model before signing them out. Uses the user-scoped client so RLS
// scopes every delete to records the caller actually owns (created_by_id). The
// User record itself is removed best-effort via the service role; if the
// platform declines, the user's data is still gone and the session is revoked
// client-side — satisfying the Play Store data-deletion requirement.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const uid = user.id;
    const counts = {};

    const entities = [
      'Workspace',
      'Conversation',
      'Message',
      'Memory',
      'Document',
      'Insight',
      'AuditEvent',
      'TaskContext'
    ];
    for (const name of entities) {
      try {
        await base44.entities[name].deleteMany({ created_by_id: uid });
        counts[name] = 'deleted';
      } catch (e) {
        counts[name] = `error: ${String(e).slice(0, 80)}`;
      }
    }

    // Best-effort removal of the account record itself (admin-level op).
    let accountDeleted = false;
    try {
      await base44.asServiceRole.entities.User.delete(uid);
      accountDeleted = true;
    } catch (e) {
      counts['User'] = `error: ${String(e).slice(0, 80)}`;
    }

    return Response.json({ ok: true, accountDeleted, counts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}