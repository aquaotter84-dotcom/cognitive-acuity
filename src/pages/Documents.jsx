import { useState, useEffect, useCallback } from 'react';
import { FileText, FolderOpen } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCognos } from '@/lib/cognosContext';
import DocumentUploader from '@/components/documents/DocumentUploader';
import DocumentCard from '@/components/documents/DocumentCard';
import { extractContent, analyzeFile } from '@/lib/documentAnalysis';
import MobilePageHeader from '@/components/MobilePageHeader';

export default function Documents() {
  const { activeWorkspace, currentUser } = useCognos();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDocuments = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const docs = await base44.entities.Document.filter({ workspace_id: activeWorkspace.id }, '-created_date', 100);
      setDocuments(docs);
    } catch (e) { console.error('Failed to load documents:', e); }
    setLoading(false);
  }, [activeWorkspace]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const memberIds = () => activeWorkspace?.member_ids?.length ? activeWorkspace.member_ids : [currentUser?.id].filter(Boolean);

  const processInput = async (input) => {
    if (!activeWorkspace || !input?.file_url) return;
    const doc = await base44.entities.Document.create({
      workspace_id: activeWorkspace.id,
      name: input.name,
      source: input.source,
      file_url: input.file_url,
      mime_type: input.mime_type || '',
      file_type: input.file_type,
      status: 'processing',
      size: input.size || 0,
      member_ids: memberIds()
    });
    setDocuments(prev => [doc, ...prev]);
    try {
      const extracted = await extractContent({ file_url: input.file_url, name: input.name, file_type: input.file_type, mime_type: input.mime_type });
      const analysis = await analyzeFile({ file_url: input.file_url, name: input.name, file_type: input.file_type, extracted_content: extracted });
      const updated = await base44.entities.Document.update(doc.id, { extracted_content: extracted || '', analysis: analysis || '', status: 'complete' });
      setDocuments(prev => prev.map(d => (d.id === doc.id ? updated : d)));
    } catch (e) {
      const updated = await base44.entities.Document.update(doc.id, { status: 'error', error_message: String(e?.message || e) }).catch(() => doc);
      setDocuments(prev => prev.map(d => (d.id === doc.id ? updated : d)));
    }
  };

  const handleDelete = async (doc) => {
    try { await base44.entities.Document.delete(doc.id); } catch (e) { console.error(e); }
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
  };

  return (
    <div className="flex flex-col h-full">
      <MobilePageHeader title="Documents" />
      <header className="hidden md:flex items-center gap-2 px-4 py-3 border-b border-border">
        <FileText className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-medium">Documents & Inputs</h2>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <p className="text-xs text-muted-foreground mb-3">Bring in any input — files, audio, camera, or screen captures. COGNOS extracts the content and analyzes it for you.</p>
            <DocumentUploader onInput={processInput} />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Library</h3>
            <span className="text-xs text-muted-foreground">({documents.length})</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">No documents yet. Upload a file, record audio, or capture your screen to get started.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {documents.map(doc => <DocumentCard key={doc.id} doc={doc} onDelete={handleDelete} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}