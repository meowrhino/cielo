/**
 * Interacción: touch/click, drag/pan en modo zoom
 * Click en sol/luna/constelación → zoom inmersivo
 * Drag en modo zoom → pan por el cielo
 */

export function setupInteraction(canvas, astrolabe, { onSelect, onPan }) {
  let dragState = null; // { startX, startY, moved }

  function findHit(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const targets = astrolabe.getHitTargets();

    const logicalW = astrolabe.getLogicalWidth();
    const logicalH = astrolabe.getLogicalHeight();
    const scaleX = logicalW / rect.width;
    const scaleY = logicalH / rect.height;

    const localX = (clientX - rect.left) * scaleX;
    const localY = (clientY - rect.top) * scaleY;

    let closest = null;
    let closestDist = Infinity;

    for (const t of targets) {
      const dx = localX - t.px;
      const dy = localY - t.py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < t.radius && dist < closestDist) {
        closest = t;
        closestDist = dist;
      }
    }

    return closest;
  }

  // Suppress native click — all click logic goes through mouseup/touchend
  canvas.addEventListener('click', (e) => {
    e.stopImmediatePropagation();
    e.preventDefault();
  });

  // === Mouse events ===

  canvas.addEventListener('mousedown', (e) => {
    dragState = { startX: e.clientX, startY: e.clientY, moved: false };
  });

  canvas.addEventListener('mousemove', (e) => {
    if (dragState) {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragState.moved = true;
      }

      if (dragState.moved) {
        astrolabe.panBy(-dx, -dy);
        dragState.startX = e.clientX;
        dragState.startY = e.clientY;
        if (onPan) onPan();
      }
    } else {
      // Hover cursor
      if (astrolabe.getZoomLevel() > 1.5) {
        const hit = findHit(e.clientX, e.clientY);
        canvas.style.cursor = hit ? 'pointer' : 'grab';
      } else {
        const hit = findHit(e.clientX, e.clientY);
        canvas.style.cursor = hit ? 'pointer' : 'default';
      }
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    if (dragState && !dragState.moved) {
      handleTap(e.clientX, e.clientY);
    }
    dragState = null;
  });

  canvas.addEventListener('mouseleave', () => {
    dragState = null;
  });

  // === Touch events ===

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      dragState = { startX: t.clientX, startY: t.clientY, moved: false };
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (!dragState || e.touches.length !== 1) return;

    const t = e.touches[0];
    const dx = t.clientX - dragState.startX;
    const dy = t.clientY - dragState.startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragState.moved = true;
    }

    if (dragState.moved) {
      e.preventDefault();
      astrolabe.panBy(-dx, -dy);
      dragState.startX = t.clientX;
      dragState.startY = t.clientY;
      if (onPan) onPan();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (dragState && !dragState.moved && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      handleTap(t.clientX, t.clientY);
    }
    dragState = null;
  });

  // === Shared tap logic ===

  function handleTap(clientX, clientY) {
    if (astrolabe.isAnimating()) return;

    const hit = findHit(clientX, clientY);

    if (hit) {
      if (onSelect) onSelect(hit);
    }
  }
}
