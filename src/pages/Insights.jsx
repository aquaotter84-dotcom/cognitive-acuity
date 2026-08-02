import { useState, useEffect } from 'react';
import { Sparkles, Clock, CheckCircle2, Trash2, RefreshCw, ChevronDown, ChevronUp, Zap, Menu, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCognos } from '@/lib/cognosContext';
import ReactMarkdown from 'react-markdown';
import PullToRefresh from '@/components/PullToRefresh';

const TRIGGER_STYLES = {
  scheduled: 'bg-primary/10 text-primary',
  manual: 'bg-accent/10 text-accent'
};

export default function Insights() {
  const { activeWorkspace, openSidebar } = useCognos();
  const navigate = useNavigate();
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [topic, setTopic] = useState('');

  const load = async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const list = await base44.entities.Insight.filter({ workspace_id: activeWorkspace.id }, '-created_date', 50);
      setInsights(list);
    } catch { setInsights([]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeWorkspace?.id]);

  const generate = async () => {
    if (!activeWorkspace || generating) return;
    setGenerating(true);
    try {
      await base44.functions.invoke('runCouncilAutonomous', {
        workspaceId: activeWorkspace.id,
        topic: topic.trim() || undefined,
        trigger: 'manual'
      });
      setTopic('');
      await load();
    } catch (e) {
      console.error(e);
    }
    setGenerating(false);
  };

  const markRead = async (id, val) => {
    await base44.entities.Insight.update(id, { is_read: val });
    setInsights(prev => prev.map(i => i.id === id ? { ...i, is_read: val } : i));
  };

  const remove = async (id) => {
    await base44.entities.Insight.delete(id);
    setInsights(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border select-none" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
        <button onClick={() => navigate('/')} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-muted transition-colors" aria-label="Back to chat">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button onClick={openSidebar} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-muted transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Autonomous Insights</h2>
          <p className="text-xs text-muted-foreground truncate">Council deliberations generated on their own — daily briefings and on-demand.</p>
        </div>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="p-4 border-b border-border">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') generate(); }}
            placeholder="Optional: what should the council deliberate? (blank = daily briefing)"
            className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
          />
          <button onClick={generate} disabled={generating || !activeWorkspace} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 text-sm transition-colors hover:bg-primary/90">
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {generating ? 'Deliberating…' : 'Generate'}
          </button>
        </div>
      </div>

      <PullToRefresh onRefresh={load} className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-3">
          {insights.length === 0 && !loading ? (
            <div className="text-center py-16 text-muted-foreground">
              <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No insights yet. Generate one or wait for the daily 9am briefing.</p>
            </div>
          ) : insights.map(ins => (
            <div key={ins.id} className={`rounded-xl border bg-card transition-colors ${ins.is_read ? 'border-border' : 'border-primary/30'}`}>
              <button
                onClick={() => { setExpanded(expanded === ins.id ? null : ins.id); if (!ins.is_read) markRead(ins.id, true); }}
                className="w-full text-left p-4 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wide ${TRIGGER_STYLES[ins.trigger_type] || ''}`}>{ins.trigger_type}</span>
                    {ins.council?.critic?.score != null && !ins.council?.critic?.skipped && (
                      <span className="text-[10px] text-muted-foreground">critic {ins.council.critic.score}/10</span>
                    )}
                    {ins.council?.governor && !ins.council.governor.approved && (
                      <span className="text-[10px] text-destructive">flagged</span>
                    )}
                    {!ins.is_read && <span className="w-1.5 h-1.5 rounded-full bg-primary ml-auto" />}
                  </div>
                  <p className="text-sm font-medium truncate">{ins.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(ins.created_date).toLocaleString()}
                  </p>
                </div>
                {expanded === ins.id ? <ChevronUp className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />}
              </button>
              {expanded === ins.id && (
                <div className="px-4 pb-4 border-t border-border pt-3">
                  <ReactMarkdown components={{
                    p: ({ children }) => <p className="mb-3 last:mb-0 text-sm leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-sm">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-sm">{children}</ol>,
                    h1: ({ children }) => <h1 className="text-base font-semibold mb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-semibold mb-2">{children}</h2>,
                    code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{children}</code>
                  }}>{ins.content}</ReactMarkdown>
                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border">
                    <button onClick={() => markRead(ins.id, !ins.is_read)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <CheckCircle2 className="w-3 h-3" /> {ins.is_read ? 'Mark unread' : 'Mark read'}
                    </button>
                    <button onClick={() => remove(ins.id)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive ml-auto transition-colors">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </PullToRefresh>
    </div>
  );
}