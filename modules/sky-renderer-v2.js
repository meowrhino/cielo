/**
 * Módulo de renderizado del cielo nocturno V2
 * Usa posicionamiento absoluto CSS en lugar de canvas ASCII
 * Incluye líneas de constelaciones con nombres interactivos
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
 * Proyección equidistante azimutal adaptativa
 * Se estira para llenar todo el rectángulo del contenedor.
 * En pantalla ancha (desktop) se estira horizontalmente,
 * en pantalla alta (móvil) se estira verticalmente.
 *
 * @param {number} azimuth - Azimut en grados (0=N, 90=E, 180=S, 270=O)
 * @param {number} altitude - Altitud en grados (0=horizonte, 90=cenit)
 * @returns {{x: number, y: number}} Coordenadas en porcentaje (0-100)
 */
function azimuthalProject(azimuth, altitude) {
  const azRad = azimuth * Math.PI / 180;
  // Distancia normalizada desde el cenit: 0 en cenit, 1 en horizonte
  const r = (90 - altitude) / 90;
  // Escala >50 para que el horizonte se extienda más allá de los bordes
  // y el cielo visible llene todo el rectángulo del contenedor.
  // El contenedor recorta con overflow:hidden lo que sobresale.
  const scale = 72;
  const x = 50 + r * Math.sin(azRad) * scale;
  const y = 50 - r * Math.cos(azRad) * scale;
  return { x, y };
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

  // Renderizar cielo
  renderSky(container, visibleStars, lat, lon, currentTime, true, magLimit, 'barcelona');
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

  // Renderizar cielo
  renderSky(container, visibleStars, lat, lon, currentTime, false, magLimit, 'antipoda');
}

/**
 * Función unificada de renderizado del cielo
 */
function renderSky(container, visibleStars, lat, lon, currentTime, isNorthern, magLimit, label) {
  // Limpiar contenedor
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.overflow = 'hidden';

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

  // Dibujar líneas de constelaciones y recoger centroides para los nombres
  let constellationCentroids = {};
  if (constellationLines) {
    constellationCentroids = drawConstellationLines(svg, constellationLines, lat, lon, currentTime, isNorthern);
  }

  // Crear elementos de estrellas con proyección equidistante azimutal
  for (const star of visibleStars) {
    const { x, y } = azimuthalProject(star.azimuth, star.altitude);

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
    starEl.style.transition = 'opacity 0.3s ease';

    if (star.name) {
      starEl.title = `${star.name} (mag ${star.mag.toFixed(1)})`;
    }

    container.appendChild(starEl);
  }

  // Dibujar nombres de constelaciones
  drawConstellationNames(container, constellationCentroids);

  // Marcas cardinales en el horizonte
  drawCardinalMarks(container);

  // Añadir información del cielo
  const info = document.createElement('div');
  info.className = 'sky-info';
  info.style.position = 'absolute';
  info.style.bottom = '1rem';
  info.style.left = '50%';
  info.style.transform = 'translateX(-50%)';
  info.style.fontSize = 'clamp(0.7rem, 1.5vw, 0.9rem)';
  info.style.color = 'var(--btn-color)';
  info.style.textAlign = 'center';
  info.style.zIndex = '5';
  info.style.pointerEvents = 'none';
  info.style.whiteSpace = 'pre-line';

  info.textContent = [
    `${label} · ${visibleStars.length} estrellas (mag < ${magLimit.toFixed(1)})`,
    `${formatTime(currentTime)}`
  ].join('\n');

  container.appendChild(info);

  // Configurar interactividad de constelaciones
  setupConstellationInteraction(container);
}

/**
 * Dibuja las líneas de constelaciones en el SVG usando proyección azimutal
 * Devuelve un mapa de centroides { id: { name, x, y, pointCount } }
 */
