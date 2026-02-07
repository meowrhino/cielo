/**
 * Módulo de renderizado ASCII del sol
 * Pantalla completa con horizonte en el borde inferior
 */

/**
 * Renderiza la trayectoria del sol desde salida hasta mediodía (panel Este)
 * Muestra 180° de azimut (0° Norte → 180° Sur)
 */
export function renderSunEast(sunData, currentTime) {
  if (!sunData) return null;
  
  const sunrise = parseTime(sunData.sunrise);
  const solarNoon = parseTime(sunData.solarNoon);
  const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;
  
  // Determinar posición actual del sol
  const currentSunData = getInterpolatedSunData(sunData.hourlyData, currentTime);
  
  // Crear canvas ASCII (pantalla completa)
  const width = 80;
  const height = 30;
  const canvas = createEmptyCanvas(width, height);
  
  // Dibujar marca del Este puro (90°, centro horizontal)
  drawEastMarker(canvas, width, height);
  
  // Dibujar trayectoria del sol (solo si está en el rango Este)
  drawSunPath(canvas, width, height, sunrise, solarNoon, sunData);
  
  // Dibujar sol actual si está visible y en el rango Este
  if (currentSunData && currentSunData.isVisible && currentHour >= sunrise && currentHour <= solarNoon) {
    if (currentSunData.azimuth >= 0 && currentSunData.azimuth <= 180) {
      drawCurrentSun(canvas, width, height, currentSunData);
    }
  }
  
  // Añadir información
  const info = [
    `salida: ${sunData.sunrise} (${sunData.azimuthSunrise.toFixed(1)}°)`,
    `mediodía: ${sunData.solarNoon} (${sunData.azimuthNoon.toFixed(1)}°)`
  ].join('\n');
  
  return { art: canvasToString(canvas), info };
}

/**
 * Renderiza la trayectoria del sol desde mediodía hasta puesta (panel Oeste)
 * Muestra 180° de azimut (180° Sur → 360° Norte)
 */
export function renderSunWest(sunData, currentTime) {
  if (!sunData) return null;
  
  const solarNoon = parseTime(sunData.solarNoon);
  const sunset = parseTime(sunData.sunset);
  const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;
  
  // Determinar posición actual del sol
  const currentSunData = getInterpolatedSunData(sunData.hourlyData, currentTime);
  
  // Crear canvas ASCII (pantalla completa)
  const width = 80;
  const height = 30;
  const canvas = createEmptyCanvas(width, height);
  
  // Dibujar marca del Oeste puro (270°, centro horizontal)
  drawWestMarker(canvas, width, height);
  
  // Dibujar trayectoria del sol (solo si está en el rango Oeste)
  drawSunPathWest(canvas, width, height, solarNoon, sunset, sunData);
  
  // Dibujar sol actual si está visible y en el rango Oeste
  if (currentSunData && currentSunData.isVisible && currentHour >= solarNoon && currentHour <= sunset) {
    if (currentSunData.azimuth >= 180 && currentSunData.azimuth <= 360) {
      drawCurrentSunWest(canvas, width, height, currentSunData);
    }
  }
  
  // Añadir información
  const info = [
    `mediodía: ${sunData.solarNoon} (${sunData.azimuthNoon.toFixed(1)}°)`,
    `puesta: ${sunData.sunset} (${sunData.azimuthSunset.toFixed(1)}°)`
  ].join('\n');
  
  return { art: canvasToString(canvas), info };
}

// === FUNCIONES AUXILIARES ===

/**
 * Crea un canvas ASCII vacío
 */
function createEmptyCanvas(width, height) {
  const canvas = [];
  for (let y = 0; y < height; y++) {
    canvas[y] = new Array(width).fill(' ');
  }
  return canvas;
}

/**
 * Dibuja marca del Este puro (90°, centro horizontal)
 */
