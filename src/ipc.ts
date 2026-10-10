import { app, ipcMain } from 'electron';
import type { AppConfig } from './shared/types';
import { getNews } from './services/news';
import { getSports } from './services/sports';
import { getWeather } from './services/weather';
import { readTodoTasks, saveTodoTasks } from './services/todo';
import { browseMusicFolder, chooseMusicFolder } from './services/music';

export function registerIpc(config: AppConfig): void {
  const userDataPath = app.getPath('userData');

  ipcMain.handle('config:get', () => config);
  ipcMain.handle('weather:get', (_event, force: unknown) =>
    getWeather(userDataPath, config.weather, force === true)
  );
  ipcMain.handle('news:get', (_event, force: unknown) =>
    getNews(userDataPath, force === true)
  );
  ipcMain.handle('sports:get', (_event, force: unknown) =>
    getSports(userDataPath, force === true)
  );
  ipcMain.handle('todo:get', () => readTodoTasks(userDataPath, config.todo?.tasks));
  ipcMain.handle('todo:save', (_event, tasks: unknown) => saveTodoTasks(userDataPath, tasks));
  ipcMain.handle('music:choose-folder', () => chooseMusicFolder(userDataPath));
  ipcMain.handle('music:browse-folder', (_event, relativePath: unknown) =>
    browseMusicFolder(userDataPath, relativePath)
  );
}