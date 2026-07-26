import { useState, useEffect } from 'react';
import { Brain, Search, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCognos } from '@/lib/cognosContext';

const typeColors = {
  episodic: 'bg-accent/15 text-accent',
  semantic: 'bg-primary/15 text-primary',
  working: 'bg-amber-500/15 text-amber-400',
};

export default function Memory() {
  const { activeWorkspace } = useCognos();
  const [memories, setMemories] = useState([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState('');

  const loadMemories = async () => {
    if (!activeWorkspace) return;
    try {
      const mems = await base44.entities.Memory.filter(
        { workspace_id: activeWorkspace.id },
        '-importance',
        100
      );
      setMemories(mems);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadMemories(); }, [activeWorkspace?.id]);

  const filtered = memories.filter(m =>
    m.content?.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = async (mem) => {
    await base44.entities.Memory.update(mem.id, { is_enabled: !mem.is_enabled });
    loadMemories();
  };

  const handleDelete = async (id) => {
    await base44.entities.Memory.delete(id);
    loadMemories();
  };

  const handleSaveEdit = async (id) => {
    if (!editContent.trim()) return;
    await base44.entities.Memory.update(id, { content: editContent.trim() });
    setEditingId(null);
    loadMemories();
  };

  const handleCreate = async () => {
    if (!newContent.trim() || !activeWorkspace) return;
    await base44.entities.Memory.create({
      workspace_id: activeWorkspace.id,
      content: newContent.trim(),
      memory_type: 'semantic',
      source: 'manual',
      importance: 5,
      is_enabled: true
    });
    setNewContent('');
    setIsAdding(false);
    loadMemories();
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-3xl mx-auto w-full px-4 py-8 pb-24 md:pb-8">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold">Memory</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Memories extracted from your conversations in <span className="text-foreground font-medium">{activeWorkspace?.name}</span>.
          COGNOS uses these to provide personalized, context-aware responses.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search memories..."
              className="w-full bg-card border border-border rounded-lg pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
            />
          </div>
          <button onClick={() => setIsAdding(!isAdding)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {isAdding && (
          <div className="mb-4 p-4 rounded-xl border border-accent/30 bg-accent/5 animate-fade-in">
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Enter a memory or fact you want COGNOS to remember..."
              rows={3}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent/50 resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => { setIsAdding(false); setNewContent(''); }} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={handleCreate} className="px-3 py-1.5 text-sm bg-accent text-accent-foreground rounded-lg hover:bg-accent/90">Save Memory</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{search ? 'No memories match your search.' : 'No memories yet. They will appear here as you chat with COGNOS.'}</p>
            </div>
          ) : (
            filtered.map(mem => (
              <div key={mem.id} className={`p-4 rounded-xl border border-border bg-card transition-opacity ${!mem.is_enabled ? 'opacity-50' : ''}`}>
                {editingId === mem.id ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent/50 resize-none"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                      <button onClick={() => handleSaveEdit(mem.id)} className="p-1.5 text-accent hover:text-accent/80"><Check className="w-4 h-4" /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[mem.memory_type] || typeColors.episodic}`}>{mem.memory_type}</span>
                        <span className="text-xs text-muted-foreground">Importance: {mem.importance}/10</span>
                      </div>
                      <p className="text-sm">{mem.content}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => handleToggle(mem)} className={`w-9 h-5 rounded-full transition-colors ${mem.is_enabled ? 'bg-accent' : 'bg-muted'}`}>
                        <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${mem.is_enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                      <button onClick={() => { setEditingId(mem.id); setEditContent(mem.content); }} className="p-1.5 text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(mem.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}