const TEST_INTERVAL_MS = 10 * 1000;
const MINUTE = 60 * 1000;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function intervalMs(state, rule) {
  if (state.testMode) return TEST_INTERVAL_MS;
  const value = Number(rule.intervalValue);
  const safe = Number.isFinite(value) ? value : 30;
  if (rule.intervalUnit === 'seconds') return clamp(safe, 5, 3600) * 1000;
  return clamp(safe, 1, 240) * MINUTE;
}

function parseClock(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return 9 * 60;
  const hours = clamp(Number(match[1]), 0, 23);
  const minutes = clamp(Number(match[2]), 0, 59);
  return hours * 60 + minutes;
}

function minutesOf(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function isActiveAt(date, activeHours) {
  if (!activeHours || activeHours.enabled === false) return true;
  const days = Array.isArray(activeHours.days) ? activeHours.days : [1, 2, 3, 4, 5];
  if (!days.includes(date.getDay())) return false;
  const start = parseClock(activeHours.start);
  const end = parseClock(activeHours.end);
  const now = minutesOf(date);
  if (start === end) return true;
  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}

function nextOpening(state, now) {
  const active = state.activeHours;
  if (!active || active.enabled === false) return null;
  const start = new Date(now);
  start.setSeconds(0, 0);
  for (let offset = 0; offset < 8 * 24 * 60; offset += 1) {
    const candidate = new Date(start.getTime() + offset * MINUTE);
    if (isActiveAt(candidate, active) && candidate.getTime() >= now) return candidate.getTime();
  }
  return null;
}

function formatClock(ms) {
  const safe = Math.max(0, Math.ceil(Number(ms) || 0));
  const total = Math.floor(safe / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatLoose(ms) {
  const minutes = Math.max(1, Math.round((Number(ms) || 0) / MINUTE));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!rest) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${hours}h ${rest}m`;
}

function enabledRules(state) {
  return (state.rules || []).filter((rule) => rule && rule.enabled !== false);
}

function ensureScheduled(state, now) {
  if (!state.timerStarted || state.paused) return state;
  state.rules.forEach((rule) => {
    if (!rule.enabled) return;
    if (rule.armed) return;
    if (!rule.nextAt || !Number.isFinite(rule.nextAt)) {
      rule.nextAt = now + intervalMs(state, rule);
    }
  });
  return state;
}

function dueRule(state, now) {
  if (!state.timerStarted || state.paused) return null;
  if (!isActiveAt(new Date(now), state.activeHours)) return null;
  const due = enabledRules(state)
    .filter((rule) => !rule.armed && Number.isFinite(rule.nextAt) && rule.nextAt <= now)
    .sort((a, b) => a.nextAt - b.nextAt);
  return due[0] || null;
}

function armRule(state, ruleId) {
  const rule = state.rules.find((item) => item.id === ruleId);
  if (rule) rule.armed = true;
  return state;
}

function completeRule(state, ruleId, now) {
  const rule = state.rules.find((item) => item.id === ruleId);
  if (!rule) return state;
  rule.armed = false;
  rule.nextAt = now + intervalMs(state, rule);
  enabledRules(state).forEach((other) => {
    if (other.id !== rule.id && other.nextAt && other.nextAt <= now && !other.armed) {
      other.nextAt = now + intervalMs(state, other);
    }
  });
  return state;
}

function pauseState(state, now) {
  state.paused = true;
  state.rules.forEach((rule) => {
    if (rule.armed || !rule.nextAt) rule.remainingMs = intervalMs(state, rule);
    else rule.remainingMs = Math.max(1000, rule.nextAt - now);
    rule.armed = false;
  });
  return state;
}

function resumeState(state, now) {
  state.paused = false;
  state.timerStarted = true;
  state.rules.forEach((rule) => {
    const remaining = Number(rule.remainingMs);
    rule.nextAt = now + (Number.isFinite(remaining) && remaining > 0 ? remaining : intervalMs(state, rule));
    rule.armed = false;
  });
  return state;
}

function resetState(state, now) {
  state.paused = false;
  state.timerStarted = true;
  state.rules.forEach((rule) => {
    rule.armed = false;
    rule.remainingMs = intervalMs(state, rule);
    rule.nextAt = now + intervalMs(state, rule);
  });
  return state;
}

function applyTestMode(state, enabled, now) {
  state.testMode = !!enabled;
  state.rules.forEach((rule) => {
    rule.armed = false;
    if (!state.paused && state.timerStarted && rule.enabled) {
      rule.nextAt = now + intervalMs(state, rule);
    }
  });
  return state;
}

function soonest(state, now) {
  const rules = enabledRules(state).filter((rule) => Number.isFinite(rule.nextAt));
  if (!rules.length) return null;
  return rules.slice().sort((a, b) => a.nextAt - b.nextAt)[0];
}

function status(state, now) {
  const active = isActiveAt(new Date(now), state.activeHours);
  const opening = active ? null : nextOpening(state, now);
  if (!state.timerStarted) {
    return {
      paused: false,
      active,
      testMode: !!state.testMode,
      remainingMs: null,
      label: 'Not started',
      loose: 'Not started',
      ruleName: '',
      resumeText: '',
      nextAt: null
    };
  }
  if (state.paused) {
    const remaining = enabledRules(state).reduce((min, rule) => {
      const value = Number(rule.remainingMs);
      if (!Number.isFinite(value)) return min;
      return Math.min(min, value);
    }, Infinity);
    const ms = Number.isFinite(remaining) ? remaining : 0;
    return {
      paused: true,
      active,
      testMode: !!state.testMode,
      remainingMs: ms,
      label: formatClock(ms),
      loose: formatLoose(ms),
      ruleName: '',
      resumeText: 'Paused',
      nextAt: null
    };
  }
  const rule = soonest(state, now);
  if (!rule) {
    return {
      paused: false,
      active,
      testMode: !!state.testMode,
      remainingMs: null,
      label: 'No reminders',
      loose: 'No reminders',
      ruleName: '',
      resumeText: active ? '' : 'Outside active hours',
      nextAt: null
    };
  }
  const remainingMs = Math.max(0, rule.nextAt - now);
  let resumeText = '';
  if (!active && opening) {
    const when = new Date(opening);
    resumeText = `Resumes ${when.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
  }
  return {
    paused: false,
    active,
    testMode: !!state.testMode,
    remainingMs,
    label: formatClock(remainingMs),
    loose: formatLoose(remainingMs),
    ruleName: rule.name || 'Reminder',
    resumeText,
    nextAt: rule.nextAt
  };
}

function clearArmedOnLaunch(state, now) {
  state.rules.forEach((rule) => {
    if (!rule.armed) return;
    rule.armed = false;
    if (!state.paused && state.timerStarted) rule.nextAt = now + intervalMs(state, rule);
  });
  return state;
}

module.exports = {
  TEST_INTERVAL_MS,
  intervalMs,
  isActiveAt,
  nextOpening,
  formatClock,
  formatLoose,
  ensureScheduled,
  dueRule,
  armRule,
  completeRule,
  pauseState,
  resumeState,
  resetState,
  applyTestMode,
  status,
  clearArmedOnLaunch,
  parseClock
};
