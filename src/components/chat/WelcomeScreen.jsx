import { Sparkles, BookOpen, Lightbulb, Code } from 'lucide-react';
import { Image } from '@/components/ui/image';

const COGNOS_LOGO = 'https://media.base44.com/images/public/6a65b5729b2fe6a520a0ab97/33193cff0_33519d65130b52f40ef3a4c45c04ff98d2430b231b5b15abfd0b3170de405f121.jpg';

const suggestions = [
  { icon: Sparkles, title: 'Brainstorm ideas', text: 'Help me brainstorm ideas for a new project' },
  { icon: BookOpen, title: 'Explain a concept', text: 'Explain how neural networks work in simple terms' },
  { icon: Lightbulb, title: 'Solve a problem', text: 'What are some strategies for improving productivity?' },
  { icon: Code, title: 'Write code', text: 'Write a Python function to sort a list of dictionaries' },
];

export default function WelcomeScreen({ onSuggestion }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 animate-fade-in">
      <Image
        src={COGNOS_LOGO}
        fittingType="fit"
        className="w-[400px] h-[400px] mb-6 mix-blend-screen"
        alt="COGNOS"
      />
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