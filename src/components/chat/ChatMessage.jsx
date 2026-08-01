import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import CouncilTrace from '@/components/chat/CouncilTrace';

export default function ChatMessage({ message, council }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
      <div className="flex-1 group min-w-0">
        <div className="bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-3 last:mb-0 text-sm leading-relaxed">{children}</p>,
              code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{children}</code>,
              pre: ({ children }) => <pre className="bg-muted p-3 rounded-lg overflow-x-auto mb-3 text-xs">{children}</pre>,
              ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-sm">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-sm">{children}</ol>,
              h1: ({ children }) => <h1 className="text-base font-semibold mb-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-sm font-semibold mb-2">{children}</h2>,
              a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        {council && <CouncilTrace council={council} />}
        <button onClick={handleCopy} className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}