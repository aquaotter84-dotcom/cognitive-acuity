import { useState, useEffect, useMemo } from 'react';
import { GitBranch, TrendingUp, TrendingDown, ArrowRight, Spline } from 'lucide-react';
import moment from 'moment';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

// Phase 14 — Temporal Cascade Reasoner.
// Replays the BeliefSnapshot chain as a system-wide confidence trajectory and lets
// the user watch a single belief's shift ripple through the relationship graph over
// time: the selected belief's line is bold, its neighbours are coloured by edge type,
// and each recorded transition is a marker with its downstream ripple measured across
// the bracketing snapshots. "Knowledge is the current equilibrium of continuous
// change" — this is the change, made visible.

const REL_COLOR = {
  supports: '#34d399',    // emerald-400
  contradicts: '#ef4444', // red-500
  depends_on: '#fbbf24'   // amber-400
};

export default function CascadeTimeline({ workspaceId, onClose }) {
  const [snaps, setSnaps] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState(null);
  const [eventIdx, setEventIdx] = useState(0);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, e] = await Promise.all([
          base44.entities.BeliefSnapshot.filter({ workspace_id: workspaceId }, 'derived_at', 100),
          base44.entities.ChangeEvent.filter({ workspace_id: workspaceId, subject_type: 'belief' }, 'created_date', 200)
        ]);
        if (cancelled) return;
        setSnaps((s || []).sort((a, b) => new Date(a.derived_at) - new Date(b.derived_at)));
        setEvents((e || []).sort((a, b) => new Date(a.created_date) - new Date(b.created_date)));
      } catch (err) {
        console.error('Cascade load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceId]);

  const { keyLabel, allKeys } = useMemo(() => {
    const labelMap = new Map();
    const order = [];
    for (const s of snaps) {
      for (const b of (s.beliefs || [])) {
        if (!labelMap.has(b.key)) { labelMap.set(b.key, b.claim); order.push(b.key); }
        else if (!labelMap.get(b.key)) labelMap.set(b.key, b.claim);
      }
    }
    return { keyLabel: labelMap, allKeys: order };
  }, [snaps]);

  const chartData = useMemo(() => snaps.map(s => {
    const o = { ts: new Date(s.derived_at).getTime(), _id: s.id };
    for (const b of (s.beliefs || [])) o[b.key] = Number(b.confidence ?? 0);
    return o;
  }), [snaps]);

  const latestRels = useMemo(() => {
    for (let i = snaps.length - 1; i >= 0; i--) {
      if ((snaps[i].relationships || []).length) return snaps[i].relationships;
    }
    return [];
  }, [snaps]);

  const neighbors = useMemo(() => {
    if (!selectedKey) return [];
    const map = new Map();
    for (const r of latestRels) {
      if (r.source === selectedKey && r.target !== selectedKey) {
        if (!map.has(r.target)) map.set(r.target, r.type);
      } else if (r.target === selectedKey && r.source !== selectedKey) {
        if (!map.has(r.source)) map.set(r.source, r.type);
      }
    }
    return [...map.entries()].map(([k, type]) => ({ key: k, type }));
  }, [selectedKey, latestRels]);

  const selectedEvents = useMemo(() => {
    if (!selectedKey) return [];
    return events.filter(e => e.subject_id === selectedKey);
  }, [events, selectedKey]);

  useEffect(() => {
    if (selectedKey || allKeys.length === 0) return;
    const counts = new Map();
    for (const e of events) counts.set(e.subject_id, (counts.get(e.subject_id) || 0) + 1);
    let best = null, bestCount = -1;
    for (const k of allKeys) {
      const c = counts.get(k) || 0;
      if (c > bestCount) { bestCount = c; best = k; }
    }
    setSelectedKey(best || allKeys[0]);
  }, [allKeys, events, selectedKey]);

  useEffect(() => { setEventIdx(0); }, [selectedKey]);

  const currentEvent = selectedEvents.length ? selectedEvents[Math.min(eventIdx, selectedEvents.length - 1)] : null;

  const ripple = useMemo(() => {
    if (!currentEvent || snaps.length < 2) return [];
    const i = snaps.findIndex(s => s.id === currentEvent.run_id);
    if (i <= 0) return [];
    const prev = snaps[i - 1];
    const cur = snaps[i];
    const out = [];
    for (const n of neighbors) {
      const pb = (prev.beliefs || []).find(x => x.key === n.key);
      const cb = (cur.beliefs || []).find(x => x.key === n.key);
      const pConf = pb ? Number(pb.confidence ?? 0) : null;
      const cConf = cb ? Number(cb.confidence ?? 0) : null;
      if (pConf == null && cConf == null) continue;
      out.push({
        key: n.key, label: keyLabel.get(n.key) || n.key, type: n.type,
        prev: pConf, curr: cConf, delta: Number(((cConf ?? 0) - (pConf ?? 0)).toFixed(3))
      });
    }
    out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return out;
  }, [currentEvent, snaps, neighbors, keyLabel]);

  const eventMarkers = useMemo(() => selectedEvents
    .map(e => snaps.find(x => x.id === e.run_id))
    .filter(Boolean)
    .map(s => new Date(s.derived_at).getTime()), [selectedEvents, snaps]);

  const hasData = snaps.length > 0 && allKeys.length > 0;

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <GitBranch className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-sm font-medium">Temporal Cascade Reasoner</span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : !hasData ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No belief snapshots yet — derive beliefs a few times to build the temporal chain, then watch shifts cascade through the graph.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Each line is a belief's live (propagated) confidence across derivations. Pick a belief to trace its cascade — its relationship neighbours are highlighted by edge type, and markers show where that belief's base shifted, rippling outward.
            </p>

            <Select value={selectedKey || ''} onValueChange={setSelectedKey}>
              <SelectTrigger className="w-full bg-muted border border-border"><SelectValue placeholder="Select a belief to trace" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {allKeys.map(k => <SelectItem key={k} value={k}>{(keyLabel.get(k) || k).slice(0, 90)}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="rounded-xl border border-border bg-card/30 p-3">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 12, bottom: 5, left: -18 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.4} />
                    <XAxis dataKey="ts" tickFormatter={(ts) => moment(ts).format('MMM D HH:mm')} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} minTickGap={24} />
                    <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={40} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', fontSize: '11px' }}
                      labelFormatter={(ts) => moment(ts).format('MMM D, HH:mm')}
                      formatter={(v, k) => [v != null ? `${(v * 100).toFixed(0)}%` : '—', (keyLabel.get(k) || k).slice(0, 50)]}
                    />
                    {eventMarkers.map((ts, i) => <ReferenceLine key={i} x={ts} stroke="hsl(var(--primary))" strokeOpacity={0.35} strokeDasharray="2 4" />)}
                    {allKeys.map(k => {
                      const isSel = k === selectedKey;
                      const nb = neighbors.find(n => n.key === k);
                      const color = isSel ? 'hsl(var(--accent))' : (nb ? REL_COLOR[nb.type] : 'hsl(var(--muted-foreground))');
                      const opacity = isSel || nb ? 1 : 0.22;
                      const width = isSel ? 2.5 : (nb ? 1.8 : 1);
                      return (
                        <Line key={k} type="monotone" dataKey={k} stroke={color} strokeWidth={width} strokeOpacity={opacity} dot={isSel ? { r: 2.5, fill: color } : false} connectNulls animate={false} />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-accent" /> Selected</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ background: REL_COLOR.supports }} /> supports</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ background: REL_COLOR.contradicts }} /> contradicts</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ background: REL_COLOR.depends_on }} /> depends_on</span>
                <span className="flex items-center gap-1 ml-auto"><Spline className="w-3 h-3" /> {snaps.length} derivations · {allKeys.length} beliefs · {latestRels.length} edges</span>
              </div>
            </div>

            {selectedEvents.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Cascade origin ({selectedEvents.length})</p>
                  <div className="flex items-center gap-1">
                    <button disabled={eventIdx <= 0} onClick={() => setEventIdx(i => i - 1)} className="px-2 py-0.5 rounded bg-muted text-xs disabled:opacity-40">Prev</button>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{eventIdx + 1}/{selectedEvents.length}</span>
                    <button disabled={eventIdx >= selectedEvents.length - 1} onClick={() => setEventIdx(i => i + 1)} className="px-2 py-0.5 rounded bg-muted text-xs disabled:opacity-40">Next</button>
                  </div>
                </div>
                {currentEvent && (
                  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <div className="flex items-center gap-2 text-[11px] flex-wrap">
                      <span className={`font-medium ${currentEvent.event_type === 'belief_collapsed' ? 'text-destructive' : 'text-primary'}`}>{currentEvent.event_type.replace('belief_', '')}</span>
                      <span className="text-muted-foreground">{moment(currentEvent.created_date).format('MMM D HH:mm')}</span>
                      <div className="flex items-center gap-1 ml-1 text-muted-foreground">
                        {currentEvent.from_state?.confidence != null && <span>{(currentEvent.from_state.confidence * 100).toFixed(0)}%</span>}
                        <ArrowRight className="w-3 h-3" />
                        {currentEvent.to_state?.confidence != null
                          ? <span className="text-foreground/80">{(currentEvent.to_state.confidence * 100).toFixed(0)}%</span>
                          : <span className="text-destructive">collapsed</span>}
                        {typeof currentEvent.delta === 'number' && currentEvent.delta !== 0 && (
                          <span className={currentEvent.delta > 0 ? 'text-emerald-400' : 'text-destructive'}>{currentEvent.delta > 0 ? '+' : ''}{(currentEvent.delta * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    </div>
                    {currentEvent.cause && <p className="text-[10px] text-muted-foreground/70 mt-1 italic line-clamp-2 selectable">{currentEvent.cause}</p>}
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Downstream ripple ({ripple.length} neighbour{ripple.length !== 1 ? 's' : ''})</p>
              {ripple.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic">No connected neighbours shifted across this transition — the cascade dissipated or the graph changed shape.</p>
              ) : (
                <div className="space-y-1.5">
                  {ripple.map(r => (
                    <div key={r.key} className="flex items-center gap-2 rounded-lg border border-border bg-muted/10 px-3 py-1.5">
                      <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: REL_COLOR[r.type] || '#888' }} />
                      <span className="text-[11px] text-muted-foreground flex-1 truncate selectable">{r.label}</span>
                      <span className="text-[10px] text-muted-foreground/70 tabular-nums">{r.prev != null ? `${(r.prev * 100).toFixed(0)}%` : '—'}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-foreground/80 tabular-nums">{r.curr != null ? `${(r.curr * 100).toFixed(0)}%` : '—'}</span>
                      {r.delta !== 0 && (
                        <span className={`flex items-center gap-0.5 text-[10px] tabular-nums ${r.delta > 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                          {r.delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {r.delta > 0 ? '+' : ''}{(r.delta * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}