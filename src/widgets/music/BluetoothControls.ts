import type { BluetoothDevice, WidgetContext } from '../../shared/types';

export function createBluetoothControls(context: WidgetContext): HTMLElement {
  const control = document.createElement('div');
  control.className = 'music-bluetooth-control';
  control.innerHTML = `
    <button class="music-bluetooth-toggle" type="button" aria-expanded="false">Bluetooth</button>
    <div class="music-bluetooth-panel" hidden>
      <p class="music-bluetooth-status" aria-live="polite">Bluetooth devices</p>
      <div class="music-bluetooth-actions">
        <select class="music-bluetooth-devices" aria-label="Bluetooth audio device">
          <option value="">No devices found</option>
        </select>
        <button class="music-bluetooth-scan" type="button" title="Scan for Bluetooth devices">Scan</button>
        <button class="music-bluetooth-connect" type="button" disabled>Connect</button>
      </div>
    </div>`;

  const toggle = control.querySelector<HTMLButtonElement>('.music-bluetooth-toggle')!;
  const panel = control.querySelector<HTMLElement>('.music-bluetooth-panel')!;
  const status = control.querySelector<HTMLElement>('.music-bluetooth-status')!;
  const select = control.querySelector<HTMLSelectElement>('.music-bluetooth-devices')!;
  const scanButton = control.querySelector<HTMLButtonElement>('.music-bluetooth-scan')!;
  const connectButton = control.querySelector<HTMLButtonElement>('.music-bluetooth-connect')!;
  let devices: BluetoothDevice[] = [];
  let busy = false;

  const selectedDevice = (): BluetoothDevice | undefined =>
    devices.find(device => device.address === select.value);

  const updateAction = (): void => {
    const selected = selectedDevice();
    connectButton.disabled = busy || !selected;
    connectButton.textContent = selected?.connected ? 'Disconnect' : 'Connect';
  };

  const loadDevices = async (scan: boolean): Promise<void> => {
    busy = true;
    scanButton.disabled = true;
    status.textContent = scan ? 'Scanning for devices…' : 'Loading devices…';
    updateAction();
    try {
      const previousAddress = select.value;
      devices = await context.getBluetoothDevices(scan);
      select.replaceChildren();
      if (!devices.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No devices found';
        select.append(option);
      } else {
        for (const device of devices) {
          const option = document.createElement('option');
          option.value = device.address;
          option.textContent = `${device.name}${device.connected ? ' (Connected)' : device.paired ? ' (Paired)' : ''}`;
          select.append(option);
        }
        if (devices.some(device => device.address === previousAddress)) select.value = previousAddress;
      }
      const connected = devices.find(device => device.connected);
      status.textContent = connected ? `Connected to ${connected.name}` :
        devices.length ? 'Select an audio device to connect.' : 'No devices found. Scan to discover devices.';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not load Bluetooth devices.';
    } finally {
      busy = false;
      scanButton.disabled = false;
      updateAction();
    }
  };

  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) void loadDevices(false);
  });

  scanButton.addEventListener('click', () => void loadDevices(true));
  select.addEventListener('change', updateAction);
  connectButton.addEventListener('click', async () => {
    const device = selectedDevice();
    if (!device || busy) return;

    busy = true;
    scanButton.disabled = true;
    connectButton.disabled = true;
    status.textContent = device.connected ? `Disconnecting from ${device.name}…` : `Connecting to ${device.name}…`;
    try {
      if (device.connected) await context.disconnectBluetooth(device.address);
      else await context.connectBluetooth(device.address);
      await loadDevices(false);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Bluetooth connection failed.';
    } finally {
      busy = false;
      scanButton.disabled = false;
      updateAction();
    }
  });

  return control;
}