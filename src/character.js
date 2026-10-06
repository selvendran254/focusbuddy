(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof root !== 'undefined') root.FocusCharacters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // SPRITE REPLACEMENT POINT
  // Characters are generated here so the app works with no binary art.
  // To use real frames later:
  //   1. Export transparent PNGs to assets/characters/<id>/<pose>/<frame>.png
  //   2. Set that character's source from "generated" to "files"
  //   3. List the files on fileFrames[pose]
  // The companion and the Customize preview both call renderSprite().

  const COLS = 22;
  const ROWS = 32;

  const CHARACTERS = [
    { id: 'sheet-boy', name: '3D Student Boy', kind: 'human', source: 'generated', photoSet: '../assets/characters/sheet-boy/', cap: false, backpack: true, skirt: false, defaultHair: 'short', defaultOutfit: 'hoodie' },
    { id: 'hoodie-3d', name: '3D Hoodie Boy', kind: 'human', source: 'generated', photo: '../assets/characters/hoodie-boy.png', photoRatio: 282 / 640, cap: false, backpack: true, skirt: false, defaultHair: 'short', defaultOutfit: 'hoodie' },
    { id: 'developer', name: 'Cute Developer', kind: 'human', source: 'generated', cap: false, backpack: false, skirt: false, defaultHair: 'short', defaultOutfit: 'hoodie' },
    { id: 'student', name: 'Student', kind: 'human', source: 'generated', cap: true, backpack: true, skirt: false, defaultHair: 'short', defaultOutfit: 'shirt' },
    { id: 'casual', name: 'Casual Person', kind: 'human', source: 'generated', cap: false, backpack: false, skirt: false, defaultHair: 'long', defaultOutfit: 'shirt' },
    { id: 'pixel-girl', name: 'Pixel Girl', kind: 'human', source: 'generated', cap: false, backpack: false, skirt: true, defaultHair: 'long', defaultOutfit: 'sweater' },
    { id: 'pixel-boy', name: 'Pixel Boy', kind: 'human', source: 'generated', cap: false, backpack: false, skirt: false, defaultHair: 'spiky', defaultOutfit: 'shirt' },
    { id: 'robot', name: 'Robot', kind: 'robot', source: 'generated', defaultHair: 'none', defaultOutfit: 'none' },
    { id: 'cat', name: 'Cat', kind: 'cat', source: 'generated', defaultHair: 'none', defaultOutfit: 'none' },
    { id: 'dog', name: 'Dog', kind: 'dog', source: 'generated', defaultHair: 'none', defaultOutfit: 'none' }
  ];

  const COLORS = [
    { id: 'blue', label: 'Blue', hex: '#4c7dff' },
    { id: 'teal', label: 'Teal', hex: '#2fbfa8' },
    { id: 'coral', label: 'Coral', hex: '#ff7a59' },
    { id: 'purple', label: 'Purple', hex: '#8b6cff' },
    { id: 'green', label: 'Green', hex: '#3cb371' },
    { id: 'rose', label: 'Rose', hex: '#ef6f9b' },
    { id: 'amber', label: 'Amber', hex: '#f0a202' },
    { id: 'slate', label: 'Slate', hex: '#5c6b7a' }
  ];

  const HAIR_COLORS = [
    { id: 'brown', label: 'Brown', hex: '#6b3f2a' },
    { id: 'black', label: 'Black', hex: '#2a2422' },
    { id: 'blonde', label: 'Blonde', hex: '#e2b657' },
    { id: 'auburn', label: 'Auburn', hex: '#a24b32' },
    { id: 'pink', label: 'Pink', hex: '#e56aa8' },
    { id: 'blue', label: 'Blue', hex: '#3d6fd8' }
  ];

  const HAIR_STYLES = [
    { id: 'short', label: 'Short' },
    { id: 'long', label: 'Long' },
    { id: 'bun', label: 'Bun' },
    { id: 'spiky', label: 'Spiky' },
    { id: 'none', label: 'None' }
  ];

  const OUTFITS = [
    { id: 'hoodie', label: 'Hoodie' },
    { id: 'shirt', label: 'Shirt' },
    { id: 'sweater', label: 'Sweater' },
    { id: 'coat', label: 'Coat' }
  ];

  const ACCESSORIES = [
    { id: 'none', label: 'None' },
    { id: 'bow', label: 'Bow' },
    { id: 'collar', label: 'Collar' },
    { id: 'scarf', label: 'Scarf' }
  ];

  const THEMES = [
    { id: '3d', label: '3D' },
    { id: 'pixel', label: 'Pixel' },
    { id: 'cute', label: 'Cute' },
    { id: 'minimal', label: 'Minimal' },
    { id: 'cartoon', label: 'Cartoon' }
  ];

  // Poses cut from assets/characters/sheet-boy-source.jpg by scripts/slice-sheet.py.
  // ratio = width / height of each PNG.
  const PHOTO_POSES = [
    { id: 'hero', label: 'Standing', ratio: 231 / 640, full: true },
    { id: 'front', label: 'Front', ratio: 107 / 279, full: true },
    { id: 'side-left', label: 'Side', ratio: 94 / 277, full: true },
    { id: 'side-right', label: 'Side 2', ratio: 95 / 272, full: true },
    { id: 'back', label: 'Back', ratio: 107 / 279, full: true },
    { id: 'walk', label: 'Walking', ratio: 151 / 264, full: true },
    { id: 'sit', label: 'Sitting', ratio: 163 / 237, full: true },
    { id: 'laptop', label: 'Laptop', ratio: 174 / 232, full: true },
    { id: 'wave', label: 'Wave', ratio: 141 / 216 },
    { id: 'thumbs', label: 'Thumbs up', ratio: 150 / 220 },
    { id: 'tablet', label: 'Tablet', ratio: 127 / 218 },
    { id: 'face', label: 'Smile', ratio: 126 / 154 },
    { id: 'wink', label: 'Wink', ratio: 129 / 153 },
    { id: 'laugh', label: 'Laugh', ratio: 130 / 148 }
  ];

  const SIZES = [
    { id: 'small', label: 'Small', scale: 78 },
    { id: 'medium', label: 'Medium', scale: 100 },
    { id: 'large', label: 'Large', scale: 132 },
    { id: 'custom', label: 'Custom', scale: null }
  ];

  function blank() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill('.'));
  }

  function plot(grid, x, y, color) {
    if (!color || color === '.') return;
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= COLS || py >= ROWS) return;
    grid[py][px] = color;
  }

  function fill(grid, x, y, w, h, color) {
    for (let yy = 0; yy < h; yy += 1) {
      for (let xx = 0; xx < w; xx += 1) plot(grid, x + xx, y + yy, color);
    }
  }

  function shade(hex, amount) {
    const raw = hex.replace('#', '');
    const num = parseInt(raw, 16);
    const clamp = (v) => Math.max(0, Math.min(255, v));
    const r = clamp((num >> 16) + amount);
    const g = clamp(((num >> 8) & 255) + amount);
    const b = clamp((num & 255) + amount);
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }

  function addOutline(grid, passes) {
    let current = grid.map((row) => row.slice());
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let pass = 0; pass < passes; pass += 1) {
      const next = current.map((row) => row.slice());
      for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLS; x += 1) {
          const cell = current[y][x];
          if (cell === '.' || cell === 'z') continue;
          dirs.forEach(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return;
            if (next[ny][nx] === '.') next[ny][nx] = 'o';
          });
        }
      }
      current = next;
    }
    return current;
  }

  function drawLeg(grid, x, y, mode) {
    if (mode === 'short') {
      fill(grid, x, y, 2, 4, 'p');
      fill(grid, x, y + 4, 2, 1, 'k');
      return;
    }
    if (mode === 'tuck') {
      fill(grid, x, y + 1, 3, 2, 'p');
      fill(grid, x, y + 3, 3, 1, 'k');
      return;
    }
    if (mode === 'sit') {
      fill(grid, x, y + 2, 4, 2, 'p');
      fill(grid, x + 3, y + 3, 2, 1, 'k');
      return;
    }
    fill(grid, x, y, 2, 6, 'p');
    fill(grid, x, y + 6, 2, 1, 'k');
  }

  function drawArm(grid, side, style, y, wave) {
    const left = side === 'left';
    const x = left ? 4 : 16;
    if (style === 'up' || style === 'stretch') {
      fill(grid, x + (left ? 1 : 0), y - 6, 2, 8, 'b');
      plot(grid, x + (left ? 1 : 1), y - 7, 's');
      return;
    }
    if (style === 'wave') {
      const lift = wave ? -1 : 0;
      fill(grid, (left ? 3 : 16), y - 5 + lift, 2, 7, 'b');
      fill(grid, (left ? 2 : 17), y - 7 + lift, 2, 2, 's');
      return;
    }
    if (style === 'drink') {
      fill(grid, 15, y - 2, 2, 6, 'b');
      fill(grid, 14, y - 3, 2, 2, 's');
      return;
    }
    if (style === 'up-soft') {
      fill(grid, x, y - 3, 2, 6, 'b');
      plot(grid, x + (left ? 0 : 1), y - 4, 's');
      return;
    }
    if (style === 'think') {
      fill(grid, 14, y + 1, 3, 4, 'b');
      fill(grid, 13, y, 2, 2, 's');
      return;
    }
    if (style === 'swing') {
      fill(grid, left ? 3 : 17, y + 2, 2, 5, 'b');
      plot(grid, left ? 3 : 18, y + 7, 's');
      return;
    }
    if (style === 'back') {
      fill(grid, left ? 6 : 14, y + 3, 2, 5, 'd');
      return;
    }
    if (style === 'out') {
      fill(grid, left ? 2 : 17, y + 2, 3, 2, 'b');
      fill(grid, left ? 2 : 18, y + 4, 2, 3, 'b');
      plot(grid, left ? 2 : 19, y + 7, 's');
      return;
    }
    if (style === 'mid') {
      fill(grid, left ? 4 : 15, y - 1, 2, 6, 'b');
      plot(grid, left ? 4 : 16, y - 2, 's');
      return;
    }
    fill(grid, x + (left ? 1 : 0), y + 2, 2, 6, 'b');
    plot(grid, x + (left ? 1 : 1), y + 8, 's');
  }

  function drawHair(grid, style, x, y, theme) {
    if (style === 'none') return;
    if (style === 'spiky') {
      fill(grid, x, y, 8, 3, 'h');
      plot(grid, x, y - 2, 'h');
      plot(grid, x + 1, y - 1, 'h');
      plot(grid, x + 3, y - 3, 'h');
      plot(grid, x + 4, y - 2, 'h');
      plot(grid, x + 6, y - 2, 'h');
      plot(grid, x + 7, y - 1, 'h');
      fill(grid, x, y + 3, 8, 2, 'h');
      return;
    }
    if (style === 'bun') {
      fill(grid, x + 2, y - 3, 4, 3, 'h');
      fill(grid, x, y, 8, 3, 'h');
      return;
    }
    if (style === 'long') {
      fill(grid, x - 1, y, 10, 4, 'h');
      fill(grid, x - 1, y + 4, 2, 8, 'h');
      fill(grid, x + 7, y + 4, 2, 8, 'h');
      if (theme === 'cute' || theme === 'cartoon') fill(grid, x + 1, y + 1, 6, 1, 'h');
      return;
    }
    fill(grid, x, y, 8, 3, 'h');
    fill(grid, x, y + 3, 1, 2, 'h');
    fill(grid, x + 7, y + 3, 1, 2, 'h');
  }

  function drawFace(grid, x, y, pose, theme) {
    const cute = theme === 'cute' || theme === 'cartoon';
    if (pose.face === 'sleep') {
      plot(grid, x + 2, y + 4, 'e');
      plot(grid, x + 3, y + 4, 'e');
      plot(grid, x + 5, y + 4, 'e');
      plot(grid, x + 6, y + 4, 'e');
      return;
    }
    if (pose.face === 'blink') {
      plot(grid, x + 2, y + 4, 'e');
      plot(grid, x + 5, y + 4, 'e');
    } else if (pose.face === 'think') {
      plot(grid, x + 2, y + 3, 'e');
      plot(grid, x + 5, y + 3, 'e');
      plot(grid, x + 2, y + 4, 'w');
      plot(grid, x + 5, y + 4, 'w');
    } else if (cute) {
      fill(grid, x + 1, y + 3, 2, 2, 'e');
      fill(grid, x + 5, y + 3, 2, 2, 'e');
      plot(grid, x + 2, y + 3, 'w');
      plot(grid, x + 6, y + 3, 'w');
    } else {
      fill(grid, x + 2, y + 3, 1, 2, 'e');
      fill(grid, x + 5, y + 3, 1, 2, 'e');
    }
    if (cute && pose.face !== 'sleep') {
      plot(grid, x + 1, y + 5, 'n');
      plot(grid, x + 6, y + 5, 'n');
    }
    if (pose.face === 'happy') {
      plot(grid, x + 3, y + 6, 'm');
      plot(grid, x + 4, y + 6, 'm');
      plot(grid, x + 2, y + 5, 'm');
      plot(grid, x + 5, y + 5, 'm');
    } else if (pose.face === 'drink') {
      plot(grid, x + 3, y + 6, 'm');
      plot(grid, x + 4, y + 6, 'e');
    } else if (pose.face !== 'sleep') {
      plot(grid, x + 3, y + 6, 'm');
      plot(grid, x + 4, y + 6, 'm');
    }
  }

  function drawHuman(spec, pose) {
    const grid = blank();
    const bob = pose.bob || 0;
    const y = 4 + bob;
    const skirt = !!spec.skirt && spec.outfit !== 'coat';
    fill(grid, 7, 30, 8, 1, 'z');

    const legY = y + 16;
    if (pose.leg === 2) {
      drawLeg(grid, 7, legY, 'tuck');
      drawLeg(grid, 11, legY, 'tuck');
    } else if (pose.leg === 3 || pose.sit) {
      drawLeg(grid, 6, legY - 1, 'sit');
      drawLeg(grid, 11, legY - 1, 'sit');
    } else if (pose.leg === -1) {
      drawLeg(grid, 7, legY, 'short');
      drawLeg(grid, 12, legY, 'stand');
    } else if (pose.leg === 1) {
      drawLeg(grid, 7, legY, 'stand');
      drawLeg(grid, 12, legY, 'short');
    } else {
      drawLeg(grid, 7, legY, 'stand');
      drawLeg(grid, 12, legY, 'stand');
    }

    if (spec.outfit === 'coat') {
      fill(grid, 6, y + 9, 10, 10, 'b');
      fill(grid, 8, y + 10, 6, 7, 'd');
    } else if (skirt) {
      fill(grid, 7, y + 9, 8, 6, 'b');
      fill(grid, 5, y + 14, 12, 4, 'b');
    } else if (spec.outfit === 'hoodie') {
      fill(grid, 6, y + 8, 10, 9, 'b');
      fill(grid, 9, y + 11, 4, 2, 'd');
    } else if (spec.outfit === 'sweater') {
      fill(grid, 6, y + 9, 10, 8, 'b');
      fill(grid, 6, y + 9, 10, 2, 'd');
    } else {
      fill(grid, 7, y + 9, 8, 8, 'b');
      plot(grid, 10, y + 12, 'w');
      plot(grid, 11, y + 13, 'w');
    }

    if (spec.backpack) fill(grid, 16, y + 10, 3, 6, 'a');
    if (spec.id === 'developer') {
      plot(grid, 8, y + 12, 'a');
      plot(grid, 8, y + 13, 'w');
    }

    drawArm(grid, 'left', pose.armL || 'down', y + 10, pose.wave);
    drawArm(grid, 'right', pose.armR || 'down', y + 10, pose.wave);

    if (spec.outfit === 'hoodie') fill(grid, 6, y + 1, 10, 8, 'b');
    fill(grid, 7, y + 2, 8, 8, 's');
    drawHair(grid, spec.hair, 7, y, spec.theme);
    if (spec.cap) {
      fill(grid, 6, y, 10, 2, 'a');
      fill(grid, 6, y + 2, 10, 1, 'd');
      fill(grid, 15, y + 1, 2, 1, 'a');
    }

    const outlined = spec.theme === 'minimal' ? grid : addOutline(grid, spec.theme === 'cartoon' ? 2 : 1);
    drawFace(outlined, 7, y + 2, pose, spec.theme);
    if (pose.zzz) {
      plot(outlined, 17, y - 1, 'w');
      plot(outlined, 19, y - 2, 'w');
      plot(outlined, 18, y - 2, 'a');
    }
    return outlined;
  }

  function drawRobot(spec, pose) {
    const grid = blank();
    const bob = pose.bob || 0;
    const y = 5 + bob;
    fill(grid, 8, 30, 6, 1, 'z');
    const legShift = pose.leg === -1 ? -1 : pose.leg === 1 ? 1 : 0;
    fill(grid, 8, y + 16, 2, 6, 'r');
    fill(grid, 12, y + 16, 2, 6, 'r');
    fill(grid, 8 + (legShift < 0 ? 0 : 0), y + 21, 2, 1, 'k');
    fill(grid, 12, y + 21, 2, 1, 'k');
    if (pose.leg === -1) fill(grid, 7, y + 18, 2, 2, 'd');
    if (pose.leg === 1) fill(grid, 14, y + 18, 2, 2, 'd');
    fill(grid, 6, y + 8, 10, 9, 'r');
    fill(grid, 8, y + 10, 6, 5, 'd');
    plot(grid, 10, y + 12, 'a');
    plot(grid, 11, y + 12, 'g');
    if (pose.armL === 'up' || pose.armL === 'out' || pose.armL === 'wave') {
      fill(grid, 3, y + 2, 2, 7, 'r');
    } else if (pose.armL === 'swing') {
      fill(grid, 3, y + 10, 2, 6, 'r');
    } else {
      fill(grid, 4, y + 9, 2, 7, 'r');
    }
    if (pose.armR === 'up' || pose.armR === 'drink' || pose.armR === 'wave' || pose.armR === 'out') {
      fill(grid, 16, y + 2, 2, 7, 'r');
    } else if (pose.armR === 'think') {
      fill(grid, 15, y + 6, 2, 5, 'r');
    } else {
      fill(grid, 16, y + 9, 2, 7, 'r');
    }
    fill(grid, 6, y, 10, 8, 'r');
    fill(grid, 7, y + 2, 8, 3, pose.face === 'sleep' || pose.face === 'blink' ? 'd' : 'v');
    if (pose.face !== 'sleep' && pose.face !== 'blink') {
      plot(grid, 9, y + 3, 'w');
      plot(grid, 13, y + 3, 'w');
    }
    fill(grid, 10, y - 3, 2, 3, 'd');
    plot(grid, 10, y - 4, 'a');
    if (pose.zzz) plot(grid, 17, y - 2, 'w');
    return spec.theme === 'minimal' ? grid : addOutline(grid, spec.theme === 'cartoon' ? 2 : 1);
  }

  function drawAnimal(spec, pose, ears) {
    const grid = blank();
    const bob = pose.bob || 0;
    const y = 6 + bob;
    fill(grid, 6, 30, 10, 1, 'z');
    const fur = 'b';
    if (ears === 'cat') {
      fill(grid, 5, y - 2, 3, 4, fur);
      fill(grid, 14, y - 2, 3, 4, fur);
      plot(grid, 6, y - 1, 'n');
      plot(grid, 15, y - 1, 'n');
    } else {
      fill(grid, 3, y + 1, 3, 5, fur);
      fill(grid, 16, y + 1, 3, 5, fur);
    }
    fill(grid, 5, y + 2, 12, 10, fur);
    if (spec.kind === 'dog') fill(grid, 8, y + 8, 6, 3, 's');
    const eyeY = y + 5;
    if (pose.face === 'sleep' || pose.face === 'blink') {
      plot(grid, 8, eyeY, 'e');
      plot(grid, 9, eyeY, 'e');
      plot(grid, 12, eyeY, 'e');
      plot(grid, 13, eyeY, 'e');
    } else {
      fill(grid, 8, eyeY, 2, 2, 'e');
      fill(grid, 12, eyeY, 2, 2, 'e');
      plot(grid, 9, eyeY, 'w');
      plot(grid, 13, eyeY, 'w');
    }
    plot(grid, 10, y + 8, 'n');
    plot(grid, 11, y + 8, 'n');
    if (pose.face === 'happy') {
      plot(grid, 10, y + 9, 'm');
      plot(grid, 11, y + 9, 'm');
    }
    fill(grid, 6, y + 12, 10, 6, fur);
    if (pose.sit || pose.leg === 3) {
      fill(grid, 5, y + 17, 12, 4, fur);
    } else if (pose.leg === -1) {
      fill(grid, 6, y + 17, 2, 4, fur);
      fill(grid, 14, y + 17, 2, 5, fur);
    } else if (pose.leg === 1) {
      fill(grid, 6, y + 17, 2, 5, fur);
      fill(grid, 14, y + 17, 2, 4, fur);
    } else {
      fill(grid, 6, y + 17, 2, 5, 'd');
      fill(grid, 14, y + 17, 2, 5, 'd');
    }
    const tailUp = pose.face === 'happy' || pose.armR === 'wave';
    if (tailUp) {
      fill(grid, 16, y + 10, 2, 2, 't');
      fill(grid, 17, y + 8, 2, 2, 't');
      plot(grid, 18, y + 7, 't');
    } else {
      fill(grid, 16, y + 14, 3, 2, 't');
      plot(grid, 19, y + 13, 't');
    }
    if (pose.armR === 'wave' || pose.armR === 'up' || pose.armR === 'drink') {
      fill(grid, 16, y + 8, 2, 4, fur);
    }
    if (pose.armL === 'up' || pose.armL === 'out') fill(grid, 4, y + 8, 2, 4, fur);
    if (spec.outfit === 'bow' || spec.accessory === 'bow') {
      plot(grid, 4, y + 3, 'a');
      plot(grid, 5, y + 4, 'a');
      plot(grid, 6, y + 3, 'a');
    }
    if (spec.outfit === 'collar' || spec.accessory === 'collar') {
      fill(grid, 7, y + 11, 8, 1, 'a');
    }
    if (spec.outfit === 'scarf' || spec.accessory === 'scarf') {
      fill(grid, 6, y + 11, 10, 2, 'a');
    }
    if (pose.zzz) {
      plot(grid, 17, y, 'w');
      plot(grid, 19, y - 1, 'w');
    }
    return spec.theme === 'minimal' ? grid : addOutline(grid, spec.theme === 'cartoon' ? 2 : 1);
  }

  function resolveSpec(appearance) {
    const look = appearance || {};
    const def = CHARACTERS.find((item) => item.id === look.id) || CHARACTERS[0];
    const human = def.kind === 'human';
    return {
      ...def,
      color: look.color || 'blue',
      hair: human ? (look.hair || def.defaultHair) : 'none',
      hairColor: look.hairColor || 'brown',
      outfit: human ? (look.outfit || def.defaultOutfit) : (look.outfit || 'none'),
      theme: look.theme || 'pixel',
      pose: look.pose || 'hero',
      scale: Number(look.scale) || 100,
      opacity: Number(look.opacity) || 100
    };
  }

  function paletteFor(spec) {
    const clothes = (COLORS.find((item) => item.id === spec.color) || COLORS[0]).hex;
    const hair = (HAIR_COLORS.find((item) => item.id === spec.hairColor) || HAIR_COLORS[0]).hex;
    const map = {
      o: '#171a22',
      s: spec.kind === 'dog' ? '#f0d2b0' : '#f3c7a8',
      h: hair,
      b: clothes,
      d: shade(clothes, -32),
      p: '#2c3344',
      k: '#15181f',
      e: '#1a1d27',
      w: '#f6f7fb',
      n: '#f0a3a4',
      a: shade(clothes, 28),
      g: '#8fd4ff',
      u: '#e7f7ff',
      z: 'rgba(0,0,0,0.22)',
      m: '#c45b6a',
      r: shade(clothes, 8),
      v: '#b8f1ff',
      t: shade(clothes, -18)
    };
    if (spec.theme === 'minimal') {
      map.s = '#e6e9f2';
      map.p = '#aeb6c7';
      map.h = shade(hair, 10);
      map.e = '#2c3140';
    }
    if (spec.kind === 'cat') {
      map.s = shade(clothes, 36);
      map.b = clothes;
    }
    if (spec.kind === 'robot') {
      map.r = shade(clothes, 16);
      map.b = clothes;
    }
    return map;
  }

  function drawFrame(spec, action, frame) {
    const animation = getAnimationApi();
    const pose = animation.getPose(action, frame);
    if (spec.kind === 'robot') return drawRobot(spec, pose);
    if (spec.kind === 'cat') return drawAnimal(spec, pose, 'cat');
    if (spec.kind === 'dog') return drawAnimal(spec, pose, 'dog');
    return drawHuman(spec, pose);
  }

  function getAnimationApi() {
    if (typeof window !== 'undefined' && window.FocusAnimation) return window.FocusAnimation;
    return require('./animation');
  }

  function toBoxShadow(grid, pixel, palette) {
    const shadows = [];
    for (let y = 0; y < grid.length; y += 1) {
      for (let x = 0; x < grid[y].length; x += 1) {
        const key = grid[y][x];
        const color = palette[key];
        if (!color || key === '.') continue;
        shadows.push(`${x * pixel}px ${y * pixel}px 0 ${color}`);
      }
    }
    return shadows.join(',');
  }

  function pixelSizeFor(scale, theme) {
    const base = theme === 'minimal' ? 5 : 6;
    return Math.max(3, Math.round(base * (Number(scale) || 100) / 100));
  }

