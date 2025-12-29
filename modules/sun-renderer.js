/**
 * Módulo de renderizado ASCII del sol
 */

function getSunRangeDeg() {
  const value = Number(globalThis.CIELO_SUN_RANGE_DEG);
  return Number.isFinite(value) && value > 0 ? value : 30;
}

/**
 * Renderiza la trayectoria del sol desde salida hasta mediodía (panel Este)
 */
export function renderSunEast(sunData, currentTime) {
  if (!sunData) return null;
  
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
  
  // Crear canvas ASCII
  const width = 40;
  const height = 15;
  const canvas = createEmptyCanvas(width, height);
  
  // Dibujar horizonte
  drawHorizon(canvas, width, height);
  
  // Dibujar marca del Este puro (centro)
  drawEastMarker(canvas, width, height);
  
  // Dibujar trayectoria del sol
  drawSunPath(canvas, width, height, sunrise, solarNoon, sunData);
  
  // Dibujar sol actual si está visible
  if (currentSunData && currentHour >= sunrise && currentHour <= solarNoon) {
    drawCurrentSun(canvas, width, height, currentSunData, sunrise, solarNoon);
  }
  
  // Añadir información
  const info = [
    `salida: ${sunData.sunrise} (${sunData.azimuthSunrise}°)`,
    `mediodía: ${sunData.solarNoon} (${sunData.azimuthNoon}°)`
  ].join('\n');
  
  return { art: canvasToString(canvas), info };
}

/**
 * Renderiza la trayectoria del sol desde mediodía hasta puesta (panel Oeste)
 */
export function renderSunWest(sunData, currentTime) {
  if (!sunData) return null;
  
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
  
  // Crear canvas ASCII
  const width = 40;
  const height = 15;
  const canvas = createEmptyCanvas(width, height);
  
  // Dibujar horizonte
  drawHorizon(canvas, width, height);
  
  // Dibujar marca del Oeste puro (centro)
  drawWestMarker(canvas, width, height);
  
  // Dibujar trayectoria del sol
  drawSunPathWest(canvas, width, height, solarNoon, sunset, sunData);
  
  // Dibujar sol actual si está visible
  if (currentSunData && currentHour >= solarNoon && currentHour <= sunset) {
    drawCurrentSunWest(canvas, width, height, currentSunData, solarNoon, sunset);
  }
  
  // Añadir información
  const info = [
    `mediodía: ${sunData.solarNoon} (${sunData.azimuthNoon}°)`,
    `puesta: ${sunData.sunset} (${sunData.azimuthSunset}°)`
  ].join('\n');
  
  return { art: canvasToString(canvas), info };
}

/**
 * Crea un canvas ASCII vacío
 */
function createEmptyCanvas(width, height) {
  const canvas = [];
  for (let y = 0; y < height; y++) {
    canvas[y] = [];
    for (let x = 0; x < width; x++) {
      canvas[y][x] = ' ';
    }
  }
  return canvas;
}

/**
 * Dibuja el horizonte
 */
function drawHorizon(canvas, width, height) {
  const horizonY = Math.floor(height * 0.7);
  for (let x = 0; x < width; x++) {
    canvas[horizonY][x] = '~';
  }
}

/**
 * Dibuja marca del Este puro (90°)
 */
function drawEastMarker(canvas, width, height) {
  const centerX = Math.floor(width / 2);
  const horizonY = Math.floor(height * 0.7);
  canvas[horizonY + 1][centerX] = '|';
  canvas[horizonY + 2][centerX] = 'E';
}

/**
 * Dibuja marca del Oeste puro (270°)
 */
function drawWestMarker(canvas, width, height) {
  const centerX = Math.floor(width / 2);
  const horizonY = Math.floor(height * 0.7);
  canvas[horizonY + 1][centerX] = '|';
  canvas[horizonY + 2][centerX] = 'O';
}

/**
 * Dibuja la trayectoria del sol (Este)
 */
