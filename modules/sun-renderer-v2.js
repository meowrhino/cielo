/**
 * Módulo de renderizado del sol V2
 * Usa SVG para curvas fluidas y posicionamiento absoluto para el sol
 * Centra la trayectoria en el rango real de azimut del sol
 */

/**
 * Calcula el rango de azimut real del sol para centrarlo
 */
function getSunAzimuthRange(sunData, azimuthStart, azimuthEnd) {
  let min = Infinity;
  let max = -Infinity;
  let maxAlt = 0;

  for (const h of sunData.hourlyData) {
    if (!h.isVisible) continue;
    if (h.azimuth < azimuthStart || h.azimuth > azimuthEnd) continue;
    if (h.azimuth < min) min = h.azimuth;
    if (h.azimuth > max) max = h.azimuth;
    if (h.altitude > maxAlt) maxAlt = h.altitude;
  }

  if (min === Infinity) return { min: azimuthStart, max: azimuthEnd, maxAlt: 45 };
  return { min, max, maxAlt };
}

/**
 * Mapea azimut y altitud a coordenadas de pantalla centradas en el rango real
 */
function sunProject(azimuth, altitude, azRange) {
  // Margen del 15% a cada lado del rango de azimut
  const span = azRange.max - azRange.min;
  const margin = Math.max(span * 0.15, 5);
  const rangeMin = azRange.min - margin;
  const rangeMax = azRange.max + margin;

  const x = ((azimuth - rangeMin) / (rangeMax - rangeMin)) * 100;

  // Escalar altitud: maxAlt ocupa ~70% del alto, dejar margen arriba y abajo
  const altScale = Math.min(azRange.maxAlt * 1.3, 90);
  const y = 90 - (altitude / altScale) * 75;

  return { x, y };
}

/**
 * Renderiza la trayectoria del sol desde salida hasta mediodía (panel Este)
 */
export function renderSunEast(sunData, currentTime, container) {
  if (!sunData || !container) return;

  const sunrise = parseTime(sunData.sunrise);
  const solarNoon = parseTime(sunData.solarNoon);
  const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;

  // Determinar posición actual del sol
  const currentSunData = getInterpolatedSunData(sunData.hourlyData, currentTime);

  // Calcular rango real de azimut para esta mitad
  const azRange = getSunAzimuthRange(sunData, 0, 180);

  // Limpiar contenedor
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.width = '100%';
  container.style.height = '100%';

  // Crear SVG para la trayectoria
  const svg = createSvg(container);

  // Dibujar trayectoria del sol
  drawSunPath(svg, sunrise, solarNoon, sunData, 0, 180, azRange);

  // Dibujar sol actual si está visible y en el rango Este
  if (currentSunData && currentSunData.isVisible && currentHour >= sunrise && currentHour <= solarNoon) {
    if (currentSunData.azimuth >= 0 && currentSunData.azimuth <= 180) {
      drawCurrentSun(container, currentSunData.azimuth, currentSunData.altitude, azRange);
    }
  }

  // Marca del horizonte
  drawHorizonLine(svg, azRange);

  // Añadir información
  const info = createInfoDiv();
  info.textContent = [
    `salida: ${sunData.sunrise}`,
    `mediodía: ${sunData.solarNoon}`
  ].join('\n');
  container.appendChild(info);
}

/**
 * Renderiza la trayectoria del sol desde mediodía hasta puesta (panel Oeste)
 */
export function renderSunWest(sunData, currentTime, container) {
  if (!sunData || !container) return;

  const solarNoon = parseTime(sunData.solarNoon);
  const sunset = parseTime(sunData.sunset);
  const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;

  // Determinar posición actual del sol
  const currentSunData = getInterpolatedSunData(sunData.hourlyData, currentTime);

  // Calcular rango real de azimut para esta mitad
  const azRange = getSunAzimuthRange(sunData, 180, 360);

  // Limpiar contenedor
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.width = '100%';
  container.style.height = '100%';

  // Crear SVG para la trayectoria
  const svg = createSvg(container);

  // Dibujar trayectoria del sol
  drawSunPath(svg, solarNoon, sunset, sunData, 180, 360, azRange);

  // Dibujar sol actual si está visible y en el rango Oeste
  if (currentSunData && currentSunData.isVisible && currentHour >= solarNoon && currentHour <= sunset) {
    if (currentSunData.azimuth >= 180 && currentSunData.azimuth <= 360) {
      drawCurrentSun(container, currentSunData.azimuth, currentSunData.altitude, azRange);
    }
  }

  // Marca del horizonte
  drawHorizonLine(svg, azRange);

  // Añadir información
  const info = createInfoDiv();
  info.textContent = [
    `mediodía: ${sunData.solarNoon}`,
    `puesta: ${sunData.sunset}`
  ].join('\n');
  container.appendChild(info);
}

