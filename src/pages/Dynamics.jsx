import { useState, useEffect, useCallback } from 'react';
import { History, RefreshCw, Filter } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCognos } from '@/lib/cognosContext';
import ChangeEventCard from '@/components/dynamics/ChangeEventCard';
import MobilePageHeader from '@/components/MobilePageHeader';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

// Phase 14 — Dynamic Systems: the Event Ledger.
// The permanent, replayable record of every state transition in the workspace.
// Current beliefs are temporary; this timeline is how change itself becomes
// observable and auditable. "Knowledge is not a collection of facts. It is the
// current equilibrium of continuous change."

const FILTERS = [
  { value: 'all', label: 'All transitions' },
  { value: 'memory', label: 'Evidence' },
  { value: 'belief', label: 'Beliefs' },
  { value: 'identity', label: 'Identity' }
];

export default function Dynamics() {
  const { activeWorkspace } = useCognos();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const query = { workspace_id: activeWorkspace.id };
      if (filter !== 'all') query.subject_type = filter;
      const list = await base44.entities.ChangeEvent.filter(query, '-created_date', 100);
      setEvents(list);
    } catch (e) {
      console.error('Failed to load change ledger:', e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, filter]);

  useEffect(() => { load(); }, [load]);

  const counts = events.reduce((acc, e) => {
    acc[e.subject_type] = (acc[e.subject_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      <MobilePageHeader title="Dynamics" />
      <header className="hidden md:flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-medium">Dynamics — Event Ledger</h2>
          <span className="text-xs text-muted-foreground ml-2">Phase 14</span>
        </div>
        <button onClick={load} disabled={loading || !activeWorkspace} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="text-xs font-medium">{loading ? 'Loading…' : 'Refresh'}</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm leading-relaxed text-foreground/80 italic selectable">
              The ledger records transitions, not conclusions. Every belief here was the
              equilibrium at a moment in time — derivable, falsifiable, and reversible.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="h-8 w-[160px] bg-muted border border-border rounded-lg px-2 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTERS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">Evidence {counts.memory || 0}</span>
              <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent">Beliefs {counts.belief || 0}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400">Identity {counts.identity || 0}</span>
            </div>
          </div>

          {loading && events.length === 0 ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <History className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">No transitions recorded yet. Derive beliefs to begin the ledger — every change in evidence and every shift in derived beliefs will appear here as a replayable event.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map(e => <ChangeEventCard key={e.id} event={e} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}