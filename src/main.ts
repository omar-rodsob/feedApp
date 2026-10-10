import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import type { OpenDialogOptions } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import type { MusicDirectoryListing, TodoTask } from './shared/types';

interface WidgetConfig {
  id: string;
  enabled: boolean;
  title: string;
}

interface AppConfig {
  weather: {
    latitude: number;
    longitude: number;
    locationLabel: string;
    refreshHours: number;
  };
  widgets: WidgetConfig[];
  todo?: { tasks: TodoTask[] };
}

interface WeatherData {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  fetchedAt: number;
  locationLabel: string;
  stale?: boolean;
}

interface NewsItem {
  title: string;
  link: string;
  imageUrl: string;
  source: string;
  publishedAt: string;
}

interface NewsFeedData {
  items: NewsItem[];
  fetchedAt: number;
  stale?: boolean;
}

interface SportsGame {
  id: string;
  name: string;
  date: string;
  venue: string;
  status: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
}

interface SportsHeadline {
  title: string;
  link: string;
}

interface SportsData {
  games: SportsGame[];
  gameDate: string;
  headlines: SportsHeadline[];
  fetchedAt: number;
  stale?: boolean;
}

const newsRefreshMs = 4 * 60 * 60 * 1000;
const sportsRefreshMs = 4 * 60 * 60 * 1000;
const newsParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: name => name === 'item'
});

const config = JSON.parse(
  fs.readFileSync(path.join(app.getAppPath(), 'config.json'), 'utf8')
) as AppConfig;

function todoTasksPath(): string {
  return path.join(app.getPath('userData'), 'todo-tasks.json');
}

function readTodoTasks(): TodoTask[] {
  try {
    return JSON.parse(fs.readFileSync(todoTasksPath(), 'utf8')) as TodoTask[];
  } catch {
    return config.todo?.tasks ?? [];
  }
}

function saveTodoTasks(value: unknown): TodoTask[] {
  if (!Array.isArray(value) || value.some(task =>
    !task || typeof task.id !== 'string' || typeof task.title !== 'string' ||
    !['routine', 'event'].includes(task.kind) || !Array.isArray(task.completedOn)
  )) {
    throw new Error('Invalid todo task list');
  }
  const tasks = value as TodoTask[];
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(todoTasksPath(), JSON.stringify(tasks, null, 2));
  return tasks;
}

function musicLibraryPath(): string {
  return path.join(app.getPath('userData'), 'music-library.json');
}

function readMusicRoot(): string | null {
  try {
    const value = JSON.parse(fs.readFileSync(musicLibraryPath(), 'utf8')) as { root?: unknown };
    return typeof value.root === 'string' ? value.root : null;
  } catch {
    return null;
  }
}

function saveMusicRoot(root: string): void {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(musicLibraryPath(), JSON.stringify({ root }, null, 2));
}

async function chooseMusicFolder(): Promise<MusicDirectoryListing | null> {
  const options: OpenDialogOptions = {
    title: 'Choose your music folder',
    properties: ['openDirectory']
  };
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const result = focusedWindow
    ? await dialog.showOpenDialog(focusedWindow, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || !result.filePaths[0]) return null;
  const root = await fs.promises.realpath(result.filePaths[0]);
  saveMusicRoot(root);
  return browseMusicFolder('');
}

