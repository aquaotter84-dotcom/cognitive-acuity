import { FileText, Atom, User, Share2, ArrowRight, History } from 'lucide-react';
import moment from 'moment';

// One row in the Phase 14 Event Ledger. Renders a transition: what changed,
// from→to, the numeric delta, the cause, and — when cause_metadata is present —
// the deterministic drivers that explain WHY (the answer to "why did this belief
// change?"). Color is by subject kind so the timeline reads as evidence / belief /
// relationship / identity bands.

const GROUP = {
  memory: { Icon: FileText, color: 'text-primary', chip: 'bg-primary/10 text-primary' },
  belief: { Icon: Atom, color: 'text-accent', chip: 'bg-accent/10 text-accent' },
  relationship: { Icon: Share2, color: 'text-chart-4', chip: 'bg-chart-4/10 text-chart-4' },
  identity: { Icon: User, color: 'text-emerald-400', chip: 'bg-emerald-400/10 text-emerald-400' }
};

const VERB = {
  evidence_added: 'Evidence added',
  evidence_removed: 'Evidence removed',
  evidence_reweighted: 'Evidence reweighted',
  belief_emerged: 'Belief emerged',
  belief_revised: 'Belief revised',
  belief_collapsed: 'Belief collapsed',
  relationship_formed: 'Relationship formed',
  relationship_broken: 'Relationship broken',
  identity_established: 'Identity established',
  identity_revised: 'Identity revised'
};

function fmtState(state) {
  if (!state) return '—';
  if (typeof state.confidence === 'number') return `${(state.confidence * 100).toFixed(0)}%`;
  if (typeof state.weight === 'number') return `${state.type || ''} ${state.weight.toFixed(2)}`.trim();
  if (typeof state.importance === 'number') return `imp ${state.importance}${state.evidence_level ? ' · ' + state.evidence_level : ''}`;
  if (state.identity) return 'identity';
  return '·';
}

export default function ChangeEventCard({ event, onTrace }) {
  const g = GROUP[event.subject_type] || GROUP.memory;
  const Icon = g.Icon;
  const delta = typeof event.delta === 'number' ? event.delta : 0;
  const deltaStr = delta > 0 ? `+${delta.toFixed(delta % 1 ? 2 : 0)}` : delta < 0 ? `${delta.toFixed(delta % 1 ? 2 : 0)}` : '';
  const emerged = !event.from_state;
  const collapsed = !event.to_state;
  const drivers = (event.cause_metadata && Array.isArray(event.cause_metadata.drivers)) ? event.cause_metadata.drivers : [];
  const hasMeta = !!event.cause_metadata && event.subject_type === 'belief';

  return (
    <div className="rounded-xl border border-border bg-card/40 px-3 py-3 hover:bg-card/60 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg ${g.chip} flex items-center justify-center`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs font-medium ${g.color}`}>{VERB[event.event_type] || event.event_type}</span>
            <span className="text-[10px] text-muted-foreground/70 flex-shrink-0">{moment(event.created_date).fromNow()}</span>
          </div>
          {event.subject_label && event.subject_type !== 'identity' && (
            <p className="text-sm text-foreground/90 mt-1 line-clamp-2 selectable">{event.subject_label}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
            <span className={emerged ? 'text-muted-foreground/50' : ''}>{fmtState(event.from_state)}</span>
            <ArrowRight className="w-3 h-3 flex-shrink-0" />
            <span className={collapsed ? 'text-destructive' : 'text-foreground/80'}>{fmtState(event.to_state)}</span>
            {deltaStr && (
              <span className={`ml-1 font-medium ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {deltaStr}
              </span>
            )}
          </div>

          {hasMeta && (
            <div className="mt-2 rounded-lg bg-muted/40 border border-border/60 px-2 py-1.5 space-y-1">
              {typeof event.cause_metadata.base_prev === 'number' && typeof event.cause_metadata.base_now === 'number' && (
                <p className="text-[10px] text-muted-foreground">
                  base {(event.cause_metadata.base_prev * 100).toFixed(0)}% → {(event.cause_metadata.base_now * 100).toFixed(0)}%
                  {typeof event.cause_metadata.propagation_delta === 'number' && (
                    <span className={event.cause_metadata.propagation_delta >= 0 ? 'text-primary' : 'text-destructive'}>
                      {' · '}propagation {event.cause_metadata.propagation_delta >= 0 ? '+' : ''}{event.cause_metadata.propagation_delta.toFixed(2)}
                    </span>
                  )}
                </p>
              )}
              {drivers.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px]">
                  <span className={`px-1.5 py-0.5 rounded ${d.relationship === 'contradicts' ? 'bg-destructive/10 text-destructive' : d.relationship === 'depends_on' ? 'bg-chart-5/10 text-chart-5' : 'bg-primary/10 text-primary'}`}>
                    {d.relationship}
                  </span>
                  <span className="text-foreground/70 truncate flex-1 selectable">"{String(d.subject_label || '').slice(0, 50)}"</span>
                  <span className={d.contribution >= 0 ? 'text-emerald-400' : 'text-destructive'}>
                    {d.contribution >= 0 ? '+' : ''}{d.contribution.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {event.cause && !hasMeta && (
            <p className="text-[10px] text-muted-foreground/60 mt-1 italic">{event.cause}</p>
          )}

          {event.subject_type === 'belief' && onTrace && (
            <button
              onClick={() => onTrace(event.subject_id, event.subject_label)}
              className="mt-2 text-[10px] text-accent/80 hover:text-accent flex items-center gap-1 transition-colors"
            >
              <History className="w-3 h-3" /> Trace confidence history
            </button>
          )}
        </div>
      </div>
    </div>
  );
}