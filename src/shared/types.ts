export interface WidgetConfig {
  id: string;
  enabled: boolean;
  title: string;
}

export interface WeatherData {
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

export interface NewsItem {
  title: string;
  link: string;
  imageUrl: string;
  source: string;
  publishedAt: string;
}

export interface NewsFeedData {
  items: NewsItem[];
  fetchedAt: number;
  stale?: boolean;
}

export interface SportsGame {
  id: string;
  name: string;
  date: string;
  venue: string;
  status: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  homeScore?: string;
  awayScore?: string;
}

export interface SportsHeadline {
  title: string;
  link: string;
}

export interface SportsData {
  games: SportsGame[];
  gameDate: string;
  headlines: SportsHeadline[];
  fetchedAt: number;
  stale?: boolean;
}

export interface FocusOption {
  id: string;
  label: string;
  minutes: number;
}

export interface FocusConfig {
  options: FocusOption[];
  completionSound?: string;
}

export interface TodoTask {
  id: string;
  title: string;
  kind: 'routine' | 'event';
  recurrence?: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number | 'last';
  date?: string;
  time?: string;
  completedOn: string[];
}

export interface MusicFolderEntry {
  name: string;
  relativePath: string;
}

export interface MusicTrack {
  name: string;
  relativePath: string;
  source: string;
}

export interface MusicDirectoryListing {
  rootName: string;
  currentPath: string;
  folders: MusicFolderEntry[];
  tracks: MusicTrack[];
}

export interface BluetoothDevice {
  address: string;
  name: string;
  paired: boolean;
  connected: boolean;
}

export interface AppConfig {
  weather: {
    latitude: number;
    longitude: number;
    locationLabel: string;
    refreshHours: number;
  };
  widgets: WidgetConfig[];
  focus?: FocusConfig;
  todo?: { tasks: TodoTask[] };
}

export interface WidgetContext {
  config: AppConfig;
  getWeather(force?: boolean): Promise<WeatherData>;
  getNews(force?: boolean): Promise<NewsFeedData>;
  getSports(force?: boolean): Promise<SportsData>;
  getTodoTasks(): Promise<TodoTask[]>;
  saveTodoTasks(tasks: TodoTask[]): Promise<TodoTask[]>;
  chooseMusicFolder(): Promise<MusicDirectoryListing | null>;
  browseMusicFolder(relativePath: string): Promise<MusicDirectoryListing>;
  getBluetoothDevices(scan?: boolean): Promise<BluetoothDevice[]>;
  connectBluetooth(address: string): Promise<void>;
  disconnectBluetooth(address: string): Promise<void>;
  openArticle(url: string): void;
}

export interface WidgetModule {
  create(config: WidgetConfig, context: WidgetContext): HTMLElement;
}