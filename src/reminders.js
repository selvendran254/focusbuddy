(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof root !== 'undefined') root.FocusReminders = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CATEGORIES = [
    { id: 'water', label: 'Water', icon: '💧' },
    { id: 'eyes', label: 'Eye Break', icon: '👀' },
    { id: 'movement', label: 'Movement', icon: '🚶' },
    { id: 'relax', label: 'Relax', icon: '🧘' },
    { id: 'focus', label: 'Focus', icon: '🧠' },
    { id: 'coffee', label: 'Break', icon: '☕' },
    { id: 'custom', label: 'Custom', icon: '✍️' }
  ];

  const CATEGORY_IDS = CATEGORIES.map((item) => item.id);

  const CATEGORY_ACTION = {
    water: 'drink',
    eyes: 'think',
    movement: 'stretch',
    relax: 'sit',
    focus: 'think',
    coffee: 'drink',
    custom: 'wave'
  };

  // Water is visited most often. Disabled categories are skipped.
  const ROTATION = ['water', 'eyes', 'movement', 'water', 'focus', 'relax', 'coffee', 'custom'];

  function categoryEnabled(state, category) {
    if (!state.categories) return true;
    return state.categories[category] !== false;
  }

  function enabledMessages(state) {
    return (state.messages || []).filter((message) => {
      return message && message.enabled !== false && categoryEnabled(state, message.category);
    });
  }

  function nextCategory(state) {
    const start = Number(state.rotationIndex) || 0;
    for (let step = 0; step < ROTATION.length; step += 1) {
      const category = ROTATION[(start + step) % ROTATION.length];
      const hasMessage = enabledMessages(state).some((message) => message.category === category);
      if (categoryEnabled(state, category) && hasMessage) {
        return { category, index: (start + step) % ROTATION.length };
      }
    }
    return null;
  }

  function chooseMessage(state, preferredCategory) {
    const recent = new Set(state.recentMessageIds || []);
    const pool = enabledMessages(state);
    if (!pool.length) {
      return {
        text: 'Hey! 💧 Time for a water break.',
        category: 'water',
        action: 'drink',
        id: 'fallback'
      };
    }

    let candidates = pool;
    if (preferredCategory) {
      const inCategory = pool.filter((message) => message.category === preferredCategory);
      if (inCategory.length) candidates = inCategory;
    }

    const fresh = candidates.filter((message) => !recent.has(message.id));
    const usable = fresh.length ? fresh : candidates.filter((message) => message.id !== state.lastMessageId);
    const finalPool = usable.length ? usable : candidates;
    const pick = finalPool[Math.floor(Math.random() * finalPool.length)];
    return pick;
  }

  function resolveAction(ruleAction, message) {
    if (ruleAction && ruleAction !== 'auto') return ruleAction;
    if (message && message.action && message.action !== 'auto') return message.action;
    return CATEGORY_ACTION[message && message.category] || 'wave';
  }

  function materialize(state, rule) {
    let message;
    let rotationIndex = state.rotationIndex || 0;
    if (!rule || rule.messageMode === 'rotate') {
      const slot = nextCategory(state);
      message = chooseMessage(state, slot && slot.category);
      if (slot) rotationIndex = (slot.index + 1) % ROTATION.length;
    } else {
      const text = (rule.message || '').trim() || 'Hey! 💧 Time for a water break.';
      message = {
        id: `fixed-${rule.id}`,
        text,
        category: rule.category || 'custom',
        action: rule.action
      };
      const same = (state.messages || []).find((item) => item.text === text);
      if (same) message = same;
    }

    const recent = (state.recentMessageIds || []).filter((id) => id !== message.id);
    recent.push(message.id);

    return {
      message,
      action: resolveAction(rule && rule.action, message),
      recentMessageIds: recent.slice(-5),
      rotationIndex,
      lastMessageId: message.id
    };
  }

  return {
    CATEGORIES,
    CATEGORY_IDS,
    CATEGORY_ACTION,
    ROTATION,
    chooseMessage,
    materialize,
    resolveAction,
    categoryEnabled
  };
});
