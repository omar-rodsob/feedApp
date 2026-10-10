import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('feedApp', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  getWeather: (force = false) => ipcRenderer.invoke('weather:get', force),
  getNews: (force = false) => ipcRenderer.invoke('news:get', force),
  getSports: (force = false) => ipcRenderer.invoke('sports:get', force),
  getTodoTasks: () => ipcRenderer.invoke('todo:get'),
  saveTodoTasks: (tasks: unknown) => ipcRenderer.invoke('todo:save', tasks),
  chooseMusicFolder: () => ipcRenderer.invoke('music:choose-folder'),
  browseMusicFolder: (relativePath: string) => ipcRenderer.invoke('music:browse-folder', relativePath)
});