async function browseMusicFolder(relativePath: unknown): Promise<MusicDirectoryListing> {
  const selectedRoot = readMusicRoot();
  if (!selectedRoot) throw new Error('Choose a music folder first');
  const root = await fs.promises.realpath(selectedRoot);
  const requested = typeof relativePath === 'string' ? relativePath : '';
  const target = path.resolve(root, requested);
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Folder is outside the selected music library');
  }
  const actual = await fs.promises.realpath(target);
  const actualRelative = path.relative(root, actual);
  if (actualRelative === '..' || actualRelative.startsWith(`..${path.sep}`) || path.isAbsolute(actualRelative)) {
    throw new Error('Folder is outside the selected music library');
  }

  const entries = await fs.promises.readdir(actual, { withFileTypes: true });
  const folders = entries.filter(entry => entry.isDirectory()).map(entry => ({
    name: entry.name,
    relativePath: path.posix.join(relative.split(path.sep).join('/'), entry.name)
  })).sort((first, second) => first.name.localeCompare(second.name));
  const playableExtensions = new Set(['.mp3', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.flac']);
  const tracks = entries.filter(entry => entry.isFile() && playableExtensions.has(path.extname(entry.name).toLowerCase()))
    .map(entry => {
      const absolutePath = path.join(actual, entry.name);
      return {
        name: entry.name,
        relativePath: path.posix.join(relative.split(path.sep).join('/'), entry.name),
        source: pathToFileURL(absolutePath).href
      };
    }).sort((first, second) => first.name.localeCompare(second.name));

  return {
    rootName: path.basename(root) || root,
    currentPath: relative.split(path.sep).join('/'),
    folders,
    tracks
  };
}

function cachePath(): string {
  return path.join(app.getPath('userData'), 'weather-cache.json');
}

function newsCachePath(): string {
  return path.join(app.getPath('userData'), 'news-cache.json');
}

function readNewsCache(): NewsFeedData | null {
  try {
    return JSON.parse(fs.readFileSync(newsCachePath(), 'utf8')) as NewsFeedData;
  } catch {
    return null;
  }
}

function writeNewsCache(data: NewsFeedData): void {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(newsCachePath(), JSON.stringify(data, null, 2));
}

function sportsCachePath(): string {
  return path.join(app.getPath('userData'), 'sports-cache.json');
}

function readSportsCache(): SportsData | null {
  try {
    return JSON.parse(fs.readFileSync(sportsCachePath(), 'utf8')) as SportsData;
  } catch {
    return null;
  }
}

function writeSportsCache(data: SportsData): void {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(sportsCachePath(), JSON.stringify(data, null, 2));
}

function dateKey(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function getSports(force = false): Promise<SportsData> {
  const cached = readSportsCache();
  if (!force && cached && Date.now() - cached.fetchedAt < sportsRefreshMs) return cached;

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
    const events = scoreboard.events ?? [];
    const groupedGames = new Map<string, SportsGame[]>();

    for (const event of events) {
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
    const games = (groupedGames.get(gameDate) ?? []).sort((a, b) => a.date.localeCompare(b.date));
    const parsedHeadlines = newsParser.parse(await headlinesResponse.text()) as {
      rss?: { channel?: { item?: Array<Record<string, unknown>> } };
    };
    const headlines = (parsedHeadlines.rss?.channel?.item ?? []).map(item => ({
      title: textValue(item.title),
      link: textValue(item.link)
    })).filter(item => item.title && /^https:\/\//i.test(item.link)).slice(0, 5);

    const data: SportsData = { games, gameDate, headlines, fetchedAt: Date.now() };
    writeSportsCache(data);
    return data;
  } catch (error) {
    if (cached) return { ...cached, stale: true };
    throw error;
  }
}

function textValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && '#text' in value) {
    return String((value as { '#text': unknown })['#text']);
  }
  return '';
}

function extractNewsImage(item: Record<string, unknown>, description: string): string {
  const media = item['media:content'] ?? item['media:thumbnail'];
  if (media && typeof media === 'object' && '@_url' in media) {
    return String((media as { '@_url': unknown })['@_url']);
  }
  return description.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] ?? '';
}

async function getNews(force = false): Promise<NewsFeedData> {
  const cached = readNewsCache();
  if (!force && cached && Date.now() - cached.fetchedAt < newsRefreshMs) return cached;

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

    const parsed = newsParser.parse(await response.text()) as {
      rss?: { channel?: { item?: Array<Record<string, unknown>> } };
    };
    const rssItems = parsed.rss?.channel?.item ?? [];
    const items = rssItems.map(item => {
      const description = textValue(item.description);
      const imageUrl = extractNewsImage(item, description);
      return {
        title: textValue(item.title),
        link: textValue(item.link),
        imageUrl: /^https?:\/\//i.test(imageUrl) ? imageUrl : '',
        source: textValue(item.source),
        publishedAt: textValue(item.pubDate)
      };
    }).filter(item => item.title && /^https:\/\//i.test(item.link));

    const data: NewsFeedData = { items, fetchedAt: Date.now() };
    writeNewsCache(data);
    return data;
  } catch (error) {
    if (cached) return { ...cached, stale: true };
    throw error;
  }
}

function readCache(): WeatherData | null {
  try {
    return JSON.parse(fs.readFileSync(cachePath(), 'utf8')) as WeatherData;
  } catch {
    return null;
  }
}

function writeCache(data: WeatherData): void {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(cachePath(), JSON.stringify(data, null, 2));
}

async function getWeather(force = false): Promise<WeatherData> {
  const cached = readCache();
  const refreshMs = (Number(config.weather.refreshHours) || 5) * 60 * 60 * 1000;

  if (!force && cached && Date.now() - cached.fetchedAt < refreshMs) {
    return cached;
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(config.weather.latitude),
    longitude: String(config.weather.longitude),
    current:
      'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
    timezone: 'auto'
  }).toString();

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather request failed: ${response.status}`);
    }

    const result = (await response.json()) as { current: WeatherData['current'] };
    const data: WeatherData = {
      current: result.current,
      fetchedAt: Date.now(),
      locationLabel: config.weather.locationLabel
    };

    writeCache(data);
    return data;
  } catch (error) {
    if (cached) return { ...cached, stale: true };
    throw error;
  }
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 800,
    height: 480,
    minWidth: 280,
    backgroundColor: '#101820',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  void window.loadFile(path.join(__dirname, '..', 'index.html'));
}

ipcMain.handle('config:get', () => config);
ipcMain.handle('weather:get', (_event, force: unknown) =>
  getWeather(force === true)
);
ipcMain.handle('news:get', (_event, force: unknown) =>
  getNews(force === true)
);
ipcMain.handle('sports:get', (_event, force: unknown) =>
  getSports(force === true)
);
ipcMain.handle('todo:get', () => readTodoTasks());
ipcMain.handle('todo:save', (_event, tasks: unknown) => saveTodoTasks(tasks));
ipcMain.handle('music:choose-folder', () => chooseMusicFolder());
ipcMain.handle('music:browse-folder', (_event, relativePath: unknown) => browseMusicFolder(relativePath));

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});