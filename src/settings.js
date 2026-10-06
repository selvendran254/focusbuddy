const crypto = require('crypto');
const { CHARACTERS, COLORS, HAIR_COLORS, HAIR_STYLES, OUTFITS, PHOTO_POSES, THEMES } = require('./character');
const { ACTION_IDS } = require('./animation');
const { CATEGORY_IDS } = require('./reminders');
const { intervalMs } = require('./timer');

const POSITIONS = [
  { id: 'bottom-right', label: 'Bottom Right' },
  { id: 'bottom-left', label: 'Bottom Left' },
  { id: 'top-right', label: 'Top Right' },
  { id: 'top-left', label: 'Top Left' },
  { id: 'center-right', label: 'Center Right' },
  { id: 'center-left', label: 'Center Left' },
  { id: 'custom', label: 'Custom Position' }
];

const MODES = [
  { id: 'coding', label: 'Coding Mode', minutes: 30 },
  { id: 'study', label: 'Study Mode', minutes: 45 },
  { id: 'work', label: 'Work Mode', minutes: 60 },
  { id: 'custom', label: 'Custom Mode', minutes: null }
];

const INTERVAL_PRESETS = [10, 20, 30, 45, 60, 90, 120];
const DURATION_PRESETS = [5, 10, 15, 20, 30];
const BUBBLE_STYLES = ['rounded', 'minimal', 'pixel', 'cartoon'];
const BUBBLE_SIZES = ['small', 'medium', 'large'];
const BUBBLE_PLACEMENTS = ['above', 'left', 'right'];
const SOUND_CHOICES = ['soft', 'pop', 'bell', 'water', 'none'];
const WEEKDAYS = [
  { id: 1, label: 'Monday' },
  { id: 2, label: 'Tuesday' },
  { id: 3, label: 'Wednesday' },
  { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' },
  { id: 6, label: 'Saturday' },
  { id: 0, label: 'Sunday' }
];

function uid(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
}

function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeFileName(value) {
  const name = String(value || '');
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(name)) return '';
  return name;
}

function defaultMessages() {
  return [
    { id: 'm-water-1', text: 'Hey! 💧 Time for a water break.', category: 'water', enabled: true, action: 'drink' },
    { id: 'm-water-2', text: "You've been coding for 30 minutes. Grab some water.", category: 'water', enabled: true, action: 'drink' },
    { id: 'm-water-3', text: '💧 Quick hydration break!', category: 'water', enabled: true, action: 'drink' },
    { id: 'm-water-4', text: 'Your code can wait. Get some water.', category: 'water', enabled: true, action: 'drink' },
    { id: 'm-water-5', text: 'Hydration check! 💧', category: 'water', enabled: true, action: 'drink' },
    { id: 'm-eyes-1', text: '👀 Look away from the screen for a moment.', category: 'eyes', enabled: true, action: 'think' },
    { id: 'm-eyes-2', text: 'Give your eyes a short break.', category: 'eyes', enabled: true, action: 'think' },
    { id: 'm-eyes-3', text: 'Look at something far away for a few seconds.', category: 'eyes', enabled: true, action: 'think' },
    { id: 'm-move-1', text: '🚶 Stand up and move around for a minute.', category: 'movement', enabled: true, action: 'stretch' },
    { id: 'm-move-2', text: 'Quick movement break!', category: 'movement', enabled: true, action: 'jump' },
    { id: 'm-move-3', text: 'Stretch your legs for a moment.', category: 'movement', enabled: true, action: 'stretch' },
    { id: 'm-relax-1', text: 'Relax your shoulders and take a breath.', category: 'relax', enabled: true, action: 'sit' },
    { id: 'm-focus-1', text: '🧠 Quick reset, then get back to it.', category: 'focus', enabled: true, action: 'think' },
    { id: 'm-focus-2', text: 'Take a short break and come back fresh.', category: 'focus', enabled: true, action: 'happy' },
    { id: 'm-coffee-1', text: '☕ A short pause can help the next stretch.', category: 'coffee', enabled: false, action: 'drink' },
    { id: 'm-custom-1', text: 'Time for a quick reset.', category: 'custom', enabled: true, action: 'wave' }
  ];
}

function defaultRule() {
  return {
    id: 'rule-water',
    name: 'Water Break',
    enabled: true,
    intervalValue: 30,
    intervalUnit: 'minutes',
    messageMode: 'rotate',
    message: 'Hey! 💧 Time for a water break.',
    category: 'water',
    characterId: '',
    action: 'drink',
    sound: true,
    notification: true,
    durationSec: 15,
    nextAt: null,
    remainingMs: null,
    armed: false
  };
}

