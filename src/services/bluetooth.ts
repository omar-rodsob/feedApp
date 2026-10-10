import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { BluetoothDevice } from '../shared/types';

const execFileAsync = promisify(execFile);
const addressPattern = /^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/i;

async function runBluetoothctl(args: string[], timeout = 10_000): Promise<string> {
  if (process.platform !== 'linux') {
    throw new Error('Bluetooth controls are available on Linux with BlueZ.');
  }

  try {
    const { stdout, stderr } = await execFileAsync('bluetoothctl', args, {
      timeout,
      maxBuffer: 1024 * 1024,
      encoding: 'utf8'
    });
    const output = `${stdout}\n${stderr}`;
    if (/\b(?:Failed|not available|No default controller)\b/i.test(output)) {
      throw new Error(output.trim());
    }
    return output;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (detail.includes('ENOENT')) {
      throw new Error('bluetoothctl was not found. Install and enable BlueZ on the Raspberry Pi.');
    }
    throw new Error(`Bluetooth command failed: ${detail}`);
  }
}

function validateAddress(value: unknown): string {
  if (typeof value !== 'string' || !addressPattern.test(value)) {
    throw new Error('Invalid Bluetooth device address.');
  }
  return value.toUpperCase();
}

export async function getBluetoothDevices(scan = false): Promise<BluetoothDevice[]> {
  if (scan) {
    await runBluetoothctl(['power', 'on']);
    await runBluetoothctl(['--timeout', '10', 'scan', 'on'], 15_000);
    await runBluetoothctl(['scan', 'off']);
  }

  const output = await runBluetoothctl(['devices']);
  const matches = [...output.matchAll(/^Device ((?:[0-9A-F]{2}:){5}[0-9A-F]{2})\s+(.+)$/gim)];
  const devices = await Promise.all(matches.map(async match => {
    const address = match[1].toUpperCase();
    const info = await runBluetoothctl(['info', address]);
    return {
      address,
      name: match[2].trim(),
      paired: /^\s*Paired:\s*yes\s*$/im.test(info),
      connected: /^\s*Connected:\s*yes\s*$/im.test(info)
    };
  }));

  return devices.sort((first, second) => Number(second.connected) - Number(first.connected) || first.name.localeCompare(second.name));
}

export async function connectBluetooth(value: unknown): Promise<void> {
  const address = validateAddress(value);
  const info = await runBluetoothctl(['info', address]);
  if (!/^\s*Paired:\s*yes\s*$/im.test(info)) {
    await runBluetoothctl(['--agent', 'NoInputNoOutput', 'pair', address], 30_000);
  }
  await runBluetoothctl(['connect', address], 30_000);
}

export async function disconnectBluetooth(value: unknown): Promise<void> {
  const address = validateAddress(value);
  await runBluetoothctl(['disconnect', address]);
}