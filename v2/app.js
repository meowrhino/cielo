/**
 * App principal — carga de datos, estado, loop de actualización
 */
import { parseTime, azimuthalProject, equatorialToHorizontal, geoJsonToRaDec, interpolateHourly } from './astronomy.js';
import { createAstrolabe } from './astrolabe.js';
import { setupInteraction } from './interaction.js';
import { sunPoetry, moonPoetry, constellationPoetry } from './poetry.js';

const BARCELONA = { name: 'barcelona', lat: 41.3851, lon: 2.1734, label: '41.4°N · 2.2°E' };
const ANTIPODA = { name: 'antípoda', lat: -41.3851, lon: 182.1734, label: '41.4°S · 177.8°E' };

// Estado
let sunDataAll = null;
let moonDataAll = null;
let starCatalog = null;
let constellationLines = null;
let astrolabe = null;

let face = BARCELONA;
let mode = 'astrolabe'; // 'astrolabe' | 'detail'
let detailTarget = null;
let animFrameId = null;

function getDateKey(date) {
  return date.toISOString().split('T')[0];
}

function findDayData(allData, dateKey) {
  return allData ? allData.find(d => d.date === dateKey) : null;
}

function isDaytime(sunData, now) {
  if (!sunData) return true;
  const t = now.getHours() + now.getMinutes() / 60;
  return t >= parseTime(sunData.sunrise) && t < parseTime(sunData.sunset);
}

function updateInfoOverlays(now, sunData, moonData) {
  const timeEl = document.getElementById('time-display');
  const dateEl = document.getElementById('date-display');
  if (timeEl) timeEl.textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if (dateEl) dateEl.textContent = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  const sunEl = document.getElementById('sun-info');
  if (sunEl && sunData) sunEl.textContent = `sol ↑ ${sunData.sunrise} ↓ ${sunData.sunset}`;

  const moonEl = document.getElementById('moon-info');
  if (moonEl && moonData) moonEl.textContent = `luna · ${moonData.phaseName} · ${moonData.illumination}%`;

  const nameEl = document.getElementById('location-name');
  const coordsEl = document.getElementById('location-coords');
  if (nameEl) nameEl.textContent = face.name;
  if (coordsEl) coordsEl.textContent = face.label;
}

async function loadData() {
  const [sunRes, moonRes, starRes, constRes] = await Promise.all([
    fetch('../data/sun/barcelona.json'),
    fetch('../data/moon/barcelona.json'),
    fetch('../data/stars/catalog.json'),
    fetch('../data/constellations-lines.json')
  ]);

  sunDataAll = await sunRes.json();
  moonDataAll = await moonRes.json();
  starCatalog = await starRes.json();
  const constData = await constRes.json();
  constellationLines = constData.features;
}

function getState(now) {
  const dateKey = getDateKey(now);
  const sunData = findDayData(sunDataAll, dateKey);
  const moonData = findDayData(moonDataAll, dateKey);
  const daytime = isDaytime(sunData, now);

  return {
    sunData,
    moonData,
    starCatalog,
    constellationLines,
    lat: face.lat,
    lon: face.lon,
    isDaytime: daytime
  };
}

function render() {
  const now = new Date();
  const state = getState(now);

  updateInfoOverlays(now, state.sunData, state.moonData);

  if (astrolabe) {
    astrolabe.render(now, state);
  }
}

/**
 * Calcula el centro de zoom (en coordenadas normalizadas) para un target
 */
function getZoomCenter(target, now) {
  const state = getState(now);

  if (target.type === 'constellation') {
    const constellation = constellationLines.find(c => c.properties.id === target.data.id);
    if (!constellation) return { nx: 0, ny: 0 };

    let sumX = 0, sumY = 0, count = 0;
    for (const lineCoords of constellation.geometry.coordinates) {
      for (const [geoLon, geoLat] of lineCoords) {
        const { ra, dec } = geoJsonToRaDec(geoLon, geoLat);
        const { azimuth, altitude } = equatorialToHorizontal(ra, dec, face.lat, face.lon, now);
        if (altitude > 0) {
          const proj = azimuthalProject(azimuth, altitude);
          sumX += proj.x;
          sumY += proj.y;
          count++;
        }
      }
    }
    return count > 0 ? { nx: sumX / count, ny: sumY / count } : { nx: 0, ny: 0 };
  }

  if (target.type === 'sun' && state.sunData) {
    const pos = interpolateHourly(state.sunData.hourlyData, now);
    if (pos && pos.isVisible) {
      const proj = azimuthalProject(pos.azimuth, pos.altitude);
      return { nx: proj.x, ny: proj.y };
    }
  }

  if (target.type === 'moon' && state.moonData) {
    const pos = interpolateHourly(state.moonData.hourlyData, now);
    if (pos && pos.altitude > 0) {
      const proj = azimuthalProject(pos.azimuth, pos.altitude);
      return { nx: proj.x, ny: proj.y };
    }
  }

  return { nx: 0, ny: 0 };
}

