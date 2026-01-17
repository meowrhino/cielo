/**
 * Módulo de renderizado del sol V2
 * Usa SVG para curvas fluidas y posicionamiento absoluto para el sol
 */

/**
 * Renderiza la trayectoria del sol desde salida hasta mediodía (panel Este)
 */
export function renderSunEast(sunData, currentTime, container) {
  if (!sunData || !container) {
    console.error('No se puede renderizar sol este: faltan datos o contenedor');
    return;
  }
  
  const sunrise = parseTime(sunData.sunrise);
  const solarNoon = parseTime(sunData.solarNoon);
  const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;
  
  // Determinar posición actual del sol
  let currentSunData = null;
  for (const hourData of sunData.hourlyData) {
    if (hourData.hour === Math.floor(currentHour) && hourData.isVisible) {
      currentSunData = hourData;
      break;
    }
  }
  
  console.log('Renderizando sol este, hora:', currentHour, 'datos:', currentSunData);
  
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
  
  // Dibujar marca del Este puro (90°, centro horizontal)
  drawCompassMarker(container, 50, 'E');
  
  // Dibujar trayectoria del sol
  drawSunPath(svg, sunrise, solarNoon, sunData, 0, 180);
  
  // Dibujar marcadores de salida y mediodía
  const sunriseData = sunData.hourlyData.find(h => Math.abs(h.hour - Math.floor(sunrise)) <= 1 && h.isVisible);
  const noonData = sunData.hourlyData.find(h => Math.abs(h.hour - Math.floor(solarNoon)) <= 1 && h.isVisible);
  
  if (sunriseData) {
    drawSunMarker(container, sunriseData.azimuth, sunriseData.altitude, '↑', 'salida', 0);
  }
  if (noonData) {
    drawSunMarker(container, noonData.azimuth, noonData.altitude, '⊙', 'mediodía', 0);
  }
  
  // Dibujar sol actual si está visible y en el rango Este
  if (currentSunData && currentHour >= sunrise && currentHour <= solarNoon) {
    if (currentSunData.azimuth >= 0 && currentSunData.azimuth <= 180) {
      drawCurrentSun(container, currentSunData.azimuth, currentSunData.altitude, 0);
    }
  }
  
  // Añadir información
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
  
  const azSunrise = sunriseData ? sunriseData.azimuth.toFixed(1) : 'n/a';
  const azNoon = noonData ? noonData.azimuth.toFixed(1) : 'n/a';
  
  info.textContent = [
    `salida: ${sunData.sunrise} (${azSunrise}°)`,
    `mediodía: ${sunData.solarNoon} (${azNoon}°)`
  ].join('\n');
  
  container.appendChild(info);
}

/**
 * Renderiza la trayectoria del sol desde mediodía hasta puesta (panel Oeste)
 */
export function renderSunWest(sunData, currentTime, container) {
  if (!sunData || !container) {
    console.error('No se puede renderizar sol oeste: faltan datos o contenedor');
    return;
  }
  
  const solarNoon = parseTime(sunData.solarNoon);
  const sunset = parseTime(sunData.sunset);
  const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;
  
  // Determinar posición actual del sol
  let currentSunData = null;
  for (const hourData of sunData.hourlyData) {
    if (hourData.hour === Math.floor(currentHour) && hourData.isVisible) {
      currentSunData = hourData;
      break;
    }
  }
  
  console.log('Renderizando sol oeste, hora:', currentHour, 'datos:', currentSunData);
  
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
  
  // Dibujar marca del Oeste puro (270°, centro horizontal)
  drawCompassMarker(container, 50, 'O');
  
  // Dibujar trayectoria del sol
  drawSunPath(svg, solarNoon, sunset, sunData, 180, 360);
  
  // Dibujar marcadores de mediodía y puesta
  const noonData = sunData.hourlyData.find(h => Math.abs(h.hour - Math.floor(solarNoon)) <= 1 && h.isVisible);
  const sunsetData = sunData.hourlyData.find(h => Math.abs(h.hour - Math.floor(sunset)) <= 1 && h.isVisible);
  
  if (noonData) {
    drawSunMarker(container, noonData.azimuth, noonData.altitude, '⊙', 'mediodía', 180);
  }
  if (sunsetData) {
    drawSunMarker(container, sunsetData.azimuth, sunsetData.altitude, '↓', 'puesta', 180);
  }
  
  // Dibujar sol actual si está visible y en el rango Oeste
  if (currentSunData && currentHour >= solarNoon && currentHour <= sunset) {
    if (currentSunData.azimuth >= 180 && currentSunData.azimuth <= 360) {
      drawCurrentSun(container, currentSunData.azimuth, currentSunData.altitude, 180);
    }
  }
  
  // Añadir información
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
  
  const azNoon = noonData ? noonData.azimuth.toFixed(1) : 'n/a';
  const azSunset = sunsetData ? sunsetData.azimuth.toFixed(1) : 'n/a';
  
  info.textContent = [
    `mediodía: ${sunData.solarNoon} (${azNoon}°)`,
    `puesta: ${sunData.sunset} (${azSunset}°)`
  ].join('\n');
  
  container.appendChild(info);
}

