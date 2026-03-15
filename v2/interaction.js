/**
 * Interacción: touch/click en elementos del astrolabio
 * Click en sol/luna/constelación → zoom inmersivo
 * Hover en desktop → cursor pointer
 */

export function setupInteraction(canvas, astrolabe, { onSelect }) {
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

  // Click / tap
  canvas.addEventListener('click', (e) => {
    if (astrolabe.isAnimating()) return; // Ignore during animation

    const hit = findHit(e.clientX, e.clientY);
    if (hit && onSelect) {
      e.stopImmediatePropagation();
      onSelect(hit);
    }
    // If no hit and we're zoomed, the canvas click handler in app.js handles exit
  });

  // Hover (desktop)
  canvas.addEventListener('mousemove', (e) => {
    if (astrolabe.getZoomLevel() > 1.5) {
      canvas.style.cursor = 'default';
      return;
    }
    const hit = findHit(e.clientX, e.clientY);
    canvas.style.cursor = hit ? 'pointer' : 'default';
  });

  // Touch
  canvas.addEventListener('touchstart', (e) => {
    if (astrolabe.isAnimating()) return;

    const touch = e.touches[0];
    const hit = findHit(touch.clientX, touch.clientY);
    if (hit && onSelect) {
      e.preventDefault();
      onSelect(hit);
    }
  }, { passive: false });
}
