import { Link } from 'react-router-dom';
import { Brain } from 'lucide-react';

// Public About page — describes what COGNOS does, who it's for, and who builds it.
// Kept as plain semantic HTML (h1 + paragraphs) for search indexability.
export default function About() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <span className="font-heading text-xl font-semibold tracking-tight">COGNOS</span>
      </div>

      <h1 className="font-heading text-3xl font-bold mb-6">About COGNOS</h1>

      <div className="space-y-5 text-muted-foreground leading-relaxed">
        <p>
          COGNOS is a modular, intelligent reasoning platform designed to help you manage
          projects, research, and complex tasks through a unified, memory-aware AI workspace.
          Instead of a single chatbot, COGNOS runs a council of specialized AI agents — an
          Observer that classifies intent, a Strategist that plans, Specialists that execute,
          a Critic that reviews, and a Governor that safeguards quality — so every answer is
          reasoned, checked, and grounded rather than guessed.
        </p>
        <p>
          It is built for knowledge workers, researchers, engineers, founders, and anyone
          juggling complex thinking who needs more than a forgetful chat box. COGNOS remembers
          what matters across conversations, and its memory system tracks evidence level and
          volatility, so context stays auditable instead of quietly accumulating assumptions.
          Shared workspaces let teams collaborate with confidence, an activity dashboard keeps
          operations transparent, and an autonomous insights engine surfaces briefings from
          your ongoing work.
        </p>
        <p>
          COGNOS is built by an independent team focused on useful, honest AI. Every interaction
          is shaped by a simple charter — truth, evidence, agency, and dignity — so the system
          reasons with you instead of around you.
        </p>
      </div>

      <div className="mt-8 flex items-center gap-4 text-sm">
        <Link to="/contact" className="text-primary hover:text-primary/80 transition-colors">Get in touch →</Link>
        <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
      </div>
    </div>
  );
}