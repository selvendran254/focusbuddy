(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof root !== 'undefined') root.FocusSound = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  let context = null;
  let customAudio = null;

  function audioContext() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!context) context = new Ctx();
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  function envGain(ctx, volume) {
    const gain = ctx.createGain();
    const amount = Math.max(0, Math.min(1, Number(volume) / 100)) * 0.28;
    gain.gain.value = amount;
    gain.connect(ctx.destination);
    return gain;
  }

  function tone(ctx, destination, { type, freq, start, duration, attack, release }) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.9, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
    if (release) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * release), start + duration);
  }

  function playChoice(choice, volume) {
    const ctx = audioContext();
    if (!ctx || !choice || choice === 'none') return;
    const now = ctx.currentTime + 0.01;
    const destination = envGain(ctx, volume);
    if (choice === 'pop') {
      tone(ctx, destination, { type: 'sine', freq: 660, start: now, duration: 0.12, attack: 0.005, release: 0.45 });
      return;
    }
    if (choice === 'bell') {
      tone(ctx, destination, { type: 'sine', freq: 880, start: now, duration: 0.45, attack: 0.01, release: 0.7 });
      tone(ctx, destination, { type: 'triangle', freq: 1320, start: now, duration: 0.3, attack: 0.01, release: 0.5 });
      return;
    }
    if (choice === 'water') {
      tone(ctx, destination, { type: 'sine', freq: 740, start: now, duration: 0.09, attack: 0.005, release: 0.6 });
      tone(ctx, destination, { type: 'sine', freq: 980, start: now + 0.12, duration: 0.1, attack: 0.005, release: 0.55 });
      tone(ctx, destination, { type: 'triangle', freq: 520, start: now + 0.24, duration: 0.14, attack: 0.01, release: 0.5 });
      return;
    }
    tone(ctx, destination, { type: 'sine', freq: 523, start: now, duration: 0.14, attack: 0.01, release: 0.8 });
    tone(ctx, destination, { type: 'sine', freq: 659, start: now + 0.12, duration: 0.18, attack: 0.01, release: 0.75 });
  }

  function play(options) {
    const choice = options && options.choice;
    const volume = options && options.volume != null ? options.volume : 40;
    if (!options || options.enabled === false || choice === 'none') return;
    if (choice === 'custom' && options.dataUrl) {
      try {
        if (customAudio) {
          customAudio.pause();
          customAudio = null;
        }
        customAudio = new Audio(options.dataUrl);
        customAudio.volume = Math.max(0, Math.min(1, volume / 100)) * 0.7;
        customAudio.play().catch(() => {});
      } catch (_) {
        playChoice('soft', volume);
      }
      return;
    }
    if (choice === 'custom') {
      playChoice('soft', volume);
      return;
    }
    playChoice(choice || 'soft', volume);
  }

  return { play };
});
