import type { WidgetConfig, WidgetContext, WidgetModule } from '../../shared/types';

export const ClockWidget: WidgetModule = {
  create(config: WidgetConfig, _context: WidgetContext): HTMLElement {
    const element = document.createElement('article');
    element.className = 'widget clock-widget';
    element.innerHTML = `
      <div class="clock-main">
        <div class="clock-time">--:--</div>
        <div class="clock-date"></div>
      </div>
      <div class="clock-zones">
        <div class="clock-zone"><span class="clock-zone-label">NY</span><span class="clock-zone-time" data-timezone="America/New_York">--:--</span></div>
        <div class="clock-zone"><span class="clock-zone-label">HMO</span><span class="clock-zone-time" data-timezone="America/Hermosillo">--:--</span></div>
      </div>
    `;

    const formatTime = (timeZone: string): string =>
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date());

    const update = (): void => {
      const now = new Date();
      const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      element.querySelector('.clock-time')!.textContent =
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: localTimeZone });

      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      element.querySelector('.clock-date')!.textContent = `${day}/${month}/${year}`;

      element.querySelectorAll<HTMLElement>('.clock-zone-time').forEach(node => {
        const zone = node.dataset.timezone;
        if (!zone) return;
        node.textContent = formatTime(zone);
      });
    };

    update();
    window.setInterval(update, 1000);
    return element;
  }
};