function defaultState() {
  return {
    version: 1,
    firstLaunchComplete: false,
    mode: 'coding',
    testMode: false,
    paused: false,
    timerStarted: false,
    reducedMotion: false,
    uiTextScale: 100,
    lockPosition: false,
    primaryRuleId: 'rule-water',
    character: {
      id: 'sheet-boy',
      pose: 'hero',
      size: 'medium',
      scale: 100,
      opacity: 100,
      theme: '3d',
      hair: 'short',
      hairColor: 'brown',
      outfit: 'hoodie',
      color: 'blue'
    },
    position: {
      preset: 'bottom-right',
      nx: 1,
      ny: 1
    },
    speech: {
      enabled: true,
      style: 'rounded',
      size: 'medium',
      fontSize: 'medium',
      placement: 'above',
      tone: 'dark'
    },
    sound: {
      enabled: true,
      volume: 45,
      choice: 'soft',
      customName: '',
      customFile: ''
    },
    notification: {
      enabled: true,
      title: 'FocusBuddy',
      body: "You've been coding for 30 minutes. Take a short break.",
      useReminderMessage: true
    },
    durationSec: 15,
    activeHours: {
      enabled: true,
      start: '09:00',
      end: '18:00',
      days: [1, 2, 3, 4, 5]
    },
    categories: {
      water: true,
      eyes: true,
      movement: true,
      relax: true,
      focus: true,
      coffee: false,
      custom: true
    },
    behavior: {
      walking: true,
      water: true,
      bubble: true,
      autoStart: true,
      miniTimer: true
    },
    messages: defaultMessages(),
    rules: [defaultRule()],
    recentMessageIds: [],
    rotationIndex: 0,
    lastMessageId: ''
  };
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function cleanText(value, max, fallback) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  return text.slice(0, max);
}

function clock(value, fallback) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return fallback;
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function sanitizeCharacter(input, base) {
  const src = input && typeof input === 'object' ? input : {};
  const size = oneOf(src.size, ['small', 'medium', 'large', 'custom'], base.size);
  let scale = clamp(src.scale, 10, 200, base.scale);
  if (size === 'small') scale = 78;
  if (size === 'medium') scale = 100;
  if (size === 'large') scale = 132;
  return {
    id: oneOf(src.id, CHARACTERS.map((item) => item.id), base.id),
    size,
    scale,
    opacity: clamp(src.opacity, 50, 100, base.opacity),
    theme: oneOf(src.theme, THEMES.map((item) => item.id), base.theme),
    hair: oneOf(src.hair, HAIR_STYLES.map((item) => item.id), base.hair),
    hairColor: oneOf(src.hairColor, HAIR_COLORS.map((item) => item.id), base.hairColor),
    outfit: oneOf(src.outfit, OUTFITS.map((item) => item.id).concat(['none', 'bow', 'collar', 'scarf']), base.outfit),
    color: oneOf(src.color, COLORS.map((item) => item.id), base.color),
    pose: oneOf(src.pose, PHOTO_POSES.map((item) => item.id), base.pose || 'hero')
  };
}

function sanitizeMessage(input, index) {
  if (!input || typeof input !== 'object') return null;
  const text = cleanText(input.text, 240, '');
  if (!text) return null;
  return {
    id: cleanText(input.id, 40, '') || uid('msg'),
    text,
    category: oneOf(input.category, CATEGORY_IDS, 'custom'),
    enabled: input.enabled !== false,
    action: oneOf(input.action, ACTION_IDS, 'auto')
  };
}

function sanitizeRule(input, previous) {
  if (!input || typeof input !== 'object') return null;
  const prev = previous || {};
  const unit = input.intervalUnit === 'seconds' ? 'seconds' : 'minutes';
  const intervalValue = unit === 'seconds'
    ? clamp(input.intervalValue, 5, 3600, 30)
    : clamp(input.intervalValue, 1, 240, 30);
  const id = cleanText(input.id, 40, '') || prev.id || uid('rule');
  const intervalChanged = prev.intervalValue !== intervalValue || prev.intervalUnit !== unit;
  return {
    id,
    name: cleanText(input.name, 60, 'Reminder'),
    enabled: input.enabled !== false,
    intervalValue,
    intervalUnit: unit,
    messageMode: input.messageMode === 'fixed' ? 'fixed' : 'rotate',
    message: cleanText(input.message, 240, 'Hey! 💧 Time for a water break.'),
    category: oneOf(input.category, CATEGORY_IDS, 'water'),
    characterId: oneOf(input.characterId, [''].concat(CHARACTERS.map((item) => item.id)), ''),
    action: oneOf(input.action, ACTION_IDS, 'drink'),
    sound: input.sound !== false,
    notification: input.notification !== false,
    durationSec: clamp(input.durationSec, 5, 120, 15),
    nextAt: intervalChanged ? null : finiteOr(input.nextAt, finiteOr(prev.nextAt, null)),
    remainingMs: finiteOr(input.remainingMs, finiteOr(prev.remainingMs, null)),
    armed: input.armed === true
  };
}

