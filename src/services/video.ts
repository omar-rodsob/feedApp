import { BrowserWindow, dialog } from 'electron';
import type { OpenDialogOptions } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { MusicDirectoryListing } from '../shared/types';

function libraryPath(userDataPath: string): string {
  return path.join(userDataPath, 'video-library.json');
}

function readVideoRoot(userDataPath: string): string | null {
  try {
    const value = JSON.parse(fs.readFileSync(libraryPath(userDataPath), 'utf8')) as { root?: unknown };
    return typeof value.root === 'string' ? value.root : null;
  } catch {
    return null;
  }
}

function saveVideoRoot(userDataPath: string, root: string): void {
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(libraryPath(userDataPath), JSON.stringify({ root }, null, 2));
}

function clearVideoRoot(userDataPath: string): void {
  try {
    fs.unlinkSync(libraryPath(userDataPath));
  } catch {
    // Ignore stale or missing library files.
  }
}

function isMissingVideoPath(error: unknown): boolean {
  const errno = error as NodeJS.ErrnoException | undefined;
  return errno?.code === 'ENOENT' || errno?.code === 'ENOTDIR';
}

export async function chooseVideoFolder(userDataPath: string): Promise<MusicDirectoryListing | null> {
  const options: OpenDialogOptions = {
    title: 'Choose your videos folder',
    properties: ['openDirectory']
  };
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const result = focusedWindow
    ? await dialog.showOpenDialog(focusedWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || !result.filePaths[0]) return null;

  try {
    const root = await fs.promises.realpath(result.filePaths[0]);
    saveVideoRoot(userDataPath, root);
    return browseVideoFolder(userDataPath, '');
  } catch (error) {
    if (isMissingVideoPath(error)) {
      throw new Error('Video folder is unavailable. The USB drive may be disconnected.');
    }
    throw error;
  }
}

export async function browseVideoFolder(
  userDataPath: string,
  relativePath: unknown
): Promise<MusicDirectoryListing> {
  const selectedRoot = readVideoRoot(userDataPath);
  if (!selectedRoot) throw new Error('Choose a video folder first');

  let root: string;
  try {
    root = await fs.promises.realpath(selectedRoot);
  } catch (error) {
    if (isMissingVideoPath(error)) {
      clearVideoRoot(userDataPath);
      throw new Error('Video folder is unavailable. The USB drive may be disconnected.');
    }
    throw error;
  }

  const requested = typeof relativePath === 'string' ? relativePath : '';
  const target = path.resolve(root, requested);
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Folder is outside the selected video library');
  }

  let actual: string;
  try {
    actual = await fs.promises.realpath(target);
  } catch (error) {
    if (isMissingVideoPath(error)) {
      throw new Error('Video folder is unavailable. The USB drive may be disconnected.');
    }
    throw error;
  }

  const actualRelative = path.relative(root, actual);
  if (actualRelative === '..' || actualRelative.startsWith(`..${path.sep}`) || path.isAbsolute(actualRelative)) {
    throw new Error('Folder is outside the selected video library');
  }

  const entries = await fs.promises.readdir(actual, { withFileTypes: true });
  const folders = entries.filter(entry => entry.isDirectory()).map(entry => ({
    name: entry.name,
    relativePath: path.posix.join(relative.split(path.sep).join('/'), entry.name)
  })).sort((first, second) => first.name.localeCompare(second.name));
  const playableExtensions = new Set(['.mp4', '.m4v', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.flv']);
  const tracks = entries.filter(entry => entry.isFile() && playableExtensions.has(path.extname(entry.name).toLowerCase()))
    .map(entry => {
      const absolutePath = path.join(actual, entry.name);
      return {
        name: entry.name,
        relativePath: path.posix.join(relative.split(path.sep).join('/'), entry.name),
        source: pathToFileURL(absolutePath).href
      };
    }).sort((first, second) => first.name.localeCompare(second.name));

  return {
    rootName: path.basename(root) || root,
    currentPath: relative.split(path.sep).join('/'),
    folders,
    tracks
  };
}
