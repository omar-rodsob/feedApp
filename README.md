# FeedApp

FeedApp is a small Electron dashboard with a clock, focus timer, weather, Mexico news, NFL schedule and headlines, a daily/upcoming task list, and a local music player for folders on the computer or a USB drive.

## Raspberry Pi

The intended target includes a Raspberry Pi 3B/3B+, 4, or 5 running **64-bit Raspberry Pi OS with the desktop**. Electron needs a graphical session; Raspberry Pi OS Lite is not supported without first installing and configuring a desktop environment. The Pi 3B's 1 GB of memory and older graphics hardware may make the dashboard slower, so disable widgets you do not use and avoid running other heavy applications alongside it. Pi 3B operation has not yet been verified on the hardware. Use a reliable power supply and storage, especially when playing music from USB.

The repository does not yet produce a `.deb` or other install package. Install and build from source on the Pi so npm downloads the correct ARM64 Electron binary for that device.

### Install and run

Open a terminal in the `feedApp` project directory on the Pi (replace the example path with the directory where you cloned or copied the project):

```bash
cd /path/to/feedApp
```

Install a supported Node.js LTS release and npm if they are not already installed. Then install dependencies, build, and launch:

```bash
npm ci
npm start -- --kiosk
```

This builds the TypeScript and renderer bundle, then launches Electron in kiosk mode. Run it from the Pi's desktop session. The first build may take a few minutes on the Pi. To launch in a normal window instead, run `npm start`.

To rebuild without launching:

```bash
npm run build
```

### Configure the dashboard

Edit `config.json` to enable or disable widgets and set their titles. Weather coordinates, location label, and refresh interval are configured there as well. Keep `package-lock.json` in version control and use `npm ci` for repeatable installs.

The task widget lets you create daily, weekly, or monthly routines and one-time dated events. Task changes are saved in Electron's per-user application data, not in `config.json`.

### Use music from USB

Connect and mount the USB drive, open the Music widget, and choose the drive's music folder. Browse folders from inside the widget. The selected folder is remembered locally; if the drive mounts at a different path or is disconnected, choose the folder again. Playback depends on the audio formats supported by the installed Electron/Chromium build, so test your collection on the Pi.

## Development

Requirements: Node.js and npm. From this directory:

```bash
npm ci
npm start
```

The main process and preload bridge are in `src/main.ts` and `src/preload.ts`; renderer widgets are under `src/widgets/`. Generated JavaScript is written to `dist/` and should not be edited directly.

## Raspberry Pi packaging roadmap

The current setup runs from the checked-out project directory. For a more appliance-like deployment, the next packaging step is to add an ARM64 Linux build (for example, a `.deb`), a desktop launcher, and an optional graphical-session autostart entry. Build/package on a Raspberry Pi or a matching ARM64 Linux environment and test on the exact Pi OS release before distributing it.
