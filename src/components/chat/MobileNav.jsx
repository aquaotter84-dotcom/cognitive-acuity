import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, Brain, FolderKanban, Settings as SettingsIcon } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Chat', icon: MessageSquare },
  { to: '/memory', label: 'Memory', icon: Brain },
  { to: '/workspaces', label: 'Spaces', icon: FolderKanban },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function MobileNav() {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-border bg-card/95 backdrop-blur select-none" style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}>
      <div className="flex items-center justify-around py-2">
        {navItems.map(({ to, label, icon: Icon }) => {
          const isActive = location.pathname === to;
          return (
            <Link key={to} to={to} className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
              <Icon className="w-5 h-5" />
              <span className="text-xs">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}