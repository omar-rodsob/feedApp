import type { WidgetConfig, WidgetContext, WidgetModule } from '../../shared/types';

export const ClockWidget: WidgetModule = {
  create(config: WidgetConfig, _context: WidgetContext): HTMLElement {
    const element = document.createElement('article');
    element.className = 'widget clock-widget';
    element.innerHTML = `
      <div class="clock-time">--:--</div>
      <div class="clock-date"></div>
      <button class="maximize" aria-label="Maximize clock">⛶</button>`;

    //element.querySelector('h2')!.textContent = config.title;

    element.querySelector('.maximize')!.addEventListener('click', () => {
      const maximize = !element.classList.contains('maximized');
      document.querySelectorAll('.widget').forEach(widget => widget.classList.remove('maximized'));
      document.body.classList.toggle('has-maximized', maximize);
      if (maximize) element.classList.add('maximized');
    });

    const update = (): void => {
      const now = new Date();
      element.querySelector('.clock-time')!.textContent =
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      element.querySelector('.clock-date')!.textContent =
        now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    update();
    window.setInterval(update, 1000);
    return element;
  }
};