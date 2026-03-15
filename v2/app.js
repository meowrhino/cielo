/**
 * App principal — carga de datos, estado, loop de actualización
 */
import { parseTime, azimuthalProject, equatorialToHorizontal, geoJsonToRaDec, interpolateHourly } from './astronomy.js';
import { createAstrolabe } from './astrolabe.js';
import { setupInteraction } from './interaction.js';
import { computePlanetPositions } from './planets.js';

const BARCELONA = { name: 'barcelona', lat: 41.3851, lon: 2.1734, label: '41.4°N · 2.2°E' };

// Estado
let sunDataAll = null;
let moonDataAll = null;
let starCatalog = null;
let constellationLines = null;
let astrolabe = null;

let face = { ...BARCELONA };
let mode = 'astrolabe'; // 'astrolabe' | 'detail'
let detailTarget = null;
let animFrameId = null;
let nightMode = localStorage.getItem('cielo-night') === '1';

// AR state
let arMode = false;
let arSmoothed = { alpha: 0, beta: 0 };
let arFrameId = null;

// Tooltip state
let tooltipTimer = null;

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

function formatCoords(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(1)}°${ns} · ${Math.abs(lon).toFixed(1)}°${ew}`;
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
    planets: computePlanetPositions(now),
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

  if (target.type === 'planet') {
    const { azimuth, altitude } = equatorialToHorizontal(
      target.data.ra || 0, target.data.dec || 0, face.lat, face.lon, now
    );
    if (altitude > 0) {
      const proj = azimuthalProject(azimuth, altitude);
      return { nx: proj.x, ny: proj.y };
    }
  }

  return { nx: 0, ny: 0 };
}

/**
 * Nombre legible del target
 */
function getTargetName(target) {
  if (target.type === 'sun') return 'sol';
  if (target.type === 'moon') return 'luna';
  if (target.type === 'constellation') return target.data.name.toLowerCase();
  if (target.type === 'planet') return target.data.label || target.data.name;
  if (target.type === 'star') return target.data.name ? target.data.name.toLowerCase() : '';
  return '';
}

/**
 * Muestra tooltip cerca del objeto tocado
 */
function showTooltip(target, clientX, clientY) {
  hideTooltip();

  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;

  let text = '';
  if (target.type === 'star') {
    const name = target.data.name || '?';
    text = `${name} · mag ${target.data.mag.toFixed(1)}`;
  } else if (target.type === 'planet') {
    text = `${target.data.label} · mag ${target.data.magnitude.toFixed(1)}`;
  }

  if (!text) return;

  tooltip.textContent = text;
  tooltip.classList.remove('hidden');

  // Posicionar cerca del tap
  const maxX = window.innerWidth - 180;
  const maxY = window.innerHeight - 40;
  tooltip.style.left = Math.min(clientX + 10, maxX) + 'px';
  tooltip.style.top = Math.min(clientY - 40, maxY) + 'px';

  tooltipTimer = setTimeout(hideTooltip, 3000);
}

function hideTooltip() {
  if (tooltipTimer) { clearTimeout(tooltipTimer); tooltipTimer = null; }
  const tooltip = document.getElementById('tooltip');
  if (tooltip) tooltip.classList.add('hidden');
}

/**
 * Entra o cambia de zoom
 */
function enterDetail(target) {
  hideTooltip();
  const wasInDetail = mode === 'detail';
  mode = 'detail';
  detailTarget = target;

  const now = new Date();
  const { nx, ny } = getZoomCenter(target, now);

  // Zoom al punto (más rápido si ya estamos en zoom)
  astrolabe.zoomTo(nx, ny, 4, wasInDetail ? 350 : 500);

  // Mostrar nombre watermark (solo nombre, sin texto poético)
  const detailView = document.getElementById('detail-view');
  const label = document.getElementById('detail-label');

  label.textContent = getTargetName(target);
  label.style.opacity = '';
  detailView.classList.remove('hidden');
  document.body.classList.add('detail-mode');

  startAnimLoop();
}

/**
 * Vuelve al astrolabio
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
 * Loop de animación durante zooms y panning
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
 * Flip del astrolabio: cara actual ↔ antípoda
 */
function flipAstrolabe() {
  if (mode === 'detail') return;

  const wrapper = document.getElementById('astrolabe-wrapper');
  wrapper.classList.add('flipping');

  setTimeout(() => {
    face = {
      name: face.name === 'antípoda' ? (face._originalName || 'barcelona') : 'antípoda',
      lat: -face.lat,
      lon: ((face.lon + 180) % 360),
      label: formatCoords(-face.lat, (face.lon + 180) % 360),
      _originalName: face.name === 'antípoda' ? face._originalName : face.name
    };
    render();
  }, 250);

  setTimeout(() => {
    wrapper.classList.remove('flipping');
  }, 500);
}

/**
 * Intenta obtener la ubicación del usuario
 */
function requestGeolocation() {
  if (!navigator.geolocation) return;

  const nameEl = document.getElementById('location-name');
  if (nameEl) nameEl.textContent = 'buscando...';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      face = {
        name: 'tu cielo',
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        label: formatCoords(pos.coords.latitude, pos.coords.longitude)
      };
      render();
    },
    () => {
      if (nameEl) nameEl.textContent = face.name;
    },
    { timeout: 8000 }
  );
}

/**
 * Toggle modo noche (rojo)
 */
function toggleNightMode() {
  nightMode = !nightMode;
  document.body.classList.toggle('night-mode', nightMode);
  localStorage.setItem('cielo-night', nightMode ? '1' : '0');
  render();
}

/**
 * Modo AR — usa sensores del dispositivo para apuntar al cielo
 */
function toggleAR() {
  if (arMode) {
    stopAR();
    return;
  }

  // iOS requiere permiso explícito
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then(state => { if (state === 'granted') startAR(); })
      .catch(() => {});
  } else if ('DeviceOrientationEvent' in window) {
    startAR();
  }
}

function startAR() {
  arMode = true;
  document.body.classList.add('ar-mode');

  const arLabel = document.getElementById('ar-label');
  const timeEl = document.getElementById('time-display');
  const dateEl = document.getElementById('date-display');
  if (arLabel) arLabel.classList.remove('hidden');
  if (timeEl) timeEl.classList.add('hidden');
  if (dateEl) dateEl.classList.add('hidden');

  // Zoom a 2x para vista parcial
  astrolabe.zoomTo(0, 0, 2, 300);
  startAnimLoop();

  window.addEventListener('deviceorientation', onDeviceOrientation);
  arFrameId = requestAnimationFrame(arLoop);
}

function stopAR() {
  arMode = false;
  document.body.classList.remove('ar-mode');

  const arLabel = document.getElementById('ar-label');
  const timeEl = document.getElementById('time-display');
  const dateEl = document.getElementById('date-display');
  if (arLabel) arLabel.classList.add('hidden');
  if (timeEl) timeEl.classList.remove('hidden');
  if (dateEl) dateEl.classList.remove('hidden');

  window.removeEventListener('deviceorientation', onDeviceOrientation);
  if (arFrameId) { cancelAnimationFrame(arFrameId); arFrameId = null; }

  astrolabe.zoomReset(300);
  startAnimLoop();
}

function onDeviceOrientation(e) {
  // alpha: compass heading (0-360), beta: tilt front/back (-180..180), gamma: tilt left/right
  let alpha = e.alpha || 0;
  // webkitCompassHeading es más preciso en iOS
  if (e.webkitCompassHeading != null) alpha = e.webkitCompassHeading;

  const beta = e.beta || 0;

  // Low-pass filter
  arSmoothed.alpha = arSmoothed.alpha * 0.8 + alpha * 0.2;
  arSmoothed.beta = arSmoothed.beta * 0.8 + beta * 0.2;
}

function arLoop() {
  if (!arMode) return;

  // Convertir orientación del dispositivo a coordenadas del cielo
  // beta ~90 = horizontal (horizonte), beta ~0 = vertical (cénit)
  const azimuth = arSmoothed.alpha;
  const altitude = Math.max(0, Math.min(90, 90 - arSmoothed.beta));

  // Proyectar a coordenadas normalizadas
  const proj = azimuthalProject(azimuth, altitude);
  astrolabe.setViewCenter(proj.x, proj.y);
  render();

  arFrameId = requestAnimationFrame(arLoop);
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
      hideTooltip();
      if (target.type === 'star') {
        // Estrellas: mostrar tooltip, no zoom
        showTooltip(target, target.px, target.py);
      } else if (target.type === 'planet') {
        // Planetas: tooltip + zoom
        showTooltip(target, target.px, target.py);
        enterDetail(target);
      } else if (target.type === 'sun' || target.type === 'moon' || target.type === 'constellation') {
        enterDetail(target);
      }
    },
    onPan: () => {
      hideTooltip();
      const label = document.getElementById('detail-label');
      if (label) label.style.opacity = '0';
      render();
    }
  });

  // Back button
  document.getElementById('back-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    exitDetail();
  });

  // Flip button
  document.getElementById('flip-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    flipAstrolabe();
  });

  // Night mode button
  document.getElementById('night-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleNightMode();
  });

  // Location button (click on top-right info)
  document.getElementById('info-tr').addEventListener('click', () => {
    requestGeolocation();
  });

  // AR toggle (click on top-left info)
  document.getElementById('info-tl').addEventListener('click', () => {
    toggleAR();
  });

  // Aplicar modo noche guardado
  if (nightMode) document.body.classList.add('night-mode');

  // Pedir geolocalización
  requestGeolocation();

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
