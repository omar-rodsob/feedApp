import type { WidgetConfig, WidgetContext, WidgetModule } from '../../shared/types';

export const ClockWidget: WidgetModule = {
  create(config: WidgetConfig, _context: WidgetContext): HTMLElement {
    const element = document.createElement('article');
    element.className = 'widget clock-widget';
    element.innerHTML = `
      <div class="clock-time">--:--</div>
      <div class="clock-date"></div>
    `;

    const update = (): void => {
      const now = new Date();
      element.querySelector('.clock-time')!.textContent =
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      element.querySelector('.clock-date')!.textContent = `${day}/${month}/${year}`;
    };

    update();
    window.setInterval(update, 1000);
    return element;
  }
};