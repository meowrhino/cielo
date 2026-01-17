/**
 * Módulo de renderizado del cielo nocturno V2
 * Usa posicionamiento absoluto CSS en lugar de canvas ASCII
 * Incluye líneas de constelaciones
 */

// Cargar datos de líneas de constelaciones
let constellationLines = null;

/**
 * Carga los datos de líneas de constelaciones
 */
export async function loadConstellationLines() {
  if (constellationLines) return constellationLines;
  
  try {
    const response = await fetch('data/constellations-lines.json');
    const data = await response.json();
    constellationLines = data.features;
    console.log('Constelaciones cargadas:', constellationLines.length);
    return constellationLines;
  } catch (error) {
    console.error('Error cargando líneas de constelaciones:', error);
    return null;
  }
}

/**
 * Obtiene el límite de magnitud desde configuración global
 */
function getStarMagLimit() {
  const value = Number(globalThis.CIELO_STAR_MAG_LIMIT);
  return Number.isFinite(value) ? value : 6;
}

/**
 * Calcula azimut y altitud de una estrella para una ubicación y tiempo dados
 */
function calculateHorizontalCoordinates(ra, dec, lat, lon, time) {
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
 * Convierte coordenadas RA/Dec (GeoJSON format) a coordenadas horizontales
 */
function geoJsonToRaDec(lon, lat) {
  // GeoJSON usa longitud -180...180 para RA
  // Convertir a 0...360
  let ra = lon;
  if (ra < 0) ra += 360;
  
  const dec = lat;
  return { ra, dec };
}

/**
 * Determina el símbolo ASCII según la magnitud de la estrella
 */
function getStarSymbol(mag) {
  if (mag < 1) return '●';
  if (mag < 3) return '★';
  if (mag < 5) return '+';
  if (mag < 6) return '·';
  return '.';
}

/**
 * Determina el tamaño de la estrella según su magnitud
 */
function getStarSize(mag) {
  if (mag < 1) return '1.2em';
  if (mag < 3) return '1em';
  if (mag < 5) return '0.8em';
  if (mag < 6) return '0.6em';
  return '0.5em';
}

/**
 * Renderiza el cielo nocturno desde Barcelona (hemisferio norte celeste)
 */
export function renderNightSkyBarcelona(starCatalog, currentTime, container) {
  if (!starCatalog || starCatalog.length === 0 || !container) {
    console.error('No se puede renderizar: falta catálogo o contenedor');
    return;
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
        symbol: getStarSymbol(star.mag),
        size: getStarSize(star.mag)
      };
    })
    .filter(star => star.altitude > 0); // Solo estrellas sobre el horizonte
  
  console.log('Estrellas visibles (norte):', visibleStars.length);
  
  // Limpiar contenedor
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.width = '100%';
  container.style.height = '100%';
  
  // Crear SVG para las líneas de constelaciones
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
  
  // Dibujar líneas de constelaciones
  if (constellationLines) {
    drawConstellationLines(svg, constellationLines, lat, lon, currentTime, true);
  }
  
  // Crear elementos de estrellas
  for (const star of visibleStars) {
    // Proyección azimutal: azimut → x, altitud → y
    const x = (star.azimuth / 360) * 100; // Porcentaje
    const y = 100 - (star.altitude / 90) * 100; // Porcentaje (invertido)
    
    const starEl = document.createElement('span');
    starEl.textContent = star.symbol;
    starEl.className = 'star-point';
    starEl.style.position = 'absolute';
    starEl.style.left = `${x}%`;
    starEl.style.top = `${y}%`;
    starEl.style.fontSize = star.size;
    starEl.style.color = 'var(--text-color)';
    starEl.style.transform = 'translate(-50%, -50%)';
    starEl.style.zIndex = '2';
    starEl.style.pointerEvents = 'none';
    starEl.style.userSelect = 'none';
    
    // Añadir título con información de la estrella
    if (star.name) {
      starEl.title = `${star.name} (mag ${star.mag.toFixed(1)})`;
    }
    
    container.appendChild(starEl);
  }
  
  // Añadir información del cielo
  const info = document.createElement('div');
  info.className = 'sky-info';
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
  
  info.textContent = [
    `barcelona (hemisferio norte celeste)`,
    `${visibleStars.length} estrellas visibles (mag < ${magLimit.toFixed(1)})`,
    `${formatTime(currentTime)}`
  ].join('\n');
  
  container.appendChild(info);
}

