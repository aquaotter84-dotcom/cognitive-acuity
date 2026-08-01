import { useState, useEffect } from 'react';
import { User, Brain, LogOut, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCognos } from '@/lib/cognosContext';
import MobilePageHeader from '@/components/MobilePageHeader';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

export default function Settings() {
  const { activeWorkspace } = useCognos();
  const [user, setUser] = useState(null);
  const [memoryCount, setMemoryCount] = useState(0);
  const [conversationCount, setConversationCount] = useState(0);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeWorkspace) {
      base44.entities.Memory.filter({ workspace_id: activeWorkspace.id })
        .then(mems => setMemoryCount(mems.length))
        .catch(() => {});
      base44.entities.Conversation.filter({ workspace_id: activeWorkspace.id })
        .then(convs => setConversationCount(convs.length))
        .catch(() => {});
    }
  }, [activeWorkspace?.id]);

  const handleLogout = () => {
    base44.auth.logout('/login');
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-thin">
      <MobilePageHeader title="Settings" />
      <div className="max-w-2xl mx-auto w-full px-4 py-8 pb-24 md:pb-8 space-y-6">
        <h1 className="text-2xl font-bold select-none md:block hidden">Settings</h1>

        <section className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <p className="text-sm font-medium">{user.full_name || 'Not set'}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <p className="text-sm font-medium">{user.email}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Role</label>
              <p className="text-sm font-medium capitalize">{user.role}</p>
            </div>
          </div>
        </section>

        <section className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-accent" />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workspace</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Active workspace</span>
              <span className="text-sm font-medium">{activeWorkspace?.name || 'None'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Conversations</span>
              <span className="text-sm font-medium">{conversationCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Memories stored</span>
              <span className="text-sm font-medium">{memoryCount}</span>
            </div>
          </div>
        </section>

        <section className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">About COGNOS</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            COGNOS is a modular AI reasoning platform with a peer-to-peer multi-agent architecture.
            The Orchestrator Agent decomposes tasks and coordinates with the Memory Agent and Context Assembly Agent
            through a shared TaskContext object — all working silently in the background to deliver intelligent, context-aware responses.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-3">Version 1.0 · Phase 1: Foundation</p>
        </section>

        <section className="flex flex-col sm:flex-row gap-3">
          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors text-sm font-medium">
                <Trash2 className="w-4 h-4" /> Delete Account
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete account permanently?</AlertDialogTitle>
                <AlertDialogDescription>
                  You will be signed out and your account data — including workspaces, conversations, memories, and insights — will be permanently deleted and cannot be recovered. Are you sure?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete &amp; Sign Out
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </div>
    </div>
  );
}