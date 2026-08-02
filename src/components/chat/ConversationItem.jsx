import { useState } from 'react';
import { GitBranch, Trash2, Pencil, Check, X } from 'lucide-react';

// Single conversation row. Selecting opens the thread; the action cluster
// supports branch, rename (inline), and delete. Actions are always visible on
// touch devices (no hover) and hover-revealed on desktop.
export default function ConversationItem({ conv, isActive, onSelect, onBranch, onDelete, onRename }) {
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conv.title);

  const handleDelete = (e) => {
    e.stopPropagation();
    if (confirming) {
      onDelete(conv.id);
    } else {
      setConfirming(true);
    }
  };

  const startEdit = (e) => {
    e.stopPropagation();
    setDraft(conv.title);
    setEditing(true);
    setConfirming(false);
  };

  const saveEdit = (e) => {
    e?.stopPropagation();
    const t = draft.trim();
    if (t && t !== conv.title) onRename(conv.id, t);
    setEditing(false);
  };

  const cancelEdit = (e) => {
    e.stopPropagation();
    setEditing(false);
    setDraft(conv.title);
  };

  return (
    <div
      onClick={() => !editing && onSelect(conv.id)}
      className={`group w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-colors cursor-pointer ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}
    >
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit(e);
              if (e.key === 'Escape') cancelEdit(e);
            }}
            onBlur={saveEdit}
            className="text-sm font-medium flex-1 min-w-0 bg-background border border-primary/50 rounded px-1.5 py-0.5 outline-none focus:border-primary"
          />
        ) : (
          <p className="text-sm font-medium truncate flex-1">{conv.title}</p>
        )}
        {!editing && (
          <div className="flex items-center gap-0.5 flex-shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <button
              onClick={startEdit}
              title="Rename"
              className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onBranch(conv); }}
              title="Branch into a new chat"
              className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10"
            >
              <GitBranch className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              title={confirming ? 'Click again to confirm' : 'Delete chat'}
              className={`p-1 rounded hover:bg-destructive/10 ${confirming ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {editing && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onMouseDown={saveEdit}
              title="Save name"
              className="p-1 rounded text-primary hover:bg-primary/10"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={cancelEdit}
              title="Cancel"
              className="p-1 rounded text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      {conv.last_message_preview && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.last_message_preview}</p>
      )}
    </div>
  );
}