import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip } from 'lucide-react';

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  }, [text]);

  return (
    <div className="border-t border-border bg-background/95 backdrop-blur p-4">
      <div className="max-w-3xl mx-auto flex items-end gap-2 bg-card border border-border rounded-2xl p-2 focus-within:border-primary/50 transition-colors">
        <button disabled className="p-2 text-muted-foreground/40 cursor-not-allowed">
          <Paperclip className="w-4 h-4" />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message COGNOS..."
          rows={1}
          className="flex-1 bg-transparent resize-none outline-none text-sm py-2 placeholder:text-muted-foreground/60 scrollbar-thin"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="p-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}