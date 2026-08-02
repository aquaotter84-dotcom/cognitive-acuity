import { useState, useEffect } from 'react';
import { Atom, TrendingUp, TrendingDown, History, ArrowRight } from 'lucide-react';
import moment from 'moment';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Phase 14 — State Reconstruction. Replay a single belief's confidence drift
// across the BeliefSnapshot chain (the full equilibrium curve), overlaid with
// the change-ledger transitions that explain each shift. History, not asserted
// truth: "every change is reversible and reconstructable."

const VERB = {
  belief_emerged: 'Belief emerged',
  belief_revised: 'Belief revised',
  belief_collapsed: 'Belief collapsed'
};

export default function BeliefHistory({ workspaceId, beliefKey, beliefLabel, onClose }) {
  const [snapshots, setSnapshots] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId || !beliefKey) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [snaps, evs] = await Promise.all([
          base44.entities.BeliefSnapshot.filter({ workspace_id: workspaceId }, 'derived_at', 50),
          base44.entities.ChangeEvent.filter({ workspace_id: workspaceId, subject_type: 'belief', subject_id: beliefKey }, 'created_date', 50)
        ]);
        if (cancelled) return;
        setSnapshots(snaps || []);
        setEvents(evs || []);
      } catch (e) {
        console.error('Belief history load failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceId, beliefKey]);

  // Reconstruct the drift curve from the snapshot chain — confidence + base at
  // each derivation where this belief existed. More complete than the ledger
  // alone (which only records revisions above the threshold).
  const series = snapshots
    .map(s => {
      const b = (s.beliefs || []).find(x => x.key === beliefKey);
      if (!b) return null;
      return {
        ts: new Date(s.derived_at).getTime(),
        confidence: Number(b.confidence ?? 0),
        base: Number(b.base ?? 0)
      };
    })
    .filter(Boolean);

  const first = series[0];
  const last = series[series.length - 1];
  const drift = last && first ? last.confidence - first.confidence : 0;

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 pr-6">
            <Atom className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <span className="text-sm font-medium leading-snug selectable">{beliefLabel}</span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
        ) : series.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No snapshot history for this belief yet — derive beliefs again to build its lineage.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <span className="text-muted-foreground">{series.length} derivation{series.length > 1 ? 's' : ''}</span>
              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {first ? `${(first.confidence * 100).toFixed(0)}%` : '—'} → <span className="text-foreground font-medium">{last ? `${(last.confidence * 100).toFixed(0)}%` : '—'}</span>
              </span>
              {drift !== 0 && (
                <span className={`flex items-center gap-1 ${drift > 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                  {drift > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {drift > 0 ? '+' : ''}{(drift * 100).toFixed(0)}%
                </span>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card/30 p-3">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.4} />
                    <XAxis dataKey="ts" tickFormatter={(ts) => moment(ts).format('MMM D HH:mm')} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} minTickGap={30} />
                    <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={36} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', fontSize: '11px' }}
                      labelFormatter={(ts) => moment(ts).format('MMM D, HH:mm')}
                      formatter={(v, name) => [`${(v * 100).toFixed(0)}%`, name === 'confidence' ? 'Propagated' : 'Base']}
                    />
                    <Line type="monotone" dataKey="base" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="confidence" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--accent))' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-accent" /> Propagated confidence</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 border-t border-dashed border-muted-foreground" /> Base (LLM)</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Transitions ({events.length})</p>
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic">No recorded transitions for this belief.</p>
              ) : (
                <div className="space-y-1.5">
                  {events.map(ev => {
                    const from = ev.from_state?.confidence;
                    const to = ev.to_state?.confidence;
                    return (
                      <div key={ev.id} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[11px] font-medium ${ev.event_type === 'belief_collapsed' ? 'text-destructive' : 'text-accent'}`}>
                            {VERB[ev.event_type] || ev.event_type}
                          </span>
                          <span className="text-[10px] text-muted-foreground/70">{moment(ev.created_date).format('MMM D HH:mm')}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                          {from != null ? <span>{(from * 100).toFixed(0)}%</span> : <span className="text-muted-foreground/50">—</span>}
                          <ArrowRight className="w-3 h-3" />
                          {to != null ? <span className="text-foreground/80">{(to * 100).toFixed(0)}%</span> : <span className="text-destructive">collapsed</span>}
                          {typeof ev.delta === 'number' && ev.delta !== 0 && (
                            <span className={ev.delta > 0 ? 'text-emerald-400' : 'text-destructive'}>
                              {ev.delta > 0 ? '+' : ''}{(ev.delta * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                        {ev.cause && <p className="text-[10px] text-muted-foreground/60 mt-1 italic line-clamp-2 selectable">{ev.cause}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}