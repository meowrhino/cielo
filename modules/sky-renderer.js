/**
 * Módulo de renderizado ASCII de cielos nocturnos
 */

/**
 * Renderiza el cielo nocturno de Barcelona (panel Norte)
 */
export function renderNightSkyBarcelona(starCatalog, currentTime) {
  if (!starCatalog) return '';
  
  const lat = 41.3851; // Barcelona
  const lon = 2.1734;
  
  return renderNightSky(starCatalog, currentTime, lat, lon, 'Barcelona');
}

/**
 * Renderiza el cielo nocturno de la antípoda (panel Sur)
 */
export function renderNightSkyAntipode(starCatalog, currentTime) {
  if (!starCatalog) return '';
  
  const lat = -41.3851; // Antípoda de Barcelona
  const lon = 2.1734 - 180;
  
  return renderNightSky(starCatalog, currentTime, lat, lon, 'Antípoda');
}

/**
 * Renderiza un cielo nocturno genérico
 */
function renderNightSky(starCatalog, currentTime, lat, lon, locationName) {
  const width = 50;
  const height = 20;
  const canvas = createEmptyCanvas(width, height);
  
  // Calcular hora sidérea local
  const lst = calculateLocalSiderealTime(currentTime, lon);
  
  // Filtrar y proyectar estrellas visibles
  const visibleStars = [];
  for (const star of starCatalog) {
    const pos = calculateStarPosition(star, lst, lat);
    if (pos.altitude > 0) { // Solo estrellas sobre el horizonte
      visibleStars.push({ ...star, ...pos });
    }
  }
  
  // Ordenar por magnitud (más brillantes primero)
  visibleStars.sort((a, b) => a.mag - b.mag);
  
  // Dibujar estrellas
  for (const star of visibleStars) {
    drawStar(canvas, width, height, star);
  }
  
  // Añadir algunas estrellas aleatorias de fondo
  addBackgroundStars(canvas, width, height, 30);
  
  const info = `
${locationName}
estrellas visibles: ${visibleStars.length}
hora sidérea: ${lst.toFixed(2)}h
  `;
  
  return canvasToString(canvas) + '\n' + info;
}

/**
 * Calcula la hora sidérea local
 */
function calculateLocalSiderealTime(date, lon) {
  // Simplificación: calcular LST aproximado
  const J2000 = new Date('2000-01-01T12:00:00Z');
  const daysSinceJ2000 = (date - J2000) / (1000 * 60 * 60 * 24);
  
  // Tiempo sidéreo de Greenwich a medianoche
  const gst0 = (18.697374558 + 24.06570982441908 * daysSinceJ2000) % 24;
  
  // Hora UTC
  const utHours = date.getUTCHours() + date.getUTCMinutes() / 60;
  
  // Tiempo sidéreo de Greenwich
  const gst = (gst0 + utHours * 1.00273790935) % 24;
  
  // Tiempo sidéreo local
  const lst = (gst + lon / 15) % 24;
  
  return lst;
}

/**
 * Calcula la posición de una estrella en el cielo
 */
function calculateStarPosition(star, lst, lat) {
  // Convertir RA y Dec a radianes
  const ra = star.ra * 15 * Math.PI / 180; // RA en horas -> grados -> radianes
  const dec = star.dec * Math.PI / 180;
  const latRad = lat * Math.PI / 180;
  
  // Calcular ángulo horario
  const ha = (lst - star.ra) * 15 * Math.PI / 180;
  
  // Calcular altitud y azimut
  const sinAlt = Math.sin(dec) * Math.sin(latRad) + 
                 Math.cos(dec) * Math.cos(latRad) * Math.cos(ha);
  const altitude = Math.asin(sinAlt) * 180 / Math.PI;
  
  const cosAz = (Math.sin(dec) - Math.sin(latRad) * sinAlt) / 
                (Math.cos(latRad) * Math.cos(Math.asin(sinAlt)));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180 / Math.PI;
  
  if (Math.sin(ha) > 0) {
    azimuth = 360 - azimuth;
  }
  
  return { altitude, azimuth };
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
 * Dibuja una estrella en el canvas
 */
function drawStar(canvas, width, height, star) {
  // Mapear azimut a X (0° = Norte arriba, 90° = Este derecha)
  // Invertimos para que el Norte esté arriba
  const azimuthRad = (star.azimuth - 180) * Math.PI / 180;
  
  // Mapear altitud a distancia desde el centro (90° = centro, 0° = borde)
  const radius = (90 - star.altitude) / 90;
  
  // Calcular posición en el canvas (proyección azimutal)
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(centerX, centerY) * 0.9;
  
  const x = Math.floor(centerX + Math.sin(azimuthRad) * radius * maxRadius);
  const y = Math.floor(centerY - Math.cos(azimuthRad) * radius * maxRadius);
  
  if (x >= 0 && x < width && y >= 0 && y < height) {
    // Símbolo según magnitud
    let symbol = '.';
    if (star.mag < 0) {
      symbol = '★'; // Muy brillante
    } else if (star.mag < 1) {
      symbol = '*'; // Brillante
    } else if (star.mag < 2) {
      symbol = '+'; // Media
    }
    
    canvas[y][x] = symbol;
  }
}

/**
 * Añade estrellas de fondo aleatorias
 */
function addBackgroundStars(canvas, width, height, count) {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    
    if (canvas[y][x] === ' ') {
      canvas[y][x] = Math.random() > 0.5 ? '.' : '·';
    }
  }
}

/**
 * Convierte el canvas a string
 */
function canvasToString(canvas) {
  return canvas.map(row => row.join('')).join('\n');
}
