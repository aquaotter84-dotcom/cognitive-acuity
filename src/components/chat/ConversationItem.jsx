import { useState } from 'react';
import { GitBranch, Trash2 } from 'lucide-react';

// Single conversation row with hover-reveal actions: branch (copy into a new
// chat) and delete. Keeps the sidebar list clean while making chat management
// discoverable.
export default function ConversationItem({ conv, isActive, onSelect, onBranch, onDelete }) {
  const [confirming, setConfirming] = useState(false);

  const handleDelete = (e) => {
    e.stopPropagation();
    if (confirming) {
      onDelete(conv.id);
    } else {
      setConfirming(true);
    }
  };

  return (
    <div
      onClick={() => onSelect(conv.id)}
      className={`group w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-colors cursor-pointer ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium truncate flex-1">{conv.title}</p>
        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
      </div>
      {conv.last_message_preview && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.last_message_preview}</p>
      )}
    </div>
  );
}