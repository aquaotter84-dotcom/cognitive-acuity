import { Share2, X } from 'lucide-react';

// ShareMemoryModal — consent-based memory sharing. The memory owner explicitly
// picks a shared workspace to move the memory into; the memory's member_ids
// becomes that workspace's members, so RLS lets them read it. Consent is the
// owner's update (RLS gates Memory writes to created_by_id); revocation moves
// the memory back to the personal workspace.

export default function ShareMemoryModal({ memory, workspaces, onClose, onShared }) {
  const shared = workspaces.filter(w => (w.member_ids || []).length > 1);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Share2 className="w-4 h-4 text-accent" /> Share memory</h2>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{memory.content}</p>
        {shared.length === 0 ? (
          <p className="text-sm text-muted-foreground">No shared workspaces yet. Create one and invite a member first.</p>
        ) : (
          <div className="space-y-1.5">
            {shared.map(ws => (
              <button key={ws.id} onClick={() => onShared(ws)} className="w-full text-left px-3 py-2 rounded-lg border border-border hover:bg-muted/50 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ws.color }} />
                <span className="text-sm font-medium flex-1">{ws.name}</span>
                <span className="text-xs text-muted-foreground">{(ws.member_ids || []).length} members</span>
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Sharing moves this memory into the chosen workspace so its members can see it. Revoke anytime to return it to your personal workspace.
        </p>
      </div>
    </div>
  );
}