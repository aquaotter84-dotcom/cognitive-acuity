import { useState, useEffect } from 'react';
import { Brain, Briefcase, FlaskConical, Palette, Rocket, BookOpen, Heart, Code, Plus, Edit2, Trash2, Check, X, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCognos } from '@/lib/cognosContext';
import WorkspaceMembers from '@/components/workspaces/WorkspaceMembers';

const ICON_MAP = { Brain, Briefcase, FlaskConical, Palette, Rocket, BookOpen, Heart, Code };
const ICON_NAMES = Object.keys(ICON_MAP);
const COLORS = ['#3B82F6', '#7C3AED', '#10B981', '#F59E0B', '#F43F5E', '#06B6D4'];

export default function Workspaces() {
  const { activeWorkspace, setActiveWorkspace, setActiveConversationId, currentUser } = useCognos();
  const [workspaces, setWorkspaces] = useState([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [membersWs, setMembersWs] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', instructions: '', color: '#3B82F6', icon: 'Brain' });

  const load = async () => {
    try {
      const wss = await base44.entities.Workspace.list();
      setWorkspaces(wss);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, []);

  const handleMembersUpdated = async () => {
    try {
      const wss = await base44.entities.Workspace.list();
      setWorkspaces(wss);
      setMembersWs(prev => (prev ? wss.find(w => w.id === prev.id) || prev : prev));
    } catch (e) { console.error(e); }
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ name: '', description: '', instructions: '', color: '#3B82F6', icon: 'Brain' });
    setModalOpen(true);
  };

  const openEdit = (ws) => {
    setEditingId(ws.id);
    setForm({ name: ws.name, description: ws.description || '', instructions: ws.instructions || '', color: ws.color || '#3B82F6', icon: ws.icon || 'Brain' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      if (editingId) {
        await base44.entities.Workspace.update(editingId, form);
      } else {
        await base44.entities.Workspace.create({ ...form, member_ids: [currentUser.id], member_emails: [currentUser.email] });
      }
      setModalOpen(false);
      load();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (ws) => {
    if (ws.id === activeWorkspace?.id) return;
    if (!confirm(`Delete workspace "${ws.name}"? This will not delete its conversations.`)) return;
    await base44.entities.Workspace.delete(ws.id);
    load();
  };

  const handleSetActive = (ws) => {
    setActiveWorkspace(ws);
    setActiveConversationId(null);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-3xl mx-auto w-full px-4 py-8 pb-24 md:pb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Workspaces</h1>
            <p className="text-sm text-muted-foreground mt-1">Organize your conversations, memories, and instructions.</p>
          </div>
          <button onClick={openNew} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> New
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {workspaces.map(ws => {
            const Icon = ICON_MAP[ws.icon] || Brain;
            const isActive = ws.id === activeWorkspace?.id;
            return (
              <div key={ws.id} className={`p-5 rounded-2xl border bg-card transition-all ${isActive ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border hover:border-border/80'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: ws.color + '20', color: ws.color }}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setMembersWs(ws)} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-muted/50 hover:bg-muted text-foreground/80" title="Members">
                      <Users className="w-3.5 h-3.5" /> {(ws.member_ids || []).length}
                    </button>
                    <button onClick={() => openEdit(ws)} className="p-1.5 text-muted-foreground hover:text-foreground"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(ws)} disabled={isActive} className="p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <h3 className="font-semibold mb-1">{ws.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{ws.description || 'No description'}</p>
                <button
                  onClick={() => handleSetActive(ws)}
                  disabled={isActive}
                  className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'border border-border hover:bg-muted/50'}`}
                >
                  {isActive ? '✓ Active' : 'Set Active'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin">
            <h2 className="text-lg font-semibold mb-4">{editingId ? 'Edit Workspace' : 'New Workspace'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Research, Personal, Work" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" autoFocus />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What is this workspace for?" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Instructions</label>
                <textarea value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} placeholder="Custom instructions that shape COGNOS behavior in this workspace..." rows={3} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 resize-none" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {ICON_NAMES.map(name => {
                    const Icon = ICON_MAP[name];
                    return (
                      <button key={name} onClick={() => setForm({ ...form, icon: name })} className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${form.icon === name ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`}>
                        <Icon className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setForm({ ...form, color: c })} className={`w-8 h-8 rounded-full border-2 transition-transform ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">{editingId ? 'Save Changes' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {membersWs && (
        <WorkspaceMembers workspace={membersWs} currentUser={currentUser} onClose={() => setMembersWs(null)} onUpdated={handleMembersUpdated} />
      )}
    </div>
  );
}