function drawSunPath(canvas, width, height, sunrise, solarNoon, sunData) {
  const horizonY = Math.floor(height * 0.7);
  const rangeDeg = getSunRangeDeg();
  const halfSpan = (width - 1) / 2;
  
  // Obtener datos de salida y mediodía
  const sunriseData = sunData.hourlyData.find(h => h.hour === Math.floor(sunrise));
  const noonData = sunData.hourlyData.find(h => h.hour === Math.floor(solarNoon));
  
  if (!sunriseData || !noonData) return;
  
  // Calcular desviación del Este puro (90°)
  const sunriseDeviation = sunriseData.azimuth - 90;
  const noonDeviation = noonData.azimuth - 90;
  
  // Dibujar puntos de la trayectoria
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const deviation = sunriseDeviation + (noonDeviation - sunriseDeviation) * t;
    const altitude = sunriseData.altitude + (noonData.altitude - sunriseData.altitude) * t;
    
    // Mapear a coordenadas del canvas
    const x = Math.round(halfSpan + (deviation / rangeDeg) * halfSpan);
    const y = horizonY - Math.floor((altitude / 90) * (horizonY - 2));
    
    if (x >= 0 && x < width && y >= 0 && y < height) {
      canvas[y][x] = '·';
    }
  }
}

/**
 * Dibuja la trayectoria del sol (Oeste)
 */
function drawSunPathWest(canvas, width, height, solarNoon, sunset, sunData) {
  const horizonY = Math.floor(height * 0.7);
  const rangeDeg = getSunRangeDeg();
  const halfSpan = (width - 1) / 2;
  
  // Obtener datos de mediodía y puesta
  const noonData = sunData.hourlyData.find(h => h.hour === Math.floor(solarNoon));
  const sunsetData = sunData.hourlyData.find(h => h.hour === Math.floor(sunset));
  
  if (!noonData || !sunsetData) return;
  
  // Calcular desviación del Oeste puro (270°)
  const noonDeviation = 270 - noonData.azimuth;
  const sunsetDeviation = 270 - sunsetData.azimuth;
  
  // Dibujar puntos de la trayectoria
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const deviation = noonDeviation + (sunsetDeviation - noonDeviation) * t;
    const altitude = noonData.altitude + (sunsetData.altitude - noonData.altitude) * t;
    
    // Mapear a coordenadas del canvas
    const x = Math.round(halfSpan + (deviation / rangeDeg) * halfSpan);
    const y = horizonY - Math.floor((altitude / 90) * (horizonY - 2));
    
    if (x >= 0 && x < width && y >= 0 && y < height) {
      canvas[y][x] = '·';
    }
  }
}

/**
 * Dibuja el sol en su posición actual (Este)
 */
function drawCurrentSun(canvas, width, height, sunData, sunrise, solarNoon) {
  const horizonY = Math.floor(height * 0.7);
  const rangeDeg = getSunRangeDeg();
  const halfSpan = (width - 1) / 2;
  const deviation = sunData.azimuth - 90;
  
  const x = Math.round(halfSpan + (deviation / rangeDeg) * halfSpan);
  const y = horizonY - Math.floor((sunData.altitude / 90) * (horizonY - 2));
  
  if (x >= 0 && x < width && y >= 0 && y < height) {
    canvas[y][x] = '☼';
  }
}

/**
 * Dibuja el sol en su posición actual (Oeste)
 */
function drawCurrentSunWest(canvas, width, height, sunData, solarNoon, sunset) {
  const horizonY = Math.floor(height * 0.7);
  const rangeDeg = getSunRangeDeg();
  const halfSpan = (width - 1) / 2;
  const deviation = 270 - sunData.azimuth;
  
  const x = Math.round(halfSpan + (deviation / rangeDeg) * halfSpan);
  const y = horizonY - Math.floor((sunData.altitude / 90) * (horizonY - 2));
  
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
 * Parsea una hora en formato HH:MM a decimal
 */
function parseTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours + minutes / 60;
}
