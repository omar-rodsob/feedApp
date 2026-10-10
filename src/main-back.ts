import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { AppConfig } from './shared/types';
import { registerIpc } from './ipc';

const config = JSON.parse(
  fs.readFileSync(path.join(app.getAppPath(), 'config.json'), 'utf8')
) as AppConfig;

function createWindow(): void {
  const window = new BrowserWindow({
    width: 800,
    height: 480,
    minWidth: 280,
    backgroundColor: '#101820',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  void window.loadFile(path.join(__dirname, '..', 'index.html'));
}

app.whenReady().then(() => {
  registerIpc(config);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});