import { contextBridge, ipcRenderer } from 'electron';
import type { MediaDecision } from './services/media';

contextBridge.exposeInMainWorld('feedApp', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  getWeather: (force = false) => ipcRenderer.invoke('weather:get', force),
  getNews: (force = false) => ipcRenderer.invoke('news:get', force),
  getSports: (force = false) => ipcRenderer.invoke('sports:get', force),
  getTodoTasks: () => ipcRenderer.invoke('todo:get'),
  saveTodoTasks: (tasks: unknown) => ipcRenderer.invoke('todo:save', tasks),
  chooseMusicFolder: () => ipcRenderer.invoke('music:choose-folder'),
  browseMusicFolder: (relativePath: string) => ipcRenderer.invoke('music:browse-folder', relativePath),
  getRandomMp3Playlist: () => ipcRenderer.invoke('music:random-mp3-playlist'),
  chooseVideoFolder: () => ipcRenderer.invoke('video:choose-folder'),
  browseVideoFolder: (relativePath: string) => ipcRenderer.invoke('video:browse-folder', relativePath),
  getBluetoothDevices: (scan = false) => ipcRenderer.invoke('bluetooth:devices', scan),
  connectBluetooth: (address: string) => ipcRenderer.invoke('bluetooth:connect', address),
  disconnectBluetooth: (address: string) => ipcRenderer.invoke('bluetooth:disconnect', address),
  openMediaRequest: (request: { url: string; title?: string; type?: string; source?: string; autoPlay?: boolean }) =>
    ipcRenderer.invoke('media:open', request),
  getRecentMedia: () => ipcRenderer.invoke('media:recent'),
  onMediaRequest: (callback: (decision: MediaDecision) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, decision: MediaDecision): void => callback(decision);
    ipcRenderer.on('media:external-open', listener);
    return () => ipcRenderer.removeListener('media:external-open', listener);
  }
});