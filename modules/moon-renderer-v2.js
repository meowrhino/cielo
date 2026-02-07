/**
 * Módulo de renderizado de la luna V2
 * Usa posicionamiento absoluto y SVG para visualización fluida
 */

/**
 * Renderiza la posición de la luna en el cielo
 */
export function renderMoonPosition(moonData, currentTime, container) {
  if (!moonData || !container) {
    console.error('No se puede renderizar posición lunar: faltan datos o contenedor');
    return;
  }
  
  const currentHour = currentTime.getHours();
  const hourData = moonData.hourlyData.find(h => h.hour === currentHour);
  
  if (!hourData) {
    console.log('No hay datos de luna para la hora:', currentHour);
    return;
  }
  
  console.log('Renderizando posición lunar:', hourData);
  
  // Limpiar contenedor
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.width = '100%';
  container.style.height = '100%';
  
  // Crear SVG para la trayectoria
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '1';
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  container.appendChild(svg);
  
  // Dibujar trayectoria de la luna durante la noche
  drawMoonPath(svg, moonData);
  
  // Dibujar luna actual si está visible
  if (hourData.isVisible && hourData.altitude > 0) {
    drawCurrentMoon(container, hourData.azimuth, hourData.altitude, moonData.phase);
  }
  
  // Añadir información
  const info = document.createElement('div');
  info.className = 'moon-info';
  info.style.position = 'absolute';
  info.style.bottom = '2rem';
  info.style.left = '50%';
  info.style.transform = 'translateX(-50%)';
  info.style.fontSize = 'clamp(0.7rem, 1.5vw, 0.9rem)';
  info.style.color = 'var(--btn-color)';
  info.style.textAlign = 'center';
  info.style.zIndex = '3';
  info.style.pointerEvents = 'none';
  info.style.whiteSpace = 'pre-line';
  
  const visibilityText = hourData.isVisible && hourData.altitude > 0 ? 'visible' : 'bajo el horizonte';
  
  info.textContent = [
    `azimut: ${hourData.azimuth.toFixed(1)}° · altitud: ${hourData.altitude.toFixed(1)}°`,
    `${visibilityText}`,
    `fase: ${(moonData.phase * 100).toFixed(0)}%`
  ].join('\n');
  
  container.appendChild(info);
}

/**
 * Renderiza la fase lunar
 */
export function renderMoonPhase(moonData, container) {
  if (!moonData || !container) {
    console.error('No se puede renderizar fase lunar: faltan datos o contenedor');
    return;
  }
  
  console.log('Renderizando fase lunar:', moonData.phase);
  
  // Limpiar contenedor
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.justifyContent = 'center';
  container.style.alignItems = 'center';
  container.style.gap = '2rem';
  
  // Crear visualización de la fase lunar
  const phaseContainer = document.createElement('div');
  phaseContainer.style.position = 'relative';
  phaseContainer.style.width = 'clamp(8rem, 20vw, 12rem)';
  phaseContainer.style.height = 'clamp(8rem, 20vw, 12rem)';
  
  // Crear SVG para la luna
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.style.width = '100%';
  svg.style.height = '100%';
  
  // Círculo exterior (luna completa)
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '50');
  circle.setAttribute('cy', '50');
  circle.setAttribute('r', '45');
  circle.setAttribute('fill', 'var(--text-color)');
  circle.setAttribute('opacity', '0.2');
  svg.appendChild(circle);
  
  // Fase iluminada
  drawMoonPhase(svg, moonData.phase);
  
  phaseContainer.appendChild(svg);
  container.appendChild(phaseContainer);
  
  // Información de la fase
  const info = document.createElement('div');
  info.className = 'moon-phase-info';
  info.style.fontSize = 'clamp(0.8rem, 2vw, 1.2rem)';
  info.style.color = 'var(--text-color)';
  info.style.textAlign = 'center';
  info.style.whiteSpace = 'pre-line';
  
  const phaseName = getMoonPhaseName(moonData.phase);
  const illumination = (moonData.phase * 100).toFixed(0);
  
  info.textContent = [
    phaseName,
    `${illumination}% iluminada`
  ].join('\n');
  
  container.appendChild(info);
  
  // Información adicional
  const details = document.createElement('div');
  details.style.fontSize = 'clamp(0.7rem, 1.5vw, 0.9rem)';
  details.style.color = 'var(--btn-color)';
  details.style.textAlign = 'center';
  details.style.whiteSpace = 'pre-line';
  
  details.textContent = [
    `salida: ${moonData.moonrise || 'n/a'}`,
    `puesta: ${moonData.moonset || 'n/a'}`
  ].join('\n');
  
  container.appendChild(details);
}

