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

async function start(): Promise<void> {
  const config = await window.feedApp.getConfig();
  const container = document.querySelector<HTMLElement>('#widgets');
  const headerContainer = document.querySelector<HTMLElement>('#head-widgets');

  if (!container) throw new Error('Missing #widgets container');
  if (!headerContainer) throw new Error('Missing #head-widgets container');

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