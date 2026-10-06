const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  if (typeof callback !== 'function') return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api = {
  getState: () => ipcRenderer.invoke('state:get'),
  save: (patch) => ipcRenderer.invoke('state:patch', patch),
  setup: (choice) => ipcRenderer.invoke('setup:complete', choice),
  pause: () => ipcRenderer.invoke('timer:pause'),
  resume: () => ipcRenderer.invoke('timer:resume'),
  reset: () => ipcRenderer.invoke('timer:reset'),
  skip: () => ipcRenderer.invoke('timer:skip'),
  start: () => ipcRenderer.invoke('timer:start'),
  testReminder: (draft) => ipcRenderer.invoke('reminder:test', draft),
  pickSound: () => ipcRenderer.invoke('sound:pick'),
  clearSound: () => ipcRenderer.invoke('sound:clear'),
  readSound: () => ipcRenderer.invoke('sound:read'),
  setInteractive: (enabled) => ipcRenderer.send('companion:interactive', enabled === true),
  dragStart: (point) => ipcRenderer.send('companion:drag-start', point),
  dragMove: (point) => ipcRenderer.send('companion:drag-move', point),
  dragEnd: () => ipcRenderer.send('companion:drag-end'),
  dismiss: () => ipcRenderer.send('companion:dismiss'),
  onState: (callback) => subscribe('state:update', callback),
  onTimer: (callback) => subscribe('timer:tick', callback),
  onNavigate: (callback) => subscribe('ui:navigate', callback),
  onCue: (callback) => subscribe('companion:cue', callback)
};

contextBridge.exposeInMainWorld('focusbuddy', api);
