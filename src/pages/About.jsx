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

      <h1 className="font-heading text-3xl font-bold mb-3">About COGNOS</h1>
      <p className="text-muted-foreground mb-8 leading-relaxed">
        <span className="font-heading font-semibold text-foreground">COGNOS</span> — Cognitive
        Operators for Guidance, Navigation, Oversight, and Sovereignty.
      </p>

      <div className="space-y-5 text-muted-foreground leading-relaxed">
        <p>
          COGNOS is a multi-agent reasoning engine built to deliver clarity, structure, and
          breakthrough-level insight. It doesn't imitate conversation. It orchestrates a council
          of cognitive operators that perceive your intent, build structured plans, refine
          their own reasoning, and maintain long-horizon alignment with your goals.
        </p>

        <p>Where most AI apps react, COGNOS thinks.</p>
        <p>Where most AI apps drift, COGNOS aligns.</p>
        <p>Where most AI apps answer, COGNOS reasons.</p>

        <p>
          COGNOS transforms every question, idea, or challenge into a layered reasoning pipeline
          powered by four specialized cognitive operators:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><span className="font-medium text-foreground">Guidance</span> — Extracts intent, identifies entities, and detects gaps with precision.</li>
          <li><span className="font-medium text-foreground">Navigation</span> — Frames problems, generates options, and builds actionable plans.</li>
          <li><span className="font-medium text-foreground">Oversight</span> — Audits reasoning, corrects blind spots, and enforces clarity.</li>
          <li><span className="font-medium text-foreground">Sovereignty</span> — Maintains coherence, direction, and fidelity to your long-term goals.</li>
        </ul>
        <p>
          Together, these operators form a unified intelligence that thinks with you — clearly,
          coherently, and without drift.
        </p>

        <h2 className="font-heading text-xl font-semibold text-foreground mt-8 mb-2">A Council Behind Every Answer</h2>
        <p>
          COGNOS speaks with one outward voice, but every response is shaped by a coordinated
          internal exchange:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Observers analyze your input.</li>
          <li>Strategists structure the problem.</li>
          <li>Critics refine the reasoning.</li>
          <li>Governors enforce alignment.</li>
        </ul>
        <p>
          This multi-agent council ensures every output is structured, corrected, and aligned
          before it reaches you. Activate the optional Reasoning Trace to see how each operator
          contributed to the final decision.
        </p>

        <h2 className="font-heading text-xl font-semibold text-foreground mt-8 mb-2">Aligned to Your Intent — Not Just Your Prompt</h2>
        <p>During onboarding, COGNOS calibrates itself to your goals and thinking style:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Define your objectives.</li>
          <li>Set your horizon (short, long, or mythic).</li>
          <li>Choose depth and strictness.</li>
          <li>Configure agent visibility and tone.</li>
        </ul>
        <p>
          From that moment forward, the Sovereign operator maintains continuity across
          sessions, ensuring the system stays aligned with your direction — not just your last
          question. This is the difference between a chatbot and a cognitive architecture.
        </p>

        <h2 className="font-heading text-xl font-semibold text-foreground mt-8 mb-2">Built for Thinkers, Builders, and Strategists</h2>
        <p>COGNOS excels at:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Strategic planning</li>
          <li>Creative development</li>
          <li>Problem framing</li>
          <li>Decision support</li>
          <li>Cognitive mapping</li>
          <li>Long-horizon reasoning</li>
        </ul>
        <p>
          Whether you're designing a project, navigating a challenge, or exploring an idea,
          COGNOS acts as a layered intelligence engine that amplifies clarity and reduces noise.
        </p>

        <h2 className="font-heading text-xl font-semibold text-foreground mt-8 mb-2">Breakthrough-Oriented Intelligence</h2>
        <p>
          COGNOS is engineered for breakthroughs — the moments when structure emerges from
          chaos, when direction becomes clear, when the next step reveals itself.
        </p>
        <p>This is not reactive intelligence.</p>
        <p>This is evolving intelligence.</p>

        <p className="font-heading text-lg text-foreground mt-8">
          One Voice Outward. Many Minds Underneath.
        </p>
        <p>
          COGNOS is not a chatbot. It is a cognitive council, a principled multi-agent system
          designed to help you think with structure, insight, and sovereign direction.
        </p>
      </div>

      <div className="mt-8 flex items-center gap-4 text-sm">
        <Link to="/contact" className="text-primary hover:text-primary/80 transition-colors">Get in touch →</Link>
        <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
      </div>
    </div>
  );
}