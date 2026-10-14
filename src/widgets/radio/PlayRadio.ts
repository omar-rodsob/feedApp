type RadioCategory = 'news' | 'music' | 'sports';

type RadioStation = {
  id: string;
  name: string;
  country: string;
  description: string;
  stream: string;
  category: RadioCategory;
};

const categoryLabels: Record<RadioCategory, string> = {
  news: 'News',
  music: 'Punk & Alt',
  sports: 'Sports'
};

const radioStations: RadioStation[] = [
  {
    id: 'imer-news',
    name: 'IMER Nois Radio',
    country: 'Mexico',
    description: 'imer.mx is a public radio station that provides news, culture, and music programming.',
    stream: 'https://s2.mexside.net/8014/stream',
    category: 'news'
  },
  {
    id: 'reactor',
    name: 'Reactor 105.7 FM',
    country: 'Mexico',
    description: 'Reactor',
    stream: 'https://s2.mexside.net/8002/stream',
    category: 'news'
  },
  {
    id: '181-punk',
    name: '181.FM Punk',
    country: 'United States',
    description: 'Fast punk, hardcore and loud alt culture.',
    stream: 'https://listen.181fm.com/181-punk_128k.mp3',
    category: 'music'
  },
  {
    id: 'soma-indie-pop',
    name: 'Soma FM Indie Pop Rocks',
    country: 'United States',
    description: 'Bright, guitar-driven indie and alternative vibes.',
    stream: 'https://ice1.somafm.com/indiepop-128-mp3',
    category: 'music'
  },
  {
    id: 'soma-black-rock',
    name: 'Soma FM Black Rock FM',
    country: 'United States',
    description: 'Independent, indie, and alternative playlists.',
    stream: 'https://ice1.somafm.com/brfm-128-mp3',
    category: 'music'
  },
  {
    id: 'soma-alt',
    name: 'Soma FM Alt Nation',
    country: 'United States',
    description: 'A modern blend of alternative and indie rock.',
    stream: 'https://ice1.somafm.com/alt-128-mp3',
    category: 'music'
  },
  {
    id: 'talk-sport',
    name: 'frecuencia deportiva',
    country: 'Mexico',
    description: 'frecuencia deportiva',
    stream: 'https://stream-287.surfernetwork.com/r1540b8e408uv?zt=eyJhbGciOiJIUzI1NiJ9.eyJzdHJlYW0iOiJyMTU0MGI4ZTQwOHV2IiwiaG9zdCI6InN0cmVhbS0yODcuc3VyZmVybmV0d29yay5jb20iLCJydHRsIjo1LCJqdGkiOiJGc2hGQWlFa1JSeVdFZmo2eHUySEhRIiwiaWF0IjoxNzkxOTQ0ODAxLCJleHAiOjE3OTE5NDQ4NjF9.fjwX4GAMfZfBTKGOW_IrIqQHLLLna-IXQmB6SBtRrf0',
    category: 'sports'
  },
  {
    id: 'bbc-five-live',
    name: 'W Radio',
    country: 'Mx',
    description: 'FW Radio deportiva',
    stream: 'https://26293.live.streamtheworld.com/TDW730AMAAC.aac?dist=onlineradiobox',
    category: 'sports'
  },
  {
    id: 'espn-radio',
    name: 'TUDN Radio',
    country: 'Mexico',
    description: 'TUDN Radio',
    stream: 'tu.streamguys1.com/tudnradio/playlist.m3u8?listeningSessionID=6a5a62a936cd65e4_7636935_E2F1Qk3g_MjE2LjI0Ni42MS4zOQ!!_0000001aY0f&downloadSessionID=0&aw_0_1st.playerId=webPIPplayer&key=4c5079ac77e6be3dde2cfec833634ef49f76206acc1e7c53c6557178377d8495&aw_0_req.gdpr=true&aw_0_1st.lmt=0&gpp=DBABBg~BUoAAAKA.QA&aw_0_req.gpp=DBABBg~BUoAAAKA.QA&gpp_sid=8',
    category: 'sports'
  }
];

let maximizeTarget: ChildNode | null = null;

