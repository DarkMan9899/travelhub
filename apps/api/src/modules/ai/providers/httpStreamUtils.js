/**
 * Shared byte-stream parsing helpers for the real provider adapters
 * (Phase 15). Node's native `fetch` (undici) exposes `response.body` as
 * an async-iterable byte stream — these two generators turn that into
 * either SSE `data:` frames (OpenAI/Azure OpenAI/Anthropic/Gemini) or
 * newline-delimited JSON objects (Ollama), independent of any one
 * provider's payload shape.
 */

export async function* iterateSseFrames(body) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLines = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim());
      if (dataLines.length > 0) {
        yield dataLines.join('\n');
      }
      boundary = buffer.indexOf('\n\n');
    }
  }
}

export async function* iterateNdjsonLines(body) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) yield line;
      newlineIndex = buffer.indexOf('\n');
    }
  }
}
