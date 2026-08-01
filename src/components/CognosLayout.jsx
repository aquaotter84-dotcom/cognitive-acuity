import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CognosContext } from '@/lib/cognosContext';
import Sidebar from '@/components/chat/Sidebar';
import MobileNav from '@/components/chat/MobileNav';

export default function CognosLayout() {
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        setCurrentUser(me);
        let workspaces = await base44.entities.Workspace.list();
        if (workspaces.length === 0) {
          const ws = await base44.entities.Workspace.create({
            name: 'Personal',
            description: 'Your default workspace',
            is_default: true,
            color: '#3B82F6',
            icon: 'Brain',
            member_ids: [me.id],
            member_emails: [me.email]
          });
          workspaces = [ws];
        }
        setActiveWorkspace(workspaces.find(w => w.is_default) || workspaces[0]);
      } catch (e) {
        console.error('Failed to initialize workspace:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const convs = await base44.entities.Conversation.filter(
        { workspace_id: activeWorkspace.id },
        '-updated_date',
        50
      );
      setConversations(convs);
    } catch (e) {
      console.error('Failed to load conversations:', e);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <CognosContext.Provider value={{
      activeWorkspace, setActiveWorkspace,
      currentUser,
      conversations, refreshConversations,
      activeConversationId, setActiveConversationId,
      openSidebar: () => setSidebarOpen(true),
      closeSidebar: () => setSidebarOpen(false)
    }}>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        <div className="hidden md:flex w-[280px] flex-col border-r border-border bg-card/30">
          <Sidebar />
        </div>

        {isSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-card border-r border-border animate-fade-in" style={{ paddingTop: 'env(safe-area-inset-top, 12px)' }}>
              <Sidebar onNavigate={() => setSidebarOpen(false)} />
            </div>
          </div>
        )}

        <main className="flex-1 flex flex-col overflow-hidden pb-[calc(env(safe-area-inset-bottom,12px)+56px)] md:pb-0" style={{ paddingTop: 'env(safe-area-inset-top, 12px)' }}>
          <Outlet />
        </main>
      </div>

      <MobileNav />
    </CognosContext.Provider>
  );
}