// === FUNCIONES AUXILIARES ===

/**
 * Dibuja la marca de punto cardinal en el horizonte
 */
function drawCompassMarker(container, x, label) {
  const marker = document.createElement('span');
  marker.textContent = label;
  marker.style.position = 'absolute';
  marker.style.left = `${x}%`;
  marker.style.bottom = '5rem';
  marker.style.fontSize = 'clamp(0.8rem, 2vw, 1.2rem)';
  marker.style.color = 'var(--btn-color)';
  marker.style.transform = 'translateX(-50%)';
  marker.style.zIndex = '2';
  marker.style.pointerEvents = 'none';
  marker.style.fontWeight = 'bold';
  
  container.appendChild(marker);
}

/**
 * Dibuja la trayectoria del sol como una curva SVG
 */
function drawSunPath(svg, startTime, endTime, sunData, azimuthStart, azimuthEnd) {
  const points = [];
  const steps = 50;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const hour = startTime + (endTime - startTime) * t;
    const hourData = sunData.hourlyData.find(h => Math.abs(h.hour - Math.floor(hour)) < 0.5);
    
    if (!hourData || !hourData.isVisible) continue;
    if (hourData.azimuth < azimuthStart || hourData.azimuth > azimuthEnd) continue;
    
    // Normalizar azimut al rango 0-100
    let normalizedAzimuth = hourData.azimuth;
    if (azimuthStart === 180) {
      normalizedAzimuth -= 180;
    }
    const x = (normalizedAzimuth / 180) * 100;
    
    // Normalizar altitud al rango 0-100 (invertido)
    const y = 100 - (hourData.altitude / 90) * 100;
    
    points.push({ x, y });
  }
  
  if (points.length < 2) {
    console.log('No hay suficientes puntos para dibujar trayectoria');
    return;
  }
  
  console.log('Dibujando trayectoria con', points.length, 'puntos');
  
  // Crear path con curva suave
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  
  // Construir el path
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
 * Dibuja un marcador en la trayectoria del sol
 */
function drawSunMarker(container, azimuth, altitude, symbol, label, azimuthOffset = 0) {
  // Normalizar azimut
  let normalizedAzimuth = azimuth;
  if (azimuthOffset === 180) {
    normalizedAzimuth -= 180;
  }
  
  const x = (normalizedAzimuth / 180) * 100;
  const y = 100 - (altitude / 90) * 100;
  
  const marker = document.createElement('span');
  marker.textContent = symbol;
  marker.style.position = 'absolute';
  marker.style.left = `${x}%`;
  marker.style.top = `${y}%`;
  marker.style.fontSize = 'clamp(0.8rem, 2vw, 1.2rem)';
  marker.style.color = 'var(--btn-color)';
  marker.style.transform = 'translate(-50%, -50%)';
  marker.style.zIndex = '2';
  marker.style.pointerEvents = 'none';
  marker.title = label;
  
  container.appendChild(marker);
}

/**
 * Dibuja el sol en su posición actual
 */
function drawCurrentSun(container, azimuth, altitude, azimuthOffset = 0) {
  // Normalizar azimut
  let normalizedAzimuth = azimuth;
  if (azimuthOffset === 180) {
    normalizedAzimuth -= 180;
  }
  
  const x = (normalizedAzimuth / 180) * 100;
  const y = 100 - (altitude / 90) * 100;
  
  console.log('Dibujando sol en:', x, y, 'azimut:', azimuth, 'altitud:', altitude);
  
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
 * Parsea una hora en formato HH:MM a decimal
 */
function parseTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours + minutes / 60;
}
