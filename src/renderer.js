(function () {
  const PAGES = [
    ['home', 'Home'],
    ['customize', 'Customize'],
    ['reminders', 'Reminders'],
    ['appearance', 'Appearance'],
    ['timing', 'Timing'],
    ['settings', 'Settings']
  ];
  const COPY = {
    home: ['Home', 'The companion stays hidden until a reminder is due.'],
    customize: ['Customize', 'Change the companion here. Nothing requires editing code.'],
    reminders: ['Reminders', 'Create your own messages, actions, and schedules.'],
    appearance: ['Appearance', 'Size, color, speech bubble, and where the companion stands.'],
    timing: ['Timing', 'The default break is 30 minutes. Test mode is separate.'],
    settings: ['Settings', 'Sound, notifications, active hours, and behavior.']
  };

  let state = null;
  let page = 'home';
  let lastStatus = null;
  let queued = null;
  let pumping = false;
  let previewTimer = null;
  let previewAction = 'idle';
  let previewFrame = 0;
  let toastTimer = null;
  let deskDrag = null;

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  function primary() {
    return state.rules.find((rule) => rule.id === state.primaryRuleId) || state.rules[0];
  }

  function setPath(obj, path, value) {
    const parts = path.split('.');
    let cursor = obj;
    for (let i = 0; i < parts.length - 1; i += 1) cursor = cursor[parts[i]];
    cursor[parts[parts.length - 1]] = value;
  }

  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
  }

  function queue(patch) {
    queued = Object.assign(queued || {}, patch);
    void pump();
  }

  async function pump() {
    if (pumping || !queued) return;
    pumping = true;
    const patch = queued;
    queued = null;
    try {
      const result = await window.focusbuddy.save(patch);
      if (result && result.ok && !queued) state = result.state;
    } catch (error) {
      console.error(error);
    }
    pumping = false;
    if (queued) void pump();
  }

  async function flush() {
    if (queued) await pump();
    while (pumping) await new Promise((resolve) => setTimeout(resolve, 20));
    if (queued) await pump();
  }

  function modeLabel() {
    const modes = { coding: 'Coding Mode', study: 'Study Mode', work: 'Work Mode', custom: 'Custom Mode' };
    return modes[state.mode] || 'Custom Mode';
  }

  function paintNav() {
    $('nav').innerHTML = PAGES.map(([id, label]) => {
      return `<button type="button" data-nav="${id}" class="${page === id ? 'active' : ''}"><span>${label}</span></button>`;
    }).join('');
    const copy = COPY[page] || COPY.home;
    $('page-title').textContent = copy[0];
    $('page-sub').textContent = copy[1];
    $('mode-pill').textContent = state.testMode ? 'TEST MODE' : modeLabel();
    $('test-banner').hidden = !state.testMode;
    document.body.style.fontSize = `${state.uiTextScale || 100}%`;
  }

  function paintWelcome() {
    const welcome = $('welcome');
    if (state.firstLaunchComplete) {
      welcome.hidden = true;
      welcome.innerHTML = '';
      return;
    }
    welcome.hidden = false;
    welcome.innerHTML = `
      <div class="welcome-card">
        <h2>Meet FocusBuddy 👋</h2>
        <p>Your tiny desktop companion for healthier coding sessions. It stays out of the way, then walks in when it is time for a break.</p>
        <div class="actions">
          <button class="primary" type="button" data-cmd="setup" data-value="start">Start with 30-minute reminders</button>
          <button class="soft" type="button" data-cmd="setup" data-value="customize">Customize</button>
          <button class="ghost" type="button" data-cmd="setup" data-value="skip">Skip setup</button>
        </div>
      </div>`;
  }

  function choiceButtons(group, options, current) {
    return `<div class="choice-row">${options.map((item) => {
      const id = item.id || item;
      const label = item.label || item;
      return `<button type="button" class="choice ${current === id ? 'selected' : ''}" data-pick="${group}" data-value="${esc(id)}">${esc(label)}</button>`;
    }).join('')}</div>`;
  }

  function toggle(path, on, label) {
    return `<button type="button" class="switch ${on ? 'on' : ''}" data-cmd="toggle" data-path="${path}" aria-pressed="${on}"><i></i><span>${esc(label)}</span></button>`;
  }

  function ruleFields() {
    const rule = primary();
    const characters = [{ id: '', label: 'Current companion' }].concat(window.FocusCharacters.CHARACTERS.map((item) => ({ id: item.id, label: item.name })));
    return `
      <div class="grid-2">
        <label class="field"><span>Name</span><input data-bind="rule.name" type="text" value="${esc(rule.name)}"></label>
        <label class="field"><span>Category</span>
          <select data-bind="rule.category">${window.FocusReminders.CATEGORIES.map((cat) => `<option value="${cat.id}" ${rule.category === cat.id ? 'selected' : ''}>${cat.icon} ${esc(cat.label)}</option>`).join('')}</select>
        </label>
      </div>
      <label class="field"><span>Reminder interval</span>
        <span class="inline">
          <input data-bind="rule.intervalValue" type="number" min="1" max="240" value="${esc(rule.intervalValue)}">
          <select data-bind="rule.intervalUnit">
            <option value="minutes" ${rule.intervalUnit !== 'seconds' ? 'selected' : ''}>Minutes</option>
            <option value="seconds" ${rule.intervalUnit === 'seconds' ? 'selected' : ''}>Seconds</option>
          </select>
        </span>
      </label>
      <div class="choice-row">
        ${[10, 20, 30, 45, 60, 90, 120].map((min) => `<button type="button" class="choice ${rule.intervalUnit === 'minutes' && Number(rule.intervalValue) === min ? 'selected' : ''}" data-pick="interval" data-value="${min}">${min} min</button>`).join('')}
      </div>
      <label class="field"><span>Message</span><textarea data-bind="rule.message">${esc(rule.message)}</textarea></label>
      ${choiceButtons('message-mode', [{ id: 'fixed', label: 'This message' }, { id: 'rotate', label: 'Rotate messages' }], rule.messageMode)}
      <p class="help">${rule.messageMode === 'rotate' ? 'Scheduled reminders rotate enabled messages and avoid repeating the last one. Test Reminder plays the message in the box.' : 'This exact message is used every time this reminder runs.'}</p>
      <div class="grid-2">
        <label class="field"><span>Character</span>
          <select data-bind="rule.characterId">${characters.map((item) => `<option value="${item.id}" ${(rule.characterId || '') === item.id ? 'selected' : ''}>${esc(item.label)}</option>`).join('')}</select>
        </label>
        <label class="field"><span>Action</span>
          <select data-bind="rule.action">${window.FocusAnimation.ACTIONS.map((item) => `<option value="${item.id}" ${rule.action === item.id ? 'selected' : ''}>${esc(item.label)}</option>`).join('')}</select>
        </label>
      </div>
      <label class="field"><span>Duration</span>
        <select data-bind="rule.durationSec">
          ${[5, 10, 15, 20, 30, 45, 60].map((sec) => `<option value="${sec}" ${Number(rule.durationSec) === sec ? 'selected' : ''}>${sec} seconds</option>`).join('')}
        </select>
      </label>
      <div class="grid-2">
        ${toggle('rule.sound', rule.sound !== false, 'Sound')}
        ${toggle('rule.notification', rule.notification !== false, 'Notification')}
      </div>
      <div class="actions">
        <button class="primary" type="button" data-cmd="test">▶ Test Reminder</button>
        <button class="soft" type="button" data-cmd="save-rule">Save</button>
      </div>`;
  }

  function pageHome() {
    const statusClass = state.paused ? 'paused' : 'active';
    return `
      <div class="stats">
        <div class="stat hero"><span>Next break</span><b data-timer>--:--</b></div>
        <div class="stat"><span>Mode</span><b style="font-size:18px">${esc(modeLabel())}</b></div>
        <div class="stat"><span>Status</span><b class="status-dot ${statusClass}" data-status style="font-size:16px">Reminders active</b></div>
      </div>
      <div class="card">
        <h2>Modes</h2>
        ${choiceButtons('mode', [
          { id: 'coding', label: 'Coding · 30m' },
          { id: 'study', label: 'Study · 45m' },
          { id: 'work', label: 'Work · 60m' },
          { id: 'custom', label: 'Custom' }
        ], state.mode)}
        <p class="help" data-resume></p>
        <div class="actions">
          <button class="soft" type="button" data-cmd="pause">Pause</button>
          <button class="soft" type="button" data-cmd="resume">Resume</button>
          <button class="primary" type="button" data-cmd="test">▶ Test Reminder</button>
          <button class="ghost" type="button" data-nav="customize">Customize</button>
        </div>
      </div>`;
  }

  function posePicker() {
    const character = window.FocusCharacters;
    const def = character.CHARACTERS.find((item) => item.id === state.character.id) || {};
    if (!def.photoSet) return '';
    const current = state.character.pose || 'hero';
    return `
      <div class="card">
        <h2>Pose</h2>
        <p class="help">Pick how he stands on screen. Walking, drinking, waving and sitting switch pose automatically.</p>
        <div class="pose-grid">${character.PHOTO_POSES.map((item) => `
          <button type="button" class="pose-card ${current === item.id ? 'selected' : ''}" data-pick="pose" data-value="${item.id}">
            <img src="${def.photoSet}${item.id}.png" alt="">
            <strong>${esc(item.label)}</strong>
          </button>`).join('')}</div>
      </div>`;
  }

  function pageCustomize() {
    const character = window.FocusCharacters;
    const human = (character.CHARACTERS.find((item) => item.id === state.character.id) || {}).kind === 'human';
    return `
      <div class="card"><h2>Character</h2><div class="char-grid">${character.CHARACTERS.map((item) => `
        <button type="button" class="char-card ${state.character.id === item.id ? 'selected' : ''}" data-pick="character" data-value="${item.id}">
          <span class="mini-sprite" data-mini="${item.id}"></span>
          <strong>${esc(item.name)}</strong>
          ${state.character.id === item.id ? '<em>✓</em>' : ''}
        </button>`).join('')}</div></div>
      ${posePicker()}
      <div class="card">
        <h2>Quick reminder</h2>
        ${ruleFields()}
      </div>
      <div class="card">
        <h2>Look</h2>
        ${choiceButtons('size', character.SIZES, state.character.size)}
        <label class="field"><span>Scale ${state.character.scale}%</span><input data-bind="character.scale" type="range" min="10" max="200" value="${state.character.scale}"></label>
        <label class="field"><span>Opacity ${state.character.opacity}%</span><input data-bind="character.opacity" type="range" min="50" max="100" value="${state.character.opacity}"></label>
        ${choiceButtons('theme', character.THEMES, state.character.theme)}
        <div class="swatches">${character.COLORS.map((item) => `<button type="button" class="swatch ${state.character.color === item.id ? 'selected' : ''}" style="background:${item.hex}" data-pick="color" data-value="${item.id}" aria-label="${esc(item.label)}"></button>`).join('')}</div>
        ${human ? `<p class="help">Hair and outfit</p>${choiceButtons('hair', character.HAIR_STYLES, state.character.hair)}${choiceButtons('outfit', character.OUTFITS, state.character.outfit)}` : `<p class="help">Accessory</p>${choiceButtons('outfit', character.ACCESSORIES, state.character.outfit)}`}
      </div>`;
  }

  function pageReminders() {
    return `
      <div class="card">
        <h2>Your reminders</h2>
        <div class="list" id="rule-list">${state.rules.map((rule) => `
          <div class="rule ${rule.id === primary().id ? 'selected' : ''}" data-cmd="select-rule" data-id="${esc(rule.id)}">
            <div><strong>${esc(rule.name)}</strong><div class="help">${esc(rule.intervalValue)} ${esc(rule.intervalUnit)} · ${esc(rule.action)}</div></div>
            <button type="button" class="ghost" data-cmd="toggle-rule" data-id="${esc(rule.id)}">${rule.enabled === false ? 'Off' : 'On'}</button>
            <button type="button" class="ghost" data-cmd="delete-rule" data-id="${esc(rule.id)}">Delete</button>
          </div>`).join('')}</div>
        <div class="actions"><button class="soft" type="button" data-cmd="add-rule">+ New reminder</button></div>
      </div>
      <div class="card"><h2>Edit reminder</h2>${ruleFields()}</div>
      <div class="card">
        <h2>Reminder messages</h2>
        <div class="list" id="message-list">${messageRows()}</div>
        <div class="actions"><button class="soft" type="button" data-cmd="add-message">+ Add message</button></div>
        <h3>Categories</h3>
        <div class="grid-2">${window.FocusReminders.CATEGORIES.map((cat) => toggle(`categories.${cat.id}`, state.categories[cat.id] !== false, `${cat.icon} ${cat.label}`)).join('')}</div>
      </div>`;
  }

  function messageRows() {
    return state.messages.map((message) => `
      <div class="list-row">
        <input data-message="${esc(message.id)}" type="text" value="${esc(message.text)}">
        <span class="inline">
          <button type="button" class="ghost" data-cmd="toggle-message" data-id="${esc(message.id)}">${message.enabled === false ? 'Disabled' : 'Enabled'}</button>
          <button type="button" class="ghost" data-cmd="delete-message" data-id="${esc(message.id)}">Delete</button>
        </span>
      </div>`).join('');
  }

  function pageAppearance() {
    const character = window.FocusCharacters;
    const human = (character.CHARACTERS.find((item) => item.id === state.character.id) || {}).kind === 'human';
    return `
      ${posePicker()}
      <div class="card">
        <h2>Size and theme</h2>
        ${choiceButtons('size', character.SIZES, state.character.size)}
        <label class="field"><span>Scale ${state.character.scale}%</span><input data-bind="character.scale" type="range" min="10" max="200" value="${state.character.scale}"></label>
        <label class="field"><span>Opacity ${state.character.opacity}%</span><input data-bind="character.opacity" type="range" min="50" max="100" value="${state.character.opacity}"></label>
        ${choiceButtons('theme', character.THEMES, state.character.theme)}
        <div class="swatches">${character.COLORS.map((item) => `<button type="button" class="swatch ${state.character.color === item.id ? 'selected' : ''}" style="background:${item.hex}" data-pick="color" data-value="${item.id}" aria-label="${esc(item.label)}"></button>`).join('')}</div>
        <div class="swatches">${character.HAIR_COLORS.map((item) => `<button type="button" class="swatch ${state.character.hairColor === item.id ? 'selected' : ''}" style="background:${item.hex}" data-pick="hair-color" data-value="${item.id}" aria-label="${esc(item.label)}"></button>`).join('')}</div>
        ${human ? choiceButtons('hair', character.HAIR_STYLES, state.character.hair) + choiceButtons('outfit', character.OUTFITS, state.character.outfit) : choiceButtons('outfit', character.ACCESSORIES, state.character.outfit)}
      </div>
      <div class="card">
        <h2>Speech bubble</h2>
        ${toggle('speech.enabled', state.speech.enabled !== false, 'Speech bubble')}
        ${choiceButtons('bubble-style', ['rounded', 'minimal', 'pixel', 'cartoon'].map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) })), state.speech.style)}
        ${choiceButtons('bubble-size', ['small', 'medium', 'large'].map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) })), state.speech.size)}
        ${choiceButtons('font-size', ['small', 'medium', 'large'].map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) })), state.speech.fontSize)}
        ${choiceButtons('placement', [{ id: 'above', label: 'Above' }, { id: 'left', label: 'Left' }, { id: 'right', label: 'Right' }], state.speech.placement)}
        ${choiceButtons('tone', [{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }], state.speech.tone)}
      </div>
      <div class="card">
        <h2>Position</h2>
        ${choiceButtons('position', [
          { id: 'bottom-right', label: 'Bottom Right' },
          { id: 'bottom-left', label: 'Bottom Left' },
          { id: 'top-right', label: 'Top Right' },
          { id: 'top-left', label: 'Top Left' },
          { id: 'center-right', label: 'Center Right' },
          { id: 'center-left', label: 'Center Left' },
          { id: 'custom', label: 'Custom' }
        ], state.position.preset)}
        <p class="help">Drag the character in the live preview, then save that spot. The next reminder walks to it.</p>
        <div class="actions">
          <button class="primary" type="button" data-cmd="save-position">Save position</button>
          ${toggle('lockPosition', state.lockPosition === true, 'Lock character position')}
        </div>
      </div>`;
  }

  function pageTiming() {
    const rule = primary();
    return `
      <div class="card">
        <h2>Work style</h2>
        ${choiceButtons('mode', [
          { id: 'coding', label: 'Coding Mode' },
          { id: 'study', label: 'Study Mode' },
          { id: 'work', label: 'Work Mode' },
          { id: 'custom', label: 'Custom Mode' }
        ], state.mode)}
        <p class="help">Coding is 30 minutes, Study is 45, Work is 60. You can change any of them afterward.</p>
      </div>
      <div class="card">
        <h2>Default interval</h2>
        <p class="help">This edits “${esc(rule.name)}”. Production stays on the interval you set here. Test mode does not overwrite it.</p>
        ${choiceButtons('interval', [10, 20, 30, 45, 60, 90, 120].map((min) => ({ id: String(min), label: `${min} min` })), rule.intervalUnit === 'minutes' ? String(rule.intervalValue) : '')}
        <label class="field"><span>Custom interval</span><span class="inline"><input data-bind="rule.intervalValue" type="number" min="1" max="240" value="${esc(rule.intervalValue)}"><select data-bind="rule.intervalUnit"><option value="minutes" ${rule.intervalUnit !== 'seconds' ? 'selected' : ''}>Minutes</option><option value="seconds" ${rule.intervalUnit === 'seconds' ? 'selected' : ''}>Seconds</option></select></span></label>
        ${choiceButtons('duration', [5, 10, 15, 20, 30].map((sec) => ({ id: String(sec), label: `${sec} seconds` })), String(state.durationSec))}
      </div>
      <div class="card">
        <h2>Active hours</h2>
        ${toggle('activeHours.enabled', state.activeHours.enabled !== false, 'Only during these hours')}
        <div class="grid-2">
          <label class="field"><span>Start</span><input data-bind="activeHours.start" type="time" value="${esc(state.activeHours.start)}"></label>
          <label class="field"><span>End</span><input data-bind="activeHours.end" type="time" value="${esc(state.activeHours.end)}"></label>
        </div>
        <div class="choice-row">${[
          ['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed'], ['4', 'Thu'], ['5', 'Fri'], ['6', 'Sat'], ['0', 'Sun']
        ].map(([id, label]) => `<button type="button" class="choice ${state.activeHours.days.includes(Number(id)) ? 'selected' : ''}" data-cmd="day" data-value="${id}">${label}</button>`).join('')}</div>
      </div>`;
  }

  function pageSettings() {
    const sounds = [
      ['soft', 'Soft notification'],
      ['pop', 'Pop'],
      ['bell', 'Bell'],
      ['water', 'Water'],
      ['none', 'None'],
      ['custom', 'Custom']
    ];
    return `
      <div class="card">
        <h2>Notifications</h2>
        ${toggle('notification.enabled', state.notification.enabled !== false, 'Desktop notifications')}
        ${toggle('notification.useReminderMessage', state.notification.useReminderMessage !== false, 'Use the reminder message as the notification body')}
        <label class="field"><span>Notification title</span><input data-bind="notification.title" type="text" value="${esc(state.notification.title)}"></label>
        <label class="field"><span>Notification message</span><input data-bind="notification.body" type="text" value="${esc(state.notification.body)}"></label>
      </div>
      <div class="card">
        <h2>Sound</h2>
        ${toggle('sound.enabled', state.sound.enabled !== false, 'Reminder sound')}
        <label class="field"><span>Volume ${state.sound.volume}%</span><input data-bind="sound.volume" type="range" min="0" max="100" value="${state.sound.volume}"></label>
        ${choiceButtons('sound', sounds.map(([id, label]) => ({ id, label })), state.sound.choice)}
        <p class="help">${state.sound.customName ? `Custom file: ${esc(state.sound.customName)}` : 'You can add your own short sound.'}</p>
        <div class="actions">
          <button class="soft" type="button" data-cmd="preview-sound">Play sound</button>
          <button class="soft" type="button" data-cmd="pick-sound">Upload sound</button>
          <button class="ghost" type="button" data-cmd="clear-sound">Remove custom sound</button>
        </div>
      </div>
      <div class="card">
        <h2>Behavior</h2>
        <div class="grid-2">
          ${toggle('behavior.walking', state.behavior.walking !== false, 'Walking')}
          ${toggle('behavior.water', state.behavior.water !== false, 'Water animation')}
          ${toggle('behavior.bubble', state.behavior.bubble !== false, 'Speech bubble')}
          ${toggle('behavior.autoStart', state.behavior.autoStart !== false, 'Start timer when the app opens')}
          ${toggle('behavior.miniTimer', state.behavior.miniTimer !== false, 'Tiny countdown on the companion')}
          ${toggle('reducedMotion', state.reducedMotion === true, 'Reduced motion')}
          ${toggle('lockPosition', state.lockPosition === true, 'Lock character position')}
        </div>
        ${choiceButtons('text-scale', [{ id: '100', label: 'Text' }, { id: '112', label: 'Larger' }, { id: '125', label: 'Largest' }], String(state.uiTextScale))}
      </div>
      <div class="card dev-card ${state.testMode ? 'hot' : ''}">
        <h2>Developer</h2>
        <p class="help">Test mode runs reminders every 10 seconds so you can watch the walk, bubble, and water animation. Your saved interval stays at ${esc(primary().intervalValue)} ${esc(primary().intervalUnit)}. The normal default is 30 minutes. Test mode is off unless you turn it on here, and the banner stays visible while it is on.</p>
        <button class="primary" type="button" data-cmd="test-mode">${state.testMode ? 'Turn off test mode' : 'Enable 10-second test mode'}</button>
      </div>`;
  }

  const RENDER = {
    home: pageHome,
    customize: pageCustomize,
    reminders: pageReminders,
    appearance: pageAppearance,
    timing: pageTiming,
    settings: pageSettings
  };

  function paintPage() {
    $('page').innerHTML = (RENDER[page] || pageHome)();
    document.querySelectorAll('[data-mini]').forEach((el) => {
      drawSprite(el, { ...state.character, id: el.dataset.mini, scale: 36 }, 'idle', 0);
    });
  }

  function paintPreview() {
    const root = $('preview');
    if (!root.querySelector('.desk')) {
      root.innerHTML = `
        <div class="preview-card">
          <h2>Live preview</h2>
          <p class="help">Next break <strong data-timer>--:--</strong></p>
          <div class="desk" id="desk">
            <div class="desk-actor" id="desk-actor">
              <div class="bubble" id="preview-bubble"><p id="preview-text"></p></div>
              <div class="sprite" id="preview-sprite"><i></i></div>
            </div>
          </div>
          <div class="preview-actions">
            <button class="primary" type="button" data-cmd="test">▶ Test Reminder</button>
            <button class="soft" type="button" data-cmd="preview-action">Play action</button>
          </div>
        </div>`;
    }
    const rule = primary();
    const bubble = $('preview-bubble');
    bubble.className = `bubble ${state.speech.style} ${state.speech.tone} font-${state.speech.fontSize}`;
    bubble.hidden = state.speech.enabled === false || state.behavior.bubble === false;
    $('preview-text').textContent = rule.message || 'Hey! 💧 Time for a water break.';
    const actor = $('desk-actor');
    const anchor = anchorFor(state.position);
    actor.style.left = `calc(12px + (100% - 24px - var(--aw, 80px)) * ${anchor.nx})`;
    actor.style.top = `calc(12px + (100% - 24px - var(--ah, 80px)) * ${anchor.ny})`;
    actor.style.cursor = state.lockPosition ? 'default' : 'grab';
    drawSprite($('preview-sprite'), state.character, previewAction, previewFrame);
    const sprite = $('preview-sprite');
    actor.style.setProperty('--aw', `${sprite.offsetWidth || 80}px`);
    actor.style.setProperty('--ah', `${(sprite.offsetHeight || 80) + 48}px`);
    if (lastStatus) applyStatus(lastStatus);
  }

  function anchorFor(position) {
    if (position.preset === 'bottom-left') return { nx: 0, ny: 1 };
    if (position.preset === 'top-right') return { nx: 1, ny: 0 };
    if (position.preset === 'top-left') return { nx: 0, ny: 0 };
    if (position.preset === 'center-right') return { nx: 1, ny: 0.5 };
    if (position.preset === 'center-left') return { nx: 0, ny: 0.5 };
    if (position.preset === 'custom') return { nx: Number(position.nx) || 0, ny: Number(position.ny) || 0 };
    return { nx: 1, ny: 1 };
  }

  function drawSprite(el, appearance, action, frame) {
    if (!appearance || appearance.theme !== 'pixel') {
      const figure = window.Focus3D.render(appearance, action || 'idle');
      el.style.width = `${figure.width}px`;
      el.style.height = `${figure.height}px`;
      el.style.opacity = String(figure.opacity);
      el.innerHTML = figure.svg;
      return;
    }
    const rendered = window.FocusCharacters.renderSprite(appearance, action, frame);
    el.style.width = `${rendered.width}px`;
    el.style.height = `${rendered.height}px`;
    el.style.opacity = String(rendered.opacity);
    let pixel = el.querySelector('i');
    if (!pixel) {
      el.innerHTML = '<i></i>';
      pixel = el.querySelector('i');
    }
    pixel.style.width = `${rendered.pixel}px`;
    pixel.style.height = `${rendered.pixel}px`;
    pixel.style.boxShadow = rendered.shadow;
  }

  function paint() {
    paintNav();
    paintWelcome();
    paintPage();
    paintPreview();
  }

  function applyStatus(status) {
    lastStatus = status;
    document.querySelectorAll('[data-timer]').forEach((el) => { el.textContent = status.label; });
    document.querySelectorAll('[data-status]').forEach((el) => {
      el.classList.toggle('paused', status.paused);
      el.classList.toggle('asleep', !status.active && !status.paused);
      el.textContent = status.paused ? 'Paused' : (!status.active ? 'Outside active hours' : 'Reminders active');
    });
    document.querySelectorAll('[data-resume]').forEach((el) => { el.textContent = status.resumeText || ''; });
  }

  function bindValue(bind, raw, element) {
    let value = raw;
    if (element.type === 'number' || element.type === 'range' || bind === 'rule.durationSec' || bind === 'rule.intervalValue') {
      value = Number(raw);
    }
    if (bind.startsWith('rule.')) {
      const rule = primary();
      const key = bind.slice(5);
      rule[key] = value;
      if (key === 'intervalValue' || key === 'intervalUnit') state.mode = 'custom';
      if (key === 'characterId' && value) state.character.id = value;
      if (key === 'durationSec') state.durationSec = Number(value);
      if (key === 'action') {
        previewAction = !value || value === 'auto' || value === 'custom' ? 'wave' : value;
        previewFrame = 0;
        startPreviewLoop();
      }
      queue({ rules: state.rules, mode: state.mode, character: state.character, durationSec: state.durationSec });
      return;
    }
    if (bind === 'character.scale') {
      state.character.scale = Number(value);
      state.character.size = 'custom';
      queue({ character: state.character });
      return;
    }
    setPath(state, bind, value);
    queue({ [bind.split('.')[0]]: bind.includes('.') ? state[bind.split('.')[0]] : value });
  }

  function applyPick(group, value) {
    const character = state.character;
    if (group === 'character') {
      character.id = value;
      const rule = primary();
      rule.characterId = value;
      queue({ character, rules: state.rules });
    } else if (group === 'size') {
      const size = window.FocusCharacters.SIZES.find((item) => item.id === value);
      character.size = value;
      if (size && size.scale) character.scale = size.scale;
      queue({ character });
    } else if (group === 'theme') {
      character.theme = value;
      queue({ character });
    } else if (group === 'color') {
      character.color = value;
      queue({ character });
    } else if (group === 'hair') {
      character.hair = value;
      queue({ character });
    } else if (group === 'pose') {
      character.pose = value;
      queue({ character });
    } else if (group === 'hair-color') {
      character.hairColor = value;
      queue({ character });
    } else if (group === 'outfit') {
      character.outfit = value;
      queue({ character });
    } else if (group === 'position') {
      state.position.preset = value;
      const anchor = anchorFor(state.position);
      if (value !== 'custom') {
        state.position.nx = anchor.nx;
        state.position.ny = anchor.ny;
      }
      queue({ position: state.position });
    } else if (group === 'mode') {
      const minutes = { coding: 30, study: 45, work: 60 }[value];
      state.mode = value;
      if (minutes) {
        const rule = primary();
        rule.intervalValue = minutes;
        rule.intervalUnit = 'minutes';
      }
      queue({ mode: state.mode, rules: state.rules });
    } else if (group === 'interval') {
      const rule = primary();
      rule.intervalValue = Number(value);
      rule.intervalUnit = 'minutes';
      state.mode = 'custom';
      queue({ rules: state.rules, mode: state.mode });
    } else if (group === 'duration') {
      state.durationSec = Number(value);
      primary().durationSec = Number(value);
      queue({ durationSec: state.durationSec, rules: state.rules });
    } else if (group === 'message-mode') {
      primary().messageMode = value;
      queue({ rules: state.rules });
    } else if (group === 'bubble-style') {
      state.speech.style = value;
      queue({ speech: state.speech });
    } else if (group === 'bubble-size') {
      state.speech.size = value;
      queue({ speech: state.speech });
    } else if (group === 'font-size') {
      state.speech.fontSize = value;
      queue({ speech: state.speech });
    } else if (group === 'placement') {
      state.speech.placement = value;
      queue({ speech: state.speech });
    } else if (group === 'tone') {
      state.speech.tone = value;
      queue({ speech: state.speech });
    } else if (group === 'sound') {
      state.sound.choice = value;
      queue({ sound: state.sound });
    } else if (group === 'text-scale') {
      state.uiTextScale = Number(value);
      queue({ uiTextScale: state.uiTextScale });
    }
    paint();
  }

  function flip(path) {
    if (path.startsWith('rule.')) {
      const key = path.slice(5);
      const rule = primary();
      rule[key] = rule[key] === false;
      queue({ rules: state.rules });
      if (key === 'sound') state.sound.enabled = rule.sound !== false;
      if (key === 'notification') state.notification.enabled = rule.notification !== false;
      if (key === 'sound' || key === 'notification') queue({ sound: state.sound, notification: state.notification, rules: state.rules });
      paint();
      return;
    }
    const current = path.split('.').reduce((obj, key) => obj[key], state);
    setPath(state, path, current === false || current == null ? true : !current);
    if (path === 'sound.enabled' || path === 'notification.enabled') {
      primary()[path.startsWith('sound') ? 'sound' : 'notification'] = path.split('.').reduce((obj, key) => obj[key], state);
      queue({ rules: state.rules });
    }
    queue({ [path.split('.')[0]]: path.includes('.') ? state[path.split('.')[0]] : state[path] });
    paint();
  }

  function previewMessage() {
    return primary().message || 'Hey! 💧 Time for a water break.';
  }

  async function testReminder() {
    await flush();
    const rule = primary();
    let action = rule.action;
    if (!action || action === 'auto' || action === 'custom') {
      action = window.FocusReminders.CATEGORY_ACTION[rule.category] || 'wave';
    }
    await window.focusbuddy.testReminder({
      message: previewMessage(),
      action,
      durationSec: Number(rule.durationSec) || state.durationSec,
      sound: rule.sound !== false,
      notification: rule.notification !== false,
      character: state.character
    });
    toast('Playing on your desktop');
  }

  function rememberMessage() {
    const rule = primary();
    const text = (rule.message || '').trim();
    if (!text) return;
    if (!state.messages.some((message) => message.text === text)) {
      state.messages.unshift({
        id: `msg-${Math.random().toString(16).slice(2, 10)}`,
        text,
        category: rule.category || 'custom',
        enabled: true,
        action: rule.action && rule.action !== 'auto' ? rule.action : 'wave'
      });
      queue({ messages: state.messages });
    }
  }

  async function runCmd(cmd, el) {
    if (cmd === 'setup') {
      const result = await window.focusbuddy.setup(el.dataset.value);
      if (result && result.ok) {
        state = result.state;
        page = result.page || 'home';
        paint();
      }
      return;
    }
    if (cmd === 'toggle') { flip(el.dataset.path); return; }
    if (cmd === 'test') { await testReminder(); return; }
    if (cmd === 'save-rule' || cmd === 'save-position') {
      rememberMessage();
      await flush();
      toast('Saved');
      return;
    }
    if (cmd === 'pause' || cmd === 'resume' || cmd === 'reset' || cmd === 'skip' || cmd === 'start') {
      const result = await window.focusbuddy[cmd === 'skip' ? 'skip' : cmd]();
      if (result && result.ok) {
        state = result.state;
        applyStatus(result.status);
        paint();
      }
      return;
    }
    if (cmd === 'test-mode') {
      queue({ testMode: !state.testMode });
      state.testMode = !state.testMode;
      await flush();
      paint();
      toast(state.testMode ? 'Test mode is on' : 'Back to your saved interval');
      return;
    }
    if (cmd === 'preview-action') {
      const action = primary().action;
      previewAction = !action || action === 'auto' || action === 'custom' ? 'drink' : action;
      previewFrame = 0;
      startPreviewLoop();
      return;
    }
    if (cmd === 'preview-sound') {
      let dataUrl = '';
      if (state.sound.choice === 'custom') {
        const result = await window.focusbuddy.readSound();
        dataUrl = result.dataUrl || '';
      }
      window.FocusSound.play({ ...state.sound, dataUrl });
      return;
    }
    if (cmd === 'pick-sound') {
      const result = await window.focusbuddy.pickSound();
      if (result && result.ok) {
        state = result.state;
        paint();
        toast('Sound added');
      } else if (result && result.error) toast(result.error);
      return;
    }
    if (cmd === 'clear-sound') {
      const result = await window.focusbuddy.clearSound();
      if (result && result.ok) {
        state = result.state;
        paint();
      }
      return;
    }
    if (cmd === 'add-message') {
      state.messages.unshift({
        id: `msg-${Math.random().toString(16).slice(2, 10)}`,
        text: 'New reminder',
        category: 'custom',
        enabled: true,
        action: 'wave'
      });
      queue({ messages: state.messages });
      paintPage();
      return;
    }
    if (cmd === 'delete-message') {
      state.messages = state.messages.filter((message) => message.id !== el.dataset.id);
      if (!state.messages.length) return;
      queue({ messages: state.messages });
      paintPage();
      return;
    }
    if (cmd === 'toggle-message') {
      const message = state.messages.find((item) => item.id === el.dataset.id);
      if (!message) return;
      message.enabled = message.enabled === false;
      queue({ messages: state.messages });
      paintPage();
      return;
    }
    if (cmd === 'add-rule') {
      const id = `rule-${Math.random().toString(16).slice(2, 10)}`;
      state.rules.push({
        id,
        name: 'New reminder',
        enabled: true,
        intervalValue: 30,
        intervalUnit: 'minutes',
        messageMode: 'fixed',
        message: 'Hey! 💧 Time for a water break.',
        category: 'custom',
        characterId: state.character.id,
        action: 'wave',
        sound: true,
        notification: true,
        durationSec: state.durationSec
      });
      state.primaryRuleId = id;
      queue({ rules: state.rules, primaryRuleId: id });
      paint();
      return;
    }
    if (cmd === 'delete-rule') {
      if (state.rules.length < 2) { toast('Keep at least one reminder'); return; }
      state.rules = state.rules.filter((rule) => rule.id !== el.dataset.id);
      if (!state.rules.some((rule) => rule.id === state.primaryRuleId)) state.primaryRuleId = state.rules[0].id;
      queue({ rules: state.rules, primaryRuleId: state.primaryRuleId });
      paint();
      return;
    }
    if (cmd === 'toggle-rule') {
      const rule = state.rules.find((item) => item.id === el.dataset.id);
      if (!rule) return;
      rule.enabled = rule.enabled === false;
      queue({ rules: state.rules });
      paintPage();
      return;
    }
    if (cmd === 'select-rule') {
      if (el.dataset.id) state.primaryRuleId = el.dataset.id;
      queue({ primaryRuleId: state.primaryRuleId });
      paint();
      return;
    }
    if (cmd === 'day') {
      const day = Number(el.dataset.value);
      const days = new Set(state.activeHours.days);
      if (days.has(day) && days.size > 1) days.delete(day);
      else days.add(day);
      state.activeHours.days = Array.from(days);
      queue({ activeHours: state.activeHours });
      paintPage();
    }
  }

  document.addEventListener('click', (event) => {
    const nav = event.target.closest('[data-nav]');
    if (nav) {
      page = nav.dataset.nav;
      paint();
      return;
    }
    const pick = event.target.closest('[data-pick]');
    if (pick) {
      applyPick(pick.dataset.pick, pick.dataset.value);
      return;
    }
    const cmd = event.target.closest('[data-cmd]');
    if (cmd) runCmd(cmd.dataset.cmd, cmd);
  });

  document.addEventListener('input', (event) => {
    const el = event.target;
    if (el.dataset.bind) {
      bindValue(el.dataset.bind, el.value, el);
      paintPreview();
      if (el.dataset.bind === 'rule.message') $('preview-text').textContent = el.value;
      return;
    }
    if (el.dataset.message) {
      const message = state.messages.find((item) => item.id === el.dataset.message);
      if (!message) return;
      message.text = el.value;
      queue({ messages: state.messages });
    }
  });

  document.addEventListener('change', (event) => {
    const el = event.target;
    if (el.dataset.bind) {
      bindValue(el.dataset.bind, el.value, el);
      if (el.tagName === 'SELECT') paint();
      else paintPreview();
    }
  });

  $('preview').addEventListener('pointerdown', (event) => {
    if (state.lockPosition) return;
    if (!event.target.closest('#desk-actor')) return;
    deskDrag = { id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  });

  $('preview').addEventListener('pointermove', (event) => {
    if (!deskDrag) return;
    const desk = $('desk');
    const actor = $('desk-actor');
    const rect = desk.getBoundingClientRect();
    const width = actor.offsetWidth || 80;
    const height = actor.offsetHeight || 120;
    const nx = (event.clientX - rect.left - width / 2 - 12) / Math.max(1, rect.width - 24 - width);
    const ny = (event.clientY - rect.top - height / 2 - 12) / Math.max(1, rect.height - 24 - height);
    state.position.preset = 'custom';
    state.position.nx = Math.min(1, Math.max(0, nx));
    state.position.ny = Math.min(1, Math.max(0, ny));
    paintPreview();
  });

  $('preview').addEventListener('pointerup', () => {
    if (!deskDrag) return;
    deskDrag = null;
    queue({ position: state.position });
  });

  function startPreviewLoop() {
    clearInterval(previewTimer);
    if (!state || state.character.theme !== 'pixel') return;
    previewTimer = setInterval(() => {
      if (document.hidden) return;
      const count = window.FocusAnimation.frameCount(previewAction);
      previewFrame = (previewFrame + 1) % count;
      const sprite = $('preview-sprite');
      if (sprite) drawSprite(sprite, state.character, previewAction, previewFrame);
    }, window.FocusAnimation.frameDuration(previewAction === 'idle' ? 'idle' : previewAction));
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInterval(previewTimer);
    else startPreviewLoop();
  });

  window.focusbuddy.onState((payload) => {
    if (!payload || !payload.state) return;
    const typing = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
    state = payload.state;
    if (payload.status) applyStatus(payload.status);
    if (payload.refresh && !typing) paint();
    else {
      paintNav();
      paintPreview();
    }
  });

  window.focusbuddy.onTimer((status) => applyStatus(status));

  window.focusbuddy.onNavigate((next) => {
    if (typeof next === 'string' && RENDER[next]) page = next;
    if (state) paint();
  });

  window.focusbuddy.getState().then((payload) => {
    state = payload.state;
    lastStatus = payload.status;
    if (!state.firstLaunchComplete && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      state.reducedMotion = true;
      queue({ reducedMotion: true });
    }
    paint();
    applyStatus(payload.status);
    startPreviewLoop();
  }).catch((error) => {
    console.error(error);
    document.body.textContent = 'FocusBuddy could not open its settings.';
  });
})();
