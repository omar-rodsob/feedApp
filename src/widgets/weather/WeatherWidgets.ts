import type { WidgetConfig, WidgetContext, WidgetModule, WeatherData } from '../../shared/types';

const descriptions: Record<number, string> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle',
  55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers',
  81: 'Rain showers', 82: 'Heavy rain showers', 95: 'Thunderstorm',
  96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail'
};

const weatherIcons: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️', 51: '🌦️', 53: '🌧️',
  55: '🌧️', 61: '🌦️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '❄️', 75: '❄️', 80: '🌦️',
  81: '🌧️', 82: '🌧️', 95: '⛈️',
  96: '⛈️', 99: '⛈️'
};

export const WeatherWidget: WidgetModule = {
  create(_config: WidgetConfig, context: WidgetContext): HTMLElement {
    const element = document.createElement('article');
    element.className = 'widget weather-widget';
    element.innerHTML = `
      <div class="weather-current">
        <div class="weather-summary">
          <div class="weather-location"></div>
          <div class="weather-description" aria-label="Current weather">☀️</div>
        </div>
        <div class="weather-temperature">--°</div>
      </div>
      <div class="weather-footer">
        <div class="weather-metrics">
          <div class="weather-metric weather-feels-like">
            <span class="weather-metric-icon" aria-hidden="true">🌡</span>
            <span class="weather-metric-value">--°C</span>
          </div>
          <div class="weather-metric weather-humidity">
            <span class="weather-metric-icon" aria-hidden="true">💧</span>
            <span class="weather-metric-value">--%</span>
          </div>
          <div class="weather-metric weather-wind">
            <span class="weather-metric-icon" aria-hidden="true">💨</span>
            <span class="weather-metric-value">-- km/h</span>
          </div>
        </div>
      </div>`;

    element.querySelector('.weather-location')!.textContent = context.config.weather.locationLabel;
    const weatherDescription = element.querySelector<HTMLElement>('.weather-description');

    const showWeather = (data: WeatherData): void => {
      const current = data.current;
      element.querySelector('.weather-temperature')!.textContent =
        `${Math.round(current.temperature_2m)}°C`;
      if (weatherDescription) {
        weatherDescription.textContent = weatherIcons[current.weather_code] ?? '☀️';
        weatherDescription.setAttribute('title', descriptions[current.weather_code] ?? 'Current conditions');
      }
      element.querySelector('.weather-feels-like .weather-metric-value')!.textContent =
        `${Math.round(current.apparent_temperature)}°C`;
      element.querySelector('.weather-humidity .weather-metric-value')!.textContent =
        `${current.relative_humidity_2m}%`;
      element.querySelector('.weather-wind .weather-metric-value')!.textContent =
        `${current.wind_speed_10m} km/h`;
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