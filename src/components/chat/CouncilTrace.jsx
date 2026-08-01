// Council trace — a collapsible panel rendered under assistant messages that have
// council metadata from chatOrchestrate. Lets the user watch the pipeline reason:
// Observer classification -> Strategist plan -> Specialist sub-tasks -> Critic ->
// revisions -> Governor. Session-only (not persisted on the message).

import { useState } from 'react';
import { ChevronRight, Brain, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';

function Section({ title, children }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 mb-1.5">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-1.5">
      <span className="text-muted-foreground/60">{label}:</span>
      <span className="text-foreground/80">{String(value)}</span>
    </div>
  );
}

export default function CouncilTrace({ council }) {
  const [open, setOpen] = useState(false);
  if (!council) return null;
  const { classification, plan, subTasks, critic, revisions, governor, modelUsed, latencyMs, memoriesUsed } = council || {};
  if (!classification && !plan && !critic) return null;

  const score = critic?.score;
  const summary = [
    classification?.task_type,
    classification?.complexity,
    plan === 'decomposed' ? 'decomposed' : 'direct'
  ].filter(Boolean).join(' • ');

  return (
    <div className="mt-2 border border-border rounded-lg bg-muted/30 text-xs">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
      >
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
        <Brain className="w-3.5 h-3.5 text-accent" />
        <span className="font-medium text-muted-foreground">Council</span>
        <span className="text-muted-foreground/70 truncate flex-1 text-left">{summary}</span>
        {score != null && !critic?.skipped && (
          <span className={`px-1.5 py-0.5 rounded font-medium ${score >= 7 ? 'text-green-400' : score >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>
            {score}/10
          </span>
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/60 pt-3">
          {critic?.charter && (
            <Section title="Charter">
              <div className="flex flex-wrap gap-1.5">
                {['truth', 'evidence', 'agency', 'dignity'].map(p => {
                  const ok = critic.charter[p];
                  return (
                    <span key={p} className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${ok ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
                      {p}
                    </span>
                  );
                })}
              </div>
              {critic.charter.note && <p className="text-muted-foreground">{critic.charter.note}</p>}
            </Section>
          )}
          {Array.isArray(memoriesUsed) && memoriesUsed.length > 0 && (
            <Section title={`Memory (${memoriesUsed.length})`}>
              {memoriesUsed.map(m => {
                const ev = m.evidence;
                const evColor = ev === 'direct' ? 'text-green-400 bg-green-400/10'
                  : ev === 'repeated' ? 'text-primary bg-primary/10'
                  : ev === 'inferred' ? 'text-amber-400 bg-amber-400/10'
                  : ev === 'assumed' ? 'text-red-400 bg-red-400/10' : '';
                return (
                  <div key={m.id} className="flex items-start gap-1.5">
                    {ev && <span className={`mt-0.5 px-1 py-0.5 rounded text-[9px] font-medium uppercase shrink-0 ${evColor}`}>{ev}</span>}
                    <p className="text-muted-foreground/80 leading-relaxed flex-1">{m.preview}</p>
                  </div>
                );
              })}
            </Section>
          )}
          {classification && (
            <Section title="Observer">
              <Field label="Task" value={classification.task_type} />
              <Field label="Complexity" value={classification.complexity} />
              <Field label="Intent" value={classification.intent} />
              {classification.needs_decomposition && (
                <span className="inline-block px-1.5 py-0.5 rounded bg-accent/15 text-accent">needs decomposition</span>
              )}
            </Section>
          )}

          {plan && (
            <Section title="Strategist">
              <Field label="Plan" value={plan} />
            </Section>
          )}

          {Array.isArray(subTasks) && subTasks.length > 0 && (
            <Section title={`Specialist (${subTasks.length})`}>
              {subTasks.map((st, i) => (
                <div key={st.id || i} className="rounded-md border border-border/60 p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium uppercase text-[10px]">{st.agent}</span>
                    <span className={`text-[10px] ${st.status === 'complete' ? 'text-green-400' : st.status === 'error' ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {st.status}
                    </span>
                  </div>
                  <p className="text-muted-foreground mb-1">{st.description}</p>
                  {st.output && <p className="text-foreground/70 line-clamp-4 whitespace-pre-wrap">{st.output}</p>}
                </div>
              ))}
            </Section>
          )}

          {critic && (
            <Section title="Critic">
              {critic.skipped ? (
                <span className="text-muted-foreground">skipped ({critic.reason})</span>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    {score != null && <span className="px-1.5 py-0.5 rounded font-medium bg-muted text-foreground">Score {score}/10</span>}
                    {critic.needs_revision && (
                      <span className="flex items-center gap-1 text-red-400"><AlertTriangle className="w-3 h-3" />needs revision</span>
                    )}
                  </div>
                  {critic.reasoning && <p className="text-muted-foreground">{critic.reasoning}</p>}
                </>
              )}
            </Section>
          )}

          {revisions && revisions.triggered && (
            <Section title="Revisions">
              <span className="flex items-center gap-1 text-muted-foreground">
                <RefreshCw className="w-3 h-3" /> {revisions.count} of {revisions.maxRevisions} revision{revisions.count !== 1 ? 's' : ''} applied
              </span>
            </Section>
          )}

          {governor && (
            <Section title="Governor">
              {governor.approved ? (
                <span className="flex items-center gap-1 text-green-400"><ShieldCheck className="w-3 h-3" /> approved</span>
              ) : (
                <span className="flex items-center gap-1 text-yellow-400"><ShieldCheck className="w-3 h-3" /> flagged</span>
              )}
              {Array.isArray(governor.flags) && governor.flags.length > 0 && (
                <p className="text-muted-foreground">{governor.flags.join(', ')}</p>
              )}
            </Section>
          )}

          <div className="flex items-center gap-3 text-muted-foreground/70 pt-1 border-t border-border/60">
            {modelUsed && <span>model: {modelUsed}</span>}
            {latencyMs != null && <span>{(latencyMs / 1000).toFixed(1)}s</span>}
          </div>
        </div>
      )}
    </div>
  );
}