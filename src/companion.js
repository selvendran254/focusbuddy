(function () {
  const stage = document.getElementById('stage');
  const bubble = document.getElementById('bubble');
  const bubbleText = document.getElementById('bubble-text');
  const sprite = document.getElementById('sprite');
  const spritePixel = sprite.querySelector('i');
  const spriteImg = document.getElementById('sprite-img');
  const mini = document.getElementById('mini');
  let cue = null;
  let frameTimer = null;
  let followTimer = null;
  let interactive = false;
  let dragging = false;
  let dragMoved = false;
  let down = null;

  function clearMotion() {
    if (frameTimer) clearInterval(frameTimer);
    if (followTimer) clearTimeout(followTimer);
    frameTimer = null;
    followTimer = null;
  }

  function draw(action, frame) {
    if (!cue) return;
    const usePixel = cue.character && cue.character.theme === 'pixel';
    stage.dataset.look = usePixel ? 'pixel' : '3d';
    if (!usePixel && window.Focus3D) {
      const figure = window.Focus3D.render(cue.character, action || 'idle');
      sprite.style.width = `${figure.width}px`;
      sprite.style.height = `${figure.height}px`;
      sprite.style.opacity = String(figure.opacity);
      sprite.innerHTML = figure.svg;
      return;
    }
    if (!spritePixel || !spritePixel.isConnected) {
      sprite.innerHTML = '<i></i><img id="sprite-img" alt="" hidden>';
    }
    const pixel = sprite.querySelector('i');
    const image = sprite.querySelector('img');
    const rendered = window.FocusCharacters.renderSprite(cue.character, action, frame || 0);
    sprite.style.width = `${rendered.width}px`;
    sprite.style.height = `${rendered.height}px`;
    sprite.style.opacity = String(rendered.opacity);
    if (rendered.image && image) {
      image.hidden = false;
      image.src = rendered.image;
      image.width = rendered.width;
      image.height = rendered.height;
      if (pixel) pixel.style.boxShadow = 'none';
    } else if (pixel) {
      if (image) {
        image.hidden = true;
        image.removeAttribute('src');
      }
      pixel.style.width = `${rendered.pixel}px`;
      pixel.style.height = `${rendered.pixel}px`;
      pixel.style.boxShadow = rendered.shadow;
    }
  }

  function loop(action) {
    if (frameTimer) clearInterval(frameTimer);
    frameTimer = null;
    const key = action || 'idle';
    const usePixel = cue && cue.character && cue.character.theme === 'pixel';
    if (!usePixel || !cue || cue.reducedMotion) {
      draw(key, 0);
      return;
    }
    let frame = 0;
    draw(key, 0);
    frameTimer = setInterval(() => {
      const count = window.FocusAnimation.frameCount(key);
      frame = (frame + 1) % count;
      draw(key, frame);
    }, window.FocusAnimation.frameDuration(key));
  }

  function applyChrome(next) {
    const speech = next.speech || {};
    stage.dataset.placement = speech.placement || 'above';
    stage.dataset.style = speech.style || 'rounded';
    stage.dataset.tone = speech.tone || 'dark';
    stage.dataset.action = next.action || 'idle';
    document.body.dataset.bubble = speech.enabled === false ? 'off' : 'on';
    document.body.dataset.mini = next.behavior && next.behavior.miniTimer === false ? 'off' : 'on';
    bubble.className = `bubble hit ${speech.style || 'rounded'} ${speech.tone || 'dark'} size-${speech.size || 'medium'} font-${speech.fontSize || 'medium'}`;
    bubbleText.textContent = next.message || '';
  }

  function showBubble(on) {
    bubble.classList.toggle('show', on && cue && cue.speech && cue.speech.enabled !== false && !!cue.message);
  }

  async function playSound() {
    if (!cue || !cue.sound || cue.sound.enabled === false) return;
    const sound = { ...cue.sound };
    if (sound.choice === 'custom') {
      try {
        const result = await window.focusbuddy.readSound();
        sound.dataUrl = result && result.dataUrl;
      } catch (_) {
        sound.choice = 'soft';
      }
    }
    window.FocusSound.play(sound);
  }

  function setInteractive(on) {
    if (interactive === on) return;
    interactive = on;
    window.focusbuddy.setInteractive(on);
  }

  window.focusbuddy.onCue((next) => {
    if (!next) return;
    if (next.phase === 'tick') {
      if (mini && next.label) mini.textContent = next.label;
      return;
    }
    if (followTimer) clearTimeout(followTimer);
    followTimer = null;
    if (next.phase === 'hide') {
      clearMotion();
      document.body.dataset.visible = 'false';
      stage.classList.remove('show', 'leaving');
      showBubble(false);
      setInteractive(false);
      return;
    }
    cue = next;
    document.body.dataset.visible = 'true';
    applyChrome(next);
    stage.classList.toggle('fade', next.reducedMotion === true || next.walking === false);
    stage.classList.remove('leaving');
    stage.classList.add('show');
    // Walking poses face left; mirror them when the buddy moves right.
    stage.dataset.flip = String(next.phase === 'exit' ? next.fromRight !== false : next.fromRight === false);
    if (next.phase === 'enter') {
      showBubble(false);
      loop('walk');
    } else if (next.phase === 'hold') {
      showBubble(true);
      loop(next.action || 'idle');
      if (next.playSound) playSound();
      if (next.action === 'drink' && next.durationSec > 8) {
        followTimer = setTimeout(() => {
          if (cue && cue.phase === 'hold') {
            stage.dataset.action = 'wave';
            loop('wave');
          }
        }, Math.min(11000, next.durationSec * 700));
      }
    } else if (next.phase === 'exit') {
      showBubble(false);
      stage.classList.add('leaving');
      loop(next.walking === false ? (next.action || 'idle') : 'walk');
    } else if (next.phase === 'idle') {
      showBubble(false);
      loop('idle');
    }
  });

  window.addEventListener('mousemove', (event) => {
    const onHit = !!(event.target && event.target.closest && event.target.closest('.hit'));
    setInteractive(onHit || dragging);
    if (!dragging || !down || (cue && cue.lockPosition)) return;
    if (Math.abs(event.screenX - down.screenX) + Math.abs(event.screenY - down.screenY) > 4) {
      if (!dragMoved) {
        dragMoved = true;
        window.focusbuddy.dragStart(down);
      }
      window.focusbuddy.dragMove({ screenX: event.screenX, screenY: event.screenY });
    }
  });

  window.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    if (!event.target.closest('.hit')) return;
    dragging = true;
    dragMoved = false;
    down = { screenX: event.screenX, screenY: event.screenY };
    setInteractive(true);
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    const wasDrag = dragMoved;
    const phase = cue && cue.phase;
    dragging = false;
    down = null;
    if (wasDrag) window.focusbuddy.dragEnd();
    else if (phase === 'hold' || phase === 'enter') window.focusbuddy.dismiss();
    dragMoved = false;
  });
})();