function drawEastMarker(canvas, width, height) {
  const centerX = Math.floor(width / 2);
  const bottomY = height - 1;
  
  // Marca en el borde inferior
  if (bottomY >= 0 && centerX >= 0 && centerX < width) {
    canvas[bottomY][centerX] = 'E';
  }
}

/**
 * Dibuja marca del Oeste puro (270°, centro horizontal)
 */
function drawWestMarker(canvas, width, height) {
  const centerX = Math.floor(width / 2);
  const bottomY = height - 1;
  
  // Marca en el borde inferior
  if (bottomY >= 0 && centerX >= 0 && centerX < width) {
    canvas[bottomY][centerX] = 'O';
  }
}

/**
 * Dibuja la trayectoria del sol (Este: 0° → 180°)
 */
function drawSunPath(canvas, width, height, sunrise, solarNoon, sunData) {
  const steps = 20;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const hour = sunrise + (solarNoon - sunrise) * t;
    const hourData = sunData.hourlyData.find(h => Math.abs(h.hour - Math.floor(hour)) < 0.5);
    
    if (!hourData || !hourData.isVisible) continue;
    if (hourData.azimuth < 0 || hourData.azimuth > 180) continue;
    
    // Mapear azimut (0° → 180°) a X (0 → width)
    const x = Math.floor((hourData.azimuth / 180) * (width - 1));
    
    // Mapear altitud (0° → 90°) a Y (bottom → top)
    const y = Math.floor(height - 1 - (hourData.altitude / 90) * (height - 1));
    
    if (x >= 0 && x < width && y >= 0 && y < height) {
      canvas[y][x] = '·';
    }
  }
}

/**
 * Dibuja la trayectoria del sol (Oeste: 180° → 360°)
 */
function drawSunPathWest(canvas, width, height, solarNoon, sunset, sunData) {
  const steps = 20;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const hour = solarNoon + (sunset - solarNoon) * t;
    const hourData = sunData.hourlyData.find(h => Math.abs(h.hour - Math.floor(hour)) < 0.5);
    
    if (!hourData || !hourData.isVisible) continue;
    if (hourData.azimuth < 180 || hourData.azimuth > 360) continue;
    
    // Mapear azimut (180° → 360°) a X (0 → width)
    const normalizedAzimuth = hourData.azimuth - 180;
    const x = Math.floor((normalizedAzimuth / 180) * (width - 1));
    
    // Mapear altitud (0° → 90°) a Y (bottom → top)
    const y = Math.floor(height - 1 - (hourData.altitude / 90) * (height - 1));
    
    if (x >= 0 && x < width && y >= 0 && y < height) {
      canvas[y][x] = '·';
    }
  }
}

/**
 * Dibuja el sol en su posición actual (Este: 0° → 180°)
 */
function drawCurrentSun(canvas, width, height, sunData) {
  // Mapear azimut (0° → 180°) a X (0 → width)
  const x = Math.floor((sunData.azimuth / 180) * (width - 1));
  
  // Mapear altitud (0° → 90°) a Y (bottom → top)
  const y = Math.floor(height - 1 - (sunData.altitude / 90) * (height - 1));
  
  if (x >= 0 && x < width && y >= 0 && y < height) {
    canvas[y][x] = '☼';
  }
}

/**
 * Dibuja el sol en su posición actual (Oeste: 180° → 360°)
 */
function drawCurrentSunWest(canvas, width, height, sunData) {
  // Mapear azimut (180° → 360°) a X (0 → width)
  const normalizedAzimuth = sunData.azimuth - 180;
  const x = Math.floor((normalizedAzimuth / 180) * (width - 1));
  
  // Mapear altitud (0° → 90°) a Y (bottom → top)
  const y = Math.floor(height - 1 - (sunData.altitude / 90) * (height - 1));
  
  if (x >= 0 && x < width && y >= 0 && y < height) {
    canvas[y][x] = '☼';
  }
}

/**
 * Convierte el canvas a string
 */
function canvasToString(canvas) {
  return canvas.map(row => row.join('')).join('\n');
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
