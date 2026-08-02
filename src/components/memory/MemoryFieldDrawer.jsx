import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

// A native-feeling picker for memory fields. On mobile it opens a vaul bottom
// drawer; on desktop it falls back to a plain <select> so keyboard/pointer
// users keep the compact inline control.
export default function MemoryFieldDrawer({ value, onChange, options, title, className }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const current = options.find(o => String(o.value) === String(value));

  if (!isMobile) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn('focus:outline-none focus:border-accent/50', className)}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          className={cn('inline-flex items-center gap-1 text-left focus:outline-none focus:border-accent/50', className)}
        >
          <span className="truncate">{current?.label ?? 'Select'}</span>
          <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
        </button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[60vh]">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle>{title ?? 'Select'}</DrawerTitle>
        </DrawerHeader>
        <div className="px-3 pb-6 overflow-y-auto scrollbar-thin">
          {options.map(o => {
            const selected = String(o.value) === String(value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-colors',
                  selected ? 'bg-accent/15 text-accent' : 'hover:bg-muted'
                )}
              >
                <span>{o.label}</span>
                {selected && <Check className="w-4 h-4" />}
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}