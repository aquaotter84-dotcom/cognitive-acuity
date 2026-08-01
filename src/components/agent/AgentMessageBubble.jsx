import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const STATUS = {
  pending: { icon: Loader2, label: 'Pending', spin: true, cls: 'text-muted-foreground' },
  running: { icon: Loader2, label: 'Running', spin: true, cls: 'text-muted-foreground' },
  in_progress: { icon: Loader2, label: 'In progress', spin: true, cls: 'text-muted-foreground' },
  completed: { icon: CheckCircle2, label: 'Done', cls: 'text-primary' },
  success: { icon: CheckCircle2, label: 'Done', cls: 'text-primary' },
  failed: { icon: XCircle, label: 'Failed', cls: 'text-destructive' },
  error: { icon: XCircle, label: 'Error', cls: 'text-destructive' }
};

function isFailed(tc) {
  if (['failed', 'error'].includes(tc.status)) return true;
  const r = tc.results;
  if (typeof r === 'string') return /error|failed/i.test(r);
  if (r && typeof r === 'object' && r.success === false) return true;
  return false;
}

export default function AgentMessageBubble({ message }) {
  const [expanded, setExpanded] = useState({});
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end animate-message-in">
        <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-message-in">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-white">C</span>
      </div>
      <div className="flex-1 min-w-0">
        {message.content && (
          <div className="bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3">
            <ReactMarkdown components={{
              p: ({ children }) => <p className="mb-3 last:mb-0 text-sm leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-sm">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-sm">{children}</ol>,
              pre: ({ children }) => <pre className="bg-muted p-3 rounded-lg overflow-x-auto mb-3 text-xs">{children}</pre>,
              code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{children}</code>,
              h1: ({ children }) => <h1 className="text-base font-semibold mb-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-sm font-semibold mb-2">{children}</h2>
            }}>{message.content}</ReactMarkdown>
          </div>
        )}
        {(message.tool_calls || []).map((tc, i) => {
          const failed = isFailed(tc);
          const st = STATUS[tc.status] || STATUS.completed;
          const Icon = st.icon;
          const proj = tc.display_projection || {};
          const hideDetails = proj.hide_details && proj.details_redacted;
          const key = `${tc.name}_${i}`;
          let parsedArgs = tc.arguments_string;
          try { parsedArgs = JSON.parse(tc.arguments_string); } catch {}
          let parsedRes = tc.results;
          if (typeof parsedRes === 'string') { try { parsedRes = JSON.parse(parsedRes); } catch {} }

          return (
            <div key={i} className="mt-2 text-xs border border-border rounded-lg bg-muted/40 px-3 py-2">
              <button
                onClick={() => setExpanded(s => ({ ...s, [key]: !s[key] }))}
                className="flex items-center gap-2 w-full"
              >
                <Icon className={`w-3.5 h-3.5 ${st.spin ? 'animate-spin' : ''} ${failed ? 'text-destructive' : st.cls}`} />
                <span className="font-medium">{tc.name || 'tool'}</span>
                <span className={failed ? 'text-destructive' : 'text-muted-foreground'}>
                  {failed ? (proj.error_label || 'Failed') : (st.spin ? (proj.active_label || st.label) : (proj.label || st.label))}
                </span>
                {!hideDetails && (expanded[key]
                  ? <ChevronUp className="w-3 h-3 ml-auto" />
                  : <ChevronDown className="w-3 h-3 ml-auto" />)}
              </button>
              {!hideDetails && expanded[key] && (
                <div className="mt-2 space-y-1.5 font-mono text-[11px]">
                  <div>
                    <span className="text-muted-foreground">args:</span>
                    <pre className="whitespace-pre-wrap break-all mt-0.5">{typeof parsedArgs === 'string' ? parsedArgs : JSON.stringify(parsedArgs, null, 2)}</pre>
                  </div>
                  {parsedRes !== undefined && (
                    <div>
                      <span className="text-muted-foreground">result:</span>
                      <pre className="whitespace-pre-wrap break-all mt-0.5">{typeof parsedRes === 'string' ? parsedRes : JSON.stringify(parsedRes, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}