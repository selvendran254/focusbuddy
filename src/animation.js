(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof root !== 'undefined') root.FocusAnimation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Pose data drives the generated character. Real sprite sheets can replace
  // this by setting a character's source to "files" (see src/character.js).
  const POSES = {
    idle: [
      { bob: 0, leg: 0, armL: 'down', armR: 'down', face: 'neutral' },
      { bob: 1, leg: 0, armL: 'down', armR: 'down', face: 'blink' }
    ],
    walk: [
      { bob: 0, leg: -1, armL: 'swing', armR: 'back', face: 'neutral' },
      { bob: 1, leg: 0, armL: 'down', armR: 'down', face: 'neutral' },
      { bob: 0, leg: 1, armL: 'back', armR: 'swing', face: 'neutral' },
      { bob: 1, leg: 0, armL: 'down', armR: 'down', face: 'neutral' }
    ],
    drink: [
      { bob: 0, leg: 0, armL: 'down', armR: 'mid', face: 'neutral', bottle: 'low' },
      { bob: 0, leg: 0, armL: 'down', armR: 'up', face: 'neutral', bottle: 'mid' },
      { bob: 0, leg: 0, armL: 'down', armR: 'drink', face: 'drink', bottle: 'mouth' },
      { bob: 1, leg: 0, armL: 'down', armR: 'drink', face: 'drink', bottle: 'mouth' },
      { bob: 0, leg: 0, armL: 'down', armR: 'drink', face: 'happy', bottle: 'mouth' },
      { bob: 0, leg: 0, armL: 'down', armR: 'down', face: 'happy', bottle: 'low' }
    ],
    stretch: [
      { bob: 0, leg: 0, armL: 'up', armR: 'up', face: 'neutral' },
      { bob: -1, leg: 0, armL: 'up', armR: 'up', face: 'happy' },
      { bob: 0, leg: 1, armL: 'up', armR: 'up', face: 'neutral' },
      { bob: 0, leg: -1, armL: 'up', armR: 'up', face: 'happy' }
    ],
    wave: [
      { bob: 0, leg: 0, armL: 'down', armR: 'wave', face: 'happy', wave: 0 },
      { bob: 0, leg: 0, armL: 'down', armR: 'wave', face: 'happy', wave: 1 },
      { bob: 1, leg: 0, armL: 'down', armR: 'wave', face: 'happy', wave: 0 },
      { bob: 0, leg: 0, armL: 'down', armR: 'wave', face: 'happy', wave: 1 }
    ],
    jump: [
      { bob: 1, leg: 0, armL: 'down', armR: 'down', face: 'neutral' },
      { bob: -2, leg: 2, armL: 'up', armR: 'up', face: 'happy' },
      { bob: -3, leg: 2, armL: 'up', armR: 'up', face: 'happy' },
      { bob: 0, leg: 0, armL: 'out', armR: 'out', face: 'happy' }
    ],
    sit: [
      { bob: 3, leg: 3, armL: 'down', armR: 'down', face: 'neutral', sit: true },
      { bob: 3, leg: 3, armL: 'down', armR: 'down', face: 'blink', sit: true }
    ],
    think: [
      { bob: 0, leg: 0, armL: 'down', armR: 'think', face: 'think' },
      { bob: 1, leg: 0, armL: 'down', armR: 'think', face: 'think' }
    ],
    happy: [
      { bob: 0, leg: 0, armL: 'out', armR: 'out', face: 'happy' },
      { bob: -1, leg: 0, armL: 'up', armR: 'up', face: 'happy' },
      { bob: 0, leg: -1, armL: 'out', armR: 'out', face: 'happy' },
      { bob: 0, leg: 1, armL: 'out', armR: 'out', face: 'happy' }
    ],
    sleep: [
      { bob: 3, leg: 3, armL: 'down', armR: 'down', face: 'sleep', sit: true, zzz: 0 },
      { bob: 3, leg: 3, armL: 'down', armR: 'down', face: 'sleep', sit: true, zzz: 1 }
    ]
  };

  const ACTIONS = [
    { id: 'auto', label: 'Match message', pose: null },
    { id: 'walk', label: 'Walk In', pose: 'walk' },
    { id: 'walk-out', label: 'Walk Out', pose: 'walk' },
    { id: 'wave', label: 'Wave', pose: 'wave' },
    { id: 'drink', label: 'Drink Water', pose: 'drink' },
    { id: 'stretch', label: 'Stretch', pose: 'stretch' },
    { id: 'jump', label: 'Jump', pose: 'jump' },
    { id: 'sit', label: 'Sit', pose: 'sit' },
    { id: 'think', label: 'Think', pose: 'think' },
    { id: 'happy', label: 'Happy', pose: 'happy' },
    { id: 'sleep', label: 'Sleep', pose: 'sleep' },
    { id: 'custom', label: 'Custom', pose: 'wave' }
  ];

  const ACTION_IDS = ACTIONS.map((action) => action.id);

  function poseKey(action) {
    const found = ACTIONS.find((item) => item.id === action);
    if (found && found.pose) return found.pose;
    return 'idle';
  }

  function frameCount(action) {
    const key = poseKey(action);
    return (POSES[key] || POSES.idle).length;
  }

  function getPose(action, frame) {
    const key = poseKey(action);
    const frames = POSES[key] || POSES.idle;
    const index = ((frame % frames.length) + frames.length) % frames.length;
    return frames[index];
  }

  function frameDuration(action) {
    const key = poseKey(action);
    if (key === 'walk') return 140;
    if (key === 'drink') return 280;
    if (key === 'jump') return 160;
    if (key === 'idle' || key === 'sleep' || key === 'sit' || key === 'think') return 700;
    return 220;
  }

  return {
    POSES,
    ACTIONS,
    ACTION_IDS,
    poseKey,
    frameCount,
    getPose,
    frameDuration
  };
});
