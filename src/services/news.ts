import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import type { NewsFeedData } from '../shared/types';

const refreshMs = 4 * 60 * 60 * 1000;
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: name => name === 'item'
});

function cachePath(userDataPath: string): string {
  return path.join(userDataPath, 'news-cache.json');
}

function readCache(userDataPath: string): NewsFeedData | null {
  try {
    return JSON.parse(fs.readFileSync(cachePath(userDataPath), 'utf8')) as NewsFeedData;
  } catch {
    return null;
  }
}

function writeCache(userDataPath: string, data: NewsFeedData): void {
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(cachePath(userDataPath), JSON.stringify(data, null, 2));
}

function textValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && '#text' in value) {
    return String((value as { '#text': unknown })['#text']);
  }
  return '';
}

function extractImage(item: Record<string, unknown>, description: string): string {
  const media = item['media:content'] ?? item['media:thumbnail'];
  if (media && typeof media === 'object' && '@_url' in media) {
    return String((media as { '@_url': unknown })['@_url']);
  }
  return description.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] ?? '';
}

export async function getNews(userDataPath: string, force = false): Promise<NewsFeedData> {
  const cached = readCache(userDataPath);
  if (!force && cached && Date.now() - cached.fetchedAt < refreshMs) return cached;

  const url = new URL('https://news.google.com/rss/search');
  url.search = new URLSearchParams({
    q: 'México',
    hl: 'es-419',
    gl: 'MX',
    ceid: 'MX:es-419'
  }).toString();

  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'FeedApp/1.0' } });
    if (!response.ok) throw new Error(`Google News request failed: ${response.status}`);

    const parsed = parser.parse(await response.text()) as {
      rss?: { channel?: { item?: Array<Record<string, unknown>> } };
    };
    const rssItems = parsed.rss?.channel?.item ?? [];
    const items = rssItems.map(item => {
      const description = textValue(item.description);
      const imageUrl = extractImage(item, description);
      return {
        title: textValue(item.title),
        link: textValue(item.link),
        imageUrl: /^https?:\/\//i.test(imageUrl) ? imageUrl : '',
        source: textValue(item.source),
        publishedAt: textValue(item.pubDate)
      };
    }).filter(item => item.title && /^https:\/\//i.test(item.link));

    const data: NewsFeedData = { items, fetchedAt: Date.now() };
    writeCache(userDataPath, data);
    return data;
  } catch (error) {
    if (cached) return { ...cached, stale: true };
    throw error;
  }
}