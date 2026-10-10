import fs from 'node:fs';
import path from 'node:path';
import type { AppConfig, WeatherData } from '../shared/types';

function cachePath(userDataPath: string): string {
  return path.join(userDataPath, 'weather-cache.json');
}

function readCache(userDataPath: string): WeatherData | null {
  try {
    return JSON.parse(fs.readFileSync(cachePath(userDataPath), 'utf8')) as WeatherData;
  } catch {
    return null;
  }
}

function writeCache(userDataPath: string, data: WeatherData): void {
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(cachePath(userDataPath), JSON.stringify(data, null, 2));
}

export async function getWeather(
  userDataPath: string,
  weatherConfig: AppConfig['weather'],
  force = false
): Promise<WeatherData> {
  const cached = readCache(userDataPath);
  const refreshMs = (Number(weatherConfig.refreshHours) || 5) * 60 * 60 * 1000;

  if (!force && cached && Date.now() - cached.fetchedAt < refreshMs) return cached;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(weatherConfig.latitude),
    longitude: String(weatherConfig.longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
    timezone: 'auto'
  }).toString();

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);

    const result = await response.json() as { current: WeatherData['current'] };
    const data: WeatherData = {
      current: result.current,
      fetchedAt: Date.now(),
      locationLabel: weatherConfig.locationLabel
    };

    writeCache(userDataPath, data);
    return data;
  } catch (error) {
    if (cached) return { ...cached, stale: true };
    throw error;
  }
}