function drawConstellationLines(svg, lines, lat, lon, time, isNorthernHemisphere) {
  const centroids = {};

  for (const constellation of lines) {
    const { geometry, properties } = constellation;
    const cId = properties.id;
    const cName = properties.name;

    if (geometry.type !== 'MultiLineString') continue;

    // Acumular todos los puntos visibles de esta constelación para calcular centroide
    let sumX = 0, sumY = 0, ptCount = 0;

    for (const lineCoords of geometry.coordinates) {
      const points = [];
      let allVisible = true;

      for (const [geoLon, geoLat] of lineCoords) {
        const { ra, dec } = geoJsonToRaDec(geoLon, geoLat);

        if (isNorthernHemisphere && dec < 0) { allVisible = false; break; }
        if (!isNorthernHemisphere && dec > 0) { allVisible = false; break; }

        const coords = calculateHorizontalCoordinates(ra, dec, lat, lon, time);

        if (coords.altitude < 0) { allVisible = false; break; }

        // Usar la misma proyección equidistante azimutal
        const pt = azimuthalProject(coords.azimuth, coords.altitude);
        points.push(pt);
      }

      if (allVisible && points.length >= 2) {
        // Descartar líneas que cruzan el cielo entero (artefacto de wrap-around)
        let hasHugeGap = false;
        for (let i = 1; i < points.length; i++) {
          const dx = points[i].x - points[i - 1].x;
          const dy = points[i].y - points[i - 1].y;
          if (Math.sqrt(dx * dx + dy * dy) > 60) { hasHugeGap = true; break; }
        }
        if (hasHugeGap) continue;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
          d += ` L ${points[i].x} ${points[i].y}`;
        }

        path.setAttribute('d', d);
        path.setAttribute('stroke', 'var(--muted)');
        path.setAttribute('stroke-width', '0.3');
        path.setAttribute('fill', 'none');
        path.setAttribute('opacity', '0.6');
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        path.setAttribute('data-constellation', cId);
        path.classList.add('constellation-line');
        path.style.transition = 'opacity 0.3s ease';

        svg.appendChild(path);

        // Acumular para centroide
        for (const pt of points) {
          sumX += pt.x;
          sumY += pt.y;
          ptCount++;
        }
      }
    }

    // Guardar centroide si hay puntos visibles
    if (ptCount > 0) {
      centroids[cId] = {
        name: cName,
        x: sumX / ptCount,
        y: sumY / ptCount,
        pointCount: ptCount
      };
    }
  }

  return centroids;
}

/**
 * Dibuja los nombres de las constelaciones en sus centroides
 */
function drawConstellationNames(container, centroids) {
  for (const [cId, data] of Object.entries(centroids)) {
    const label = document.createElement('span');
    label.textContent = data.name.toLowerCase();
    label.className = 'constellation-name';
    label.setAttribute('data-constellation', cId);
    label.style.position = 'absolute';
    label.style.left = `${data.x}%`;
    label.style.top = `${data.y}%`;
    label.style.transform = 'translate(-50%, -50%)';
    label.style.fontSize = 'clamp(0.5rem, 1.1vw, 0.75rem)';
    label.style.color = 'var(--muted)';
    label.style.opacity = '0.5';
    label.style.zIndex = '3';
    label.style.pointerEvents = 'auto';
    label.style.cursor = 'pointer';
    label.style.userSelect = 'none';
    label.style.whiteSpace = 'nowrap';
    label.style.letterSpacing = '0.05em';
    label.style.transition = 'opacity 0.3s ease, color 0.3s ease';

    container.appendChild(label);
  }
}

/**
 * Configura la interacción: click en nombre de constelación para destacarla
 */
function setupConstellationInteraction(container) {
  let activeConstellation = null;

  container.addEventListener('click', (e) => {
    const target = e.target;
    const cId = target.getAttribute('data-constellation');

    // Si se clicó en un nombre de constelación
    if (cId && target.classList.contains('constellation-name')) {
      e.stopPropagation();

      // Si ya está activa esta, desactivar
      if (activeConstellation === cId) {
        resetHighlight(container);
        activeConstellation = null;
        return;
      }

      // Activar esta constelación
      activeConstellation = cId;
      highlightConstellation(container, cId);
      return;
    }

    // Click en cualquier otro lugar: resetear
    if (activeConstellation) {
      resetHighlight(container);
      activeConstellation = null;
    }
  });
}

