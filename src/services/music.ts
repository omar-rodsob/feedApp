import { BrowserWindow, dialog } from 'electron';
import type { OpenDialogOptions } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { randomInt } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import type { MusicDirectoryListing, MusicTrack } from '../shared/types';

function libraryPath(userDataPath: string): string {
  return path.join(userDataPath, 'music-library.json');
}

function readMusicRoot(userDataPath: string): string | null {
  try {
    const value = JSON.parse(fs.readFileSync(libraryPath(userDataPath), 'utf8')) as { root?: unknown };
    return typeof value.root === 'string' ? value.root : null;
  } catch {
    return null;
  }
}

function saveMusicRoot(userDataPath: string, root: string): void {
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(libraryPath(userDataPath), JSON.stringify({ root }, null, 2));
}

function clearMusicRoot(userDataPath: string): void {
  try {
    fs.unlinkSync(libraryPath(userDataPath));
  } catch {
    // Ignore cleanup errors for a stale or missing library file.
  }
}

function isMissingMusicPath(error: unknown): boolean {
  const errno = error as NodeJS.ErrnoException | undefined;
  return errno?.code === 'ENOENT' || errno?.code === 'ENOTDIR';
}

export async function chooseMusicFolder(userDataPath: string): Promise<MusicDirectoryListing | null> {
  const options: OpenDialogOptions = {
    title: 'Choose your music folder',
    properties: ['openDirectory']
  };
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const result = focusedWindow
    ? await dialog.showOpenDialog(focusedWindow, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || !result.filePaths[0]) return null;

  try {
    const root = await fs.promises.realpath(result.filePaths[0]);
    saveMusicRoot(userDataPath, root);
    return browseMusicFolder(userDataPath, '');
  } catch (error) {
    if (isMissingMusicPath(error)) {
      throw new Error('Music folder is unavailable. The USB drive may be disconnected.');
    }
    throw error;
  }
}

export async function browseMusicFolder(
  userDataPath: string,
  relativePath: unknown
): Promise<MusicDirectoryListing> {
  const selectedRoot = readMusicRoot(userDataPath);
  if (!selectedRoot) throw new Error('Choose a music folder first');

  let root: string;
  try {
    root = await fs.promises.realpath(selectedRoot);
  } catch (error) {
    if (isMissingMusicPath(error)) {
      clearMusicRoot(userDataPath);
      throw new Error('Music folder is unavailable. The USB drive may be disconnected.');
    }
    throw error;
  }

  const requested = typeof relativePath === 'string' ? relativePath : '';
  const target = path.resolve(root, requested);
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Folder is outside the selected music library');
  }

  let actual: string;
  try {
    actual = await fs.promises.realpath(target);
  } catch (error) {
    if (isMissingMusicPath(error)) {
      throw new Error('Music folder is unavailable. The USB drive may be disconnected.');
    }
    throw error;
  }

  const actualRelative = path.relative(root, actual);
  if (actualRelative === '..' || actualRelative.startsWith(`..${path.sep}`) || path.isAbsolute(actualRelative)) {
    throw new Error('Folder is outside the selected music library');
  }

  const entries = await fs.promises.readdir(actual, { withFileTypes: true });
  const folders = entries.filter(entry => entry.isDirectory()).map(entry => ({
    name: entry.name,
    relativePath: path.posix.join(relative.split(path.sep).join('/'), entry.name)
  })).sort((first, second) => first.name.localeCompare(second.name));
  const playableExtensions = new Set(['.mp3', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.flac']);
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

export async function getRandomMp3Playlist(userDataPath: string): Promise<MusicTrack[]> {
  const selectedRoot = readMusicRoot(userDataPath);
  if (!selectedRoot) throw new Error('Choose a music folder first');

  let root: string;
  try {
    root = await fs.promises.realpath(selectedRoot);
  } catch (error) {
    if (isMissingMusicPath(error)) {
      clearMusicRoot(userDataPath);
      throw new Error('Music folder is unavailable. The USB drive may be disconnected.');
    }
    throw error;
  }

  const tracks: MusicTrack[] = [];
  const folders = [root];
  while (folders.length > 0) {
    const folder = folders.pop()!;
    const entries = await fs.promises.readdir(folder, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        folders.push(absolutePath);
      } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.mp3') {
        tracks.push({
          name: entry.name,
          relativePath: path.relative(root, absolutePath).split(path.sep).join('/'),
          source: pathToFileURL(absolutePath).href
        });
      }
    }
  }

  const playlistSize = Math.min(50, tracks.length);
  for (let index = 0; index < playlistSize; index += 1) {
    const randomIndex = index + randomInt(tracks.length - index);
    [tracks[index], tracks[randomIndex]] = [tracks[randomIndex], tracks[index]];
  }

  return tracks.slice(0, playlistSize);
}