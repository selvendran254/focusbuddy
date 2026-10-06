# FocusBuddy

FocusBuddy is a small macOS menu-bar companion. It stays hidden while you work. When a reminder is due, a pixel character walks in above your other apps, shows a message, plays an action, then walks away.

No account, server, or internet connection is required. Everything is stored in a local JSON file.

## Run it

```bash
cd focusbuddy
npm install
npm start
```

The same command is available as `npm run dev`.

On first launch, choose **Start with 30-minute reminders**. The window can be closed; FocusBuddy keeps running in the menu bar.

## Customize without editing code

Open the menu-bar icon and choose **Customize**, or press Customize in the app.

From the screens you can change:

- Character, size, colors, hair, outfit, theme, and opacity
- Screen position, including a dragged custom spot
- Reminder interval, including a custom number of minutes
- Your own messages, categories, actions, and multiple reminder rules
- How long the character stays, the speech bubble, sound, and notifications
- Active hours and weekdays
- Coding (30), Study (45), and Work (60) modes

**Test Reminder** plays the current setup on the desktop immediately.

**Save** stores it on this Mac. The next real reminder uses those settings.

## Timer

The normal interval is **30 minutes**. Change it under **Timing** or in the quick reminder form. The countdown is timestamp based, so sleep and restarts do not stack a pile of missed reminders.

**Developer → Enable 10-second test mode** is only for trying the animation. A banner stays on screen while it is enabled. Turning it off returns to the interval you saved. Test mode is off by default.

## Character art

Generated characters live in `src/character.js`. To swap in real sprites later, read `assets/characters/README.md`.

## Package a Mac app

```bash
npm run dist
```

This builds an unsigned `.dmg` in `dist/`. The first time you open the app, use the Finder shortcut for an unsigned app (right-click, Open). A packaged app is what macOS uses for the FocusBuddy notification name.

`npm run pack` builds the `.app` bundle without a disk image.
