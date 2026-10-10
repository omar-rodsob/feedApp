import type { WidgetConfig, WidgetContext, WidgetModule, WeatherData } from '../../shared/types';

const descriptions: Record<number, string> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle',
  55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers',
  81: 'Rain showers', 82: 'Heavy rain showers', 95: 'Thunderstorm',
  96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail'
};

export const WeatherWidget: WidgetModule = {
  create(config: WidgetConfig, context: WidgetContext): HTMLElement {
    const element = document.createElement('article');
    element.className = 'widget weather-widget';
    element.innerHTML = `
      <div class="widget-heading">
        <h2></h2>
        <button class="maximize" aria-label="Maximize weather">⛶</button>
      </div>
      <div class="weather-location"></div>
      <div class="weather-temperature">--°</div>
      <div class="weather-description">Loading weather…</div>
      <div class="weather-details"></div>
      <div class="weather-footer">
        <span class="weather-updated">Last updated: —</span>
        <button class="refresh">Refresh</button>
      </div>`;

    element.querySelector('h2')!.textContent = config.title;
    element.querySelector('.weather-location')!.textContent = context.config.weather.locationLabel;

    element.querySelector('.maximize')!.addEventListener('click', () => {
      const maximize = !element.classList.contains('maximized');
      document.querySelectorAll('.widget').forEach(widget => widget.classList.remove('maximized'));
      document.body.classList.toggle('has-maximized', maximize);
      if (maximize) element.classList.add('maximized');
    });

    const showWeather = (data: WeatherData): void => {
      const current = data.current;
      element.querySelector('.weather-temperature')!.textContent =
        `${Math.round(current.temperature_2m)}°C`;
      element.querySelector('.weather-description')!.textContent =
        descriptions[current.weather_code] ?? 'Current conditions';
      element.querySelector('.weather-details')!.textContent =
        `Feels like ${Math.round(current.apparent_temperature)}°C · ` +
        `${current.relative_humidity_2m}% humidity · Wind ${current.wind_speed_10m} km/h`;

      const updated = new Date(data.fetchedAt).toLocaleString([], {
        dateStyle: 'short',
        timeStyle: 'short'
      });
      element.querySelector('.weather-updated')!.textContent =
        `Last updated: ${updated}${data.stale ? ' (offline cache)' : ''}`;
    };

    const refresh = async (force = false): Promise<void> => {
      const button = element.querySelector<HTMLButtonElement>('.refresh')!;
      button.disabled = true;

      try {
        showWeather(await context.getWeather(force));
      } catch {
        element.querySelector('.weather-description')!.textContent = 'Weather unavailable';
        element.querySelector('.weather-updated')!.textContent = 'Check your network connection';
      } finally {
        button.disabled = false;
      }
    };

    element.querySelector('.refresh')!.addEventListener('click', () => void refresh(true));
    void refresh();

    window.setInterval(
      () => void refresh(),
      (Number(context.config.weather.refreshHours) || 5) * 60 * 60 * 1000
    );

    return element;
  }
};