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
  create(_config: WidgetConfig, context: WidgetContext): HTMLElement {
    const element = document.createElement('article');
    element.className = 'widget weather-widget';
    element.innerHTML = `
      <div class="weather-current">
        <div class="weather-summary">
          <div class="weather-location"></div>
          <div class="weather-description">Loading weather…</div>
        </div>
        <div class="weather-temperature">--°</div>
      </div>
      <div class="weather-footer">
        <div class="weather-details"></div>
      </div>`;

    element.querySelector('.weather-location')!.textContent = context.config.weather.locationLabel;

    const showWeather = (data: WeatherData): void => {
      const current = data.current;
      element.querySelector('.weather-temperature')!.textContent =
        `${Math.round(current.temperature_2m)}°C`;
      element.querySelector('.weather-description')!.textContent =
        descriptions[current.weather_code] ?? 'Current conditions';
      element.querySelector('.weather-details')!.textContent =
        `Feels like ${Math.round(current.apparent_temperature)}°C · ` +
        `${current.relative_humidity_2m}% humidity · Wind ${current.wind_speed_10m} km/h`;
    };

    const refresh = async (): Promise<void> => {
      try {
        showWeather(await context.getWeather());
      } catch {
        element.querySelector('.weather-description')!.textContent = 'Weather unavailable';
      }
    };

    void refresh();

    window.setInterval(
      () => void refresh(),
      (Number(context.config.weather.refreshHours) || 5) * 60 * 60 * 1000
    );

    return element;
  }
};