import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessagesSquare, Search, RefreshCw, Pencil, Trash2, ExternalLink, Check, X, FolderKanban } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCognos } from '@/lib/cognosContext';
import MobilePageHeader from '@/components/MobilePageHeader';
import { formatDistanceToNow } from 'date-fns';

// Threads — the chat-library view. Store, manage, rename, and delete every
// conversation thread, scoped to the active workspace or expanded across all
// of the user's workspaces.

export default function Threads() {
  const { activeWorkspace, conversations, refreshConversations, currentUser } = useCognos();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [allMode, setAllMode] = useState(false);
  const [allThreads, setAllThreads] = useState([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [workspaceNames, setWorkspaceNames] = useState({});

  const loadAll = useCallback(async () => {
    if (!currentUser) return;
    setLoadingAll(true);
    try {
      const wsList = await base44.entities.Workspace.list();
      const mine = wsList.filter(w => (w.member_ids || []).includes(currentUser.id) || w.created_by_id === currentUser.id);
      const names = {};
      mine.forEach(w => { names[w.id] = w.name; });
      setWorkspaceNames(names);
      const results = await Promise.all(mine.map(w =>
        base44.entities.Conversation.filter({ workspace_id: w.id }, '-updated_date', 200).catch(() => [])
      ));
      const flat = results.flat();
      flat.sort((a, b) => (b.updated_date || '').localeCompare(a.updated_date || ''));
      setAllThreads(flat);
    } catch (e) {
      console.error('Failed to load all threads:', e);
      setAllThreads([]);
    } finally {
      setLoadingAll(false);
    }
  }, [currentUser]);

  useEffect(() => { if (allMode) loadAll(); }, [allMode, loadAll]);

  const list = allMode ? allThreads : conversations;
  const filtered = list.filter(c =>
    (c.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.last_message_preview || '').toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (c) => { setEditingId(c.id); setEditTitle(c.title || ''); };
  const cancelEdit = () => { setEditingId(null); setEditTitle(''); };
  const saveEdit = async (id) => {
    if (!editTitle.trim()) return cancelEdit();
    try {
      await base44.entities.Conversation.update(id, { title: editTitle.trim() });
    } catch (e) {
      console.error('Failed to rename thread:', e);
    }
    setEditingId(null);
    setEditTitle('');
    if (allMode) loadAll(); else refreshConversations();
  };
  const handleDelete = async (id) => {
    try {
      await base44.entities.Message.deleteMany({ conversation_id: id });
      await base44.entities.Conversation.delete(id);
    } catch (e) {
      console.error('Failed to delete thread:', e);
    }
    setConfirmId(null);
    if (allMode) loadAll(); else refreshConversations();
  };
  const open = (id) => navigate(`/?c=${id}`);

  const wsName = (c) => allMode ? (workspaceNames[c.workspace_id] || 'Workspace') : (activeWorkspace?.name || '');

  return (
    <div className="flex flex-col h-full">
      <MobilePageHeader title="Threads" />
      <header className="hidden md:flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessagesSquare className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-medium">Threads</h2>
          <span className="text-xs text-muted-foreground ml-2">{filtered.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAllMode(m => !m)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${allMode ? 'bg-primary/15 text-primary' : 'bg-muted/60 text-muted-foreground hover:text-foreground'}`}
          >
            {allMode ? 'All workspaces' : 'Active workspace'}
          </button>
          <button
            onClick={() => allMode ? loadAll() : refreshConversations()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAll ? 'animate-spin' : ''}`} />
            <span className="text-xs">Refresh</span>
          </button>
        </div>
      </header>

      <div className="px-4 py-3">
        <div className="relative max-w-3xl mx-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search threads..."
            className="w-full bg-muted/60 border border-border rounded-lg pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 pb-4">
        <div className="max-w-3xl mx-auto space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <MessagesSquare className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">No threads yet. Start a new chat to create one.</p>
            </div>
          ) : filtered.map(c => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-3 hover:border-primary/30 transition-colors">
              {editingId === c.id ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(c.id); if (e.key === 'Escape') cancelEdit(); }}
                    className="flex-1 bg-muted border border-primary/40 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                  />
                  <button onClick={() => saveEdit(c.id)} className="p-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25"><Check className="w-4 h-4" /></button>
                  <button onClick={cancelEdit} className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>
              ) : confirmId === c.id ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-foreground">Delete "{c.title || 'Untitled'}"? This removes all its messages.</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleDelete(c.id)} className="px-2.5 py-1 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium">Delete</button>
                    <button onClick={() => setConfirmId(null)} className="px-2.5 py-1 rounded-lg bg-muted text-muted-foreground text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <button onClick={() => open(c.id)} className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate selectable">{c.title || 'Untitled'}</span>
                      {allMode && wsName(c) && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <FolderKanban className="w-3 h-3" />{wsName(c)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5 selectable">{c.last_message_preview || 'No messages yet'}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{c.updated_date ? formatDistanceToNow(new Date(c.updated_date), { addSuffix: true }) : ''}</p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => open(c.id)} title="Open" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary"><ExternalLink className="w-4 h-4" /></button>
                    <button onClick={() => startEdit(c)} title="Rename" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setConfirmId(c.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}