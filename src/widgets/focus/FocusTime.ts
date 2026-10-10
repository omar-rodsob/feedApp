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
			<label class="focus-mode-label">Session
				<select class="focus-mode"></select>
			</label>
			<output class="focus-clock" aria-live="polite">25:00</output>
			<p class="focus-status" aria-live="polite">Ready when you are</p>
			<div class="focus-actions">
				<button class="focus-start" type="button">Start</button>
				<button class="focus-reset" type="button" aria-label="Reset timer" title="Reset timer">Reset</button>
			</div>`;
		 element.querySelector('h2')!.textContent = config.title;

		const modeSelect = element.querySelector<HTMLSelectElement>('.focus-mode')!;
		const clock = element.querySelector<HTMLOutputElement>('.focus-clock')!;
		const status = element.querySelector<HTMLElement>('.focus-status')!;
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
		const resetTimer = (): void => {
			stopTimer();
			complete = false;
			element.classList.remove('focus-complete');
			remainingSeconds = selectedOption().minutes * 60;
			startButton.textContent = 'Start';
			status.textContent = 'Ready when you are';
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
				startButton.textContent = 'Resume';
				status.textContent = 'Paused';
				return;
			}

			startButton.textContent = 'Pause';
			status.textContent = 'Session in progress';
			timer = window.setInterval(() => {
				remainingSeconds -= 1;
				renderTime();
				if (remainingSeconds <= 0) {
					stopTimer();
					remainingSeconds = 0;
					renderTime();
					complete = true;
					element.classList.add('focus-complete');
					startButton.textContent = 'Start again';
					status.textContent = 'Time’s up';
				}
			}, 1000);
		});

		resetTimer();
		return element;
	}
};
