export type MediaType = 'audio' | 'video' | 'radio' | 'unknown';

export type MediaSource = 'direct' | 'youtube' | 'radio' | 'external';

export type MediaRequest = {
  url: string;
  title?: string;
  type?: MediaType;
  source?: MediaSource;
  autoPlay?: boolean;
};

export type MediaDecision =
  | { action: 'play-audio'; url: string; title?: string }
  | { action: 'play-video'; url: string; title?: string }
  | { action: 'open-external'; url: string; title?: string }
  | { action: 'reject'; reason: string };

export type RecentMediaItem = {
  id: string;
  url: string;
  title: string;
  type: MediaType;
  source: MediaSource;
  playedAt: string;
  favorite: boolean;
};

const RECENT_MEDIA_STORAGE_KEY = 'recentMedia';

const DEMO_RECENT_MEDIA: RecentMediaItem[] = [
  {
    id: 'demo-youtube-1',
    url: 'https://youtu.be/yBQy_S_k-qg?si=mN-CKBcsHioPmfRE',
    title: 'YouTube demo 1',
    type: 'video',
    source: 'youtube',
    playedAt: new Date().toISOString(),
    favorite: false
  },
  {
    id: 'demo-youtube-2',
    url: 'https://youtu.be/WtbpuUTag5Q?si=5oenlwK0AHLf_T-C',
    title: 'YouTube demo 2',
    type: 'video',
    source: 'youtube',
    playedAt: new Date().toISOString(),
    favorite: false
  }
];

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function getMediaExtension(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    const dotIndex = pathname.lastIndexOf('.');
    if (dotIndex >= 0 && dotIndex < pathname.length - 1) {
      return pathname.slice(dotIndex + 1);
    }
  } catch {
    // Ignore invalid URLs and fall back to a simple suffix scan.
  }

  const cleaned = url.split('?')[0].split('#')[0].toLowerCase();
  const dotIndex = cleaned.lastIndexOf('.');
  return dotIndex >= 0 && dotIndex < cleaned.length - 1 ? cleaned.slice(dotIndex + 1) : '';
}

export function normalizeMediaRequest(input: MediaRequest): MediaRequest {
  const url = (input.url ?? '').trim();

  if (!url) {
    return { ...input, url: '', type: 'unknown', source: 'external' };
  }

  const lower = url.toLowerCase();

  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return { ...input, url, type: 'video', source: 'youtube' };
  }

  if (
    lower.includes('m3u8') ||
    lower.includes('icecast') ||
    lower.includes('shoutcast') ||
    lower.includes('.pls')
  ) {
    return { ...input, url, type: 'radio', source: 'radio' };
  }

  const ext = getMediaExtension(url);

  if (['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac', 'opus'].includes(ext)) {
    return { ...input, url, type: 'audio', source: 'direct' };
  }

  if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) {
    return { ...input, url, type: 'video', source: 'direct' };
  }

  return { ...input, url, type: 'unknown', source: 'external' };
}

export function routeMedia(request: MediaRequest): MediaDecision {
  const normalized = normalizeMediaRequest(request);

  if (normalized.source === 'youtube') {
    return {
      action: 'open-external',
      url: normalized.url,
      title: normalized.title
    };
  }

  if (normalized.type === 'radio' || normalized.type === 'audio') {
    return {
      action: 'play-audio',
      url: normalized.url,
      title: normalized.title
    };
  }

  if (normalized.type === 'video') {
    return {
      action: 'play-video',
      url: normalized.url,
      title: normalized.title
    };
  }

  return {
    action: 'reject',
    reason: 'Unsupported or unrecognized media URL'
  };
}

export function readRecentMedia(): RecentMediaItem[] {
  const storage = getStorage();
  if (!storage) return [...DEMO_RECENT_MEDIA];

  try {
    const raw = storage.getItem(RECENT_MEDIA_STORAGE_KEY);
    if (!raw) {
      storage.setItem(RECENT_MEDIA_STORAGE_KEY, JSON.stringify(DEMO_RECENT_MEDIA));
      return [...DEMO_RECENT_MEDIA];
    }

    const parsed = JSON.parse(raw) as RecentMediaItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      storage.setItem(RECENT_MEDIA_STORAGE_KEY, JSON.stringify(DEMO_RECENT_MEDIA));
      return [...DEMO_RECENT_MEDIA];
    }

    return parsed;
  } catch {
    return [...DEMO_RECENT_MEDIA];
  }
}

export function writeRecentMedia(items: RecentMediaItem[]): void {
  const storage = getStorage();
  if (!storage) return;

  storage.setItem(RECENT_MEDIA_STORAGE_KEY, JSON.stringify(items));
}

export async function saveMediaHistory(input: MediaRequest): Promise<void> {
  const normalized = normalizeMediaRequest(input);
  const decision = routeMedia(normalized);

  if (decision.action === 'reject') {
    return;
  }

  const item: RecentMediaItem = {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    url: normalized.url,
    title: normalized.title ?? 'Untitled media',
    type: normalized.type ?? 'unknown',
    source: normalized.source ?? 'external',
    playedAt: new Date().toISOString(),
    favorite: false
  };

  const existing = readRecentMedia();
  const updated = [item, ...existing].slice(0, 50);
  writeRecentMedia(updated);
}

export async function openMediaRequest(input: MediaRequest): Promise<MediaDecision> {
  const normalized = normalizeMediaRequest(input);
  const decision = routeMedia(normalized);

  if (decision.action !== 'reject') {
    await saveMediaHistory(normalized);
  }

  return decision;
}

export class MediaListener {
  async handle(request: MediaRequest): Promise<MediaDecision> {
    return openMediaRequest(request);
  }
}
