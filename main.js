const fs = require('fs');
const path = require('path');
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  screen,
  ipcMain,
  Notification,
  dialog,
  powerMonitor,
  nativeImage
} = require('electron');

const { loadJson, saveJson } = require('./src/storage');
const settings = require('./src/settings');
const timer = require('./src/timer');
const reminders = require('./src/reminders');
const { showReminderNotification } = require('./src/notification');
const { COLS, ROWS, pixelSizeFor } = require('./src/character');
const { ACTION_IDS } = require('./src/animation');

const APP_NAME = 'FocusBuddy';
const AUDIO_EXT = ['wav', 'mp3', 'm4a', 'aac', 'ogg', 'caf'];

let state;
let stateFile = '';
let soundsDir = '';
let tray = null;
let ui = null;
let companion = null;
let companionReady = false;
let playToken = 0;
let playing = false;
let tickHandle = null;
let drag = null;
let mutationQueue = Promise.resolve();
let quitting = false;
let pendingPage = 'home';

app.setName(APP_NAME);
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showUI('home'));
  app.whenReady().then(start).catch((error) => {
    console.error(error);
    app.quit();
  });
}

async function start() {
  if (process.platform === 'darwin') app.setActivationPolicy('accessory');
  stateFile = path.join(app.getPath('userData'), 'focusbuddy-state.json');
  soundsDir = path.join(app.getPath('userData'), 'sounds');
  fs.mkdirSync(soundsDir, { recursive: true });
  ensureIcons();
  state = settings.sanitize(loadJson(stateFile, settings.defaultState()));
  const now = Date.now();
  timer.clearArmedOnLaunch(state, now);
  if (state.firstLaunchComplete && state.behavior.autoStart && !state.timerStarted && !state.paused) {
    state.timerStarted = true;
  }
  if (state.timerStarted && !state.paused) timer.ensureScheduled(state, now);
  persist();
  installMenu();
  createCompanion();
  createUI();
  createTray();
  bindIpc();
  screen.on('display-added', () => repositionIdle());
  screen.on('display-removed', () => repositionIdle());
  screen.on('display-metrics-changed', () => repositionIdle());
  powerMonitor.on('resume', () => {
    scheduleTick(200);
  });
  scheduleTick(1200);
  showUI('home');
  if (process.env.FOCUSBUDDY_SHOW === '1' || !state.firstLaunchComplete) {
    setTimeout(() => {
      void runPlay(cueFrom({
        message: 'Hey! 💧 Time for a water break.',
        action: 'drink',
        durationSec: 15,
        sound: true,
        notification: false
      }));
    }, 1200);
  }
  if (process.env.FOCUSBUDDY_SMOKE === '1') {
    setTimeout(() => {
      void runPlay(cueFrom({
        message: 'Hey! 💧 Time for a water break.',
        action: 'drink',
        durationSec: 8,
        sound: true,
        notification: false
      })).then(() => {
        console.log('FOCUSBUDDY_SMOKE_OK');
        setTimeout(() => app.quit(), 400);
      });
    }, 1600);
  }
}

function ensureIcons() {
  const iconPath = path.join(__dirname, 'assets', 'icons', 'tray.png');
  if (!fs.existsSync(iconPath)) {
    require('./scripts/write-icons');
  }
}

function persist() {
  saveJson(stateFile, state);
}

function enqueue(task) {
  const run = mutationQueue.then(task);
  mutationQueue = run.then(() => {}, () => {});
  return run;
}

