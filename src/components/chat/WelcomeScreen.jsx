import { Brain, Sparkles, BookOpen, Lightbulb, Code } from 'lucide-react';

const suggestions = [
  { icon: Sparkles, title: 'Brainstorm ideas', text: 'Help me brainstorm ideas for a new project' },
  { icon: BookOpen, title: 'Explain a concept', text: 'Explain how neural networks work in simple terms' },
  { icon: Lightbulb, title: 'Solve a problem', text: 'What are some strategies for improving productivity?' },
  { icon: Code, title: 'Write code', text: 'Write a Python function to sort a list of dictionaries' },
];

export default function WelcomeScreen({ onSuggestion }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6">
        <Brain className="w-9 h-9 text-white" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Welcome to COGNOS</h1>
      <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
        Your intelligent AI reasoning assistant. Start a conversation or try one of the suggestions below.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
        {suggestions.map(({ icon: Icon, title, text }) => (
          <button
            key={title}
            onClick={() => onSuggestion(text)}
            className="flex flex-col gap-1 p-4 rounded-xl border border-border bg-card/50 hover:bg-card hover:border-primary/30 transition-all text-left"
          >
            <Icon className="w-5 h-5 text-primary mb-1" />
            <span className="text-sm font-medium">{title}</span>
            <span className="text-xs text-muted-foreground line-clamp-1">{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}