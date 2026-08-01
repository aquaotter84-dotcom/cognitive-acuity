import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function MobilePageHeader({ title }) {
  const navigate = useNavigate();
  return (
    <header
      className="md:hidden sticky top-0 z-30 flex items-center gap-1 px-3 pb-2 border-b border-border bg-card/95 backdrop-blur select-none"
      style={{ paddingTop: 'env(safe-area-inset-top, 12px)' }}
    >
      <button
        onClick={() => navigate('/')}
        className="p-2 -ml-1 rounded-lg hover:bg-muted transition-colors"
        aria-label="Back to chat"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h2 className="text-base font-semibold flex-1 truncate">{title}</h2>
    </header>
  );
}