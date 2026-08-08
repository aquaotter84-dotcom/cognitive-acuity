import { base44 } from '@/api/base44Client';

// Client-side document/input analysis pipeline.
// Routes any uploaded/imported file through the right extraction path:
//  - audio  → TranscribeAudio (speech-to-text)
//  - image  → external BluesMinds vision (file_urls) → description
//  - docs / spreadsheets / pdfs / csv / json / html → ExtractDataFromUploadedFile → text
// Then an external BluesMinds pass produces an AI analysis/summary of the extracted content.

const RUNTIME_URL = (import.meta.env.VITE_COGNOS_RUNTIME_URL || '').replace(/\/$/, '');

async function externalLLM(payload) {
  // Preference is controlled by a client-side toggle stored in localStorage (key: cognos_use_external_runtime).
  // When enabled, the frontend will call the external runtime directly (requires VITE_COGNOS_RUNTIME_URL).
  // Otherwise, the frontend will invoke the Base44 function bridge (externalLLM) so requests are proxied through Base44.
  const preferExternal = typeof window !== 'undefined' && localStorage.getItem('cognos_use_external_runtime') === 'true';

  if (preferExternal) {
    if (!RUNTIME_URL) throw new Error('VITE_COGNOS_RUNTIME_URL is not configured');
    const response = await fetch(`${RUNTIME_URL}/api/llm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || `Runtime LLM request failed (${response.status})`);
    return data;
  }

  // Fallback: call the Base44 function which proxies to the runtime from the server-side (avoids embedding secrets in the client).
  try {
    const res = await base44.functions.invoke('externalLLM', payload);
    // base44.functions.invoke returns an object with .data property when successful; mirror previous behavior.
    return res?.data ?? res;
  } catch (e) {
    // Normalize error shape similar to direct fetch path.
    throw new Error(e?.data?.error || e?.message || 'External LLM invocation failed');
  }
}

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
      const res = await externalLLM({
        messages: [
          { role: 'user', content: `Analyze this image in detail. Describe what it shows, any text visible, context, and key observations. The file is named "${name}".` }
        ],
        file_urls: [file_url]
      });
      return typeof res === 'string' ? res : (res?.choices?.[0]?.message?.content || res?.response || res?.text || JSON.stringify(res));
    }
    const body = (extracted_content || '').slice(0, 12000) || '(no extractable text content)';
    const res = await externalLLM({
      messages: [
        { role: 'system', content: 'You are an analyst. Analyze file content and provide a clear, structured summary, key insights, entities, and anything noteworthy.' },
        { role: 'user', content: `Analyze the following content extracted from a file named "${name}".\n\nCONTENT:\n${body}` }
      ]
    });
    return typeof res === 'string' ? res : (res?.choices?.[0]?.message?.content || res?.response || res?.text || JSON.stringify(res));
  } catch (e) {
    console.warn('analyzeFile failed:', e);
    return '';
  }
}

// Used by chat to fold attachment content into the user message before orchestration.
// Images are described via external BluesMinds vision, audio is transcribed, documents are extracted.
export async function extractAttachmentContext(attachments) {
  if (!attachments?.length) return '';
  const parts = [];
  for (const a of attachments) {
    const ft = categorizeFile(a.name, a.file_type);
    try {
      if (ft === 'image' && a.file_url) {
        const res = await externalLLM({
          messages: [
            { role: 'user', content: `Describe this image concisely, including any visible text. Filename: ${a.name}.` }
          ],
          file_urls: [a.file_url]
        });
        const desc = typeof res === 'string' ? res : (res?.choices?.[0]?.message?.content || res?.response || JSON.stringify(res));
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
