import type { NewsFeedData, NewsItem, WidgetConfig, WidgetContext, WidgetModule } from '../../shared/types';

const batchSize = 5;
const rotationMs = 60 * 1000;
const refreshMs = 4 * 60 * 60 * 1000;

export const NewsFeeds: WidgetModule = {
	create(config: WidgetConfig, context: WidgetContext): HTMLElement {
		const element = document.createElement('section');
		element.className = 'widget news-widget';
		element.innerHTML = `
			<div class="widget-heading">
				<div>
					<p class="news-kicker">MEXICO · GOOGLE NEWS</p>
					<h2></h2>
				</div>
				<button class="news-maximize" type="button" aria-label="Maximize news" title="Maximize news">⛶</button>
				<button class="news-refresh" type="button" aria-label="Refresh news" title="Refresh news">↻</button>
			</div>
			<div class="news-items" aria-live="polite"></div>
			<footer class="news-footer">
				<span class="news-updated">Waiting for news…</span>
				<span class="news-page"></span>
			</footer>`;
		element.querySelector('h2')!.textContent = config.title;

		const list = element.querySelector<HTMLElement>('.news-items')!;
		const refreshButton = element.querySelector<HTMLButtonElement>('.news-refresh')!;
		const maximizeButton = element.querySelector<HTMLButtonElement>('.news-maximize')!;
		const updatedLabel = element.querySelector<HTMLElement>('.news-updated')!;
		const pageLabel = element.querySelector<HTMLElement>('.news-page')!;
		let feed: NewsFeedData | null = null;
		let page = 0;
		let originalNextSibling: ChildNode | null = null;

		maximizeButton.addEventListener('click', () => {
			const maximize = !element.classList.contains('maximized');
			document.querySelectorAll('.widget').forEach(widget => widget.classList.remove('maximized'));
			document.body.classList.toggle('has-maximized', maximize);

			if (maximize) {
				originalNextSibling = element.nextSibling;
				element.classList.add('maximized');
				element.parentElement?.prepend(element);
				maximizeButton.setAttribute('aria-label', 'Restore news');
				maximizeButton.title = 'Restore news';
			} else {
				const parent = element.parentElement;
				if (parent) {
					const nextSibling = originalNextSibling?.parentNode === parent ? originalNextSibling : null;
					parent.insertBefore(element, nextSibling);
				}
				maximizeButton.setAttribute('aria-label', 'Maximize news');
				maximizeButton.title = 'Maximize news';
			}
		});

		const renderBatch = (): void => {
			if (!feed?.items.length) {
				list.innerHTML = '<p class="news-empty">No headlines available.</p>';
				pageLabel.textContent = '';
				return;
			}

			const pageCount = Math.ceil(feed.items.length / batchSize);
			page %= pageCount;
			const batch = feed.items.slice(page * batchSize, (page + 1) * batchSize);
			list.replaceChildren(...batch.map((item: NewsItem) => {
				const button = document.createElement('button');
				button.className = 'news-item';
				button.type = 'button';
				button.setAttribute('aria-label', `Open article: ${item.title}`);

				if (item.imageUrl) {
					const image = document.createElement('img');
					image.className = 'news-image';
					image.src = item.imageUrl;
					image.alt = '';
					image.loading = 'lazy';
					image.addEventListener('error', () => image.remove(), { once: true });
					button.append(image);
				} else {
					const imageFallback = document.createElement('span');
					imageFallback.className = 'news-image news-image-fallback';
					imageFallback.textContent = 'MX';
					button.append(imageFallback);
				}

				const content = document.createElement('span');
				content.className = 'news-copy';
				const title = document.createElement('span');
				title.className = 'news-title';
				title.textContent = item.title;
				const source = document.createElement('span');
				source.className = 'news-source';
				source.textContent = item.source || 'Google News';
				content.append(title, source);
				button.append(content);
				button.addEventListener('click', () => context.openArticle(item.link));
				return button;
			}));
			pageLabel.textContent = `${page + 1} / ${pageCount}`;
		};

		const updateNews = async (force = false): Promise<void> => {
			refreshButton.disabled = true;
			try {
				feed = await context.getNews(force);
				page = 0;
				renderBatch();
				const fetchedAt = new Date(feed.fetchedAt).toLocaleString([], {
					dateStyle: 'short',
					timeStyle: 'short'
				});
				updatedLabel.textContent = `Updated ${fetchedAt}${feed.stale ? ' · saved copy' : ''}`;
			} catch {
				if (!feed) list.innerHTML = '<p class="news-empty">News is unavailable. Check your connection.</p>';
				updatedLabel.textContent = 'Could not refresh news';
			} finally {
				refreshButton.disabled = false;
			}
		};

		refreshButton.addEventListener('click', () => void updateNews(true));
		void updateNews();
		window.setInterval(() => {
			if (!feed?.items.length) return;
			page = (page + 1) % Math.ceil(feed.items.length / batchSize);
			renderBatch();
		}, rotationMs);
		window.setInterval(() => void updateNews(), refreshMs);

		return element;
	}
};
