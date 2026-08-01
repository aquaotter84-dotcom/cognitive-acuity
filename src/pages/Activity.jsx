import { useState, useEffect, useMemo } from 'react';
import { Activity as ActivityIcon, Clock, Zap, AlertTriangle, Cpu } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const STATUS_COLORS = {
  success: 'text-emerald-400',
  error: 'text-destructive',
};

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className={`w-4 h-4 ${accent}`} />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Breakdown({ title, data }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, n]) => n));
  if (entries.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{title}</h3>
      <div className="space-y-1.5">
        {entries.map(([key, n]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs w-32 truncate text-muted-foreground">{key}</span>
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary/60" style={{ width: `${(n / max) * 100}%` }} />
            </div>
            <span className="text-xs text-muted-foreground w-6 text-right">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Activity() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.AuditEvent.list('-created_date', 100)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const total = events.length;
    const errors = events.filter(e => e.status === 'error').length;
    const avgLatency = total ? Math.round(events.reduce((s, e) => s + (e.latency_ms || 0), 0) / total) : 0;
    const totalTokens = events.reduce((s, e) => s + (e.token_count || 0), 0);
    const byModel = {}, byTask = {}, byType = {};
    events.forEach(e => {
      byModel[e.model_used || 'unknown'] = (byModel[e.model_used || 'unknown'] || 0) + 1;
      byTask[e.task_type || 'unclassified'] = (byTask[e.task_type || 'unclassified'] || 0) + 1;
      byType[e.event_type] = (byType[e.event_type] || 0) + 1;
    });
    return { total, errors, avgLatency, totalTokens, byModel, byTask, byType };
  }, [events]);

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-3xl mx-auto w-full px-4 py-8 pb-24 md:pb-8">
        <div className="flex items-center gap-2 mb-2">
          <ActivityIcon className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Activity</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Observability for the COGNOS council — model usage, latency, and errors across your recent runs.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <ActivityIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No activity yet. Council events will appear here as you chat with COGNOS.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard icon={ActivityIcon} label="Events" value={stats.total} accent="text-primary" />
              <StatCard icon={AlertTriangle} label="Errors" value={stats.errors} accent="text-destructive" />
              <StatCard icon={Clock} label="Avg latency" value={`${stats.avgLatency}ms`} accent="text-amber-400" />
              <StatCard icon={Zap} label="Tokens" value={stats.totalTokens} accent="text-accent" />
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <Breakdown title="By model" data={stats.byModel} />
              <Breakdown title="By task type" data={stats.byTask} />
            </div>

            <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Recent events</h3>
            <div className="space-y-1.5">
              {events.slice(0, 25).map(e => (
                <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card text-sm">
                  <Cpu className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{e.agent_type || e.event_type}</span>
                      {e.model_used && <span className="text-xs text-muted-foreground">· {e.model_used}</span>}
                    </div>
                    {e.error_message && <p className="text-xs text-destructive truncate mt-0.5">{e.error_message}</p>}
                  </div>
                  <span className={`text-xs ${STATUS_COLORS[e.status] || 'text-muted-foreground'}`}>{e.status}</span>
                  {e.latency_ms > 0 && <span className="text-xs text-muted-foreground">{e.latency_ms}ms</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}