function sanitize(raw) {
  const base = defaultState();
  const src = raw && typeof raw === 'object' ? raw : {};
  const prevRules = new Map((Array.isArray(src.rules) ? src.rules : []).map((rule) => [rule && rule.id, rule]));
  const messages = (Array.isArray(src.messages) ? src.messages : base.messages)
    .map(sanitizeMessage)
    .filter(Boolean)
    .slice(0, 100);
  const rules = (Array.isArray(src.rules) ? src.rules : base.rules)
    .map((rule) => sanitizeRule(rule, prevRules.get(rule && rule.id)))
    .filter(Boolean)
    .slice(0, 30);

  const categories = { ...base.categories };
  CATEGORY_IDS.forEach((id) => {
    if (src.categories && typeof src.categories === 'object' && id in src.categories) {
      categories[id] = !!src.categories[id];
    }
  });

  const days = Array.isArray(src.activeHours && src.activeHours.days)
    ? src.activeHours.days.map(Number).filter((day) => day >= 0 && day <= 6)
    : base.activeHours.days;

  return {
    ...base,
    version: 1,
    firstLaunchComplete: !!src.firstLaunchComplete,
    mode: oneOf(src.mode, MODES.map((item) => item.id), base.mode),
    testMode: src.testMode === true,
    paused: !!src.paused,
    timerStarted: !!src.timerStarted,
    reducedMotion: !!src.reducedMotion,
    uiTextScale: oneOf(Number(src.uiTextScale), [100, 112, 125], 100),
    lockPosition: !!src.lockPosition,
    primaryRuleId: cleanText(src.primaryRuleId, 40, rules[0] ? rules[0].id : base.primaryRuleId),
    character: sanitizeCharacter(src.character, base.character),
    position: {
      preset: oneOf(src.position && src.position.preset, POSITIONS.map((item) => item.id), 'bottom-right'),
      nx: clamp(src.position && src.position.nx, 0, 1, 1),
      ny: clamp(src.position && src.position.ny, 0, 1, 1)
    },
    speech: {
      enabled: !src.speech || src.speech.enabled !== false,
      style: oneOf(src.speech && src.speech.style, BUBBLE_STYLES, 'rounded'),
      size: oneOf(src.speech && src.speech.size, BUBBLE_SIZES, 'medium'),
      fontSize: oneOf(src.speech && src.speech.fontSize, BUBBLE_SIZES, 'medium'),
      placement: oneOf(src.speech && src.speech.placement, BUBBLE_PLACEMENTS, 'above'),
      tone: (src.speech && src.speech.tone) === 'light' ? 'light' : 'dark'
    },
    sound: {
      enabled: !src.sound || src.sound.enabled !== false,
      volume: clamp(src.sound && src.sound.volume, 0, 100, 45),
      choice: oneOf(src.sound && src.sound.choice, SOUND_CHOICES.concat(['custom']), 'soft'),
      customName: cleanText(src.sound && src.sound.customName, 120, ''),
      customFile: safeFileName(src.sound && src.sound.customFile)
    },
    notification: {
      enabled: !src.notification || src.notification.enabled !== false,
      title: cleanText(src.notification && src.notification.title, 80, 'FocusBuddy'),
      body: cleanText(src.notification && src.notification.body, 180, base.notification.body),
      useReminderMessage: !src.notification || src.notification.useReminderMessage !== false
    },
    durationSec: clamp(src.durationSec, 5, 120, 15),
    activeHours: {
      enabled: !src.activeHours || src.activeHours.enabled !== false,
      start: clock(src.activeHours && src.activeHours.start, '09:00'),
      end: clock(src.activeHours && src.activeHours.end, '18:00'),
      days: days.length ? Array.from(new Set(days)) : [1, 2, 3, 4, 5]
    },
    categories,
    behavior: {
      walking: !src.behavior || src.behavior.walking !== false,
      water: !src.behavior || src.behavior.water !== false,
      bubble: !src.behavior || src.behavior.bubble !== false,
      autoStart: !src.behavior || src.behavior.autoStart !== false,
      miniTimer: !src.behavior || src.behavior.miniTimer !== false
    },
    messages: messages.length ? messages : defaultMessages(),
    rules: rules.length ? rules : [defaultRule()],
    recentMessageIds: Array.isArray(src.recentMessageIds) ? src.recentMessageIds.map(String).slice(-5) : [],
    rotationIndex: clamp(src.rotationIndex, 0, 20, 0),
    lastMessageId: cleanText(src.lastMessageId, 40, '')
  };
}

