import { useState } from 'react';
import { ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, Scale } from 'lucide-react';

const CATEGORY_STYLES = {
  identity: 'bg-primary/15 text-primary',
  preference: 'bg-accent/15 text-accent',
  goal: 'bg-chart-3/15 text-chart-3',
  knowledge: 'bg-chart-4/15 text-chart-4',
  behavior: 'bg-chart-5/15 text-chart-5'
};

function confidenceColor(c) {
  if (c >= 0.7) return 'bg-primary';
  if (c >= 0.4) return 'bg-chart-4';
  return 'bg-destructive';
}

function EvidenceList({ label, items, tone }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-1">
      <span className={`text-xs font-medium ${tone}`}>{label} ({items.length})</span>
      {items.map((e, i) => (
        <div key={i} className="text-xs text-muted-foreground pl-2 border-l border-border">
          {e.quote || `#${e.id?.slice(-6) || i}`}
        </div>
      ))}
    </div>
  );
}

export default function BeliefCard({ belief }) {
  const [expanded, setExpanded] = useState(false);
  const confidence = Math.max(0, Math.min(1, Number(belief.confidence) || 0));
  const cat = belief.category || 'knowledge';

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-snug">{belief.claim}</p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap ${CATEGORY_STYLES[cat] || CATEGORY_STYLES.knowledge}`}>{cat}</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={`h-full ${confidenceColor(confidence)}`} style={{ width: `${Math.round(confidence * 100)}%` }} />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{Math.round(confidence * 100)}%</span>
      </div>

      <button onClick={() => setExpanded(v => !v)} className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline">
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? 'Hide trace' : 'Show evidence & trace'}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className="flex items-start gap-2">
            <Scale className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-foreground/80"><span className="text-muted-foreground">Rationale: </span>{belief.rationale || '—'}</p>
          </div>
          <EvidenceList label="Supporting" items={belief.supporting_evidence} tone="text-primary" />
          <EvidenceList label="Contradicting" items={belief.contradicting_evidence} tone="text-destructive" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {belief.contradicting_evidence?.length ? <ShieldAlert className="w-3.5 h-3.5 text-destructive" /> : <ShieldCheck className="w-3.5 h-3.5 text-primary" />}
            <span>Last challenged: {belief.last_challenged || 'untested'}</span>
          </div>
        </div>
      )}
    </div>
  );
}