function installMenu() {
  const template = [
    {
      label: APP_NAME,
      submenu: [
        { label: 'Customize', click: () => showUI('customize') },
        { label: 'Settings', click: () => showUI('settings') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { role: 'editMenu' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function trusted(event) {
  try {
    const url = event.sender.getURL();
    return typeof url === 'string' && url.startsWith('file:');
  } catch (_) {
    return false;
  }
}

function point(value) {
  if (!value || typeof value !== 'object') return null;
  const screenX = Number(value.screenX);
  const screenY = Number(value.screenY);
  if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return null;
  return { screenX, screenY };
}

function bindIpc() {
  ipcMain.handle('state:get', (event) => {
    if (!trusted(event)) return { ok: false, error: 'Rejected.' };
    return { ok: true, state, meta: settings.meta(), status: timer.status(state, Date.now()) };
  });

  ipcMain.handle('state:patch', (event, patch) => {
    if (!trusted(event)) return { ok: false, error: 'Rejected.' };
    return enqueue(() => applyPatch(patch));
  });

  ipcMain.handle('setup:complete', (event, choice) => {
    if (!trusted(event)) return { ok: false, error: 'Rejected.' };
    return enqueue(() => completeSetup(choice));
  });

  ipcMain.handle('timer:pause', (event) => trusted(event) ? enqueue(() => control('pause')) : reject());
  ipcMain.handle('timer:resume', (event) => trusted(event) ? enqueue(() => control('resume')) : reject());
  ipcMain.handle('timer:reset', (event) => trusted(event) ? enqueue(() => control('reset')) : reject());
  ipcMain.handle('timer:skip', (event) => trusted(event) ? enqueue(() => control('skip')) : reject());
  ipcMain.handle('timer:start', (event) => trusted(event) ? enqueue(() => control('start')) : reject());
  ipcMain.handle('reminder:test', (event, draft) => {
    if (!trusted(event)) return reject();
    return enqueue(() => testReminder(draft));
  });
  ipcMain.handle('sound:pick', (event) => trusted(event) ? enqueue(() => pickSound()) : reject());
  ipcMain.handle('sound:clear', (event) => trusted(event) ? enqueue(() => clearSound()) : reject());
  ipcMain.handle('sound:read', (event) => trusted(event) ? { ok: true, dataUrl: readSoundData() } : reject());

  ipcMain.on('companion:interactive', (event, enabled) => {
    if (!trusted(event) || !companion || companion.isDestroyed()) return;
    companion.setIgnoreMouseEvents(enabled !== true, { forward: true });
  });

  ipcMain.on('companion:drag-start', (event, raw) => {
    if (!trusted(event) || state.lockPosition || !companion) return;
    const cursor = point(raw);
    if (!cursor) return;
    const [x, y] = companion.getPosition();
    drag = { ...cursor, x, y, moved: false };
  });

  ipcMain.on('companion:drag-move', (event, raw) => {
    if (!trusted(event) || !drag || state.lockPosition || !companion) return;
    const cursor = point(raw);
    if (!cursor) return;
    const x = Math.round(drag.x + (cursor.screenX - drag.screenX));
    const y = Math.round(drag.y + (cursor.screenY - drag.screenY));
    if (Math.abs(x - drag.x) + Math.abs(y - drag.y) > 3) drag.moved = true;
    companion.setPosition(x, y);
  });

  ipcMain.on('companion:drag-end', (event) => {
    if (!trusted(event)) return;
    if (drag && drag.moved) saveDraggedPosition();
    drag = null;
  });

  ipcMain.on('companion:dismiss', (event) => {
    if (!trusted(event)) return;
    cancelPlay();
  });
}

function reject() {
  return { ok: false, error: 'Rejected.' };
}

function applyPatch(patch) {
  const now = Date.now();
  const previousTest = state.testMode === true;
  const merged = settings.mergePatch(state, patch);
  if (!merged.ok) return merged;
  state = merged.state;
  if (state.testMode !== previousTest) timer.applyTestMode(state, state.testMode, now);
  state.rules.forEach((rule) => {
    if (rule.nextAt) return;
    if (!rule.enabled || !state.timerStarted) return;
    if (state.paused) rule.remainingMs = timer.intervalMs(state, rule);
    else rule.nextAt = now + timer.intervalMs(state, rule);
  });
  persist();
  publish(false);
  refreshTray();
  if (companion && companion.isVisible() && !playing) repositionIdle();
  return { ok: true, state, status: timer.status(state, now) };
}

function completeSetup(choice) {
  const mode = ['start', 'customize', 'skip'].includes(choice) ? choice : 'start';
  state.firstLaunchComplete = true;
  state.testMode = false;
  state.paused = false;
  state.timerStarted = true;
  timer.resetState(state, Date.now());
  persist();
  publish(true);
  refreshTray();
  if (mode === 'customize') sendUI('ui:navigate', 'customize');
  else sendUI('ui:navigate', 'home');
  return { ok: true, state, page: mode === 'customize' ? 'customize' : 'home' };
}

function control(action) {
  const now = Date.now();
  if (action === 'pause') {
    cancelPlay();
    timer.pauseState(state, now);
  } else if (action === 'resume' || action === 'start') {
    if (state.paused) timer.resumeState(state, now);
    else {
      state.timerStarted = true;
      state.paused = false;
      timer.ensureScheduled(state, now);
    }
  } else if (action === 'reset' || action === 'skip') {
    cancelPlay();
    timer.resetState(state, now);
  }
  persist();
  publish(true);
  refreshTray();
  scheduleTick(50);
  return { ok: true, state, status: timer.status(state, Date.now()) };
}

function testReminder(draft) {
  const cue = cueFrom(normalizeDraft(draft));
  void runPlay(cue, { ruleId: '' });
  return { ok: true };
}

function normalizeDraft(draft) {
  const src = draft && typeof draft === 'object' ? draft : {};
  const message = String(src.message || state.rules[0].message || 'Hey! 💧 Time for a water break.').trim().slice(0, 240);
  const action = ACTION_IDS.includes(src.action) ? src.action : 'drink';
  const durationSec = Math.min(120, Math.max(5, Number(src.durationSec) || state.durationSec || 15));
  return {
    message,
    action,
    durationSec,
    sound: src.sound !== false,
    notification: src.notification !== false,
    character: src.character && typeof src.character === 'object' ? { ...state.character, ...src.character } : state.character
  };
}

function cueFrom(extra) {
  const action = extra.action === 'auto' ? 'wave' : extra.action;
  const visualAction = state.behavior.water === false && action === 'drink' ? 'happy' : action;
  const bubble = state.speech.enabled !== false && state.behavior.bubble !== false;
  return {
    message: extra.message,
    action: visualAction,
    durationSec: extra.durationSec,
    character: extra.character || state.character,
    speech: { ...state.speech, enabled: bubble },
    behavior: state.behavior,
    reducedMotion: state.reducedMotion === true,
    walking: state.behavior.walking !== false && state.reducedMotion !== true,
    lockPosition: state.lockPosition === true,
    sound: {
      enabled: !!(state.sound.enabled && extra.sound !== false && state.sound.choice !== 'none'),
      volume: state.sound.volume,
      choice: state.sound.choice
    },
    notification: {
      enabled: !!(state.notification.enabled && extra.notification !== false),
      title: state.notification.title || APP_NAME,
      body: state.notification.useReminderMessage ? extra.message : state.notification.body
    }
  };
}

function pickSound() {
  return dialog.showOpenDialog(ui && !ui.isDestroyed() ? ui : undefined, {
    title: 'Choose a reminder sound',
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: AUDIO_EXT }]
  }).then((chosen) => {
    if (chosen.canceled || !chosen.filePaths[0]) return { ok: false, cancelled: true };
    const source = chosen.filePaths[0];
    const ext = path.extname(source).toLowerCase().replace('.', '');
    if (!AUDIO_EXT.includes(ext)) return { ok: false, error: 'Choose a wav, mp3, m4a, aac, ogg, or caf file.' };
    const info = fs.statSync(source);
    if (!info.isFile() || info.size > 2 * 1024 * 1024) return { ok: false, error: 'Please choose a sound under 2 MB.' };
    const filename = `custom.${ext}`;
    fs.mkdirSync(soundsDir, { recursive: true });
    fs.copyFileSync(source, path.join(soundsDir, filename));
    state.sound.choice = 'custom';
    state.sound.customFile = filename;
    state.sound.customName = path.basename(source).slice(0, 120);
    state.sound.enabled = true;
    persist();
    publish(true);
    return { ok: true, state };
  }).catch((error) => ({ ok: false, error: error.message }));
}

function clearSound() {
  state.sound.customFile = '';
  state.sound.customName = '';
  if (state.sound.choice === 'custom') state.sound.choice = 'soft';
  persist();
  publish(true);
  return { ok: true, state };
}

function readSoundData() {
  const file = customSoundPath();
  if (!file) return '';
  const ext = path.extname(file).slice(1);
  const mime = ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : `audio/${ext}`;
  const data = fs.readFileSync(file);
  return `data:${mime};base64,${data.toString('base64')}`;
}

function customSoundPath() {
  const name = state.sound.customFile;
  if (!name || !/^[A-Za-z0-9._-]{1,120}$/.test(name)) return '';
  const full = path.resolve(soundsDir, name);
  if (!full.startsWith(path.resolve(soundsDir))) return '';
  return fs.existsSync(full) ? full : '';
}

function publish(refresh) {
  sendUI('state:update', { state, refresh: refresh === true, status: timer.status(state, Date.now()) });
}

function sendUI(channel, payload) {
  try {
    if (!ui || ui.isDestroyed() || ui.webContents.isDestroyed()) return;
    ui.webContents.send(channel, payload);
  } catch (_) { /* window closed mid-update */ }
}

function sendCompanion(payload) {
  try {
    if (!companion || companion.isDestroyed() || companion.webContents.isDestroyed() || !companionReady) return;
    companion.webContents.send('companion:cue', payload);
  } catch (_) { /* companion closed mid-update */ }
}

function createUI() {
  ui = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 920,
    minHeight: 640,
    show: false,
    title: APP_NAME,
    backgroundColor: '#101218',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });
  ui.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    ui.hide();
  });
  ui.on('hide', () => {
    if (!quitting && process.platform === 'darwin') app.setActivationPolicy('accessory');
  });
  ui.webContents.on('did-fail-load', (_event, code, description) => {
    console.error('Settings window failed to load', code, description);
  });
  pipeConsole(ui, 'ui');
  harden(ui.webContents);
  ui.once('ready-to-show', () => {
    if (process.env.FOCUSBUDDY_SMOKE === '1') console.log(`ui-shown ${JSON.stringify(ui.getBounds())}`);
  });
  ui.webContents.on('did-finish-load', () => {
    if (pendingPage) sendUI('ui:navigate', pendingPage);
  });
  ui.loadFile(path.join(__dirname, 'src', 'index.html'));
}

