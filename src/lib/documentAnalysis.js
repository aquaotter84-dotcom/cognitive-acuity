// Client-side document/input analysis pipeline.
// Routes any uploaded/imported file through the right extraction path:
//  - audio  → TranscribeAudio (speech-to-text)
//  - image  → InvokeLLM vision (file_urls) → description
//  - docs / spreadsheets / pdfs / csv / json / html → ExtractDataFromUploadedFile → text
// Then an InvokeLLM pass produces an AI analysis/summary of the extracted content.
import { base44 } from '@/api/base44Client';

export function categorizeFile(name, mime) {
  const m = (mime || '').toLowerCase();
  const ext = (name || '').split('.').pop()?.toLowerCase();
  if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
  if (m.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'flac', 'mpga', 'mpeg'].includes(ext)) return 'audio';
  if (m.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
  if (['csv', 'xlsx', 'xls', 'tsv'].includes(ext) || m.includes('spreadsheet') || m.includes('csv')) return 'spreadsheet';
  return 'document';
}

function parseExtractOutput(output) {
  if (!output) return '';
  if (typeof output === 'string') {
    try { const o = JSON.parse(output); return o?.content || o?.summary || output; }
    catch { return output; }
  }
  if (Array.isArray(output)) return JSON.stringify(output, null, 2);
  return output?.content || output?.summary || JSON.stringify(output, null, 2);
}

// Returns the raw extracted/transcribed text for a file (no AI analysis).
export async function extractContent({ file_url, name, file_type, mime_type }) {
  if (!file_url) return '';
  try {
    if (file_type === 'audio') {
      const res = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
      return typeof res === 'string' ? res : (res?.text || JSON.stringify(res));
    }
    if (file_type === 'image') return '';
    const schema = {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The full extracted text content of the file' },
        summary: { type: 'string', description: 'A short summary of the file contents' }
      }
    };
    const res = await base44.integrations.Core.ExtractDataFromUploadedFile({ file_url, json_schema: schema });
    if (res?.status === 'success') return parseExtractOutput(res.output);
    return '';
  } catch (e) {
    console.warn('extractContent failed:', e);
    return '';
  }
}

// Returns an AI analysis/summary string for the file.
export async function analyzeFile({ file_url, name, file_type, extracted_content }) {
  try {
    if (file_type === 'image' && file_url) {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this image in detail. Describe what it shows, any text visible, context, and key observations. The file is named "${name}".`,
        file_urls: [file_url]
      });
      return typeof res === 'string' ? res : (res?.response || res?.text || JSON.stringify(res));
    }
    const body = (extracted_content || '').slice(0, 12000) || '(no extractable text content)';
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an analyst. Analyze the following content extracted from a file named "${name}". Provide a clear, structured summary and highlight key insights, entities, and anything noteworthy.\n\nCONTENT:\n${body}`
    });
    return typeof res === 'string' ? res : (res?.response || res?.text || JSON.stringify(res));
  } catch (e) {
    console.warn('analyzeFile failed:', e);
    return '';
  }
}

// Used by chat to fold attachment content into the user message before orchestration.
// Images are described via vision, audio is transcribed, documents are extracted.
export async function extractAttachmentContext(attachments) {
  if (!attachments?.length) return '';
  const parts = [];
  for (const a of attachments) {
    const ft = categorizeFile(a.name, a.file_type);
    try {
      if (ft === 'image' && a.file_url) {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `Describe this image concisely, including any visible text. Filename: ${a.name}.`,
          file_urls: [a.file_url]
        });
        const desc = typeof res === 'string' ? res : (res?.response || JSON.stringify(res));
        if (desc) parts.push(`[Attached image: ${a.name}]\n${desc}`);
      } else if (ft === 'audio' && a.file_url) {
        const res = await base44.integrations.Core.TranscribeAudio({ audio_url: a.file_url });
        const t = typeof res === 'string' ? res : (res?.text || JSON.stringify(res));
        if (t) parts.push(`[Attached audio: ${a.name}]\n${t}`);
      } else if (a.file_url) {
        const schema = { type: 'object', properties: { content: { type: 'string' }, summary: { type: 'string' } } };
        const res = await base44.integrations.Core.ExtractDataFromUploadedFile({ file_url: a.file_url, json_schema: schema });
        if (res?.status === 'success') {
          const content = parseExtractOutput(res.output);
          if (content) parts.push(`[Attached file: ${a.name}]\n${content}`);
        }
      }
    } catch (e) { /* skip this attachment */ }
  }
  return parts.join('\n\n');
}