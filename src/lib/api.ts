import { z } from 'zod';

/** All requests go through the same-origin proxy (Vite in dev, nginx in prod). */
export const API_BASE = '/_api';

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

const ErrorBody = z.object({ detail: z.string() });

/** The API's human-readable `detail` (e.g. on 429 Too Many Requests), if any. */
async function readDetail(res: Response): Promise<string | undefined> {
  try {
    const parsed = ErrorBody.safeParse(await res.json());
    return parsed.success ? parsed.data.detail : undefined;
  } catch {
    return undefined;
  }
}

async function getJson<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { signal });
  if (!res.ok) throw new ApiError(`GET ${path} failed with HTTP ${res.status}`);
  return schema.parse(await res.json());
}

const Health = z.object({ status: z.string() });
const ConditionNames = z.array(z.string());
const TopSymptoms = z.array(z.tuple([z.string(), z.number().int()]));

export const fetchHealth = (signal?: AbortSignal) => getJson('/health', Health, signal);
export const fetchConditionNames = (signal?: AbortSignal) =>
  getJson('/insights/condition-names', ConditionNames, signal);
export const fetchTopSymptoms = (topN: number, signal?: AbortSignal) =>
  getJson(`/insights/top-symptoms?top_n=${topN}`, TopSymptoms, signal);

/**
 * Events emitted by POST /chat/stream (see ChatService.stream_conversational_response
 * in medical_conditions_api). Every `data:` line is validated against this union.
 */
export const ChatEvent = z.union([
  z.object({ stage: z.enum(['rephrasing', 'retrieving']) }),
  z.object({ stage: z.literal('found'), count: z.number().int() }),
  z.object({ token: z.string() }),
  z.object({ answer: z.string() }),
  z.object({ error: z.string() }),
]);
export type ChatEvent = z.infer<typeof ChatEvent>;

/**
 * POST a question and yield validated SSE events as they arrive.
 * Uses fetch + ReadableStream because EventSource cannot send a POST body.
 */
export async function* streamChat(
  query: string,
  sessionId: string,
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ query, session_id: sessionId }),
    signal,
  });
  if (!res.ok || !res.body) {
    const detail = await readDetail(res);
    throw new ApiError(detail ?? `The API answered HTTP ${res.status}`, res.status);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;

    // SSE frames are separated by a blank line.
    let boundary: number;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const parsed = ChatEvent.safeParse(JSON.parse(line.slice(5).trim()));
        if (parsed.success) yield parsed.data;
      }
    }
  }
}
