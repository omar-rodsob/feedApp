import type { MusicDirectoryListing, MusicTrack, WidgetConfig, WidgetContext, WidgetModule } from '../../shared/types';

const formatTime = (seconds: number): string => {
	if (!Number.isFinite(seconds)) return '0:00';
	const minutes = Math.floor(seconds / 60);
	return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
};

export const MusicWidget: WidgetModule = {
	create(config: WidgetConfig, context: WidgetContext): HTMLElement {
		const element = document.createElement('section');
		element.className = 'widget music-widget';
		element.innerHTML = `
			<header class="widget-heading music-heading">
				<div><p class="music-kicker">LOCAL LIBRARY</p><h2></h2></div>
			<div class="music-header-actions">
				<button class="music-maximize" type="button" aria-label="Maximize music" title="Maximize music">⛶</button>
				<button class="music-select-root" type="button">Choose folder</button>
			</div>
			</header>
			<div class="music-browser">
				<div class="music-library-bar"><button class="music-up" type="button" aria-label="Go to parent folder" title="Parent folder">↑</button><nav class="music-breadcrumb" aria-label="Music folder path"></nav><span class="music-library-name"></span></div>
				<p class="music-message" aria-live="polite">Choose a folder on your computer or USB drive.</p>
				<div class="music-entries" aria-live="polite"></div>
			</div>
			<footer class="music-player">
				<div class="music-track-info"><span class="music-note" aria-hidden="true">♫</span><div><strong class="music-track-title">Nothing playing</strong><span class="music-track-location"></span></div></div>
				<div class="music-transport"><div class="music-transport-buttons"><button class="music-previous" type="button" aria-label="Previous track" title="Previous track">|◀</button><button class="music-play" type="button" aria-label="Play" title="Play">▶</button><button class="music-next" type="button" aria-label="Next track" title="Next track">▶|</button></div><div class="music-progress-row"><span class="music-current-time">0:00</span><input class="music-seek" type="range" min="0" max="1000" value="0" aria-label="Seek"><span class="music-duration">0:00</span></div></div>
				<label class="music-volume-label" title="Volume">♪<input class="music-volume" type="range" min="0" max="1" step="0.01" value="0.8" aria-label="Volume"></label>
				<audio class="music-audio" preload="metadata"></audio>
			</footer>`;
		element.querySelector('h2')!.textContent = config.title;

		const entries = element.querySelector<HTMLElement>('.music-entries')!;
		const message = element.querySelector<HTMLElement>('.music-message')!;
		const breadcrumb = element.querySelector<HTMLElement>('.music-breadcrumb')!;
		const libraryName = element.querySelector<HTMLElement>('.music-library-name')!;
		const chooseButton = element.querySelector<HTMLButtonElement>('.music-select-root')!;
		const upButton = element.querySelector<HTMLButtonElement>('.music-up')!;
		const audio = element.querySelector<HTMLAudioElement>('.music-audio')!;
		const playButton = element.querySelector<HTMLButtonElement>('.music-play')!;
		const seek = element.querySelector<HTMLInputElement>('.music-seek')!;
		const currentTime = element.querySelector<HTMLElement>('.music-current-time')!;
		const duration = element.querySelector<HTMLElement>('.music-duration')!;
		const title = element.querySelector<HTMLElement>('.music-track-title')!;
		const location = element.querySelector<HTMLElement>('.music-track-location')!;
		const previousButton = element.querySelector<HTMLButtonElement>('.music-previous')!;
		const nextButton = element.querySelector<HTMLButtonElement>('.music-next')!;
		let listing: MusicDirectoryListing | null = null;
		let currentTracks: MusicTrack[] = [];
		let selectedTrack = -1;
		let originalNextSibling: ChildNode | null = null;

		const setMessage = (text: string): void => {
			message.textContent = text;
			message.hidden = !text;
		};

		const playTrack = async (index: number): Promise<void> => {
			const track = currentTracks[index];
			if (!track) return;
			selectedTrack = index;
			audio.src = track.source;
			title.textContent = track.name.replace(/\.[^.]+$/, '');
			location.textContent = listing?.currentPath ? `${listing.currentPath}/${track.name}` : track.name;
			entries.querySelectorAll('.music-track').forEach((row, rowIndex) => row.classList.toggle('is-playing', rowIndex === index));
			try {
				await audio.play();
			} catch {
				setMessage('This file could not be played. Try another audio format.');
			}
		};

		const renderListing = (data: MusicDirectoryListing): void => {
			listing = data;
			currentTracks = data.tracks;
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
				button.className = 'music-entry music-folder';
				button.innerHTML = '<span class="music-entry-icon" aria-hidden="true">▰</span><span class="music-entry-name"></span><span class="music-entry-hint">Folder</span>';
				button.querySelector('.music-entry-name')!.textContent = folder.name;
				button.addEventListener('click', () => void browse(folder.relativePath));
				rows.push(button);
			}
			for (const [index, track] of data.tracks.entries()) {
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'music-entry music-track';
				button.innerHTML = '<span class="music-entry-icon" aria-hidden="true">♫</span><span class="music-entry-name"></span><span class="music-entry-hint">Audio</span>';
				button.querySelector('.music-entry-name')!.textContent = track.name;
				button.addEventListener('click', () => void playTrack(index));
				rows.push(button);
			}
			entries.replaceChildren(...rows);
			setMessage(rows.length ? '' : 'This folder has no subfolders or supported audio files.');
		};

		const browse = async (relativePath: string): Promise<void> => {
			setMessage('Reading folder…');
			try {
				renderListing(await context.browseMusicFolder(relativePath));
			} catch {
				entries.replaceChildren();
				setMessage('Music folder is unavailable. The USB drive may be disconnected. Choose the folder again.');
				libraryName.textContent = '';
			}
		};

		const chooseFolder = async (): Promise<void> => {
			chooseButton.disabled = true;
			setMessage('Choose a music folder…');
			try {
				const selected = await context.chooseMusicFolder();
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
		playButton.addEventListener('click', () => {
			if (audio.paused) {
				if (selectedTrack < 0) void playTrack(0);
				else void audio.play().catch(() => setMessage('This file could not be played.'));
			} else audio.pause();
		});
		previousButton.addEventListener('click', () => {
			if (currentTracks.length) void playTrack((selectedTrack - 1 + currentTracks.length) % currentTracks.length);
		});
		nextButton.addEventListener('click', () => {
			if (currentTracks.length) void playTrack((selectedTrack + 1) % currentTracks.length);
		});
		audio.addEventListener('play', () => {
			playButton.textContent = 'Ⅱ';
			playButton.setAttribute('aria-label', 'Pause');
			playButton.title = 'Pause';
		});
		audio.addEventListener('pause', () => {
			playButton.textContent = '▶';
			playButton.setAttribute('aria-label', 'Play');
			playButton.title = 'Play';
		});
		audio.addEventListener('timeupdate', () => {
			currentTime.textContent = formatTime(audio.currentTime);
			seek.value = String(audio.duration ? audio.currentTime / audio.duration * 1000 : 0);
		});
		audio.addEventListener('loadedmetadata', () => { duration.textContent = formatTime(audio.duration); });
		audio.addEventListener('ended', () => {
			if (selectedTrack + 1 < currentTracks.length) void playTrack(selectedTrack + 1);
		});
		audio.addEventListener('error', () => setMessage('This file could not be played. Try another audio format.'));
		seek.addEventListener('input', () => {
			if (audio.duration) audio.currentTime = Number(seek.value) / 1000 * audio.duration;
		});
		element.querySelector<HTMLInputElement>('.music-volume')!.addEventListener('input', event => {
			audio.volume = Number((event.currentTarget as HTMLInputElement).value);
		});
		element.querySelector('.music-maximize')!.addEventListener('click', event => {
			const button = event.currentTarget as HTMLButtonElement;
			const maximize = !element.classList.contains('maximized');
			document.querySelectorAll('.widget').forEach(widget => widget.classList.remove('maximized'));
			document.body.classList.toggle('has-maximized', maximize);
			if (maximize) {
				originalNextSibling = element.nextSibling;
				element.classList.add('maximized');
				element.parentElement?.prepend(element);
				button.setAttribute('aria-label', 'Restore music');
				button.title = 'Restore music';
			} else {
				const parent = element.parentElement;
				if (parent) parent.insertBefore(element, originalNextSibling?.parentNode === parent ? originalNextSibling : null);
				button.setAttribute('aria-label', 'Maximize music');
				button.title = 'Maximize music';
			}
		});

		void browse('');
		return element;
	}
};