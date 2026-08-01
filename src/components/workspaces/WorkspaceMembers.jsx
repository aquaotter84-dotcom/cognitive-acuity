import { useState } from 'react';
import { X, UserPlus, Trash2, Crown } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// WorkspaceMembers — owner-managed membership for a shared workspace.
// Sovereignty: only the workspace owner (created_by_id) can invite or remove
// members. Inviting creates an app user (role "user") and appends their id to
// member_ids — the array RLS reads against — and their email to member_emails
// for display (non-admin owners can't list users, so the email is denormalized
// at invite time). Removing a member drops them from both arrays; new records
// created afterward exclude them.

export default function WorkspaceMembers({ workspace, currentUser, onClose, onUpdated }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const memberIds = workspace.member_ids || [];
  const memberEmails = workspace.member_emails || [];
  const isOwner = workspace.created_by_id === currentUser?.id;

  const handleInvite = async () => {
    const trimmed = email.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError('');
    try {
      const invited = await base44.users.inviteUser(trimmed, 'user');
      const newId = invited?.id;
      if (!newId) throw new Error('Invite did not return a user id.');
      if (memberIds.includes(newId)) { setEmail(''); return; }
      await base44.entities.Workspace.update(workspace.id, {
        member_ids: [...memberIds, newId],
        member_emails: [...memberEmails, invited.email || trimmed]
      });
      setEmail('');
      onUpdated?.();
    } catch (e) {
      setError(e?.message || 'Could not invite that user. They may need to register first, or you may lack permission.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (id, em) => {
    if (id === workspace.created_by_id) return;
    await base44.entities.Workspace.update(workspace.id, {
      member_ids: memberIds.filter(x => x !== id),
      member_emails: memberEmails.filter(x => x !== em)
    });
    onUpdated?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Members — {workspace.name}</h2>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-1.5 mb-4 max-h-60 overflow-y-auto scrollbar-thin">
          {memberEmails.map((em, i) => {
            const id = memberIds[i];
            const owner = id === workspace.created_by_id;
            return (
              <div key={id || em} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2 min-w-0">
                  {owner && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  <span className="text-sm truncate">{em || id}</span>
                </div>
                {isOwner && !owner && (
                  <button onClick={() => handleRemove(id, em)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>
            );
          })}
        </div>

        {isOwner ? (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Invite by email</label>
            <div className="flex gap-2">
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                disabled={busy}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 disabled:opacity-50"
              />
              <button onClick={handleInvite} disabled={busy || !email.trim()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                <UserPlus className="w-4 h-4" /> Invite
              </button>
            </div>
            {error && <p className="text-xs text-destructive mt-2">{error}</p>}
            <p className="text-xs text-muted-foreground mt-2">
              Invited users join as role "user". New conversations include them; history stays visible only to those who were members when it was created.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Only the workspace owner can manage members.</p>
        )}
      </div>
    </div>
  );
}