import type { TodoTask, WidgetConfig, WidgetContext, WidgetModule } from '../../shared/types';

const todayKey = (): string => {
	const date = new Date();
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const localDate = (key: string): Date => new Date(`${key}T12:00:00`);

const taskIsDue = (task: TodoTask, date: Date): boolean => {
	if (task.kind === 'event') return task.date === todayKey();
	if (task.recurrence === 'daily') return true;
	if (task.recurrence === 'weekly') return task.dayOfWeek === date.getDay();
	if (task.recurrence === 'monthly') {
		const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
		return task.dayOfMonth === 'last'
			? date.getDate() === lastDay
			: task.dayOfMonth === date.getDate();
	}
	return false;
};

const displayDate = (key: string): string => localDate(key).toLocaleDateString([], {
	weekday: 'short', month: 'short', day: 'numeric'
});

export const TodoWidget: WidgetModule = {
	create(config: WidgetConfig, context: WidgetContext): HTMLElement {
		const element = document.createElement('section');
		element.className = 'widget todo-widget';
		element.innerHTML = `
			<header class="widget-heading todo-heading">
				<div><p class="todo-kicker">TODAY</p><h2></h2></div>
				<div class="todo-actions">
					<button class="todo-maximize" type="button" aria-label="Maximize tasks" title="Maximize tasks">⛶</button>
					<button class="todo-add" type="button" aria-label="Add task" title="Add task">+</button>
				</div>
			</header>
			<p class="todo-summary" aria-live="polite">Loading tasks…</p>
			<form class="todo-form" hidden>
				<label class="todo-title-field">Task<input name="title" type="text" maxlength="100" required placeholder="What needs doing?"></label>
				<label>Type<select name="kind"><option value="routine">Routine</option><option value="event">One-time event</option></select></label>
				<label class="todo-recurrence-field">Repeats<select name="recurrence"><option value="daily">Every day</option><option value="weekly">Every week</option><option value="monthly">Every month</option></select></label>
				<label class="todo-weekday-field" hidden>Day<select name="dayOfWeek"><option value="0">Sunday</option><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option></select></label>
				<label class="todo-monthday-field" hidden>Day of month<select name="dayOfMonth"><option value="last">Last day</option>${Array.from({ length: 31 }, (_, index) => `<option value="${index + 1}">${index + 1}</option>`).join('')}</select></label>
				<label class="todo-event-date-field" hidden>Date<input name="date" type="date"></label>
				<label class="todo-event-time-field" hidden>Time<input name="time" type="time"></label>
				<div class="todo-form-actions"><button class="todo-cancel" type="button">Cancel</button><button type="submit">Save task</button></div>
			</form>
			<div class="todo-lists">
				<section class="todo-today-section"><h3>Due today</h3><ul class="todo-today-list"></ul></section>
				<section class="todo-upcoming-section"><h3>Coming up</h3><ul class="todo-upcoming-list"></ul></section>
			</div>
			<footer class="todo-footer" aria-live="polite"></footer>`;
		element.querySelector('h2')!.textContent = config.title;

		const form = element.querySelector<HTMLFormElement>('.todo-form')!;
		const kindSelect = form.elements.namedItem('kind') as HTMLSelectElement;
		const recurrenceSelect = form.elements.namedItem('recurrence') as HTMLSelectElement;
		const todayList = element.querySelector<HTMLUListElement>('.todo-today-list')!;
		const upcomingList = element.querySelector<HTMLUListElement>('.todo-upcoming-list')!;
		const summary = element.querySelector<HTMLElement>('.todo-summary')!;
		const footer = element.querySelector<HTMLElement>('.todo-footer')!;
		const maximizeButton = element.querySelector<HTMLButtonElement>('.todo-maximize')!;
		let tasks: TodoTask[] = [];
		let editingId: string | null = null;
		let originalNextSibling: ChildNode | null = null;

		maximizeButton.addEventListener('click', () => {
			const maximize = !element.classList.contains('maximized');
			document.querySelectorAll('.widget').forEach(widget => widget.classList.remove('maximized'));
			document.body.classList.toggle('has-maximized', maximize);

			if (maximize) {
				originalNextSibling = element.nextSibling;
				element.classList.add('maximized');
				element.parentElement?.prepend(element);
				maximizeButton.setAttribute('aria-label', 'Restore tasks');
				maximizeButton.title = 'Restore tasks';
			} else {
				const parent = element.parentElement;
				if (parent) {
					const nextSibling = originalNextSibling?.parentNode === parent ? originalNextSibling : null;
					parent.insertBefore(element, nextSibling);
				}
				maximizeButton.setAttribute('aria-label', 'Maximize tasks');
				maximizeButton.title = 'Maximize tasks';
			}
		});

		const updateFields = (): void => {
			const event = kindSelect.value === 'event';
			form.querySelector<HTMLElement>('.todo-recurrence-field')!.hidden = event;
			form.querySelector<HTMLElement>('.todo-event-date-field')!.hidden = !event;
			form.querySelector<HTMLElement>('.todo-event-time-field')!.hidden = !event;
			form.querySelector<HTMLElement>('.todo-weekday-field')!.hidden = event || recurrenceSelect.value !== 'weekly';
			form.querySelector<HTMLElement>('.todo-monthday-field')!.hidden = event || recurrenceSelect.value !== 'monthly';
			(form.elements.namedItem('date') as HTMLInputElement).required = event;
		};

		const persist = async (): Promise<void> => {
			tasks = await context.saveTodoTasks(tasks);
			footer.textContent = 'Saved';
			render();
		};

		const renderTask = (task: TodoTask, occurrence: string, dateLabel = ''): HTMLLIElement => {
			const item = document.createElement('li');
			item.className = 'todo-item';
			const checked = task.completedOn.includes(occurrence);
			const label = document.createElement('label');
			label.className = 'todo-check-label';
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.checked = checked;
			checkbox.setAttribute('aria-label', `Complete ${task.title}`);
			const title = document.createElement('span');
			title.className = 'todo-task-title';
			title.textContent = task.title;
			if (dateLabel) {
				const date = document.createElement('span');
				date.className = 'todo-task-date';
				date.textContent = dateLabel;
				label.append(date);
			}
			label.append(checkbox, title);
			checkbox.addEventListener('change', () => {
				task.completedOn = checkbox.checked
					? [...new Set([...task.completedOn, occurrence])]
					: task.completedOn.filter(value => value !== occurrence);
				void persist();
			});
			const actions = document.createElement('span');
			actions.className = 'todo-item-actions';
			const edit = document.createElement('button');
			edit.type = 'button';
			edit.className = 'todo-icon-button';
			edit.title = `Edit ${task.title}`;
			edit.setAttribute('aria-label', `Edit ${task.title}`);
			edit.textContent = 'Edit';
			edit.addEventListener('click', () => openEditor(task));
			const remove = document.createElement('button');
			remove.type = 'button';
			remove.className = 'todo-icon-button';
			remove.title = `Delete ${task.title}`;
			remove.setAttribute('aria-label', `Delete ${task.title}`);
			remove.textContent = '×';
			remove.addEventListener('click', () => {
				tasks = tasks.filter(candidate => candidate.id !== task.id);
				void persist();
			});
			actions.append(edit, remove);
			item.append(label, actions);
			if (checked) item.classList.add('is-complete');
			return item;
		};

		const render = (): void => {
			const today = new Date();
			const todayValue = todayKey();
			const dueToday = tasks.filter(task => taskIsDue(task, today));
			todayList.replaceChildren(...dueToday.map(task => renderTask(task, task.kind === 'event' ? task.date! : todayValue)));
			if (!dueToday.length) {
				const empty = document.createElement('li');
				empty.className = 'todo-empty';
				empty.textContent = 'Nothing scheduled for today';
				todayList.append(empty);
			}
			const horizon = new Date(today);
			horizon.setDate(horizon.getDate() + 30);
			const upcoming = tasks.filter(task => task.kind === 'event' && task.date! > todayValue && localDate(task.date!) <= horizon)
				.sort((first, second) => `${first.date} ${first.time ?? ''}`.localeCompare(`${second.date} ${second.time ?? ''}`));
			upcomingList.replaceChildren(...upcoming.map(task => renderTask(task, task.date!, `${displayDate(task.date!)}${task.time ? ` · ${task.time}` : ''}`)));
			if (!upcoming.length) {
				const empty = document.createElement('li');
				empty.className = 'todo-empty';
				empty.textContent = 'No upcoming events';
				upcomingList.append(empty);
			}
			const completed = dueToday.filter(task => task.completedOn.includes(task.kind === 'event' ? task.date! : todayValue)).length;
			summary.textContent = `${completed} of ${dueToday.length} completed`;
		};

		const openEditor = (task?: TodoTask): void => {
			editingId = task?.id ?? null;
			form.reset();
			kindSelect.value = task?.kind ?? 'routine';
			recurrenceSelect.value = task?.recurrence ?? 'daily';
			(form.elements.namedItem('title') as HTMLInputElement).value = task?.title ?? '';
			(form.elements.namedItem('dayOfWeek') as HTMLSelectElement).value = String(task?.dayOfWeek ?? 1);
			(form.elements.namedItem('dayOfMonth') as HTMLSelectElement).value = String(task?.dayOfMonth ?? 'last');
			(form.elements.namedItem('date') as HTMLInputElement).value = task?.date ?? '';
			(form.elements.namedItem('time') as HTMLInputElement).value = task?.time ?? '';
			form.querySelector<HTMLButtonElement>('[type="submit"]')!.textContent = task ? 'Update task' : 'Save task';
			updateFields();
			form.hidden = false;
			(form.elements.namedItem('title') as HTMLInputElement).focus();
		};

		element.querySelector('.todo-add')!.addEventListener('click', () => openEditor());
		element.querySelector('.todo-cancel')!.addEventListener('click', () => { form.hidden = true; });
		kindSelect.addEventListener('change', updateFields);
		recurrenceSelect.addEventListener('change', updateFields);
		form.addEventListener('submit', event => {
			event.preventDefault();
			const title = (form.elements.namedItem('title') as HTMLInputElement).value.trim();
			if (!title) return;
			const kind = kindSelect.value as TodoTask['kind'];
			const previous = tasks.find(task => task.id === editingId);
			const task: TodoTask = {
				id: previous?.id ?? crypto.randomUUID(),
				title,
				kind,
				completedOn: previous?.completedOn ?? []
			};
			if (kind === 'event') {
				task.date = (form.elements.namedItem('date') as HTMLInputElement).value;
				task.time = (form.elements.namedItem('time') as HTMLInputElement).value || undefined;
			} else {
				task.recurrence = recurrenceSelect.value as NonNullable<TodoTask['recurrence']>;
				if (task.recurrence === 'weekly') task.dayOfWeek = Number((form.elements.namedItem('dayOfWeek') as HTMLSelectElement).value);
				if (task.recurrence === 'monthly') {
					const day = (form.elements.namedItem('dayOfMonth') as HTMLSelectElement).value;
					task.dayOfMonth = day === 'last' ? 'last' : Number(day);
				}
			}
			tasks = previous
				? tasks.map(candidate => candidate.id === previous.id ? task : candidate)
				: [...tasks, task];
			form.hidden = true;
			void persist();
		});

		updateFields();
		void context.getTodoTasks().then(loaded => {
			tasks = loaded;
			render();
		}).catch(() => {
			summary.textContent = 'Tasks unavailable';
			footer.textContent = 'Could not load saved tasks';
		});
		return element;
	}
};