/**
 * Destaca una constelación y atenúa todo lo demás
 */
function highlightConstellation(container, cId) {
  // Atenuar todas las estrellas
  const stars = container.querySelectorAll('.star-point');
  for (const star of stars) {
    star.style.opacity = '0.1';
  }

  // Atenuar todas las líneas de constelación
  const lines = container.querySelectorAll('.constellation-line');
  for (const line of lines) {
    if (line.getAttribute('data-constellation') === cId) {
      line.setAttribute('opacity', '1');
      line.setAttribute('stroke-width', '0.5');
      line.setAttribute('stroke', 'var(--text-color)');
    } else {
      line.setAttribute('opacity', '0.08');
    }
  }

  // Atenuar todos los nombres excepto el activo
  const names = container.querySelectorAll('.constellation-name');
  for (const name of names) {
    if (name.getAttribute('data-constellation') === cId) {
      name.style.opacity = '1';
      name.style.color = 'var(--text-color)';
      name.style.fontSize = 'clamp(0.6rem, 1.4vw, 0.9rem)';
    } else {
      name.style.opacity = '0.1';
    }
  }

  // Atenuar marcas cardinales
  const cardinals = container.querySelectorAll('.cardinal-mark');
  for (const c of cardinals) {
    c.style.opacity = '0.15';
  }
}

/**
 * Resetea el highlighting: vuelve todo a su estado normal
 */
function resetHighlight(container) {
  // Restaurar estrellas
  const stars = container.querySelectorAll('.star-point');
  for (const star of stars) {
    star.style.opacity = '1';
  }

  // Restaurar líneas
  const lines = container.querySelectorAll('.constellation-line');
  for (const line of lines) {
    line.setAttribute('opacity', '0.6');
    line.setAttribute('stroke-width', '0.3');
    line.setAttribute('stroke', 'var(--muted)');
  }

  // Restaurar nombres
  const names = container.querySelectorAll('.constellation-name');
  for (const name of names) {
    name.style.opacity = '0.5';
    name.style.color = 'var(--muted)';
    name.style.fontSize = 'clamp(0.5rem, 1.1vw, 0.75rem)';
  }

  // Restaurar marcas cardinales
  const cardinals = container.querySelectorAll('.cardinal-mark');
  for (const c of cardinals) {
    c.style.opacity = '0.6';
  }
}

/**
 * Dibuja marcas cardinales (N, S, E, O) en el horizonte de la proyección azimutal
 */
function drawCardinalMarks(container) {
  const cardinals = [
    { label: 'N', azimuth: 0 },
    { label: 'E', azimuth: 90 },
    { label: 'S', azimuth: 180 },
    { label: 'O', azimuth: 270 }
  ];

  for (const c of cardinals) {
    const { x, y } = azimuthalProject(c.azimuth, 0);
    const mark = document.createElement('span');
    mark.textContent = c.label;
    mark.className = 'cardinal-mark';
    mark.style.position = 'absolute';
    mark.style.left = `${x}%`;
    mark.style.top = `${y}%`;
    mark.style.fontSize = 'clamp(0.7rem, 1.5vw, 1rem)';
    mark.style.color = 'var(--btn-color)';
    mark.style.transform = 'translate(-50%, -50%)';
    mark.style.zIndex = '4';
    mark.style.pointerEvents = 'none';
    mark.style.fontWeight = 'bold';
    mark.style.opacity = '0.6';
    mark.style.transition = 'opacity 0.3s ease';
    container.appendChild(mark);
  }
}

/**
 * Formatea el tiempo para mostrar
 */
function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
