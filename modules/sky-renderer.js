/**
 * Módulo de renderizado ASCII del cielo nocturno
 * Usa Yale Bright Star Catalog con proyección azimutal
 */

/**
 * Obtiene el límite de magnitud desde configuración global
 */
function getStarMagLimit() {
  const value = Number(globalThis.CIELO_STAR_MAG_LIMIT);
  return Number.isFinite(value) ? value : 6;
}

/**
 * Calcula azimut y altitud de una estrella para una ubicación y tiempo dados
 * @param {number} ra - Ascensión recta en grados
 * @param {number} dec - Declinación en grados
 * @param {number} lat - Latitud del observador en grados
 * @param {number} lon - Longitud del observador en grados
 * @param {Date} time - Tiempo de observación
 * @returns {{azimuth: number, altitude: number}} Coordenadas horizontales
 */
function calculateHorizontalCoordinates(ra, dec, lat, lon, time) {
  // Convertir a radianes
  const latRad = lat * Math.PI / 180;
  const decRad = dec * Math.PI / 180;
  
  // Calcular tiempo sidéreo local (LST) simplificado
  const J2000 = new Date('2000-01-01T12:00:00Z');
  const daysSinceJ2000 = (time - J2000) / (1000 * 60 * 60 * 24);
  const gmst = (280.46061837 + 360.98564736629 * daysSinceJ2000) % 360;
  const lst = (gmst + lon) % 360;
  
  // Ángulo horario
  const ha = (lst - ra) * Math.PI / 180;
  
  // Calcular altitud
  const sinAlt = Math.sin(decRad) * Math.sin(latRad) + 
                 Math.cos(decRad) * Math.cos(latRad) * Math.cos(ha);
  const altitude = Math.asin(sinAlt) * 180 / Math.PI;
  
  // Calcular azimut
  const cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / 
                (Math.cos(latRad) * Math.cos(Math.asin(sinAlt)));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180 / Math.PI;
  
  // Ajustar azimut según el cuadrante
  if (Math.sin(ha) > 0) {
    azimuth = 360 - azimuth;
  }
  
  return { azimuth, altitude };
}

/**
 * Determina el símbolo ASCII según la magnitud de la estrella
 * @param {number} mag - Magnitud aparente
 * @returns {string} Símbolo ASCII
 */
function getStarSymbol(mag) {
  if (mag < 1) return '●';
  if (mag < 3) return '★';
  if (mag < 5) return '+';
  if (mag < 6) return '·';
  return '.';
}

/**
 * Renderiza el cielo nocturno desde Barcelona (hemisferio norte celeste)
 * @param {Array} starCatalog - Catálogo de estrellas
 * @param {Date} currentTime - Tiempo actual
 * @returns {Object} Objeto con arte ASCII e información
 */
export function renderNightSkyBarcelona(starCatalog, currentTime) {
  if (!starCatalog || starCatalog.length === 0) {
    return { 
      art: 'cargando cielo nocturno...', 
      info: 'esperando catálogo de estrellas' 
    };
  }
  
  const magLimit = getStarMagLimit();
  const lat = 41.3851; // Barcelona
  const lon = 2.1734;
  
  // Filtrar estrellas del hemisferio norte (dec > 0) y por magnitud
  const visibleStars = starCatalog
    .filter(star => star.dec > 0 && star.mag <= magLimit)
    .map(star => {
      const coords = calculateHorizontalCoordinates(star.ra, star.dec, lat, lon, currentTime);
      return {
        ...star,
        azimuth: coords.azimuth,
        altitude: coords.altitude,
        symbol: getStarSymbol(star.mag)
      };
    })
    .filter(star => star.altitude > 0); // Solo estrellas sobre el horizonte
  
  // Crear canvas ASCII
  const width = 80;
  const height = 30;
  const canvas = createEmptyCanvas(width, height);
  
  // Proyectar estrellas en el canvas
  for (const star of visibleStars) {
    // Proyección azimutal: azimut → x, altitud → y
    const x = Math.floor((star.azimuth / 360) * width);
    const y = Math.floor(height - 1 - (star.altitude / 90) * height);
    
    if (x >= 0 && x < width && y >= 0 && y < height) {
      canvas[y][x] = star.symbol;
    }
  }
  
  // Información del cielo
  const info = [
    `barcelona (hemisferio norte celeste)`,
    `${visibleStars.length} estrellas visibles (mag < ${magLimit.toFixed(1)})`,
    `${formatTime(currentTime)}`
  ].join('\n');
  
  return { art: canvasToString(canvas), info };
}

/**
 * Renderiza el cielo nocturno de la antípoda de Barcelona (hemisferio sur celeste)
 * @param {Array} starCatalog - Catálogo de estrellas
 * @param {Date} currentTime - Tiempo actual
 * @returns {Object} Objeto con arte ASCII e información
 */
export function renderNightSkyAntipode(starCatalog, currentTime) {
  if (!starCatalog || starCatalog.length === 0) {
    return { 
      art: 'cargando cielo nocturno...', 
      info: 'esperando catálogo de estrellas' 
    };
  }
  
  const magLimit = getStarMagLimit();
  const lat = -41.3851; // Antípoda de Barcelona
  const lon = 2.1734 + 180; // Longitud opuesta
  
  // Filtrar estrellas del hemisferio sur (dec < 0) y por magnitud
  const visibleStars = starCatalog
    .filter(star => star.dec < 0 && star.mag <= magLimit)
    .map(star => {
      const coords = calculateHorizontalCoordinates(star.ra, star.dec, lat, lon, currentTime);
      return {
        ...star,
        azimuth: coords.azimuth,
        altitude: coords.altitude,
        symbol: getStarSymbol(star.mag)
      };
    })
    .filter(star => star.altitude > 0); // Solo estrellas sobre el horizonte
  
  // Crear canvas ASCII
  const width = 80;
  const height = 30;
  const canvas = createEmptyCanvas(width, height);
  
  // Proyectar estrellas en el canvas
  for (const star of visibleStars) {
    // Proyección azimutal: azimut → x, altitud → y
    const x = Math.floor((star.azimuth / 360) * width);
    const y = Math.floor(height - 1 - (star.altitude / 90) * height);
    
    if (x >= 0 && x < width && y >= 0 && y < height) {
      canvas[y][x] = star.symbol;
    }
  }
  
  // Información del cielo
  const info = [
    `antípoda (hemisferio sur celeste)`,
    `${visibleStars.length} estrellas visibles (mag < ${magLimit.toFixed(1)})`,
    `${formatTime(currentTime)}`
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
 * Convierte el canvas a string
 */
function canvasToString(canvas) {
  return canvas.map(row => row.join('')).join('\n');
}

/**
 * Formatea el tiempo para mostrar
 */
function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
