/**
 * Interacción: touch/click en elementos del astrolabio
 * Detecta hits en sol, luna, estrellas, constelaciones y muestra tooltips
 */

export function setupInteraction(canvas, astrolabe) {
  const tooltip = document.getElementById('tooltip');

  function findHit(clientX, clientY) {
    const targets = astrolabe.getHitTargets();
    let closest = null;
    let closestDist = Infinity;

    for (const t of targets) {
      const dx = clientX - t.px;
      const dy = clientY - t.py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < t.radius && dist < closestDist) {
        closest = t;
        closestDist = dist;
      }
    }

    return closest;
  }

  function showTooltip(target, clientX, clientY) {
    if (!tooltip) return;

    let html = '';

    switch (target.type) {
      case 'sun':
        html = `<strong>Sol</strong><br>
                alt ${target.data.altitude}° · az ${target.data.azimuth}°<br>
                ↑ ${target.data.sunrise} · ↓ ${target.data.sunset}`;
        break;

      case 'moon':
        html = `<strong>Luna</strong> · ${target.data.phase}<br>
                ${target.data.illumination}% iluminada<br>
                alt ${target.data.altitude}° · az ${target.data.azimuth}°<br>
                ↑ ${target.data.moonrise} · ↓ ${target.data.moonset}`;
        break;

      case 'star': {
        const name = target.data.name && !target.data.name.includes('undefined')
          ? target.data.name
          : 'estrella';
        html = `<strong>${name}</strong><br>
                mag ${target.data.mag.toFixed(1)}<br>
                alt ${target.data.altitude.toFixed(1)}° · az ${target.data.azimuth.toFixed(1)}°`;
        break;
      }

      case 'constellation':
        html = `<strong>${target.data.name}</strong>`;
        break;
    }

    tooltip.innerHTML = html;
    tooltip.classList.remove('hidden');

    // Posicionar tooltip
    const margin = 15;
    let x = clientX + margin;
    let y = clientY + margin;

    // No salir de pantalla
    const rect = tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - margin) {
      x = clientX - rect.width - margin;
    }
    if (y + rect.height > window.innerHeight - margin) {
      y = clientY - rect.height - margin;
    }

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }

  function hideTooltip() {
    if (tooltip) tooltip.classList.add('hidden');
  }

  // Click / tap
  canvas.addEventListener('click', (e) => {
    const hit = findHit(e.clientX, e.clientY);
    if (hit) {
      showTooltip(hit, e.clientX, e.clientY);
    } else {
      hideTooltip();
    }
  });

  // Hover (desktop)
  canvas.addEventListener('mousemove', (e) => {
    const hit = findHit(e.clientX, e.clientY);
    canvas.style.cursor = hit ? 'pointer' : 'default';
  });

  // Touch: cerrar tooltip al tocar fuera
  canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const hit = findHit(touch.clientX, touch.clientY);
    if (hit) {
      e.preventDefault();
      showTooltip(hit, touch.clientX, touch.clientY);
    } else {
      hideTooltip();
    }
  }, { passive: false });
}