function harden(contents) {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, url) => {
    if (!String(url).startsWith('file://')) event.preventDefault();
  });
}

function createCompanion() {
  const size = windowSize(state);
  companion = new BrowserWindow({
    width: size.width,
    height: size.height,
    x: -4000,
    y: 0,
    show: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    roundedCorners: false,
    focusable: false,
    skipTaskbar: true,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    movable: true,
    acceptFirstMouse: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true
    }
  });
  companion.setAlwaysOnTop(true, 'screen-saver');
  companion.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  companion.setIgnoreMouseEvents(true, { forward: true });
  companion.setBackgroundColor('#00000000');
  companion.webContents.on('did-finish-load', () => {
    companionReady = true;
  });
  companion.webContents.on('did-fail-load', (_event, code, description) => {
    console.error('Companion failed to load', code, description);
  });
  pipeConsole(companion, 'companion');
  harden(companion.webContents);
  companion.loadFile(path.join(__dirname, 'src', 'companion.html'));
}

function pipeConsole(win, name) {
  win.webContents.on('console-message', (event, level, message) => {
    const text = event && typeof event === 'object' && event.message ? event.message : message;
    const severity = event && typeof event === 'object' && event.level != null ? event.level : level;
    if (severity === 'error' || severity === 3 || severity === 'warning' || severity === 2) {
      console.error(`[${name}] ${text}`);
    }
  });
}

