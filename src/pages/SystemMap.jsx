import { Network } from 'lucide-react';
import CognosCore3D from '@/components/system/CognosCore3D';
import MobilePageHeader from '@/components/MobilePageHeader';

// System Architecture — the COGNOS cognitive core, rendered as a live 3D scene.
// A radiant nexus, a wireframe humanoid presence, and six distinct low-poly
// faculties firing colored beams to the core. Drag to orbit, tap a node to enter.

export default function SystemMap() {
  return (
    <div className="flex flex-col h-full">
      <MobilePageHeader title="System" />
      <header className="hidden md:flex items-center gap-2 px-4 py-3 border-b border-border">
        <Network className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-medium">System Architecture</h2>
        <span className="text-xs text-muted-foreground ml-2">Cognitive Core</span>
      </header>

      <div className="flex-1 overflow-hidden px-4 py-4">
        <div className="max-w-3xl mx-auto h-full flex flex-col gap-3">
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
            <p className="text-xs leading-relaxed text-foreground/80 italic selectable">
              The cognitive core radiates into six faculties. Drag to orbit, tap a node to enter its surface.
            </p>
          </div>
          <div className="relative flex-1 min-h-[460px] rounded-xl overflow-hidden border border-border bg-black">
            <CognosCore3D />
          </div>
        </div>
      </div>
    </div>
  );
}