function renderSprite(appearance, action, frame) {
  const spec = resolveSpec(appearance);
  const pixel = pixelSizeFor(spec.scale, spec.theme);
  const opacity = Math.max(50, Math.min(100, spec.opacity)) / 100;
  if (spec.source === 'files') {
    const animation = getAnimationApi();
    const pose = animation.poseKey(action || 'idle');
    const frames = (spec.fileFrames && spec.fileFrames[pose]) || (spec.fileFrames && spec.fileFrames.idle) || [];
    const index = frames.length ? Math.abs(frame || 0) % frames.length : 0;
    return {
      image: frames[index] || '',
      shadow: '',
      cols: COLS,
      rows: ROWS,
      pixel,
      width: frames.length ? COLS * pixel : COLS * pixel,
      height: ROWS * pixel,
      opacity,
      theme: spec.theme,
      spec
    };
  }
  const grid = drawFrame(spec, action || 'idle', frame || 0);
  const palette = paletteFor(spec);
  return {
    image: '',
    shadow: toBoxShadow(grid, pixel, palette),
    cols: COLS,
    rows: ROWS,
    pixel,
    width: COLS * pixel,
    height: ROWS * pixel,
    opacity,
    theme: spec.theme,
    spec
  };
}

  function gridText(appearance, action, frame) {
    const spec = resolveSpec(appearance);
    return drawFrame(spec, action || 'idle', frame || 0)
      .map((row) => row.join(''))
      .join('\n');
  }

  return {
    COLS,
    ROWS,
    CHARACTERS,
    COLORS,
    HAIR_COLORS,
    HAIR_STYLES,
    OUTFITS,
    PHOTO_POSES,
    ACCESSORIES,
    THEMES,
    SIZES,
    resolveSpec,
    renderSprite,
    gridText,
    pixelSizeFor
  };
});