function mergePatch(current, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { ok: false, error: 'Settings must be an object.' };
  }
  const raw = JSON.stringify(patch);
  if (raw.length > 400000) return { ok: false, error: 'Settings are too large.' };

  const next = sanitize(current);
  const keys = [
    'mode', 'reducedMotion', 'uiTextScale', 'lockPosition', 'primaryRuleId',
    'character', 'position', 'speech', 'sound', 'notification', 'durationSec',
    'activeHours', 'categories', 'behavior', 'messages', 'rules'
  ];
  keys.forEach((key) => {
    if (key in patch) next[key] = patch[key];
  });
  if ('testMode' in patch) next.testMode = patch.testMode === true;

  const prevById = new Map(current.rules.map((rule) => [rule.id, rule]));
  const sanitized = sanitize(next);
  sanitized.rules = sanitized.rules.map((rule) => {
    const prev = prevById.get(rule.id);
    if (!prev) {
      rule.nextAt = null;
      return rule;
    }
    const changed = prev.intervalValue !== rule.intervalValue || prev.intervalUnit !== rule.intervalUnit;
    rule.nextAt = changed ? null : prev.nextAt;
    rule.remainingMs = prev.remainingMs;
    rule.armed = !!prev.armed;
    return rule;
  });
  sanitized.paused = current.paused;
  sanitized.timerStarted = current.timerStarted;
  sanitized.firstLaunchComplete = current.firstLaunchComplete;
  sanitized.recentMessageIds = current.recentMessageIds || [];
  sanitized.rotationIndex = current.rotationIndex || 0;
  sanitized.lastMessageId = current.lastMessageId || '';
  if (!('testMode' in patch)) sanitized.testMode = current.testMode === true;
  return { ok: true, state: sanitized };
}

function rescheduleChanged(state, now) {
  state.rules.forEach((rule) => {
    if (!state.timerStarted || state.paused || !rule.enabled) return;
    if (!rule.nextAt) rule.nextAt = now + intervalMs(state, rule);
  });
  return state;
}

function meta() {
  return {
    characters: CHARACTERS.map((item) => ({
      id: item.id,
      name: item.name,
      kind: item.kind
    })),
    colors: COLORS,
    hairColors: HAIR_COLORS,
    hairStyles: HAIR_STYLES,
    outfits: OUTFITS,
    themes: THEMES,
    positions: POSITIONS,
    modes: MODES,
    intervalPresets: INTERVAL_PRESETS,
    durationPresets: DURATION_PRESETS,
    bubbleStyles: BUBBLE_STYLES,
    bubbleSizes: BUBBLE_SIZES,
    bubblePlacements: BUBBLE_PLACEMENTS,
    soundChoices: SOUND_CHOICES,
    weekdays: WEEKDAYS,
    actions: ACTION_IDS,
    categories: CATEGORY_IDS
  };
}

function newMessage(partial) {
  return sanitizeMessage({
    id: uid('msg'),
    text: 'New reminder',
    category: 'custom',
    enabled: true,
    action: 'wave',
    ...partial
  });
}

function newRule(partial) {
  return sanitizeRule({
    id: uid('rule'),
    name: 'New reminder',
    enabled: true,
    intervalValue: 30,
    intervalUnit: 'minutes',
    messageMode: 'fixed',
    message: 'Hey! 💧 Time for a water break.',
    category: 'custom',
    characterId: '',
    action: 'wave',
    sound: true,
    notification: true,
    durationSec: 15,
    ...partial
  }, null);
}

module.exports = {
  POSITIONS,
  MODES,
  INTERVAL_PRESETS,
  DURATION_PRESETS,
  WEEKDAYS,
  defaultState,
  defaultMessages,
  defaultRule,
  sanitize,
  mergePatch,
  rescheduleChanged,
  meta,
  newMessage,
  newRule,
  uid
};