/**
 * Renderiza el cielo nocturno de la antípoda de Barcelona (hemisferio sur celeste)
 */
export function renderNightSkyAntipode(starCatalog, currentTime, container) {
  if (!starCatalog || starCatalog.length === 0 || !container) {
    console.error('No se puede renderizar: falta catálogo o contenedor');
    return;
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
        symbol: getStarSymbol(star.mag),
        size: getStarSize(star.mag)
      };
    })
    .filter(star => star.altitude > 0); // Solo estrellas sobre el horizonte
  
  console.log('Estrellas visibles (sur):', visibleStars.length);
  
  // Limpiar contenedor
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.width = '100%';
  container.style.height = '100%';
  
  // Crear SVG para las líneas de constelaciones
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
  
  // Dibujar líneas de constelaciones
  if (constellationLines) {
    drawConstellationLines(svg, constellationLines, lat, lon, currentTime, false);
  }
  
  // Crear elementos de estrellas
  for (const star of visibleStars) {
    // Proyección azimutal: azimut → x, altitud → y
    const x = (star.azimuth / 360) * 100; // Porcentaje
    const y = 100 - (star.altitude / 90) * 100; // Porcentaje (invertido)
    
    const starEl = document.createElement('span');
    starEl.textContent = star.symbol;
    starEl.className = 'star-point';
    starEl.style.position = 'absolute';
    starEl.style.left = `${x}%`;
    starEl.style.top = `${y}%`;
    starEl.style.fontSize = star.size;
    starEl.style.color = 'var(--text-color)';
    starEl.style.transform = 'translate(-50%, -50%)';
    starEl.style.zIndex = '2';
    starEl.style.pointerEvents = 'none';
    starEl.style.userSelect = 'none';
    
    // Añadir título con información de la estrella
    if (star.name) {
      starEl.title = `${star.name} (mag ${star.mag.toFixed(1)})`;
    }
    
    container.appendChild(starEl);
  }
  
  // Añadir información del cielo
  const info = document.createElement('div');
  info.className = 'sky-info';
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
  
  info.textContent = [
    `antípoda (hemisferio sur celeste)`,
    `${visibleStars.length} estrellas visibles (mag < ${magLimit.toFixed(1)})`,
    `${formatTime(currentTime)}`
  ].join('\n');
  
  container.appendChild(info);
}

/**
 * Dibuja las líneas de constelaciones en el SVG
 */
function drawConstellationLines(svg, lines, lat, lon, time, isNorthernHemisphere) {
  let linesDrawn = 0;
  
  for (const constellation of lines) {
    const { geometry } = constellation;
    
    if (geometry.type !== 'MultiLineString') continue;
    
    // Para cada línea en la constelación
    for (const lineCoords of geometry.coordinates) {
      const points = [];
      let allVisible = true;
      
      // Convertir cada punto de la línea
      for (const [geoLon, geoLat] of lineCoords) {
        const { ra, dec } = geoJsonToRaDec(geoLon, geoLat);
        
        // Filtrar por hemisferio
        if (isNorthernHemisphere && dec < 0) {
          allVisible = false;
          break;
        }
        if (!isNorthernHemisphere && dec > 0) {
          allVisible = false;
          break;
        }
        
        const coords = calculateHorizontalCoordinates(ra, dec, lat, lon, time);
        
        // Si algún punto está bajo el horizonte, no dibujar la línea
        if (coords.altitude < 0) {
          allVisible = false;
          break;
        }
        
        // Convertir a coordenadas de pantalla (porcentaje)
        const x = (coords.azimuth / 360) * 100;
        const y = 100 - (coords.altitude / 90) * 100;
        
        points.push({ x, y });
      }
      
      // Dibujar la línea si todos los puntos son visibles
      if (allVisible && points.length >= 2) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        // Construir el path
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
          d += ` L ${points[i].x} ${points[i].y}`;
        }
        
        path.setAttribute('d', d);
        path.setAttribute('stroke', 'var(--btn-color)');
        path.setAttribute('stroke-width', '0.15');
        path.setAttribute('stroke-dasharray', '0.5 0.8');
        path.setAttribute('fill', 'none');
        path.setAttribute('opacity', '0.4');
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        
        svg.appendChild(path);
        linesDrawn++;
      }
    }
  }
  
  console.log('Líneas de constelaciones dibujadas:', linesDrawn);
}

/**
 * Formatea el tiempo para mostrar
 */
function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
