/**
 * Interacción: touch/click en elementos del astrolabio
 * Click en sol/luna/constelación → abre vista inmersiva
 * Hover en desktop → cursor pointer
 */

export function setupInteraction(canvas, astrolabe, { onSelect }) {
  function findHit(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const targets = astrolabe.getHitTargets();

    // hitTargets están en coordenadas lógicas (px sin DPR)
    // clientX/Y son coordenadas de viewport
    // Necesitamos mapear viewport → lógicas del canvas
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

  // Click / tap → abre vista inmersiva
  canvas.addEventListener('click', (e) => {
    const wrapper = document.getElementById('astrolabe-wrapper');
    if (wrapper && wrapper.classList.contains('minimap')) return;

    const hit = findHit(e.clientX, e.clientY);
    if (hit && onSelect) {
      e.stopPropagation(); // Prevent bubbling to wrapper
      onSelect(hit);
    }
  });

  // Hover (desktop)
  canvas.addEventListener('mousemove', (e) => {
    const wrapper = document.getElementById('astrolabe-wrapper');
    if (wrapper && wrapper.classList.contains('minimap')) return;

    const hit = findHit(e.clientX, e.clientY);
    canvas.style.cursor = hit ? 'pointer' : 'default';
  });

  // Touch
  canvas.addEventListener('touchstart', (e) => {
    const wrapper = document.getElementById('astrolabe-wrapper');
    if (wrapper && wrapper.classList.contains('minimap')) return;

    const touch = e.touches[0];
    const hit = findHit(touch.clientX, touch.clientY);
    if (hit && onSelect) {
      e.preventDefault();
      onSelect(hit);
    }
  }, { passive: false });
}
