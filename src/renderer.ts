import { ClockWidget } from './widgets/clock/ClockWidget';
import { FocusTime } from './widgets/focus/FocusTime';
import { NewsFeeds } from './widgets/feeds/NewsFeeds';
import { SportsFeeds } from './widgets/sports/SportsFeeds';
import { WeatherWidget } from './widgets/weather/WeatherWidgets';
import { TodoWidget } from './widgets/todo/todo';
import { MusicWidget } from './widgets/music/Music';
import { RadioWidget } from './widgets/radio/PlayRadio';
import { VideoWidget } from './widgets/videos/videos';
import type { AppConfig, BluetoothDevice, MusicDirectoryListing, NewsFeedData, SportsData, TodoTask, WidgetContext, WidgetModule } from './shared/types';

declare global {
  interface Window {
    feedApp: {
      getConfig(): Promise<AppConfig>;
      getWeather(force?: boolean): Promise<WidgetContext['getWeather'] extends (...args: never[]) => Promise<infer T> ? T : never>;
      getNews(force?: boolean): Promise<NewsFeedData>;
      getSports(force?: boolean): Promise<SportsData>;
      getTodoTasks(): Promise<TodoTask[]>;
      saveTodoTasks(tasks: TodoTask[]): Promise<TodoTask[]>;
      chooseMusicFolder(): Promise<MusicDirectoryListing | null>;
      browseMusicFolder(relativePath: string): Promise<MusicDirectoryListing>;
      chooseVideoFolder(): Promise<MusicDirectoryListing | null>;
      browseVideoFolder(relativePath: string): Promise<MusicDirectoryListing>;
      getBluetoothDevices(scan?: boolean): Promise<BluetoothDevice[]>;
      connectBluetooth(address: string): Promise<void>;
      disconnectBluetooth(address: string): Promise<void>;
      openMediaRequest(request: { url: string; title?: string; type?: string; source?: string; autoPlay?: boolean }): Promise<{ action: string; url?: string; title?: string; reason?: string }>;
      getRecentMedia(): Promise<unknown[]>;
    };
  }
}

const modules: Record<string, WidgetModule> = {
  clock: ClockWidget,
  focus: FocusTime,
  feeds: NewsFeeds,
  sports: SportsFeeds,
  weather: WeatherWidget,
  todo: TodoWidget,
  music: MusicWidget,
  radio: RadioWidget,
  videos: VideoWidget
};

function showMediaOverlay(kind: 'audio' | 'video', source: string, title: string): void {
  const existing = document.querySelector<HTMLElement>('.media-overlay');
  existing?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'media-overlay';

  const shell = document.createElement('div');
  shell.className = 'media-overlay-shell';

  const header = document.createElement('div');
  header.className = 'media-overlay-header';

  const label = document.createElement('strong');
  label.textContent = title || (kind === 'audio' ? 'Audio' : 'Video');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'media-close';
  closeButton.textContent = 'Close';
  closeButton.addEventListener('click', () => overlay.remove());

  const player = kind === 'audio' ? document.createElement('audio') : document.createElement('video');
  player.controls = true;
  player.autoplay = true;
  player.src = source;
  if (kind === 'video') {
    const videoPlayer = player as HTMLVideoElement;
    videoPlayer.playsInline = true;
    player.style.width = '100%';
    player.style.height = '100%';
  }

  header.append(label, closeButton);
  shell.append(header, player);
  overlay.append(shell);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) overlay.remove();
  });
  document.body.append(overlay);
}

async function replayRecentMedia(item: { url?: string; title?: string; type?: string; source?: string }): Promise<void> {
  const request = {
    url: typeof item.url === 'string' ? item.url : '',
    title: typeof item.title === 'string' ? item.title : undefined,
    type: typeof item.type === 'string' ? item.type : undefined,
    source: typeof item.source === 'string' ? item.source : undefined
  };

  if (!request.url) return;

  const decision = await window.feedApp.openMediaRequest(request);

  if (decision.action === 'play-audio') {
    showMediaOverlay('audio', decision.url ?? request.url, decision.title ?? request.title ?? 'Audio');
    return;
  }

  if (decision.action === 'play-video') {
    showMediaOverlay('video', decision.url ?? request.url, decision.title ?? request.title ?? 'Video');
    return;
  }

  if (decision.action === 'open-external' && decision.url) {
    window.open(decision.url, '_blank', 'noopener');
    return;
  }

  if (decision.action === 'reject') {
    window.alert(decision.reason ?? 'Unsupported media link');
  }
}

