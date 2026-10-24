import type { MusicDirectoryListing, MusicTrack, WidgetConfig, WidgetContext, WidgetModule } from '../../shared/types';

export const VideoWidget: WidgetModule = {
  create(config: WidgetConfig, context: WidgetContext): HTMLElement {
    const element = document.createElement('section');
    element.className = 'widget video-widget';
    element.innerHTML = `
      <header class="widget-heading video-heading">
        <div><p class="video-kicker">LOCAL VIDEO LIBRARY</p><h2></h2></div>
        <div class="video-header-actions">
          <button class="video-maximize" type="button" aria-label="Maximize video" title="Maximize video">⛶</button>
          <button class="video-select-root" type="button" aria-label="Choose video folder" title="Choose video folder">▰</button>
        </div>
      </header>
      <div class="video-browser">
        <div class="video-library-bar">
          <button class="video-up" type="button" aria-label="Go to parent folder" title="Parent folder">↑</button>
          <nav class="video-breadcrumb" aria-label="Video folder path"></nav>
          <span class="video-library-name"></span>
        </div>
        <p class="video-message" aria-live="polite">Choose a folder on your computer or USB drive.</p>
        <div class="video-entries" aria-live="polite"></div>
      </div>
      <footer class="video-player">
        <div class="video-track-info">
          <span class="video-note" aria-hidden="true">▶</span>
          <div>
            <strong class="video-track-title">No video selected</strong>
            <span class="video-track-location">Choose a video to open it full screen</span>
          </div>
        </div>
        <button class="video-open" type="button" aria-label="Open full screen" title="Open full screen">⤢</button>
      </footer>
    `;

    const titleNode = element.querySelector('h2');
    if (titleNode) titleNode.textContent = config.title;

    const entries = element.querySelector<HTMLElement>('.video-entries')!;
    const message = element.querySelector<HTMLElement>('.video-message')!;
    const breadcrumb = element.querySelector<HTMLElement>('.video-breadcrumb')!;
    const libraryName = element.querySelector<HTMLElement>('.video-library-name')!;
    const chooseButton = element.querySelector<HTMLButtonElement>('.video-select-root')!;
    const upButton = element.querySelector<HTMLButtonElement>('.video-up')!;
    const openButton = element.querySelector<HTMLButtonElement>('.video-open')!;
    const title = element.querySelector<HTMLElement>('.video-track-title')!;
    const location = element.querySelector<HTMLElement>('.video-track-location')!;
    let listing: MusicDirectoryListing | null = null;
    let currentVideos: MusicTrack[] = [];
    let selectedVideo = -1;
    let originalNextSibling: ChildNode | null = null;

    const setMessage = (text: string): void => {
      message.textContent = text;
      message.hidden = !text;
    };

    const getCompatibilityWarning = (fileName: string): string | null => {
      const lower = fileName.toLowerCase();
      if (lower.endsWith('.mkv') || lower.endsWith('.avi') || lower.endsWith('.wmv')) {
        return 'Warning: this container often has codec issues in Electron/Chromium. Audio may play while video stays black. Try MP4 or WebM for reliable playback.';
      }
      return null;
    };

    const openFullScreenVideo = async (video: MusicTrack): Promise<void> => {
      const overlay = document.createElement('div');
      overlay.className = 'video-fullscreen-overlay';
      overlay.innerHTML = `
        <div class="video-fullscreen-shell">
          <button class="video-close" type="button" aria-label="Close video">Close</button>
          <video class="video-fullscreen-player" controls autoplay playsinline></video>
        </div>
      `;

      const player = overlay.querySelector<HTMLVideoElement>('.video-fullscreen-player')!;
      const closeButton = overlay.querySelector<HTMLButtonElement>('.video-close')!;
      const compatibilityWarning = getCompatibilityWarning(video.name);
      player.src = video.source;
      player.setAttribute('title', video.name);
      if (compatibilityWarning) {
        const warning = document.createElement('div');
        warning.className = 'video-compatibility-warning';
        warning.textContent = compatibilityWarning;
        overlay.querySelector('.video-fullscreen-shell')!.appendChild(warning);
      }
      document.body.append(overlay);

      const finish = (): void => {
        player.pause();
        overlay.remove();
      };

      closeButton.addEventListener('click', finish);
      overlay.addEventListener('click', event => {
        if (event.target === overlay) finish();
      });
      player.addEventListener('ended', finish);

      try {
        await player.requestFullscreen();
      } catch {
        // Some browsers or circumstances may not allow fullscreen automatically.
      }
    };

    const renderListing = (data: MusicDirectoryListing): void => {
      listing = data;
      currentVideos = data.tracks;
      libraryName.textContent = data.rootName;
      upButton.disabled = !data.currentPath;

      const segments = data.currentPath ? data.currentPath.split('/').filter(Boolean) : [];
      breadcrumb.replaceChildren();
      const rootButton = document.createElement('button');
      rootButton.type = 'button';
      rootButton.textContent = data.rootName;
      rootButton.addEventListener('click', () => void browse(''));
      breadcrumb.append(rootButton);

      segments.forEach((segment, index) => {
        const separator = document.createElement('span');
        separator.textContent = '/';
        separator.setAttribute('aria-hidden', 'true');
        breadcrumb.append(separator);

        if (index === segments.length - 1) {
          const current = document.createElement('span');
          current.textContent = segment;
          current.setAttribute('aria-current', 'location');
          breadcrumb.append(current);
        } else {
          const pathButton = document.createElement('button');
          pathButton.type = 'button';
          pathButton.textContent = segment;
          pathButton.addEventListener('click', () => void browse(segments.slice(0, index + 1).join('/')));
          breadcrumb.append(pathButton);
        }
      });

      const rows: HTMLElement[] = [];
      for (const folder of data.folders) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'video-entry video-folder';
        button.innerHTML = '<span class="video-entry-icon" aria-hidden="true">▰</span><span class="video-entry-name"></span><span class="video-entry-hint">Folder</span>';
        button.querySelector('.video-entry-name')!.textContent = folder.name;
        button.addEventListener('click', () => void browse(folder.relativePath));
        rows.push(button);
      }

      for (const [index, track] of data.tracks.entries()) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'video-entry video-file';
        button.innerHTML = '<span class="video-entry-preview"><video class="video-entry-thumbnail" muted playsinline preload="metadata" aria-hidden="true"></video><span class="video-entry-icon" aria-hidden="true">▶</span></span><span class="video-entry-name"></span><span class="video-entry-hint">Video</span>';
        button.querySelector('.video-entry-name')!.textContent = track.name;
        const thumbnail = button.querySelector<HTMLVideoElement>('.video-entry-thumbnail')!;
        thumbnail.src = track.source;
        thumbnail.addEventListener('loadeddata', () => button.classList.add('video-entry-has-thumbnail'), { once: true });
        thumbnail.addEventListener('loadedmetadata', () => {
          if (thumbnail.duration > 0) thumbnail.currentTime = Math.min(0.1, thumbnail.duration / 2);
        }, { once: true });
        thumbnail.addEventListener('seeked', () => thumbnail.pause(), { once: true });
        thumbnail.addEventListener('error', () => button.classList.add('video-entry-unavailable'), { once: true });
        button.addEventListener('click', () => {
          selectedVideo = index;
          title.textContent = track.name;
          const compatibilityWarning = getCompatibilityWarning(track.name);
          location.textContent = compatibilityWarning ?? (listing?.currentPath ? `${listing.currentPath}/${track.name}` : track.name);
          void openFullScreenVideo(track);
        });
        rows.push(button);
      }

      entries.replaceChildren(...rows);
      setMessage(rows.length ? '' : 'This folder has no subfolders or supported video files.');
    };

    const browse = async (relativePath: string): Promise<void> => {
      setMessage('Reading folder…');
      try {
        renderListing(await context.browseVideoFolder(relativePath));
      } catch {
        entries.replaceChildren();
        setMessage('Video folder is unavailable. The USB drive may be disconnected. Choose the folder again.');
        libraryName.textContent = '';
      }
    };

    const chooseFolder = async (): Promise<void> => {
      chooseButton.disabled = true;
      setMessage('Choose a video folder…');
      try {
        const selected = await context.chooseVideoFolder();
        if (selected) renderListing(selected);
      } catch {
        setMessage('Could not open that folder. Check the drive and try again.');
      } finally {
        chooseButton.disabled = false;
      }
    };

    chooseButton.addEventListener('click', () => void chooseFolder());
    upButton.addEventListener('click', () => {
      if (!listing?.currentPath) return;
      void browse(listing.currentPath.split('/').slice(0, -1).join('/'));
    });

    openButton.addEventListener('click', () => {
      if (selectedVideo >= 0 && currentVideos[selectedVideo]) {
        void openFullScreenVideo(currentVideos[selectedVideo]);
      }
    });

    element.querySelector<HTMLButtonElement>('.video-maximize')!.addEventListener('click', event => {
      const button = event.currentTarget as HTMLButtonElement;
      const maximize = !element.classList.contains('maximized');
      document.querySelectorAll('.widget').forEach(widget => widget.classList.remove('maximized'));
      document.body.classList.toggle('has-maximized', maximize);

      if (maximize) {
        originalNextSibling = element.nextSibling;
        element.classList.add('maximized');
        element.parentElement?.prepend(element);
        button.setAttribute('aria-label', 'Restore video');
        button.title = 'Restore video';
      } else {
        const parent = element.parentElement;
        if (parent) parent.insertBefore(element, originalNextSibling?.parentNode === parent ? originalNextSibling : null);
        button.setAttribute('aria-label', 'Maximize video');
        button.title = 'Maximize video';
      }
    });

    void browse('');
    return element;
  }
};
