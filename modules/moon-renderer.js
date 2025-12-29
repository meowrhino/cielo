/**
 * Módulo de renderizado ASCII de la luna
 * Pantalla completa con horizonte en el borde inferior
 */

/**
 * Renderiza la posición de la luna (panel Oeste de noche)
 * Muestra 180° de azimut (180° Sur → 360° Norte)
 */
export function renderMoonPosition(moonData, currentTime) {
  if (!moonData) return null;
  
  const currentHour = currentTime.getHours();
  const hourData = moonData.hourlyData.find(h => h.hour === currentHour);
  
  if (!hourData || !hourData.isVisible) {
    return {
      art: 'la luna no es visible',
      info: `fase: ${moonData.phaseName}\niluminación: ${moonData.illumination}%`
    };
  }
  
  // Crear canvas ASCII (pantalla completa)
  const width = 80;
  const height = 30;
  const canvas = createEmptyCanvas(width, height);
  
  // Dibujar la luna en su posición
  drawMoon(canvas, width, height, hourData, moonData.phase);
  
  // Información
  const info = [
    `azimut: ${hourData.azimuth.toFixed(1)}°`,
    `altitud: ${hourData.altitude.toFixed(1)}°`,
    `fase: ${moonData.phaseName}`
  ].join('\n');
  
  return { art: canvasToString(canvas), info };
}

/**
 * Renderiza la fase lunar actual (panel Este de noche)
 * Muestra icono único + información textual
 */
export function renderMoonPhase(moonData) {
  if (!moonData) return null;
  
  const phase = moonData.phase;
  const moonSymbol = getMoonSymbol(phase);
  
  // Crear canvas simple con el icono centrado
  const width = 80;
  const height = 30;
  const canvas = createEmptyCanvas(width, height);
  
  // Dibujar icono de la luna en el centro
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  canvas[centerY][centerX] = moonSymbol;
  
  // Información textual
  const info = [
    `fase: ${moonData.phaseName}`,
    `iluminación: ${moonData.illumination}%`,
    `salida: ${moonData.moonrise || 'N/A'}`,
    `puesta: ${moonData.moonset || 'N/A'}`
  ].join('\n');
  
  return { art: canvasToString(canvas), info };
}

// === FUNCIONES AUXILIARES ===

/**
 * Determina el símbolo de la luna según su fase
 * @param {number} phase - Fase lunar (0-1)
 * @returns {string} Símbolo ASCII
 */
function getMoonSymbol(phase) {
  if (phase < 0.05 || phase > 0.95) {
    return '○'; // Luna nueva
  } else if (phase >= 0.45 && phase <= 0.55) {
    return '●'; // Luna llena
  } else if (phase < 0.5) {
    return '◐'; // Cuarto creciente
  } else {
    return '◑'; // Cuarto menguante
  }
}

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
 * Dibuja la luna en su posición (Oeste: 180° → 360°)
 */
function drawMoon(canvas, width, height, hourData, phase) {
  // Solo dibujar si está en el rango Oeste
  if (hourData.azimuth < 180 || hourData.azimuth > 360) return;
  
  // Mapear azimut (180° → 360°) a X (0 → width)
  const normalizedAzimuth = hourData.azimuth - 180;
  const x = Math.floor((normalizedAzimuth / 180) * (width - 1));
  
  // Mapear altitud (0° → 90°) a Y (bottom → top)
  const y = Math.floor(height - 1 - (hourData.altitude / 90) * (height - 1));
  
  // Obtener símbolo según fase
  const moonSymbol = getMoonSymbol(phase);
  
  if (x >= 0 && x < width && y >= 0 && y < height) {
    canvas[y][x] = moonSymbol;
  }
}

/**
 * Convierte el canvas a string
 */
function canvasToString(canvas) {
  return canvas.map(row => row.join('')).join('\n');
}
