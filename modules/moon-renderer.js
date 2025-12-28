/**
 * Módulo de renderizado ASCII de la luna
 */

/**
 * Renderiza la posición de la luna (panel Oeste de noche)
 */
export function renderMoonPosition(moonData, currentTime) {
  if (!moonData) return '';
  
  const currentHour = currentTime.getHours();
  const hourData = moonData.hourlyData.find(h => h.hour === currentHour);
  
  if (!hourData || !hourData.isVisible) {
    return `
La luna no es visible en este momento

fase: ${moonData.phaseName}
iluminación: ${moonData.illumination}%
    `;
  }
  
  // Crear canvas ASCII
  const width = 40;
  const height = 15;
  const canvas = createEmptyCanvas(width, height);
  
  // Dibujar horizonte
  drawHorizon(canvas, width, height);
  
  // Dibujar la luna en su posición
  drawMoon(canvas, width, height, hourData, moonData.phase);
  
  // Añadir información
  const info = `
azimut: ${hourData.azimuth}°
altitud: ${hourData.altitude}°
fase: ${moonData.phaseName}
  `;
  
  return canvasToString(canvas) + '\n' + info;
}

/**
 * Renderiza la fase lunar actual (panel Este de noche)
 */
export function renderMoonPhase(moonData) {
  if (!moonData) return '';
  
  const phase = moonData.phase;
  let moonAscii = '';
  
  // Generar representación ASCII de la fase lunar
  if (phase < 0.05 || phase > 0.95) {
    // Luna nueva
    moonAscii = `
    .---.
   /     \\
  |       |
  |       |
   \\     /
    '---'
    `;
  } else if (phase < 0.25) {
    // Creciente
    moonAscii = `
    .---.
   /    ))
  |    ))
  |    ))
   \\    ))
    '---'
    `;
  } else if (phase < 0.30) {
    // Cuarto creciente
    moonAscii = `
    .---.
   /   |||
  |   ||||
  |   ||||
   \\   |||
    '---'
    `;
  } else if (phase < 0.45) {
    // Gibosa creciente
    moonAscii = `
    .---.
   / ● |||
  | ●● |||
  | ●● |||
   \\ ● |||
    '---'
    `;
  } else if (phase < 0.55) {
    // Luna llena
    moonAscii = `
    .---.
   / ●●● \\
  | ●●●●● |
  | ●●●●● |
   \\ ●●● /
    '---'
    `;
  } else if (phase < 0.70) {
    // Gibosa menguante
    moonAscii = `
    .---.
   /||| ● \\
  |||  ●● |
  |||  ●● |
   \\||| ● /
    '---'
    `;
  } else if (phase < 0.75) {
    // Cuarto menguante
    moonAscii = `
    .---.
   /|||   \\
  ||||   |
  ||||   |
   \\|||   /
    '---'
    `;
  } else {
    // Menguante
    moonAscii = `
    .---.
   /((    \\
  ((    |
  ((    |
   \\((    /
    '---'
    `;
  }
  
  const info = `
fase: ${moonData.phaseName}
iluminación: ${moonData.illumination}%
salida: ${moonData.moonrise || 'N/A'}
puesta: ${moonData.moonset || 'N/A'}
  `;
  
  return moonAscii + '\n' + info;
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
 * Dibuja la luna en su posición
 */
function drawMoon(canvas, width, height, hourData, phase) {
  const horizonY = Math.floor(height * 0.7);
  
  // Mapear azimut a posición X (0° = Norte, 90° = Este, 180° = Sur, 270° = Oeste)
  // Normalizamos para que el centro sea el Oeste (270°)
  const azimuthOffset = hourData.azimuth - 270;
  const x = Math.floor(width / 2 + (azimuthOffset / 90) * (width / 4));
  
  // Mapear altitud a posición Y
  const y = horizonY - Math.floor((hourData.altitude / 90) * (horizonY - 2));
  
  // Determinar símbolo de la luna según fase
  let moonSymbol = '○';
  if (phase >= 0.45 && phase <= 0.55) {
    moonSymbol = '●'; // Luna llena
  } else if (phase < 0.05 || phase > 0.95) {
    moonSymbol = '○'; // Luna nueva
  } else if (phase < 0.5) {
    moonSymbol = '◐'; // Creciente
  } else {
    moonSymbol = '◑'; // Menguante
  }
  
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