// === FUNCIONES AUXILIARES ===

/**
 * Proyección equidistante azimutal (misma que sky-renderer-v2)
 */
function azimuthalProject(azimuth, altitude) {
  const azRad = azimuth * Math.PI / 180;
  const r = (90 - altitude) / 90;
  const scale = 48;
  const x = 50 + r * Math.sin(azRad) * scale;
  const y = 50 - r * Math.cos(azRad) * scale;
  return { x, y };
}

/**
 * Dibuja la trayectoria de la luna durante la noche
 */
function drawMoonPath(svg, moonData) {
  const points = [];

  for (const hourData of moonData.hourlyData) {
    if (!hourData.isVisible || hourData.altitude < 0) continue;

    const pt = azimuthalProject(hourData.azimuth, hourData.altitude);
    points.push(pt);
  }

  if (points.length < 2) return;

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    // Evitar líneas enormes por wrap-around
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    if (Math.sqrt(dx * dx + dy * dy) > 40) {
      d += ` M ${points[i].x} ${points[i].y}`;
    } else {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
  }

  path.setAttribute('d', d);
  path.setAttribute('stroke', 'var(--text-color)');
  path.setAttribute('stroke-width', '0.3');
  path.setAttribute('stroke-dasharray', '1 1.5');
  path.setAttribute('fill', 'none');
  path.setAttribute('opacity', '0.3');

  svg.appendChild(path);
}

/**
 * Dibuja la luna en su posición actual
 */
function drawCurrentMoon(container, azimuth, altitude, phase) {
  const { x, y } = azimuthalProject(azimuth, altitude);

  const moon = document.createElement('span');
  moon.textContent = getMoonSymbol(phase);
  moon.style.position = 'absolute';
  moon.style.left = `${x}%`;
  moon.style.top = `${y}%`;
  moon.style.fontSize = 'clamp(1.2rem, 3vw, 2rem)';
  moon.style.color = 'var(--text-color)';
  moon.style.transform = 'translate(-50%, -50%)';
  moon.style.zIndex = '3';
  moon.style.pointerEvents = 'none';
  moon.style.textShadow = '0 0 10px currentColor';

  container.appendChild(moon);
}

/**
 * Dibuja la fase lunar en el SVG
 */
function drawMoonPhase(svg, phase) {
  // phase: 0 = luna nueva, 0.5 = luna llena, 1 = luna nueva
  
  if (phase < 0.05 || phase > 0.95) {
    // Luna nueva - círculo oscuro (no dibujar nada adicional)
    return;
  }
  
  if (phase > 0.45 && phase < 0.55) {
    // Luna llena - círculo completo
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '50');
    circle.setAttribute('cy', '50');
    circle.setAttribute('r', '45');
    circle.setAttribute('fill', 'var(--text-color)');
    svg.appendChild(circle);
    return;
  }
  
  // Fase creciente o menguante
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  
  if (phase < 0.5) {
    // Creciente (0 → 0.5)
    const t = phase * 2; // 0 → 1
    const offset = (1 - t) * 90; // 90 → 0
    
    const d = `
      M 50 5
      A 45 45 0 0 1 50 95
      A ${offset} 45 0 0 ${t > 0.5 ? 1 : 0} 50 5
    `;
    
    path.setAttribute('d', d);
  } else {
    // Menguante (0.5 → 1)
    const t = (phase - 0.5) * 2; // 0 → 1
    const offset = t * 90; // 0 → 90
    
    const d = `
      M 50 5
      A 45 45 0 0 0 50 95
      A ${offset} 45 0 0 ${t < 0.5 ? 1 : 0} 50 5
    `;
    
    path.setAttribute('d', d);
  }
  
  path.setAttribute('fill', 'var(--text-color)');
  svg.appendChild(path);
}

/**
 * Obtiene el símbolo ASCII de la luna según su fase
 */
function getMoonSymbol(phase) {
  if (phase < 0.05 || phase > 0.95) return '●'; // Luna nueva
  if (phase < 0.25) return '☽'; // Creciente
  if (phase < 0.45) return '◐'; // Cuarto creciente
  if (phase < 0.55) return '○'; // Luna llena
  if (phase < 0.75) return '◑'; // Cuarto menguante
  return '☾'; // Menguante
}

/**
 * Obtiene el nombre de la fase lunar
 */
function getMoonPhaseName(phase) {
  if (phase < 0.05 || phase > 0.95) return 'luna nueva';
  if (phase < 0.25) return 'luna creciente';
  if (phase < 0.45) return 'cuarto creciente';
  if (phase < 0.55) return 'luna llena';
  if (phase < 0.75) return 'cuarto menguante';
  return 'luna menguante';
}