export const RadioWidget = {
  create(config: { title: string }, _context: unknown): HTMLElement {
    const element = document.createElement('section');
    element.className = 'widget radio-widget';
    element.innerHTML = `
      <header class="widget-heading radio-header">
        <div>
          <p class="radio-kicker">LIVE STREAMS</p>
          <h2></h2>
        </div>
        <button class="radio-maximize" type="button" aria-label="Maximize radio" title="Maximize radio">⛶</button>
      </header>
      <div class="radio-categories" role="tablist" aria-label="Radio categories"></div>
      <div class="radio-stations" aria-live="polite"></div>
      <footer class="radio-player">
        <div class="radio-now-playing">
          <span class="radio-status-dot" aria-hidden="true"></span>
          <div>
            <strong class="radio-station-name">Select a station</strong>
            <span class="radio-station-meta">Nothing is playing right now</span>
          </div>
        </div>
        <button class="radio-toggle" type="button">Play</button>
      </footer>
      <audio class="radio-audio" preload="metadata"></audio>
    `;

    const title = element.querySelector('h2');
    if (title) title.textContent = config.title;

    const categories = element.querySelector<HTMLElement>('.radio-categories')!;
    const stationsList = element.querySelector<HTMLElement>('.radio-stations')!;
    const stationName = element.querySelector<HTMLElement>('.radio-station-name')!;
    const stationMeta = element.querySelector<HTMLElement>('.radio-station-meta')!;
    const toggleButton = element.querySelector<HTMLButtonElement>('.radio-toggle')!;
    const audio = element.querySelector<HTMLAudioElement>('.radio-audio')!;
    const maximizeButton = element.querySelector<HTMLButtonElement>('.radio-maximize')!;

    let currentCategory: RadioCategory = 'news';
    let currentStation: RadioStation | null = null;

    const updateNowPlaying = (): void => {
      if (!currentStation) {
        stationName.textContent = 'Select a station';
        stationMeta.textContent = 'Nothing is playing right now';
        return;
      }

      stationName.textContent = currentStation.name;
      stationMeta.textContent = `${currentStation.country} • ${currentStation.description}`;
    };

    const renderCategories = (): void => {
      categories.replaceChildren();
      (Object.keys(categoryLabels) as RadioCategory[]).forEach((category) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `radio-category${currentCategory === category ? ' is-active' : ''}`;
        button.textContent = categoryLabels[category];
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(currentCategory === category));
        button.addEventListener('click', () => {
          currentCategory = category;
          renderCategories();
          renderStations();
        });
        categories.append(button);
      });
    };

    const renderStations = (): void => {
      const available = radioStations.filter((station) => station.category === currentCategory);
      stationsList.replaceChildren();

      available.forEach((station) => {
        const stationItem = document.createElement('button');
        stationItem.type = 'button';
        stationItem.className = 'radio-station';
        stationItem.innerHTML = `
          <span class="radio-station-name-pill">${station.name}</span>
          <span class="radio-station-country">${station.country}</span>
        `;
        stationItem.title = `${station.name} — ${station.description}`;
        stationItem.addEventListener('click', () => {
          currentStation = station;
          updateNowPlaying();
          audio.src = station.stream;
          void audio.play().catch(() => {
            stationMeta.textContent = 'This stream could not be loaded in this browser.';
          });
        });
        stationsList.append(stationItem);
      });
    };

    toggleButton.addEventListener('click', () => {
      if (!currentStation) {
        const [firstStation] = radioStations.filter((station) => station.category === currentCategory);
        if (!firstStation) return;
        currentStation = firstStation;
      }

      if (audio.paused) {
        if (!audio.src) {
          audio.src = currentStation.stream;
        }
        void audio.play().catch(() => {
          stationMeta.textContent = 'This stream could not be loaded in this browser.';
        });
        return;
      }

      audio.pause();
      toggleButton.textContent = 'Play';
    });

    audio.addEventListener('play', () => {
      toggleButton.textContent = 'Pause';
      if (currentStation) updateNowPlaying();
    });

    audio.addEventListener('pause', () => {
      toggleButton.textContent = 'Play';
    });

    audio.addEventListener('error', () => {
      stationMeta.textContent = 'This stream is unavailable right now.';
      toggleButton.textContent = 'Play';
    });

    maximizeButton.addEventListener('click', () => {
      const shouldMaximize = !element.classList.contains('maximized');
      document.querySelectorAll('.widget').forEach((widget) => widget.classList.remove('maximized'));
      document.body.classList.toggle('has-maximized', shouldMaximize);

      if (shouldMaximize) {
        maximizeTarget = element.nextSibling;
        element.classList.add('maximized');
        element.parentElement?.prepend(element);
        maximizeButton.setAttribute('aria-label', 'Restore radio');
        maximizeButton.title = 'Restore radio';
      } else {
        const parent = element.parentElement;
        if (parent) parent.insertBefore(element, maximizeTarget && maximizeTarget.parentNode === parent ? maximizeTarget : null);
        maximizeButton.setAttribute('aria-label', 'Maximize radio');
        maximizeButton.title = 'Maximize radio';
      }
    });

    renderCategories();
    renderStations();
    updateNowPlaying();
    return element;
  }
} as const;
