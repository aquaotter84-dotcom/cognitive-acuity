import { useState, useCallback } from 'react';
import { Brain, RefreshCw, Sparkles, Info } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCognos } from '@/lib/cognosContext';
import BeliefCard from '@/components/beliefs/BeliefCard';
import MobilePageHeader from '@/components/MobilePageHeader';

export default function Beliefs() {
  const { activeWorkspace } = useCognos();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const derive = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('deriveBeliefs', { workspaceId: activeWorkspace.id });
      setResult(res.data);
    } catch (e) {
      setError(e?.data?.error || e?.message || 'Derivation failed');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  // Derivation is on-demand, not on every load — intelligence is economic (Phase 13).
  // useEffect intentionally omitted: the user clicks "Derive" to spend the LLM call.

  const beliefs = result?.beliefs || [];
  const identity = result?.identity;

  return (
    <div className="flex flex-col h-full">
      <MobilePageHeader title="Beliefs" />
      <header className="hidden md:flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-medium">Cognition — Derived Beliefs</h2>
        </div>
        <button onClick={derive} disabled={loading || !activeWorkspace} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="text-xs font-medium">{loading ? 'Deriving…' : 'Re-derive'}</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-medium">Who am I?</h3>
            </div>
            <button onClick={derive} disabled={loading || !activeWorkspace} className="md:hidden flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-xs">{loading ? 'Deriving…' : 'Re-derive'}</span>
            </button>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm leading-relaxed text-foreground/90 italic">
              {loading && !identity ? 'Reconstructing identity from evidence…' : (identity || 'No identity could be inferred from the available evidence yet.')}
            </p>
          </div>

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            Beliefs are derived, not stored. Each is falsifiable — traceable to the evidence that supports or contradicts it, with a confidence score. Re-deriving reconstructs them from current evidence.
          </p>

          <div className="flex items-center justify-between pt-2">
            <h3 className="text-sm font-medium">Derived Beliefs</h3>
            <span className="text-xs text-muted-foreground">{beliefs.length} · {result?.evidenceCount ?? 0} evidence</span>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          {loading && beliefs.length === 0 ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : beliefs.length === 0 && !loading ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">No beliefs derived yet. Reconstruct falsifiable beliefs from your conversation evidence.</p>
              <button onClick={derive} disabled={!activeWorkspace} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm font-medium">Derive beliefs</button>
            </div>
          ) : (
            <div className="space-y-3">
              {beliefs.map((b, i) => <BeliefCard key={i} belief={b} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}