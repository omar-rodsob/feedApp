import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { MediaDecision, MediaRequest } from './media';

const HOST = '127.0.0.1';
const PORT = 3000;
const MAX_BODY_BYTES = 16 * 1024;

type MediaRequestHandler = (request: MediaRequest) => Promise<MediaDecision>;

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function parseMediaRequest(value: unknown): MediaRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const payload = value as Record<string, unknown>;
  if (typeof payload.url !== 'string' || !payload.url.trim()) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(payload.url);
  } catch {
    return null;
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return null;

  if (payload.title !== undefined && typeof payload.title !== 'string') return null;
  if (
    payload.type !== undefined &&
    payload.type !== 'audio' &&
    payload.type !== 'video' &&
    payload.type !== 'radio' &&
    payload.type !== 'unknown'
  ) return null;
  if (
    payload.source !== undefined &&
    payload.source !== 'direct' &&
    payload.source !== 'youtube' &&
    payload.source !== 'radio' &&
    payload.source !== 'external'
  ) return null;
  if (payload.autoPlay !== undefined && typeof payload.autoPlay !== 'boolean') return null;

  return {
    url: payload.url,
    title: payload.title as string | undefined,
    type: payload.type as MediaRequest['type'],
    source: payload.source as MediaRequest['source'],
    autoPlay: payload.autoPlay as boolean | undefined
  };
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let length = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > MAX_BODY_BYTES) {
      throw new RangeError('Request body exceeds the 16 KB limit');
    }
    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

export function startMediaHttpServer(handleMediaRequest: MediaRequestHandler): void {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', `http://${HOST}`).pathname;
    if (pathname !== '/api/media/open') {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }

    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }

    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      sendJson(response, 415, { error: 'Content-Type must be application/json' });
      return;
    }

    let requestBody: unknown;
    try {
      requestBody = await readJsonBody(request);
    } catch (error) {
      const tooLarge = error instanceof RangeError;
      sendJson(response, tooLarge ? 413 : 400, {
        error: tooLarge ? error.message : 'Request body must contain valid JSON'
      });
      return;
    }

    const mediaRequest = parseMediaRequest(requestBody);
    if (!mediaRequest) {
      sendJson(response, 400, { error: 'A valid HTTP(S) media URL and optional metadata are required' });
      return;
    }

    try {
      const decision = await handleMediaRequest(mediaRequest);
      sendJson(response, decision.action === 'reject' ? 422 : 200, decision);
    } catch (error) {
      console.error('Unable to handle HTTP media request:', error);
      sendJson(response, 503, { error: 'FeedApp is not ready to receive media requests' });
    }
  });

  server.on('error', error => {
    console.error(`Media HTTP endpoint could not bind to ${HOST}:${PORT}:`, error);
  });
  server.listen(PORT, HOST, () => {
    console.info(`Media HTTP endpoint listening on http://${HOST}:${PORT}/api/media/open`);
  });
}
