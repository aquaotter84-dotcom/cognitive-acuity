// Client helper: call the serverless proxy (same-origin or full URL)
// Example usage:
//   const text = await generateFromProxy('Summarize sales trends for Q2');

export async function generateFromProxy(prompt, { model, max_tokens } = {}) {
  const resp = await fetch('/api/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model, max_tokens }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Proxy request failed: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  return data.output;
}
