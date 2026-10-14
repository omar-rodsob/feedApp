import { BrowserWindow, dialog, protocol } from 'electron';
import type { OpenDialogOptions } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
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

const videoMimeTypes: Record<string, string> = {
  '.avi': 'video/x-msvideo',
  '.flv': 'video/x-flv',
  '.m4v': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wmv': 'video/x-ms-wmv'
};

async function serveVideo(userDataPath: string, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.pathname.slice(1);
  if (url.hostname !== 'library' || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return new Response('Not found', { status: 404 });
  }

  const selectedRoot = readVideoRoot(userDataPath);
  if (!selectedRoot) return new Response('Video library not selected', { status: 404 });

  try {
    const root = await fs.promises.realpath(selectedRoot);
    const relativePath = Buffer.from(token, 'base64url').toString('utf8');
    const target = path.resolve(root, relativePath);
    const relative = path.relative(root, target);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      return new Response('Not found', { status: 404 });
    }

    const actual = await fs.promises.realpath(target);
    const actualRelative = path.relative(root, actual);
    if (actualRelative === '..' || actualRelative.startsWith(`..${path.sep}`) || path.isAbsolute(actualRelative)) {
      return new Response('Not found', { status: 404 });
    }

    const stats = await fs.promises.stat(actual);
    if (!stats.isFile()) return new Response('Not found', { status: 404 });

    const headers = new Headers({
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
      'Content-Type': videoMimeTypes[path.extname(actual).toLowerCase()] ?? 'application/octet-stream'
    });
    const range = request.headers.get('range');
    let start = 0;
    let end = stats.size - 1;
    let status = 200;

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        headers.set('Content-Range', `bytes */${stats.size}`);
        return new Response(null, { status: 416, headers });
      }
      if (match[1]) {
        start = Number(match[1]);
        end = match[2] ? Number(match[2]) : end;
      } else {
        const suffixLength = Number(match[2]);
        start = Math.max(stats.size - suffixLength, 0);
      }
      if (start >= stats.size || end < start) {
        headers.set('Content-Range', `bytes */${stats.size}`);
        return new Response(null, { status: 416, headers });
      }
      end = Math.min(end, stats.size - 1);
      status = 206;
      headers.set('Content-Range', `bytes ${start}-${end}/${stats.size}`);
    }

    headers.set('Content-Length', String(end - start + 1));
    if (request.method === 'HEAD') return new Response(null, { status, headers });

    const body = Readable.toWeb(fs.createReadStream(actual, { start, end })) as ReadableStream<Uint8Array>;
    return new Response(body, { status, headers });
  } catch {
    return new Response('Video unavailable', { status: 404 });
  }
}

export function registerVideoProtocol(userDataPath: string): void {
  protocol.handle('stream', request => serveVideo(userDataPath, request));
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
        source: `stream://library/${Buffer.from(path.relative(root, absolutePath).split(path.sep).join('/')).toString('base64url')}`
      };
    }).sort((first, second) => first.name.localeCompare(second.name));

  return {
    rootName: path.basename(root) || root,
    currentPath: relative.split(path.sep).join('/'),
    folders,
    tracks
  };
}