function createTray() {
  const image = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icons', 'tray.png'));
  tray = new Tray(image.isEmpty() ? nativeImage.createFromPath(path.join(__dirname, 'assets', 'icons', 'icon.png')).resize({ width: 22, height: 22 }) : image);
  tray.setToolTip(APP_NAME);
  const openMenu = () => tray.popUpContextMenu(buildMenu());
  tray.on('click', openMenu);
  tray.on('right-click', openMenu);
  refreshTray();
}

function buildMenu() {
  const snap = timer.status(state, Date.now());
  const paused = state.paused === true;
  return Menu.buildFromTemplate([
    { label: APP_NAME, enabled: false },
    { label: state.testMode ? 'TEST MODE' : (paused ? 'Paused' : 'Reminders active'), enabled: false },
    { label: `Current timer: ${snap.label}`, enabled: false },
    { label: `Next reminder: ${snap.ruleName ? `${snap.ruleName} · ${snap.label}` : snap.label}`, enabled: false },
    { type: 'separator' },
    { label: 'Show Companion', click: () => showIdle() },
    { label: 'Hide Companion', click: () => { cancelPlay(); } },
    { type: 'separator' },
    { label: 'Start Timer', click: () => { void enqueue(() => control('start')); } },
    { label: 'Pause Timer', enabled: !paused && state.timerStarted, click: () => { void enqueue(() => control('pause')); } },
    { label: 'Resume Timer', enabled: paused, click: () => { void enqueue(() => control('resume')); } },
    { label: 'Reset Timer', click: () => { void enqueue(() => control('reset')); } },
    { label: 'Skip Reminder', click: () => { void enqueue(() => control('skip')); } },
    { type: 'separator' },
    { label: 'Customize', click: () => showUI('customize') },
    { label: 'Settings', click: () => showUI('settings') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
}

function refreshTray() {
  if (!tray) return;
  const snap = timer.status(state, Date.now());
  const prefix = state.testMode ? 'TEST MODE · ' : state.paused ? 'Paused · ' : '';
  tray.setToolTip(`${APP_NAME} — ${prefix}${snap.label}`);
}

function showUI(page) {
  pendingPage = page || 'home';
  if (process.platform === 'darwin') app.setActivationPolicy('regular');
  if (!ui || ui.isDestroyed()) createUI();
  const area = screen.getPrimaryDisplay().workArea;
  const bounds = ui.getBounds();
  ui.setBounds({
    x: Math.round(area.x + (area.width - bounds.width) / 2),
    y: Math.round(area.y + (area.height - bounds.height) / 2),
    width: bounds.width,
    height: bounds.height
  });
  ui.show();
  ui.focus();
  if (process.platform === 'darwin') app.focus({ steal: true });
  if (!ui.webContents.isLoading()) sendUI('ui:navigate', pendingPage);
}

function windowSize(current) {
  const scale = (Number(current.character.scale) || 100) / 100;
  const pixel = current.character.theme === 'pixel';
  const px = pixelSizeFor(current.character.scale, current.character.theme);
  const charW = pixel ? COLS * px : Math.round(176 * scale);
  const charH = pixel ? ROWS * px : Math.round(260 * scale);
  const speech = current.speech || {};
  const bubbleW = speech.size === 'large' ? 280 : speech.size === 'small' ? 188 : 230;
  const bubbleH = speech.size === 'large' ? 128 : speech.size === 'small' ? 78 : 104;
  const bubbleOn = speech.enabled !== false && current.behavior.bubble !== false;
  let width;
  let height;
  if (!bubbleOn || speech.placement === 'above') {
    width = Math.max(charW, bubbleOn ? bubbleW : 0) + 36;
    height = charH + (bubbleOn ? bubbleH : 0) + 42;
  } else {
    width = charW + bubbleW + 28;
    height = Math.max(charH, bubbleH) + 42;
  }
  return {
    width: Math.max(200, Math.min(680, Math.round(width))),
    height: Math.max(200, Math.min(760, Math.round(height)))
  };
}

function displayFor(position) {
  const displays = screen.getAllDisplays();
  const match = displays.find((display) => String(display.id) === String(position.displayId));
  return match || screen.getPrimaryDisplay();
}

function anchoredPoint(position) {
  if (position.preset === 'bottom-left') return { nx: 0, ny: 1 };
  if (position.preset === 'top-right') return { nx: 1, ny: 0 };
  if (position.preset === 'top-left') return { nx: 0, ny: 0 };
  if (position.preset === 'center-right') return { nx: 1, ny: 0.5 };
  if (position.preset === 'center-left') return { nx: 0, ny: 0.5 };
  if (position.preset === 'custom') {
    return {
      nx: Math.min(1, Math.max(0, Number(position.nx) || 0)),
      ny: Math.min(1, Math.max(0, Number(position.ny) || 0))
    };
  }
  return { nx: 1, ny: 1 };
}

function placement(current) {
  const size = windowSize(current);
  const display = displayFor(current.position);
  const area = display.workArea;
  const margin = 18;
  const anchor = anchoredPoint(current.position);
  const minX = area.x + margin;
  const minY = area.y + margin;
  const maxX = Math.max(minX, area.x + area.width - size.width - margin);
  const maxY = Math.max(minY, area.y + area.height - size.height - margin);
  const target = {
    x: Math.round(minX + (maxX - minX) * anchor.nx),
    y: Math.round(minY + (maxY - minY) * anchor.ny),
    width: size.width,
    height: size.height
  };
  const center = target.x + size.width / 2;
  const fromRight = center >= display.bounds.x + display.bounds.width / 2;
  const off = {
    x: fromRight ? display.bounds.x + display.bounds.width + 30 : display.bounds.x - size.width - 30,
    y: target.y,
    width: size.width,
    height: size.height
  };
  return { target, off, fromRight, display };
}

function saveDraggedPosition() {
  if (!companion || companion.isDestroyed()) return;
  const [x, y] = companion.getPosition();
  const size = companion.getBounds();
  const display = screen.getDisplayNearestPoint({ x, y });
  const area = display.workArea;
  const margin = 18;
  const minX = area.x + margin;
  const minY = area.y + margin;
  const maxX = Math.max(minX, area.x + area.width - size.width - margin);
  const maxY = Math.max(minY, area.y + area.height - size.height - margin);
  const nx = maxX === minX ? 1 : (x - minX) / (maxX - minX);
  const ny = maxY === minY ? 1 : (y - minY) / (maxY - minY);
  state.position = {
    preset: 'custom',
    nx: Math.min(1, Math.max(0, nx)),
    ny: Math.min(1, Math.max(0, ny)),
    displayId: display.id
  };
  persist();
  publish(false);
}

function repositionIdle() {
  if (!companion || companion.isDestroyed() || !companion.isVisible() || playing) return;
  const spot = placement(state);
  companion.setBounds(spot.target);
}

function showIdle() {
  if (playing || !companion || companion.isDestroyed()) return;
  const spot = placement(state);
  companion.setBounds(spot.target);
  companion.showInactive();
  sendCompanion({
    phase: 'idle',
    ...cueFrom({
      message: '',
      action: 'idle',
      durationSec: state.durationSec,
      sound: false,
      notification: false
    }),
    playSound: false
  });
}

function hideCompanion() {
  sendCompanion({ phase: 'hide' });
  if (!companion || companion.isDestroyed()) return;
  companion.hide();
  companion.setIgnoreMouseEvents(true, { forward: true });
}

function cancelPlay() {
  playToken += 1;
  playing = false;
  hideCompanion();
}

function waitFor(ms, token) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timerId);
      clearInterval(poll);
      resolve(value);
    };
    const timerId = setTimeout(() => finish(token === playToken), ms);
    const poll = setInterval(() => {
      if (token !== playToken) finish(false);
    }, 40);
  });
}

