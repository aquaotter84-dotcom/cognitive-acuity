import { Network } from 'lucide-react';
import HexSystemMap from '@/components/system/HexSystemMap';
import MobilePageHeader from '@/components/MobilePageHeader';

// System Architecture — the COGNOS cognitive map. A navigational hub-and-spoke
// view of the platform's faculties, rendered as a glowing hexagonal network.

export default function SystemMap() {
  return (
    <div className="flex flex-col h-full">
      <MobilePageHeader title="System" />
      <header className="hidden md:flex items-center gap-2 px-4 py-3 border-b border-border">
        <Network className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-medium">System Architecture</h2>
        <span className="text-xs text-muted-foreground ml-2">COGNOS Core</span>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
            <p className="text-sm leading-relaxed text-foreground/80 italic selectable">
              The cognitive core radiates into six faculties. Each node is a live surface — tap to enter.
            </p>
          </div>
          <HexSystemMap />
        </div>
      </div>
    </div>
  );
}