// === FUNCIONES AUXILIARES ===

function createSvg(container) {
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
  return svg;
}

function createInfoDiv() {
  const info = document.createElement('div');
  info.className = 'sun-info';
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
  return info;
}

/**
 * Dibuja una línea de horizonte sutil
 */
function drawHorizonLine(svg, azRange) {
  const left = sunProject(azRange.min, 0, azRange);
  const right = sunProject(azRange.max, 0, azRange);

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', '0');
  line.setAttribute('y1', left.y.toString());
  line.setAttribute('x2', '100');
  line.setAttribute('y2', right.y.toString());
  line.setAttribute('stroke', 'var(--text-color)');
  line.setAttribute('stroke-width', '0.1');
  line.setAttribute('opacity', '0.2');
  svg.appendChild(line);
}

/**
 * Dibuja la trayectoria del sol como una curva SVG
 */
function drawSunPath(svg, startTime, endTime, sunData, azimuthStart, azimuthEnd, azRange) {
  const points = [];
  const steps = 50;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const hour = startTime + (endTime - startTime) * t;
    const hourData = sunData.hourlyData.find(h => Math.abs(h.hour - Math.floor(hour)) < 0.5);

    if (!hourData || !hourData.isVisible) continue;
    if (hourData.azimuth < azimuthStart || hourData.azimuth > azimuthEnd) continue;

    const pt = sunProject(hourData.azimuth, hourData.altitude, azRange);
    points.push(pt);
  }

  if (points.length < 2) return;

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }

  path.setAttribute('d', d);
  path.setAttribute('stroke', 'var(--text-color)');
  path.setAttribute('stroke-width', '0.3');
  path.setAttribute('stroke-dasharray', '1 1.5');
  path.setAttribute('fill', 'none');
  path.setAttribute('opacity', '0.5');

  svg.appendChild(path);
}

/**
 * Dibuja el sol en su posición actual
 */
function drawCurrentSun(container, azimuth, altitude, azRange) {
  const { x, y } = sunProject(azimuth, altitude, azRange);

  const sun = document.createElement('span');
  sun.textContent = '☼';
  sun.style.position = 'absolute';
  sun.style.left = `${x}%`;
  sun.style.top = `${y}%`;
  sun.style.fontSize = 'clamp(1.2rem, 3vw, 2rem)';
  sun.style.color = 'var(--text-color)';
  sun.style.transform = 'translate(-50%, -50%)';
  sun.style.zIndex = '3';
  sun.style.pointerEvents = 'none';
  sun.style.textShadow = '0 0 10px currentColor';

  container.appendChild(sun);
}

/**
 * Interpola la posición actual del sol usando datos horarios
 */
function getInterpolatedSunData(hourlyData, currentTime) {
  if (!hourlyData || hourlyData.length === 0) return null;

  const hour = currentTime.getHours();
  const nextHour = (hour + 1) % 24;
  const current = hourlyData.find(entry => entry.hour === hour);
  const next = hourlyData.find(entry => entry.hour === nextHour);

  if (!current) return null;
  if (!next) {
    return {
      azimuth: current.azimuth,
      altitude: current.altitude,
      isVisible: current.altitude > 0
    };
  }

  const fraction = currentTime.getMinutes() / 60;
  const azimuth = interpolateAngle(current.azimuth, next.azimuth, fraction);
  const altitude = current.altitude + (next.altitude - current.altitude) * fraction;

  return {
    azimuth,
    altitude,
    isVisible: altitude > 0
  };
}

/**
 * Interpola un ángulo en grados manejando el cruce 0°/360°
 */
function interpolateAngle(start, end, t) {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return start;
  const delta = ((end - start + 540) % 360) - 180;
  return (start + delta * t + 360) % 360;
}

/**
 * Parsea una hora en formato HH:MM a decimal
 */
function parseTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours + minutes / 60;
}