function slide(from, to, ms, token) {
  return new Promise((resolve) => {
    const started = Date.now();
    const step = () => {
      if (token !== playToken || !companion || companion.isDestroyed()) return resolve(false);
      const progress = Math.min(1, (Date.now() - started) / ms);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - ((-2 * progress + 2) ** 2) / 2;
      companion.setBounds({
        x: Math.round(from.x + (to.x - from.x) * eased),
        y: Math.round(from.y + (to.y - from.y) * eased),
        width: to.width,
        height: to.height
      });
      if (progress >= 1) return resolve(true);
      setTimeout(step, 32);
    };
    step();
  });
}

async function whenCompanionReady() {
  if (companionReady) return;
  await new Promise((resolve) => {
    const check = setInterval(() => {
      if (companionReady) {
        clearInterval(check);
        resolve();
      }
    }, 30);
    setTimeout(() => {
      clearInterval(check);
      resolve();
    }, 4000);
  });
}

async function runPlay(cue) {
  const token = ++playToken;
  playing = true;
  const alive = () => token === playToken;
  try {
    await whenCompanionReady();
    if (!alive() || !companion || companion.isDestroyed()) return false;
    const spot = placement(state);
    const walk = cue.walking !== false;
    companion.setBounds(walk ? spot.off : spot.target);
    companion.showInactive();
    if (process.env.FOCUSBUDDY_SMOKE === '1') {
      console.log(`companion-target ${JSON.stringify(spot.target)}`);
    }
    cue.fromRight = spot.fromRight;
    sendCompanion({ ...cue, phase: walk ? 'enter' : 'hold', playSound: !walk });
    if (walk) {
      const entered = await slide(spot.off, spot.target, 1500, token);
      if (!entered || !alive()) return false;
      if (process.env.FOCUSBUDDY_SMOKE === '1') {
        console.log(`companion-arrived ${JSON.stringify(companion.getBounds())}`);
      }
      sendCompanion({ ...cue, phase: 'hold', playSound: true });
    }
    if (alive() && cue.notification && cue.notification.enabled) {
      showReminderNotification(Notification, cue.notification);
    }
    const held = await waitFor(Math.max(3, cue.durationSec) * 1000, token);
    if (!held || !alive()) return false;
    sendCompanion({ ...cue, phase: 'exit', playSound: false });
    const left = walk
      ? await slide(spot.target, spot.off, 1200, token)
      : await waitFor(280, token);
    if (!left || !alive()) return false;
    hideCompanion();
    return true;
  } catch (error) {
    console.error(error);
    if (alive()) hideCompanion();
    return false;
  } finally {
    if (token === playToken) playing = false;
  }
}

