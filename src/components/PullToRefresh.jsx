import { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// Basic pull-to-refresh for scrollable list views inside a WebView. Tracks a
// downward touch drag that starts at scrollTop === 0; once it crosses the
// threshold the onRefresh callback runs and a spinner shows until it settles.
// Does not transform the content (so position:sticky headers keep working).
export default function PullToRefresh({ onRefresh, children, className }) {
  const scrollRef = useRef(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const THRESHOLD = 70;

  const onTouchStart = (e) => {
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0) { pulling.current = false; return; }
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  };

  const onTouchMove = (e) => {
    if (!pulling.current) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setPull(Math.min(delta * 0.5, 100));
  };

  const onTouchEnd = async () => {
    if (!pulling.current) return;
    pulling.current = false;
    const shouldRefresh = pull >= THRESHOLD && onRefresh && !refreshing;
    if (shouldRefresh) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try { await onRefresh(); } catch (e) { /* ignore */ }
      setRefreshing(false);
    }
    setPull(0);
  };

  const showIndicator = pull > 0 || refreshing;

  return (
    <div
      ref={scrollRef}
      className={cn('relative overflow-y-auto scrollbar-thin', className)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {showIndicator && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-10"
          style={{ height: refreshing ? 40 : pull, opacity: refreshing ? 1 : Math.min(pull / THRESHOLD, 1) }}
        >
          <RefreshCw className={cn('w-5 h-5 text-muted-foreground', refreshing && 'animate-spin')} />
        </div>
      )}
      {children}
    </div>
  );
}