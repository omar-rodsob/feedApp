import { app, ipcMain } from 'electron';
import type { AppConfig } from './shared/types';
import { getNews } from './services/news';
import { getSports } from './services/sports';
import { getWeather } from './services/weather';
import { readTodoTasks, saveTodoTasks } from './services/todo';
import { browseMusicFolder, chooseMusicFolder } from './services/music';
import { browseVideoFolder, chooseVideoFolder } from './services/video';
import { connectBluetooth, disconnectBluetooth, getBluetoothDevices } from './services/bluetooth';

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
  ipcMain.handle('video:choose-folder', () => chooseVideoFolder(userDataPath));
  ipcMain.handle('video:browse-folder', (_event, relativePath: unknown) =>
    browseVideoFolder(userDataPath, relativePath)
  );
  ipcMain.handle('bluetooth:devices', (_event, scan: unknown) =>
    getBluetoothDevices(scan === true)
  );
  ipcMain.handle('bluetooth:connect', (_event, address: unknown) =>
    connectBluetooth(address)
  );
  ipcMain.handle('bluetooth:disconnect', (_event, address: unknown) =>
    disconnectBluetooth(address)
  );
}