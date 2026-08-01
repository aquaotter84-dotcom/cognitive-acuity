import { useState, useEffect, useRef } from 'react';
import { Menu } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCognos } from '@/lib/cognosContext';
import ChatMessage from '@/components/chat/ChatMessage';
import ChatInput from '@/components/chat/ChatInput';
import WelcomeScreen from '@/components/chat/WelcomeScreen';

export default function Chat() {
  const { activeWorkspace, currentUser, activeConversationId, setActiveConversationId, refreshConversations, openSidebar } = useCognos();
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [councilTraces, setCouncilTraces] = useState({});
  const [conversationSummary, setConversationSummary] = useState(null);
  const [style, setStyle] = useState('balanced');
  const [streaming, setStreaming] = useState(null);
  const abortRef = useRef(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (activeConversationId) {
      base44.entities.Message.filter({ conversation_id: activeConversationId }, 'created_date', 50)
        .then(msgs => setMessages(msgs))
        .catch(() => setMessages([]));
      base44.entities.Conversation.get(activeConversationId)
        .then(c => setConversationSummary(c?.summary || null))
        .catch(() => setConversationSummary(null));
    } else {
      setMessages([]);
      setConversationSummary(null);
    }
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleSend = async (text) => {
    if (!activeWorkspace || isProcessing) return;

    let convId = activeConversationId;
    let isNew = false;
    const memberIds = activeWorkspace.member_ids?.length ? activeWorkspace.member_ids : [currentUser.id];

    if (!convId) {
      const conv = await base44.entities.Conversation.create({
        title: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
        workspace_id: activeWorkspace.id,
        last_message_preview: text,
        member_ids: memberIds
      });
      convId = conv.id;
      setActiveConversationId(convId);
      isNew = true;
    }

    const userMsg = await base44.entities.Message.create({
      conversation_id: convId,
      workspace_id: activeWorkspace.id,
      role: 'user',
      content: text,
      processing_status: 'complete',
      member_ids: memberIds
    });
    setMessages(prev => [...prev, userMsg]);

    if (!isNew) {
      await base44.entities.Conversation.update(convId, {
        last_message_preview: text
      });
    }

    setIsProcessing(true);
    abortRef.current = false;

    try {
      const result = await base44.functions.invoke('chatOrchestrate', {
        conversationId: convId,
        workspaceId: activeWorkspace.id,
        userMessage: text,
        style
      });

      if (abortRef.current) return;

      const { response: aiResponse, taskType, modelUsed, latencyMs, council, summary } = result.data;

      const assistantMsg = await base44.entities.Message.create({
        conversation_id: convId,
        workspace_id: activeWorkspace.id,
        role: 'assistant',
        content: aiResponse,
        model_used: modelUsed,
        task_type: taskType,
        processing_status: 'complete',
        member_ids: memberIds
      });
      setMessages(prev => [...prev, assistantMsg]);
      if (council) {
        setCouncilTraces(prev => ({ ...prev, [assistantMsg.id]: { ...council, modelUsed, taskType, latencyMs } }));
      }
      if (summary) setConversationSummary(summary);

      await base44.entities.Conversation.update(convId, {
        last_message_preview: aiResponse.slice(0, 100)
      });

      refreshConversations();

      setStreaming({ id: assistantMsg.id, full: aiResponse, revealed: '', done: false });
    } catch (error) {
      const errDetail = error?.data?.error || error?.message || 'Unknown error';
      const errorMsg = await base44.entities.Message.create({
        conversation_id: convId,
        workspace_id: activeWorkspace.id,
        role: 'assistant',
        content: `⚠️ **Error:** ${errDetail}\n\nPlease check your API key in Settings or try again.`,
        processing_status: 'error',
        member_ids: memberIds
      });
      setMessages(prev => [...prev, errorMsg]);
      setStreaming(null);
      setIsProcessing(false);
    }
  };

  const handleStop = () => {
    abortRef.current = true;
    if (streaming && !streaming.done) {
      const partial = streaming.revealed;
      setMessages(prev => prev.map(m => (m.id === streaming.id ? { ...m, content: partial } : m)));
      base44.entities.Message.update(streaming.id, { content: partial }).catch(() => {});
    }
    setStreaming(null);
    setIsProcessing(false);
  };

  useEffect(() => {
    if (!streaming) return;
    if (streaming.revealed.length >= streaming.full.length) {
      const t = setTimeout(() => {
        setStreaming(null);
        setIsProcessing(false);
      }, 80);
      return () => clearTimeout(t);
    }
    const chunk = Math.max(2, Math.ceil(streaming.full.length / 72));
    const t = setTimeout(() => {
      setStreaming(s => (s ? { ...s, revealed: s.full.slice(0, s.revealed.length + chunk) } : s));
    }, 16);
    return () => clearTimeout(t);
  }, [streaming]);

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={openSidebar} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-muted transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium truncate">{activeWorkspace?.name || 'COGNOS'}</h2>
          {conversationSummary && <p className="text-xs text-muted-foreground truncate">{conversationSummary}</p>}
        </div>
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          disabled={isProcessing}
          className="text-xs bg-muted border border-border rounded-lg px-2 py-1.5 text-muted-foreground hover:text-foreground focus:outline-none focus:border-primary/50 disabled:opacity-50 cursor-pointer"
          title="Communication style"
        >
          <option value="balanced">Balanced</option>
          <option value="casual">Casual</option>
          <option value="technical">Technical</option>
          <option value="strategic">Strategic</option>
        </select>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {messages.length === 0 && !isProcessing ? (
          <WelcomeScreen onSuggestion={handleSend} />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map(msg => (
              <ChatMessage
                key={msg.id}
                message={msg}
                council={councilTraces[msg.id]}
                streamingText={streaming && streaming.id === msg.id ? streaming.revealed : null}
                isStreaming={streaming && streaming.id === msg.id && !streaming.done}
              />
            ))}
            {isProcessing && !streaming && (
              <div className="flex gap-3 animate-fade-in">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white">C</span>
                </div>
                <div className="flex items-center gap-1.5 py-3">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse" />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse" style={{ animationDelay: '0.15s' }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse" style={{ animationDelay: '0.3s' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <ChatInput onSend={handleSend} disabled={!activeWorkspace} isProcessing={isProcessing} onStop={handleStop} />
    </div>
  );
}