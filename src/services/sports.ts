import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import type { SportsData, SportsGame } from '../shared/types';

const refreshMs = 4 * 60 * 60 * 1000;
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: name => name === 'item'
});

function cachePath(userDataPath: string): string {
  return path.join(userDataPath, 'sports-cache.json');
}

function readCache(userDataPath: string): SportsData | null {
  try {
    return JSON.parse(fs.readFileSync(cachePath(userDataPath), 'utf8')) as SportsData;
  } catch {
    return null;
  }
}

function writeCache(userDataPath: string, data: SportsData): void {
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(cachePath(userDataPath), JSON.stringify(data, null, 2));
}

function dateKey(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function textValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && '#text' in value) {
    return String((value as { '#text': unknown })['#text']);
  }
  return '';
}

export async function getSports(userDataPath: string, force = false): Promise<SportsData> {
  const cached = readCache(userDataPath);
  if (!force && cached && Date.now() - cached.fetchedAt < refreshMs) return cached;

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const scoreboardUrl = new URL('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
  scoreboardUrl.search = new URLSearchParams({ limit: '1000' }).toString();
  const headlinesUrl = new URL('https://news.google.com/rss/search');
  headlinesUrl.search = new URLSearchParams({ q: 'NFL', hl: 'en-US', gl: 'US', ceid: 'US:en' }).toString();

  try {
    const [scoreboardResponse, headlinesResponse] = await Promise.all([
      fetch(scoreboardUrl, { headers: { 'User-Agent': 'FeedApp/1.0' } }),
      fetch(headlinesUrl, { headers: { 'User-Agent': 'FeedApp/1.0' } })
    ]);
    if (!scoreboardResponse.ok) throw new Error(`NFL schedule request failed: ${scoreboardResponse.status}`);
    if (!headlinesResponse.ok) throw new Error(`NFL news request failed: ${headlinesResponse.status}`);

    const scoreboard = await scoreboardResponse.json() as {
      events?: Array<{
        id?: string;
        name?: string;
        date?: string;
        status?: { type?: { shortDetail?: string } };
        competitions?: Array<{
          venue?: { fullName?: string };
          competitors?: Array<{
            homeAway?: string;
            team?: { displayName?: string; logo?: string };
          }>;
        }>;
      }>;
    };
    const groupedGames = new Map<string, SportsGame[]>();

    for (const event of scoreboard.events ?? []) {
      const competition = event.competitions?.[0];
      const competitors = competition?.competitors ?? [];
      const home = competitors.find(team => team.homeAway === 'home');
      const away = competitors.find(team => team.homeAway === 'away');
      if (!event.date || !home || !away) continue;
      const key = dateKey(event.date);
      const game: SportsGame = {
        id: event.id ?? `${key}-${event.name ?? 'game'}`,
        name: event.name ?? `${away.team?.displayName ?? 'Away'} at ${home.team?.displayName ?? 'Home'}`,
        date: event.date,
        venue: competition?.venue?.fullName ?? '',
        status: event.status?.type?.shortDetail ?? 'Scheduled',
        homeTeam: home.team?.displayName ?? 'Home',
        awayTeam: away.team?.displayName ?? 'Away',
        homeLogo: home.team?.logo ?? '',
        awayLogo: away.team?.logo ?? ''
      };
      groupedGames.set(key, [...(groupedGames.get(key) ?? []), game]);
    }

    const gameDate = [...groupedGames.keys()].filter(key => key >= todayKey).sort()[0] ?? '';
    const games = (groupedGames.get(gameDate) ?? []).sort((first, second) => first.date.localeCompare(second.date));
    const parsedHeadlines = parser.parse(await headlinesResponse.text()) as {
      rss?: { channel?: { item?: Array<Record<string, unknown>> } };
    };
    const headlines = (parsedHeadlines.rss?.channel?.item ?? []).map(item => ({
      title: textValue(item.title),
      link: textValue(item.link)
    })).filter(item => item.title && /^https:\/\//i.test(item.link)).slice(0, 5);

    const data: SportsData = { games, gameDate, headlines, fetchedAt: Date.now() };
    writeCache(userDataPath, data);
    return data;
  } catch (error) {
    if (cached) return { ...cached, stale: true };
    throw error;
  }
}