async function fireRule(rule) {
  if (playing || state.paused || !state.timerStarted) return;
  if (!timer.isActiveAt(new Date(), state.activeHours)) return;
  const now = Date.now();
  if (!rule || rule.nextAt > now) return;
  const ruleId = rule.id;
  timer.armRule(state, ruleId);
  const content = reminders.materialize(state, rule);
  state.recentMessageIds = content.recentMessageIds;
  state.rotationIndex = content.rotationIndex;
  state.lastMessageId = content.lastMessageId;
  persist();
  const character = { ...state.character };
  if (rule.characterId) character.id = rule.characterId;
  const finished = await runPlay(cueFrom({
    message: content.message.text,
    action: content.action,
    durationSec: rule.durationSec || state.durationSec,
    sound: rule.sound !== false,
    notification: rule.notification !== false,
    character
  }));
  await enqueue(() => {
    const current = state.rules.find((item) => item.id === ruleId);
    if (current && current.armed) {
      if (finished) timer.completeRule(state, ruleId, Date.now());
      else {
        current.armed = false;
        current.nextAt = Date.now() + timer.intervalMs(state, current);
      }
    }
    persist();
    publish(false);
    refreshTray();
  });
}

function scheduleTick(delay) {
  if (tickHandle) clearTimeout(tickHandle);
  tickHandle = setTimeout(tick, delay);
}

function tick() {
  const now = Date.now();
  refreshTray();
  sendUI('timer:tick', timer.status(state, now));
  if (companion && companion.isVisible()) {
    sendCompanion({ phase: 'tick', label: timer.status(state, now).label });
  }
  const due = timer.dueRule(state, now);
  if (due && !playing) void fireRule(due);
  const wait = (!state.timerStarted || state.paused || !timer.isActiveAt(new Date(now), state.activeHours)) ? 5000 : 1000;
  scheduleTick(wait);
}

app.on('before-quit', () => {
  quitting = true;
  if (tickHandle) clearTimeout(tickHandle);
  try { persist(); } catch (_) { /* ignore */ }
  if (companion && !companion.isDestroyed()) companion.destroy();
  if (ui && !ui.isDestroyed()) ui.destroy();
});

app.on('window-all-closed', () => {});

app.on('activate', () => {
  if (app.isReady()) showUI('home');
});
