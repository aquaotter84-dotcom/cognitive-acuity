import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Brain, Plus, Search, FolderKanban, Settings as SettingsIcon, Activity as ActivityIcon } from 'lucide-react';
import { useCognos } from '@/lib/cognosContext';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';

const COGNOS_LOGO = 'https://media.base44.com/images/public/6a65b5729b2fe6a520a0ab97/27ffd8237_copilot_image_1785559515375.jpeg';

export default function Sidebar({ onNavigate }) {
  const { activeWorkspace, setActiveWorkspace, conversations, activeConversationId, setActiveConversationId } = useCognos();
  const [search, setSearch] = useState('');
  const [workspaces, setWorkspaces] = useState([]);

  useEffect(() => {
    base44.entities.Workspace.list().then(setWorkspaces).catch(() => {});
  }, [activeWorkspace]);

  const filtered = conversations.filter(c =>
    c.title?.toLowerCase().includes(search.toLowerCase())
  );

  const handleNewChat = () => {
    setActiveConversationId(null);
    onNavigate?.();
  };

  const handleSelect = (id) => {
    setActiveConversationId(id);
    onNavigate?.();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 flex items-center">
        <Image
          src={COGNOS_LOGO}
          fittingType="fit"
          className="h-9 w-24 mix-blend-screen"
          alt="COGNOS"
        />
      </div>

      <div className="px-3 pb-3">
        <button onClick={handleNewChat} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">New Chat</span>
        </button>
      </div>

      <div className="px-3 pb-3">
        <select
          value={activeWorkspace?.id || ''}
          onChange={(e) => {
            const ws = workspaces.find(w => w.id === e.target.value);
            if (ws) setActiveWorkspace(ws);
          }}
          className="w-full bg-muted/60 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
        >
          {workspaces.map(ws => (
            <option key={ws.id} value={ws.id}>{ws.name}</option>
          ))}
        </select>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-muted/60 border border-border rounded-lg pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-2">
        {filtered.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">No conversations yet</p>
        ) : (
          filtered.map(conv => (
            <button
              key={conv.id}
              onClick={() => handleSelect(conv.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-colors ${activeConversationId === conv.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'}`}
            >
              <p className="text-sm font-medium truncate">{conv.title}</p>
              {conv.last_message_preview && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.last_message_preview}</p>
              )}
            </button>
          ))
        )}
      </div>

      <div className="border-t border-border p-2 space-y-0.5">
        <Link to="/memory" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 text-sm transition-colors">
          <Brain className="w-4 h-4 text-accent" /> Memory
        </Link>
        <Link to="/activity" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 text-sm transition-colors">
          <ActivityIcon className="w-4 h-4 text-primary" /> Activity
        </Link>
        <Link to="/workspaces" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 text-sm transition-colors">
          <FolderKanban className="w-4 h-4" /> Workspaces
        </Link>
        <Link to="/settings" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 text-sm transition-colors">
          <SettingsIcon className="w-4 h-4" /> Settings
        </Link>
      </div>
    </div>
  );
}