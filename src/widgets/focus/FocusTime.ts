import type { WidgetConfig, WidgetContext, WidgetModule } from '../../shared/types';

const defaultOptions = [
	{ id: 'pomodoro', label: 'Pomodoro', minutes: 25 },
	{ id: 'short-break', label: 'Short break', minutes: 5 },
	{ id: 'long-break', label: 'Long break', minutes: 15 }
];

export const FocusTime: WidgetModule = {
	create(config: WidgetConfig, context: WidgetContext): HTMLElement {
		const configuredOptions = context.config.focus?.options?.filter(option => option.minutes > 0);
		const options = configuredOptions?.length ? configuredOptions : defaultOptions;
		const element = document.createElement('section');
		element.className = 'widget focus-widget';
		element.innerHTML = `
			<div class="widget-heading">
				<div>
					<p class="focus-kicker">FOCUS TIMER</p>
					<h2></h2>
				</div>
				<button class="focus-maximize" type="button" aria-label="Maximize focus timer" title="Maximize focus timer">⛶</button>
			</div>
			<output class="focus-clock" aria-live="polite">25:00</output>
			<select class="focus-mode" aria-label="Session duration"></select>
			<div class="focus-actions">
				<button class="focus-start" type="button" aria-label="Start timer" title="Start timer">▶</button>
				<button class="focus-reset" type="button" aria-label="Reset timer" title="Reset timer">↻</button>
			</div>`;
		 element.querySelector('h2')!.textContent = config.title;

		const modeSelect = element.querySelector<HTMLSelectElement>('.focus-mode')!;
		const clock = element.querySelector<HTMLOutputElement>('.focus-clock')!;
		const startButton = element.querySelector<HTMLButtonElement>('.focus-start')!;
		const resetButton = element.querySelector<HTMLButtonElement>('.focus-reset')!;
		let remainingSeconds = 0;
		let timer: number | undefined;
		let complete = false;

		for (const option of options) {
			const item = document.createElement('option');
			item.value = option.id;
			item.textContent = `${option.label} · ${option.minutes} min`;
			modeSelect.append(item);
		}

		const selectedOption = () => options.find(option => option.id === modeSelect.value) ?? options[0];
		const renderTime = (): void => {
			const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
			const seconds = (remainingSeconds % 60).toString().padStart(2, '0');
			clock.textContent = `${minutes}:${seconds}`;
		};
		const stopTimer = (): void => {
			if (timer !== undefined) window.clearInterval(timer);
			timer = undefined;
		};
		const setStartAction = (icon: string, label: string): void => {
			startButton.textContent = icon;
			startButton.setAttribute('aria-label', label);
			startButton.title = label;
		};
		const resetTimer = (): void => {
			stopTimer();
			complete = false;
			element.classList.remove('focus-running', 'focus-complete');
			remainingSeconds = selectedOption().minutes * 60;
			setStartAction('▶', 'Start timer');
			renderTime();
		};

		element.querySelector('.focus-maximize')!.addEventListener('click', () => {
			const maximize = !element.classList.contains('maximized');
			document.querySelectorAll('.widget').forEach(widget => widget.classList.remove('maximized'));
			document.body.classList.toggle('has-maximized', maximize);
			if (maximize) element.classList.add('maximized');
		});

		modeSelect.addEventListener('change', resetTimer);
		resetButton.addEventListener('click', resetTimer);
		startButton.addEventListener('click', () => {
			if (complete) resetTimer();
			if (timer !== undefined) {
				stopTimer();
				element.classList.remove('focus-running');
				setStartAction('▶', 'Resume timer');
				return;
			}

			element.classList.add('focus-running');
			setStartAction('Ⅱ', 'Pause timer');
			timer = window.setInterval(() => {
				remainingSeconds -= 1;
				renderTime();
				if (remainingSeconds <= 0) {
					stopTimer();
					remainingSeconds = 0;
					renderTime();
					complete = true;
					element.classList.remove('focus-running');
					element.classList.add('focus-complete');
					setStartAction('▶', 'Start timer again');
				}
			}, 1000);
		});

		resetTimer();
		return element;
	}
};
