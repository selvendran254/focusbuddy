const assert = require('assert');
const { defaultState, sanitize, mergePatch } = require('./settings');
const timer = require('./timer');
const reminders = require('./reminders');
const { CHARACTERS, renderSprite, gridText } = require('./character');
const { POSES } = require('./animation');

function testDefaults() {
  const state = sanitize(defaultState());
  assert.strictEqual(state.testMode, false);
  assert.strictEqual(state.character.id, 'sheet-boy');
  assert.strictEqual(state.position.preset, 'bottom-right');
  assert.strictEqual(state.rules[0].intervalValue, 30);
  assert.strictEqual(state.rules[0].intervalUnit, 'minutes');
  assert.strictEqual(state.rules[0].action, 'drink');
  assert.strictEqual(timer.intervalMs(state, state.rules[0]), 30 * 60 * 1000);
  assert.strictEqual(state.durationSec, 15);
  assert.strictEqual(state.sound.enabled, true);
  assert.strictEqual(state.notification.enabled, true);
}

function testProductionStaysThirty() {
  const messy = defaultState();
  messy.testMode = 'yes';
  messy.rules[0].intervalValue = 0;
  const state = sanitize(messy);
  assert.strictEqual(state.testMode, false);
  assert.strictEqual(state.rules[0].intervalValue, 1);
  const explicit = sanitize({ ...defaultState(), testMode: true });
  assert.strictEqual(explicit.testMode, true);
  assert.strictEqual(explicit.rules[0].intervalValue, 30);
  assert.strictEqual(timer.intervalMs(explicit, explicit.rules[0]), 10000);
}

function testPauseResumeAndSingleCatchUp() {
  const now = Date.UTC(2026, 9, 6, 10, 0, 0);
  const state = sanitize(defaultState());
  state.firstLaunchComplete = true;
  state.timerStarted = true;
  state.activeHours.enabled = false;
  timer.resetState(state, now);
  const before = state.rules[0].nextAt;
  timer.pauseState(state, now + 5000);
  assert.strictEqual(state.paused, true);
  assert.ok(state.rules[0].remainingMs < timer.intervalMs(state, state.rules[0]));
  timer.resumeState(state, now + 9000);
  assert.strictEqual(state.paused, false);
  assert.ok(state.rules[0].nextAt > now + 9000);

  state.rules[0].nextAt = now - 60 * 60 * 1000;
  state.rules.push({
    ...state.rules[0],
    id: 'rule-eyes',
    name: 'Eyes',
    nextAt: now - 30 * 60 * 1000,
    armed: false
  });
  const due = timer.dueRule(state, now);
  assert.ok(due);
  assert.strictEqual(due.id, 'rule-water');
  timer.completeRule(state, due.id, now);
  assert.ok(state.rules.every((rule) => rule.nextAt > now));
  assert.strictEqual(timer.dueRule(state, now), null);
  assert.ok(before);
}

function testActiveHours() {
  const hours = { enabled: true, start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] };
  const tuesdayMorning = new Date(2026, 9, 6, 10, 30, 0);
  const tuesdayNight = new Date(2026, 9, 6, 20, 0, 0);
  const sunday = new Date(2026, 9, 4, 11, 0, 0);
  assert.strictEqual(tuesdayMorning.getDay(), 2);
  assert.strictEqual(timer.isActiveAt(tuesdayMorning, hours), true);
  assert.strictEqual(timer.isActiveAt(tuesdayNight, hours), false);
  assert.strictEqual(timer.isActiveAt(sunday, hours), false);
  const state = sanitize(defaultState());
  state.activeHours = hours;
  const opening = timer.nextOpening(state, tuesdayNight.getTime());
  assert.ok(opening > tuesdayNight.getTime());
}

function testRotationSkipsRepeats() {
  const state = sanitize(defaultState());
  state.rules[0].messageMode = 'rotate';
  const seen = [];
  for (let i = 0; i < 6; i += 1) {
    const result = reminders.materialize(state, state.rules[0]);
    state.recentMessageIds = result.recentMessageIds;
    state.rotationIndex = result.rotationIndex;
    state.lastMessageId = result.lastMessageId;
    seen.push(result.message.id);
  }
  for (let i = 1; i < seen.length; i += 1) assert.notStrictEqual(seen[i], seen[i - 1]);
  assert.ok(seen.includes('m-water-1') || seen.includes('m-water-2') || seen.includes('m-water-3') || seen.includes('m-water-4') || seen.includes('m-water-5'));
}

function testSprites() {
  CHARACTERS.forEach((character) => {
    Object.keys(POSES).forEach((action) => {
      POSES[action].forEach((_, frame) => {
        const rendered = renderSprite({
          id: character.id,
          scale: 100,
          opacity: 100,
          theme: 'pixel',
          hair: character.defaultHair,
          hairColor: 'brown',
          outfit: character.defaultOutfit,
          color: 'blue',
          size: 'medium'
        }, action, frame);
        assert.ok(rendered.shadow.length > 80, `${character.id} ${action} ${frame} was empty`);
      });
    });
  });
}

function testPatchKeepsTimer() {
  const state = sanitize(defaultState());
  state.timerStarted = true;
  state.rules[0].nextAt = 123456789;
  const patched = mergePatch(state, {
    character: { ...state.character, color: 'teal' },
    testMode: false
  });
  assert.strictEqual(patched.ok, true);
  assert.strictEqual(patched.state.rules[0].nextAt, 123456789);
  assert.strictEqual(patched.state.character.color, 'teal');
  assert.strictEqual(patched.state.timerStarted, true);
  const bad = mergePatch(state, ['nope']);
  assert.strictEqual(bad.ok, false);
}

function main() {
  testDefaults();
  testProductionStaysThirty();
  testPauseResumeAndSingleCatchUp();
  testActiveHours();
  testRotationSkipsRepeats();
  testSprites();
  testPatchKeepsTimer();
  if (process.env.DUMP === '1') {
    console.log(gridText({ id: 'developer', theme: 'pixel', hair: 'short', outfit: 'hoodie', color: 'blue' }, 'idle', 0));
    console.log('--- cat ---');
    console.log(gridText({ id: 'cat', theme: 'cute', color: 'amber', outfit: 'bow' }, 'idle', 0));
  }
  console.log('FocusBuddy self-test passed');
}

main();
