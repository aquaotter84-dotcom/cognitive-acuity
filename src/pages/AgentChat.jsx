import { useState, useEffect, useRef } from 'react';
import { Menu, Send, Plus, Sparkles, Loader2, Paperclip } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCognos } from '@/lib/cognosContext';
import AgentMessageBubble from '@/components/agent/AgentMessageBubble';

const AGENT = 'cognos';

export default function AgentChat() {
  const { openSidebar } = useCognos();
  const [activeId, setActiveId] = useState(null);
  const [active, setActive] = useState(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  const [fileUrls, setFileUrls] = useState([]);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const res = await base44.integrations.Core.UploadFile({ file });
        if (res?.file_url) urls.push(res.file_url);
      }
      setFileUrls(prev => [...prev, ...urls]);
    } catch (e) { console.error(e); }
    setUploading(false);
  };

  // On mount: load agent conversations, or create the first one.
  useEffect(() => {
    (async () => {
      try {
        const convs = await base44.agents.listConversations({ agent_name: AGENT });
        if (convs && convs.length) {
          setActiveId(convs[0].id);
        } else {
          const c = await base44.agents.createConversation({ agent_name: AGENT, metadata: { name: 'COGNOS agent' } });
          setActiveId(c.id);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  // Subscribe to the active conversation.
  useEffect(() => {
    if (!activeId) { setActive(null); return; }
    let unsub = null;
    (async () => {
      try {
        const conv = await base44.agents.getConversation(activeId);
        setActive(conv);
      } catch (e) {
        console.error(e);
      }
      try {
        unsub = base44.agents.subscribeToConversation(activeId, (data) => {
          setActive(prev => ({ ...(prev || {}), id: activeId, messages: data.messages }));
        });
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { try { unsub && unsub(); } catch {} };
  }, [activeId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [active?.messages]);

  const newSession = async () => {
    try {
      const c = await base44.agents.createConversation({ agent_name: AGENT, metadata: { name: 'COGNOS agent' } });
      setActiveId(c.id);
    } catch (e) { console.error(e); }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    setInput('');
    try {
      const conv = await base44.agents.addMessage(active, { role: 'user', content: text, ...(fileUrls.length ? { file_urls: fileUrls } : {}) });
      setActive(conv);
      setFileUrls([]);
    } catch (e) {
      console.error(e);
      setInput(text);
    }
    setSending(false);
  };

  const messages = active?.messages || [];

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={openSidebar} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-muted transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> COGNOS Agent</h2>
          <p className="text-xs text-muted-foreground truncate">Ecosystem surface — a tool-using agent with memory & autonomous deliberation.</p>
        </div>
        <button onClick={newSession} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
          <Plus className="w-3.5 h-3.5" /> New session
        </button>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Ask COGNOS anything — it can read your memories and trigger autonomous deliberations.</p>
            </div>
          ) : messages.map(m => <AgentMessageBubble key={m.id} message={m} />)}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-border bg-background/95 backdrop-blur p-4">
        {fileUrls.length > 0 && (
          <div className="max-w-3xl mx-auto mb-2 text-xs text-muted-foreground">{fileUrls.length} attachment(s) ready</div>
        )}
        <div className="max-w-3xl mx-auto flex items-end gap-2 bg-card border border-border rounded-2xl p-2 focus-within:border-primary/50 transition-colors">
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors" title="Attach files or images">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Message the COGNOS agent..."
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-sm py-2 px-1 placeholder:text-muted-foreground/60 scrollbar-thin"
          />
          <button onClick={send} disabled={!input.trim() || sending} className="p-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}