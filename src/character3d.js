(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof root !== 'undefined') root.Focus3D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  let seq = 0;

  function nextId() {
    seq += 1;
    return `d${seq}`;
  }

  function shade(hex, amount) {
    const raw = String(hex || '#4c7dff').replace('#', '');
    const num = parseInt(raw, 16);
    const clamp = (value) => Math.max(0, Math.min(255, value));
    const r = clamp((num >> 16) + amount);
    const g = clamp(((num >> 8) & 255) + amount);
    const b = clamp((num & 255) + amount);
    return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  }

  function catalog() {
    if (typeof window !== 'undefined' && window.FocusCharacters) return window.FocusCharacters;
    return require('./character');
  }

  function poseName(action) {
    const map = {
      idle: 'idle',
      walk: 'walk',
      'walk-out': 'walk',
      drink: 'drink',
      stretch: 'stretch',
      wave: 'wave',
      jump: 'jump',
      sit: 'sit',
      think: 'think',
      happy: 'happy',
      sleep: 'sleep',
      custom: 'wave'
    };
    return map[action] || 'idle';
  }

  function palette(spec) {
    const book = catalog();
    const cloth = (book.COLORS.find((item) => item.id === spec.color) || book.COLORS[0]).hex;
    const hair = (book.HAIR_COLORS.find((item) => item.id === spec.hairColor) || book.HAIR_COLORS[0]).hex;
    return {
      cloth,
      clothL: shade(cloth, 42),
      clothD: shade(cloth, -38),
      hair,
      hairL: shade(hair, 36),
      hairD: shade(hair, -28),
      skin: '#ffd7c2',
      skinD: '#e7a88a',
      pants: '#2a3144',
      pantsL: '#3d4760',
      shoe: '#1b1e27'
    };
  }

  function defs(id, colors) {
    return `
      <radialGradient id="${id}-skin" cx="38%" cy="32%" r="70%">
        <stop offset="0%" stop-color="#fff1e8"/>
        <stop offset="55%" stop-color="${colors.skin}"/>
        <stop offset="100%" stop-color="${colors.skinD}"/>
      </radialGradient>
      <linearGradient id="${id}-cloth" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${colors.clothL}"/>
        <stop offset="48%" stop-color="${colors.cloth}"/>
        <stop offset="100%" stop-color="${colors.clothD}"/>
      </linearGradient>
      <radialGradient id="${id}-hair" cx="40%" cy="30%" r="75%">
        <stop offset="0%" stop-color="${colors.hairL}"/>
        <stop offset="70%" stop-color="${colors.hair}"/>
        <stop offset="100%" stop-color="${colors.hairD}"/>
      </radialGradient>
      <linearGradient id="${id}-pants" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${colors.pantsL}"/>
        <stop offset="100%" stop-color="${colors.pants}"/>
      </linearGradient>`;
  }

  function face(happy) {
    const mouth = happy
      ? '<path d="M86 96 Q100 110 114 96" fill="none" stroke="#c45b6a" stroke-width="3" stroke-linecap="round"/>'
      : '<path d="M90 98 Q100 104 110 98" fill="none" stroke="#c45b6a" stroke-width="2.4" stroke-linecap="round"/>';
    return `
      <g class="eyes">
        <ellipse cx="86" cy="78" rx="7" ry="8" fill="#1c2230"/>
        <ellipse cx="114" cy="78" rx="7" ry="8" fill="#1c2230"/>
        <circle cx="88" cy="75" r="2.3" fill="#fff"/>
        <circle cx="116" cy="75" r="2.3" fill="#fff"/>
      </g>
      <ellipse cx="74" cy="90" rx="6" ry="3.2" fill="#f3a3ad" opacity="0.55"/>
      <ellipse cx="126" cy="90" rx="6" ry="3.2" fill="#f3a3ad" opacity="0.55"/>
      <g class="face-default">${mouth}</g>
      <g class="face-happy"><path d="M84 94 Q100 112 116 94" fill="none" stroke="#c45b6a" stroke-width="3" stroke-linecap="round"/></g>
      <g class="face-drink"><ellipse cx="100" cy="100" rx="4" ry="3" fill="#c45b6a"/></g>`;
  }

  function hairFront(style, id) {
    const fill = `url(#${id}-hair)`;
    if (style === 'none') return '';
    if (style === 'spiky') {
      return `<path d="M62 62 L74 28 L84 58 L100 18 L116 58 L128 30 L140 64 Q100 48 62 62Z" fill="${fill}"/>`;
    }
    if (style === 'bun') {
      return `<circle cx="100" cy="34" r="14" fill="${fill}"/><path d="M64 70 Q100 40 136 70 Q124 52 100 50 Q76 52 64 70Z" fill="${fill}"/>`;
    }
    if (style === 'long') {
      return `
        <path d="M62 78 Q58 120 66 150 Q74 120 78 90 Q70 70 62 78Z" fill="${fill}"/>
        <path d="M138 78 Q142 120 134 150 Q126 120 122 90 Q130 70 138 78Z" fill="${fill}"/>
        <path d="M66 64 Q100 42 134 64 Q128 54 100 50 Q72 54 66 64Z" fill="${fill}"/>`;
    }
    return `<path d="M64 66 Q100 40 136 66 Q128 52 100 50 Q72 52 64 66Z" fill="${fill}"/>`;
  }

  function human(spec, id, colors) {
    const cloth = `url(#${id}-cloth)`;
    const skin = `url(#${id}-skin)`;
    const hair = `url(#${id}-hair)`;
    const pants = `url(#${id}-pants)`;
    const skirt = !!spec.skirt && spec.outfit !== 'coat';
    const hood = spec.outfit === 'hoodie';
    const legs = skirt
      ? `<ellipse cx="100" cy="196" rx="46" ry="22" fill="${cloth}"/>`
      : `
        <g class="leg leg-l"><rect x="66" y="186" width="26" height="52" rx="13" fill="${pants}"/><ellipse cx="79" cy="242" rx="16" ry="8" fill="${colors.shoe}"/></g>
        <g class="leg leg-r"><rect x="108" y="186" width="26" height="52" rx="13" fill="${pants}"/><ellipse cx="121" cy="242" rx="16" ry="8" fill="${colors.shoe}"/></g>`;
    const torso = spec.outfit === 'coat'
      ? `<path d="M58 118 Q100 104 142 118 L150 196 Q100 214 50 196Z" fill="${cloth}"/>`
      : `<rect x="62" y="112" width="76" height="82" rx="28" fill="${cloth}"/>`;
    return `
      ${legs}
      ${spec.backpack ? `<ellipse cx="150" cy="156" rx="16" ry="24" fill="${colors.clothD}"/>` : ''}
      <g class="arm arm-l"><rect x="48" y="122" width="22" height="58" rx="11" fill="${cloth}"/><circle cx="59" cy="182" r="10" fill="${skin}"/></g>
      ${torso}
      <ellipse cx="100" cy="132" rx="22" ry="10" fill="#fff" opacity="0.18"/>
      ${spec.id === 'developer' ? '<rect x="78" y="150" width="16" height="12" rx="3" fill="#fff" opacity="0.85"/>' : ''}
      <g class="arm arm-r">
        <rect x="130" y="122" width="22" height="58" rx="11" fill="${cloth}"/>
        <circle cx="141" cy="182" r="10" fill="${skin}"/>
        <g class="bottle-3d">
          <rect x="146" y="156" width="12" height="22" rx="4" fill="#8fd4ff"/>
          <rect x="148" y="160" width="8" height="10" rx="2" fill="#e9f7ff"/>
          <rect x="149" y="150" width="6" height="8" rx="2" fill="#d7dde8"/>
        </g>
      </g>
      <g class="head">
        ${hood ? `<ellipse cx="100" cy="78" rx="48" ry="46" fill="${colors.clothD}"/>` : ''}
        <path d="M62 86 Q58 40 100 34 Q142 40 138 86 Q120 24 100 24 Q80 24 62 86Z" fill="${hair}"/>
        <circle cx="100" cy="78" r="34" fill="${skin}"/>
        <ellipse cx="84" cy="64" rx="14" ry="8" fill="#fff" opacity="0.35"/>
        ${face(false)}
        ${hairFront(spec.hair, id)}
        ${spec.cap ? `<path d="M60 62 H148 L140 50 H68Z" fill="${cloth}"/><rect x="138" y="56" width="16" height="6" rx="2" fill="${colors.clothD}"/>` : ''}
      </g>`;
  }

  function robot(spec, id, colors) {
    const metal = `url(#${id}-cloth)`;
    return `
      <g class="leg leg-l"><rect x="74" y="186" width="20" height="48" rx="8" fill="${colors.clothD}"/><rect x="70" y="230" width="28" height="12" rx="4" fill="${colors.shoe}"/></g>
      <g class="leg leg-r"><rect x="106" y="186" width="20" height="48" rx="8" fill="${colors.clothD}"/><rect x="102" y="230" width="28" height="12" rx="4" fill="${colors.shoe}"/></g>
      <g class="arm arm-l"><rect x="42" y="128" width="20" height="52" rx="8" fill="${metal}"/></g>
      <rect x="64" y="112" width="72" height="80" rx="16" fill="${metal}"/>
      <rect x="78" y="132" width="44" height="28" rx="8" fill="${colors.clothD}"/>
      <circle cx="100" cy="146" r="5" fill="${colors.clothL}"/>
      <g class="arm arm-r"><rect x="138" y="128" width="20" height="52" rx="8" fill="${metal}"/>
        <g class="bottle-3d"><rect x="150" y="150" width="12" height="20" rx="3" fill="#8fd4ff"/></g>
      </g>
      <g class="head">
        <rect x="148" y="46" width="6" height="22" rx="3" fill="${colors.clothD}"/>
        <circle cx="151" cy="42" r="6" fill="${colors.clothL}"/>
        <rect x="62" y="48" width="76" height="62" rx="18" fill="${metal}"/>
        <rect x="74" y="66" width="52" height="22" rx="8" fill="#12343a"/>
        <g class="eyes">
          <circle cx="90" cy="77" r="5" fill="#9be7ff"/>
          <circle cx="110" cy="77" r="5" fill="#9be7ff"/>
        </g>
      </g>`;
  }

  function animal(spec, id, colors, ears) {
    const fur = `url(#${id}-cloth)`;
    const ear = ears === 'cat'
      ? `<path d="M62 78 L74 40 L90 74Z" fill="${fur}"/><path d="M110 74 L126 40 L138 78Z" fill="${fur}"/>`
      : `<ellipse cx="62" cy="86" rx="16" ry="24" fill="${fur}"/><ellipse cx="138" cy="86" rx="16" ry="24" fill="${fur}"/>`;
    return `
      <g class="tail"><path d="M150 170 Q176 150 168 124" fill="none" stroke="${colors.clothD}" stroke-width="10" stroke-linecap="round"/></g>
      <g class="leg leg-l"><ellipse cx="78" cy="214" rx="16" ry="18" fill="${fur}"/></g>
      <g class="leg leg-r"><ellipse cx="122" cy="214" rx="16" ry="18" fill="${fur}"/></g>
      <ellipse cx="100" cy="176" rx="46" ry="36" fill="${fur}"/>
      <g class="arm arm-l"><ellipse cx="58" cy="176" rx="12" ry="16" fill="${fur}"/></g>
      <g class="arm arm-r"><ellipse cx="142" cy="176" rx="12" ry="16" fill="${fur}"/>
        <g class="bottle-3d"><rect x="148" y="150" width="10" height="18" rx="3" fill="#8fd4ff"/></g>
      </g>
      <g class="head">
        ${ear}
        <circle cx="100" cy="96" r="40" fill="${fur}"/>
        <ellipse cx="82" cy="78" rx="12" ry="7" fill="#fff" opacity="0.28"/>
        ${ears === 'dog' ? '<ellipse cx="100" cy="112" rx="16" ry="12" fill="#ffd7c2"/>' : ''}
        <g class="eyes">
          <ellipse cx="86" cy="96" rx="6" ry="7" fill="#1c2230"/>
          <ellipse cx="114" cy="96" rx="6" ry="7" fill="#1c2230"/>
          <circle cx="88" cy="93" r="2" fill="#fff"/>
          <circle cx="116" cy="93" r="2" fill="#fff"/>
        </g>
        <ellipse cx="100" cy="108" rx="4" ry="3" fill="#e8899a"/>
        ${spec.outfit === 'bow' ? '<path d="M78 70 L90 78 L78 86 L90 78 L102 70 L90 78 L102 86Z" fill="#fff"/>' : ''}
        ${spec.outfit === 'collar' || spec.outfit === 'scarf' ? `<rect x="78" y="128" width="44" height="8" rx="4" fill="${colors.clothL}"/>` : ''}
      </g>`;
  }

  function renderPhoto(spec, pose) {
    const scale = (Number(spec.scale) || 100) / 100;
    const height = Math.round(260 * scale);
    const width = Math.round(height * (spec.photoRatio || 0.45));
    const svg = `
      <div class="buddy photo pose-${pose}" style="width:${width}px;height:${height}px">
        <div class="rig">
          <img class="photo-img" src="${spec.photo.replace('.png', '-body.png')}" alt="" draggable="false">
          <div class="photo-arm-zone">
            <div class="photo-arm">
              <img class="photo-img" src="${spec.photo.replace('.png', '-arm.png')}" alt="" draggable="false">
              <div class="photo-bottle-pivot"><img class="photo-bottle" src="../assets/bottle.svg" alt="" draggable="false"></div>
            </div>
          </div>
        </div>
        <span class="zzz">z<small>z</small></span>
      </div>`;
    return {
      svg,
      width,
      height,
      opacity: Math.max(50, Math.min(100, spec.opacity)) / 100
    };
  }

  const SHEET_ACTIONS = {
    walk: 'walk',
    drink: 'front',
    wave: 'wave',
    happy: 'thumbs',
    sit: 'sit',
    think: 'laptop',
    stretch: 'front',
    sleep: 'sit'
  };

  function renderSheet(spec, pose) {
    const poses = catalog().PHOTO_POSES;
    const chosen = pose === 'idle' || pose === 'jump' ? spec.pose : SHEET_ACTIONS[pose] || spec.pose;
    const look = poses.find((item) => item.id === chosen) || poses[0];
    const scale = (Number(spec.scale) || 100) / 100;
    const width = Math.round(176 * scale);
    const height = Math.round(260 * scale);
    const frameHeight = look.full ? 100 : 72;
    const base = `${spec.photoSet}${look.id}`;
    const layered = pose === 'drink' && look.id === 'front';
    const figure = layered
      ? `
        <img class="photo-img" src="${base}-body.png" alt="" draggable="false">
        <div class="photo-arm-zone">
          <div class="photo-arm">
            <img class="photo-img" src="${base}-arm.png" alt="" draggable="false">
            <div class="photo-bottle-pivot"><img class="photo-bottle" src="../assets/bottle.svg" alt="" draggable="false"></div>
          </div>
        </div>`
      : `<img class="photo-img" src="${base}.png" alt="" draggable="false">`;
    const svg = `
      <div class="buddy photo sheet look-${look.id} pose-${pose}" style="width:${width}px;height:${height}px">
        <div class="rig">
          <div class="photo-frame" style="height:${frameHeight}%;aspect-ratio:${look.ratio}">${figure}</div>
        </div>
        <span class="zzz">z<small>z</small></span>
      </div>`;
    return {
      svg,
      width,
      height,
      opacity: Math.max(50, Math.min(100, spec.opacity)) / 100
    };
  }

  function render(appearance, action) {
    const spec = catalog().resolveSpec(appearance);
    if (spec.photoSet) return renderSheet(spec, poseName(action));
    if (spec.photo) return renderPhoto(spec, poseName(action));
    const colors = palette(spec);
    const id = nextId();
    const pose = poseName(action);
    const scale = (Number(spec.scale) || 100) / 100;
    const width = Math.round(176 * scale);
    const height = Math.round(248 * scale);
    let body = human(spec, id, colors);
    if (spec.kind === 'robot') body = robot(spec, id, colors);
    if (spec.kind === 'cat') body = animal(spec, id, colors, 'cat');
    if (spec.kind === 'dog') body = animal(spec, id, colors, 'dog');
    const svg = `
      <svg class="buddy pose-${pose} kind-${spec.kind} hair-${spec.hair} outfit-${spec.outfit}" viewBox="0 0 200 270" width="${width}" height="${height}" aria-hidden="true">
        <defs>${defs(id, colors)}</defs>
        <ellipse class="shadow" cx="100" cy="252" rx="42" ry="10" fill="rgba(0,0,0,0.22)"/>
        <g class="rig">${body}</g>
        <g class="zzz">
          <text x="150" y="48" fill="#f4f7fb" font-size="16" font-family="-apple-system, sans-serif">z</text>
          <text x="164" y="34" fill="#f4f7fb" font-size="12" font-family="-apple-system, sans-serif">z</text>
        </g>
      </svg>`;
    return {
      svg,
      width,
      height,
      opacity: Math.max(50, Math.min(100, spec.opacity)) / 100
    };
  }

  return { render, poseName };
});