async function renderRecentMedia(container: HTMLElement): Promise<void> {
  const list = container.querySelector<HTMLUListElement>('.recent-media-list');
  if (!list) return;

  const items = await window.feedApp.getRecentMedia();

  if (!Array.isArray(items) || items.length === 0) {
    list.innerHTML = '<li class="recent-media-empty">No recent media yet</li>';
    return;
  }

  list.innerHTML = '';

  for (const item of items.slice(0, 8)) {
    const media = item as { url?: string; title?: string; type?: string; source?: string };
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recent-media-item';
    button.title = media.url ?? 'Recent media';

    const typeBadge = document.createElement('span');
    typeBadge.className = 'recent-media-badge';
    typeBadge.textContent = (media.type ?? 'media').toUpperCase();

    const label = document.createElement('span');
    label.className = 'recent-media-label';
    label.textContent = media.title || media.url || 'Recent media';

    button.append(typeBadge, label);
    button.addEventListener('click', () => void replayRecentMedia(media));
    li.append(button);
    list.append(li);
  }
}

async function start(): Promise<void> {
  const config = await window.feedApp.getConfig();
  const container = document.querySelector<HTMLElement>('#widgets');
  const headerContainer = document.querySelector<HTMLElement>('#head-widgets');

  if (!container) throw new Error('Missing #widgets container');
  if (!headerContainer) throw new Error('Missing #head-widgets container');

  const recentPanel = document.createElement('aside');
  recentPanel.className = 'recent-media-panel';
  recentPanel.innerHTML = '<h3>Recent media</h3><ul class="recent-media-list"></ul>';
  headerContainer.insertAdjacentElement('afterend', recentPanel);
  void renderRecentMedia(recentPanel);

  const context: WidgetContext = {
    config,
    getWeather: force => window.feedApp.getWeather(force),
    getNews: force => window.feedApp.getNews(force),
    getSports: force => window.feedApp.getSports(force),
    getTodoTasks: () => window.feedApp.getTodoTasks(),
    saveTodoTasks: tasks => window.feedApp.saveTodoTasks(tasks),
    chooseMusicFolder: () => window.feedApp.chooseMusicFolder(),
    browseMusicFolder: relativePath => window.feedApp.browseMusicFolder(relativePath),
    chooseVideoFolder: () => window.feedApp.chooseVideoFolder(),
    browseVideoFolder: relativePath => window.feedApp.browseVideoFolder(relativePath),
    getBluetoothDevices: scan => window.feedApp.getBluetoothDevices(scan),
    connectBluetooth: address => window.feedApp.connectBluetooth(address),
    disconnectBluetooth: address => window.feedApp.disconnectBluetooth(address),
    openMediaRequest: request => window.feedApp.openMediaRequest(request),
    getRecentMedia: () => window.feedApp.getRecentMedia(),
    openArticle: url => {
      const widgets = document.querySelector<HTMLElement>('#widgets')!;
      let reader = document.querySelector<HTMLElement>('#article-reader');
      if (!reader) {
        reader = document.createElement('section');
        reader.id = 'article-reader';
        reader.className = 'article-reader';
        reader.hidden = true;
        reader.innerHTML = '<button class="reader-back" type="button">Back</button><webview class="article-webview"></webview>';
        document.querySelector('main')!.append(reader);
        reader.querySelector('.reader-back')!.addEventListener('click', () => {
          const webview = reader!.querySelector('webview') as (HTMLElement & { src: string }) | null;
          if (webview) webview.src = 'about:blank';
          reader!.remove();
          widgets.hidden = false;
        });
      }
      const webview = reader.querySelector('webview') as HTMLElement & { src: string };
      webview.src = url;
      widgets.hidden = true;
      reader.hidden = false;
      reader.scrollIntoView({ block: 'start' });
    }
  };

  for (const widgetConfig of config.headWidgets ?? []) {
    if (!widgetConfig.enabled) continue;

    const widgetModule = modules[widgetConfig.id];
    if (widgetModule) {
      const widget = widgetModule.create(widgetConfig, context);
      widget.classList.add(widgetConfig.layout === 'full' ? 'widget-layout-full' : 'widget-layout-share');
      headerContainer.append(widget);
    }
  }

  for (const widgetConfig of config.widgets) {
    if (!widgetConfig.enabled) continue;

    const widgetModule = modules[widgetConfig.id];
    if (widgetModule) {
      const widget = widgetModule.create(widgetConfig, context);
      widget.classList.add(widgetConfig.layout === 'full' ? 'widget-layout-full' : 'widget-layout-share');
      container.append(widget);
    }
  }
}

void start();