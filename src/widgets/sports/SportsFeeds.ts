import type { SportsData, SportsGame, SportsHeadline, WidgetConfig, WidgetContext, WidgetModule } from '../../shared/types';

export const SportsFeeds: WidgetModule = {
	create(config: WidgetConfig, context: WidgetContext): HTMLElement {
		const element = document.createElement('section');
		element.className = 'widget sports-widget';
		element.innerHTML = `
			<header class="widget-heading sports-heading">
				<div>
					<p class="sports-kicker">NFL · NEXT GAME DAY</p>
					<h2></h2>
				</div>
				<div class="sports-actions">
					<button class="sports-maximize" type="button" aria-label="Maximize NFL" title="Maximize NFL">⛶</button>
					<button class="sports-refresh" type="button" aria-label="Refresh NFL schedule" title="Refresh NFL schedule">↻</button>
				</div>
			</header>
			<div class="sports-content">
				<section class="sports-schedule" aria-label="NFL schedule">
					<p class="sports-date">Finding the next game day…</p>
					<div class="sports-games" aria-live="polite"></div>
				</section>
				<section class="sports-headlines">
					<h3>NFL headlines</h3>
					<ol class="sports-headline-list"></ol>
				</section>
			</div>
			<footer class="sports-footer"><span class="sports-updated">Waiting for schedule…</span></footer>`;
		element.querySelector('h2')!.textContent = config.title;

		const gameDate = element.querySelector<HTMLElement>('.sports-date')!;
		const gamesList = element.querySelector<HTMLElement>('.sports-games')!;
		const headlinesList = element.querySelector<HTMLOListElement>('.sports-headline-list')!;
		const updatedLabel = element.querySelector<HTMLElement>('.sports-updated')!;
		const refreshButton = element.querySelector<HTMLButtonElement>('.sports-refresh')!;
		const maximizeButton = element.querySelector<HTMLButtonElement>('.sports-maximize')!;
		let originalNextSibling: ChildNode | null = null;

		maximizeButton.addEventListener('click', () => {
			const maximize = !element.classList.contains('maximized');
			document.querySelectorAll('.widget').forEach(widget => widget.classList.remove('maximized'));
			document.body.classList.toggle('has-maximized', maximize);

			if (maximize) {
				originalNextSibling = element.nextSibling;
				element.classList.add('maximized');
				element.parentElement?.prepend(element);
				maximizeButton.setAttribute('aria-label', 'Restore NFL');
				maximizeButton.title = 'Restore NFL';
			} else {
				const parent = element.parentElement;
				if (parent) {
					const nextSibling = originalNextSibling?.parentNode === parent ? originalNextSibling : null;
					parent.insertBefore(element, nextSibling);
				}
				maximizeButton.setAttribute('aria-label', 'Maximize NFL');
				maximizeButton.title = 'Maximize NFL';
			}
		});

		const renderGame = (game: SportsGame): HTMLElement => {
			const row = document.createElement('article');
			row.className = 'sports-game';
			const time = new Date(game.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
			row.innerHTML = `
				<div class="sports-matchup">
					<span class="sports-team sports-away"></span>
					<span class="sports-at">at</span>
					<span class="sports-team sports-home"></span>
				</div>
				<div class="sports-game-meta"><time></time><span class="sports-venue"></span><span class="sports-status"></span></div>`;
			const away = row.querySelector<HTMLElement>('.sports-away')!;
			const home = row.querySelector<HTMLElement>('.sports-home')!;
			const addTeam = (container: HTMLElement, name: string, logo: string): void => {
				if (logo) {
					const image = document.createElement('img');
					image.src = logo;
					image.alt = '';
					image.loading = 'lazy';
					image.addEventListener('error', () => image.remove(), { once: true });
					container.append(image);
				}
				const label = document.createElement('span');
				label.textContent = name;
				container.append(label);
			};
			addTeam(away, game.awayTeam, game.awayLogo);
			addTeam(home, game.homeTeam, game.homeLogo);
			row.querySelector('time')!.textContent = time;
			row.querySelector('.sports-venue')!.textContent = game.venue;
			row.querySelector('.sports-status')!.textContent = game.status;
			return row;
		};

		const render = (data: SportsData): void => {
			if (data.gameDate && data.games.length) {
				const date = new Date(`${data.gameDate}T12:00:00`);
				gameDate.textContent = `Games · ${date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}`;
				gamesList.replaceChildren(...data.games.map(renderGame));
			} else {
				gameDate.textContent = 'No upcoming games found';
				gamesList.innerHTML = '<p class="sports-empty">No games are listed in the upcoming schedule.</p>';
			}

			const headlines = data.headlines.slice(0, 5);
			headlinesList.replaceChildren(...headlines.map((headline: SportsHeadline) => {
				const item = document.createElement('li');
				const link = document.createElement('button');
				link.type = 'button';
				link.className = 'sports-headline';
				link.textContent = headline.title;
				link.addEventListener('click', () => context.openArticle(headline.link));
				item.append(link);
				return item;
			}));

			const updated = new Date(data.fetchedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
			updatedLabel.textContent = `Updated ${updated}${data.stale ? ' · saved copy' : ''}`;
		};

		const refresh = async (force = false): Promise<void> => {
			refreshButton.disabled = true;
			try {
				render(await context.getSports(force));
			} catch {
				gameDate.textContent = 'Schedule unavailable';
				gamesList.innerHTML = '<p class="sports-empty">Check your connection and refresh.</p>';
				updatedLabel.textContent = 'Could not load NFL data';
			} finally {
				refreshButton.disabled = false;
			}
		};

		refreshButton.addEventListener('click', () => void refresh(true));
		void refresh();
		window.setInterval(() => void refresh(), 4 * 60 * 60 * 1000);
		return element;
	}
};
