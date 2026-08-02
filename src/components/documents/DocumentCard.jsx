import { useState } from 'react';
import { FileText, Image as ImageIcon, Music, Video, Trash2, ChevronDown, ChevronUp, Loader2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { Image } from '@/components/ui/image';

const SOURCE_LABEL = { upload: 'Upload', drive: 'Drive', camera: 'Camera', screen: 'Screen', audio: 'Audio' };

const TYPE_ICON = {
  document: FileText,
  spreadsheet: FileSpreadsheet,
  image: ImageIcon,
  audio: Music,
  video: Video,
  other: FileText
};

export default function DocumentCard({ doc, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TYPE_ICON[doc.file_type] || FileText;
  const isImage = doc.file_type === 'image' && doc.file_url;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      <div className="p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          {isImage ? (
            <Image src={doc.file_url} fittingType="fill" className="w-10 h-10 rounded-lg" alt={doc.name} />
          ) : (
            <Icon className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium truncate">{doc.name}</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">{SOURCE_LABEL[doc.source] || doc.source}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {doc.status === 'processing' && <span className="flex items-center gap-1 text-xs text-primary"><Loader2 className="w-3 h-3 animate-spin" /> Analyzing…</span>}
            {doc.status === 'error' && <span className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="w-3 h-3" /> Failed</span>}
            {doc.status === 'complete' && <span className="text-xs text-muted-foreground">{doc.file_type}</span>}
          </div>
        </div>
        <button onClick={() => onDelete(doc)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {doc.status === 'complete' && (
        <div className="px-4 pb-4">
          {doc.analysis && (
            <div className="text-sm text-foreground/90 leading-relaxed mb-2">
              {doc.analysis.split('\n').map((line, i) => <p key={i} className={line.trim() ? '' : 'h-2'}>{line}</p>).slice(0, expanded ? undefined : 6)}
            </div>
          )}
          {doc.extracted_content && (
            <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-1 text-xs text-primary hover:underline">
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Hide extracted content' : 'Show extracted content'}
            </button>
          )}
          {expanded && doc.extracted_content && (
            <pre className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 max-h-64 overflow-auto scrollbar-thin whitespace-pre-wrap">{doc.extracted_content}</pre>
          )}
        </div>
      )}

      {doc.status === 'error' && doc.error_message && (
        <div className="px-4 pb-4 text-xs text-destructive">{doc.error_message}</div>
      )}
    </div>
  );
}