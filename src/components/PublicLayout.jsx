import { Link, Outlet } from 'react-router-dom';
import { Brain } from 'lucide-react';

// Public layout for unauthenticated, SEO-indexable pages (About, Contact).
// Minimal header with COGNOS mark and a footer nav linking the public pages
// and the sign-in entry so visitors can reach everything.
export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/about" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="font-heading font-semibold tracking-tight">COGNOS</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</Link>
            <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/login" className="text-primary hover:text-primary/80 transition-colors">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} COGNOS</span>
          <nav className="flex items-center gap-4">
            <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/login" className="hover:text-foreground transition-colors">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}