/**
 * Genera las líneas de poesía para el target
 */
function getPoetryLines(target, now) {
  const state = getState(now);

  if (target.type === 'sun') {
    return sunPoetry(state.sunData, now);
  }
  if (target.type === 'moon') {
    return moonPoetry(state.moonData, now);
  }
  if (target.type === 'constellation') {
    const az = parseFloat(target.data.azimuth || 0);
    const alt = parseFloat(target.data.altitude || 0);
    // Recalcular centroide
    const constellation = constellationLines.find(c => c.properties.id === target.data.id);
    if (constellation) {
      let sumAz = 0, sumAlt = 0, count = 0;
      for (const lineCoords of constellation.geometry.coordinates) {
        for (const [geoLon, geoLat] of lineCoords) {
          const { ra, dec } = geoJsonToRaDec(geoLon, geoLat);
          const { azimuth, altitude } = equatorialToHorizontal(ra, dec, face.lat, face.lon, now);
          if (altitude > 0) { sumAz += azimuth; sumAlt += altitude; count++; }
        }
      }
      if (count > 0) {
        return constellationPoetry(target.data.name, sumAz / count, sumAlt / count);
      }
    }
    return constellationPoetry(target.data.name, az, alt);
  }

  return [];
}

/**
 * Entra en modo detail: zoom en la zona del cielo
 */
function enterDetail(target) {
  mode = 'detail';
  detailTarget = target;

  const now = new Date();
  const { nx, ny } = getZoomCenter(target, now);

  // Zoom al punto
  astrolabe.zoomTo(nx, ny, 4, 500);

  // Mostrar overlay con nombre y poesía
  const detailView = document.getElementById('detail-view');
  const label = document.getElementById('detail-label');
  const poetry = document.getElementById('detail-poetry');

  const lines = getPoetryLines(target, now);
  label.textContent = lines[0] || target.data.name || '';
  poetry.innerHTML = lines.slice(1).map(l => `<div class="detail-line">${l}</div>`).join('');

  detailView.classList.remove('hidden');
  document.body.classList.add('detail-mode');

  // Animar render durante el zoom
  startAnimLoop();
}

/**
 * Vuelve al astrolabio fullscreen
 */
function exitDetail() {
  mode = 'astrolabe';
  detailTarget = null;

  const detailView = document.getElementById('detail-view');
  detailView.classList.add('hidden');
  document.body.classList.remove('detail-mode');

  astrolabe.zoomReset(400);
  startAnimLoop();
}

/**
 * Loop de animación durante zooms
 */
function startAnimLoop() {
  if (animFrameId) return;

  function animStep() {
    const stillAnimating = astrolabe.updateZoom();
    render();

    if (stillAnimating) {
      animFrameId = requestAnimationFrame(animStep);
    } else {
      animFrameId = null;
    }
  }

  animFrameId = requestAnimationFrame(animStep);
}

/**
 * Flip del astrolabio: Barcelona ↔ antípoda
 */
function flipAstrolabe() {
  if (mode === 'detail') return; // No flipear durante zoom

  const wrapper = document.getElementById('astrolabe-wrapper');
  wrapper.classList.add('flipping');

  setTimeout(() => {
    face = face === BARCELONA ? ANTIPODA : BARCELONA;
    render();
  }, 250);

  setTimeout(() => {
    wrapper.classList.remove('flipping');
  }, 500);
}

async function init() {
  try {
    await loadData();
  } catch (e) {
    console.error('Error cargando datos:', e);
    return;
  }

  const canvas = document.getElementById('astrolabe');
  astrolabe = createAstrolabe(canvas);

  setupInteraction(canvas, astrolabe, {
    onSelect: (target) => {
      if (mode === 'detail') {
        // Ya en zoom — salir
        exitDetail();
        return;
      }
      if (target.type === 'sun' || target.type === 'moon' || target.type === 'constellation') {
        enterDetail(target);
      }
    }
  });

  // Click en canvas sin hit → si estamos en zoom, salir
  canvas.addEventListener('click', (e) => {
    if (mode === 'detail') {
      // El interaction.js ya maneja hits. Si llegamos aquí, no hubo hit.
      exitDetail();
    }
  });

  // Flip button
  document.getElementById('flip-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    flipAstrolabe();
  });

  // Render inicial
  render();

  // Actualizar cada 30 segundos
  setInterval(render, 30000);

  // Resize
  window.addEventListener('resize', () => {
    astrolabe.resize();
    render();
  });
}

init();
