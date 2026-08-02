import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brain, Plus, Search, FolderKanban, Settings as SettingsIcon, Activity as ActivityIcon, Sparkles, Bot, FileText, Atom } from 'lucide-react';
import { useCognos } from '@/lib/cognosContext';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import ConversationItem from '@/components/chat/ConversationItem';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const COGNOS_LOGO = 'https://media.base44.com/images/public/6a65b5729b2fe6a520a0ab97/33193cff0_33519d65130b52f40ef3a4c45c04ff98d2430b231b5b15abfd0b3170de405f121.jpg';

export default function Sidebar({ onNavigate }) {
  const { activeWorkspace, setActiveWorkspace, conversations, refreshConversations, activeConversationId, setActiveConversationId, currentUser } = useCognos();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [workspaces, setWorkspaces] = useState([]);

  useEffect(() => {
    base44.entities.Workspace.list().then(setWorkspaces).catch(() => {});
  }, [activeWorkspace]);

  const filtered = conversations.filter(c =>
    c.title?.toLowerCase().includes(search.toLowerCase())
  );

  const handleNewChat = () => {
    navigate('/');
    setActiveConversationId(null);
    onNavigate?.();
  };

  const handleSelect = (id) => {
    navigate(`/?c=${id}`);
    setActiveConversationId(id);
    onNavigate?.();
  };

  const handleBranch = async (conv) => {
    if (!activeWorkspace) return;
    const memberIds = conv.member_ids?.length ? conv.member_ids : [currentUser?.id].filter(Boolean);
    const branched = await base44.entities.Conversation.create({
      title: `${conv.title} (branch)`,
      workspace_id: conv.workspace_id,
      member_ids: memberIds,
      last_message_preview: conv.last_message_preview
    });
    // Copy the source messages so the branch continues from the same context.
    const msgs = await base44.entities.Message.filter({ conversation_id: conv.id }, 'created_date', 200);
    if (msgs.length) {
      await base44.entities.Message.bulkCreate(
        msgs.map(m => ({
          conversation_id: branched.id,
          workspace_id: conv.workspace_id,
          role: m.role,
          content: m.content,
          model_used: m.model_used,
          task_type: m.task_type,
          attachments: m.attachments,
          processing_status: m.processing_status || 'complete',
          member_ids: memberIds
        }))
      );
    }
    await refreshConversations();
    navigate(`/?c=${branched.id}`);
    setActiveConversationId(branched.id);
    onNavigate?.();
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.Message.deleteMany({ conversation_id: id });
      await base44.entities.Conversation.delete(id);
      if (activeConversationId === id) setActiveConversationId(null);
      await refreshConversations();
    } catch (e) {
      console.error('Failed to delete conversation:', e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 flex items-center">
        <Image
          src={COGNOS_LOGO}
          fittingType="fit"
          className="h-[90px] w-[240px] mix-blend-screen"
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
        <Select
          value={activeWorkspace?.id || ''}
          onValueChange={(v) => {
            const ws = workspaces.find(w => w.id === v);
            if (ws) setActiveWorkspace(ws);
          }}
        >
          <SelectTrigger className="w-full h-9 bg-muted/60 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50">
            <SelectValue placeholder="Workspace" />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map(ws => (
              <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            <ConversationItem
              key={conv.id}
              conv={conv}
              isActive={activeConversationId === conv.id}
              onSelect={handleSelect}
              onBranch={handleBranch}
              onDelete={handleDelete}
            />
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
        <Link to="/insights" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 text-sm transition-colors">
          <Sparkles className="w-4 h-4 text-primary" /> Insights
        </Link>
        <Link to="/documents" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 text-sm transition-colors">
          <FileText className="w-4 h-4 text-primary" /> Documents
        </Link>
        <Link to="/beliefs" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 text-sm transition-colors">
          <Atom className="w-4 h-4 text-accent" /> Beliefs
        </Link>
        <Link to="/agent" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 text-sm transition-colors">
          <Bot className="w-4 h-4 text-accent" /> Agent
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