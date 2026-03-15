/**
 * App principal — carga de datos, estado, loop de actualización
 */
import { parseTime, azimuthalProject, equatorialToHorizontal, geoJsonToRaDec, computeSunPosition, computeMoonPosition } from './astronomy.js';
import { createAstrolabe } from './astrolabe.js';
import { setupInteraction } from './interaction.js';
import { computePlanetPositions } from './planets.js';

const BARCELONA = { name: 'barcelona', lat: 41.3851, lon: 2.1734, label: '41.4°N · 2.2°E' };

// Visual modes (cycle with mode button)
const MODES = ['normal', 'noche', 'cálido', 'frío', 'verde'];
const MODE_CLASSES = { normal: '', noche: 'night-mode', 'cálido': 'warm-mode', 'frío': 'blue-mode', verde: 'green-mode' };

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
let menuOpen = false;

// Visual mode
let currentModeIndex = parseInt(localStorage.getItem('cielo-mode') || '0', 10);
if (currentModeIndex >= MODES.length) currentModeIndex = 0;

// Magnitude limit (light pollution)
let magLimit = parseFloat(localStorage.getItem('cielo-mag') || '6');


// Tooltip
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
    sunPosition: computeSunPosition(now),
    moonPosition: computeMoonPosition(now),
    starCatalog,
    constellationLines,
    planets: computePlanetPositions(now),
    lat: face.lat,
    lon: face.lon,
    isDaytime: daytime,
    magLimit
  };
}

function render() {
  const now = new Date();
  const state = getState(now);
  updateInfoOverlays(now, state.sunData, state.moonData);
  if (astrolabe) astrolabe.render(now, state);
}

// === Zoom ===

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

  if (target.type === 'sun') {
    const sunPos = computeSunPosition(now);
    const { azimuth, altitude } = equatorialToHorizontal(sunPos.ra, sunPos.dec, face.lat, face.lon, now);
    if (altitude > -5) {
      const proj = azimuthalProject(azimuth, Math.max(altitude, 0));
      return { nx: proj.x, ny: proj.y };
    }
  }

  if (target.type === 'moon') {
    const moonPos = computeMoonPosition(now);
    const { azimuth, altitude } = equatorialToHorizontal(moonPos.ra, moonPos.dec, face.lat, face.lon, now);
    if (altitude > 0) {
      const proj = azimuthalProject(azimuth, altitude);
      return { nx: proj.x, ny: proj.y };
    }
  }

  if (target.type === 'planet') {
    const az = parseFloat(target.data.azimuth);
    const alt = parseFloat(target.data.altitude);
    if (alt > 0) {
      const proj = azimuthalProject(az, alt);
      return { nx: proj.x, ny: proj.y };
    }
  }

  return { nx: 0, ny: 0 };
}

function getTargetName(target) {
  if (target.type === 'sun') return 'sol';
  if (target.type === 'moon') return 'luna';
  if (target.type === 'constellation') return target.data.name.toLowerCase();
  if (target.type === 'planet') return target.data.label || target.data.name;
  if (target.type === 'star') return target.data.name ? target.data.name.toLowerCase() : '';
  return '';
}

function enterDetail(target) {
  hideTooltip();
  closeAllPanels();
  const wasInDetail = mode === 'detail';
  mode = 'detail';
  detailTarget = target;

  const now = new Date();
  const { nx, ny } = getZoomCenter(target, now);

  astrolabe.zoomTo(nx, ny, 4, wasInDetail ? 350 : 500);

  const detailView = document.getElementById('detail-view');
  const label = document.getElementById('detail-label');
  label.textContent = getTargetName(target);
  label.style.opacity = '';
  detailView.classList.remove('hidden');
  document.body.classList.add('detail-mode');

  startAnimLoop();
}

function exitDetail() {
  mode = 'astrolabe';
  detailTarget = null;

  document.getElementById('detail-view').classList.add('hidden');
  document.body.classList.remove('detail-mode');

  astrolabe.zoomReset(400);
  startAnimLoop();
}

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

// === Tooltip ===

function showTooltip(target) {
  hideTooltip();
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;

  let text = '';
  if (target.type === 'star') {
    text = `${target.data.name || '?'} · mag ${target.data.mag.toFixed(1)}`;
  } else if (target.type === 'planet') {
    text = `${target.data.label} · mag ${target.data.magnitude.toFixed(1)}`;
  }
  if (!text) return;

  tooltip.textContent = text;
  tooltip.classList.remove('hidden');

  const maxX = window.innerWidth - 180;
  const maxY = window.innerHeight - 40;
  tooltip.style.left = Math.min(target.px + 10, maxX) + 'px';
  tooltip.style.top = Math.min(target.py - 40, maxY) + 'px';

  tooltipTimer = setTimeout(hideTooltip, 3000);
}

function hideTooltip() {
  if (tooltipTimer) { clearTimeout(tooltipTimer); tooltipTimer = null; }
  const tooltip = document.getElementById('tooltip');
  if (tooltip) tooltip.classList.add('hidden');
}

// === Menu system ===

function toggleMenu() {
  menuOpen ? closeAllPanels() : openMenu();
}

function openMenu() {
  menuOpen = true;
  document.body.classList.add('menu-open');
  document.getElementById('menu-bar').classList.remove('hidden');
}

function closeAllPanels() {
  menuOpen = false;
  document.body.classList.remove('menu-open');
  document.getElementById('menu-bar').classList.add('hidden');
  document.getElementById('info-panel').classList.add('hidden');
  document.getElementById('tema-modal').classList.add('hidden');
}

function togglePanel(panelId) {
  const panel = document.getElementById(panelId);
  const otherPanels = ['info-panel', 'tema-modal'].filter(id => id !== panelId);
  otherPanels.forEach(id => document.getElementById(id).classList.add('hidden'));
  panel.classList.toggle('hidden');
}

// === Visual modes ===

function applyMode() {
  for (const cls of Object.values(MODE_CLASSES)) {
    if (cls) document.body.classList.remove(cls);
  }
  const cls = MODE_CLASSES[MODES[currentModeIndex]];
  if (cls) document.body.classList.add(cls);

  // Update active state in tema modal
  document.querySelectorAll('.tema-option').forEach((btn, i) => {
    btn.classList.toggle('active', i === currentModeIndex);
  });

  localStorage.setItem('cielo-mode', String(currentModeIndex));
  render();
}

function setMode(index) {
  currentModeIndex = index;
  applyMode();
}

// === Flip ===

function flipAstrolabe() {
  if (mode === 'detail') return;
  closeAllPanels();

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
  }, 270);

  setTimeout(() => wrapper.classList.remove('flipping'), 600);
}

// === Geolocation ===

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
    () => { if (nameEl) nameEl.textContent = face.name; },
    { timeout: 8000 }
  );
}

// === Center / reset view ===

function centerView() {
  closeAllPanels();
  if (mode === 'detail') exitDetail();
  astrolabe.zoomReset(400);
  startAnimLoop();
}

// === Init ===

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
      closeAllPanels();
      if (target.type === 'star') {
        showTooltip(target);
      } else if (target.type === 'planet') {
        showTooltip(target);
        enterDetail(target);
      } else if (target.type === 'sun' || target.type === 'moon' || target.type === 'constellation') {
        enterDetail(target);
      }
    },
    onPan: () => {
      hideTooltip();
      closeAllPanels();
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

  // Menu tab — toggle menu
  document.getElementById('menu-tab').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  // Menu bar buttons
  document.getElementById('info-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel('info-panel');
  });

  document.getElementById('ubi-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    requestGeolocation();
  });

  document.getElementById('tema-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel('tema-modal');
  });

  document.getElementById('vuelta-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    flipAstrolabe();
  });

  document.getElementById('center-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    centerView();
  });

  // Magnitude slider
  const magSlider = document.getElementById('mag-slider');
  const magLabel = document.getElementById('mag-label');
  magSlider.value = magLimit;
  magLabel.textContent = `mag ${magLimit}`;
  magSlider.addEventListener('input', (e) => {
    magLimit = parseFloat(e.target.value);
    magLabel.textContent = `mag ${magLimit}`;
    localStorage.setItem('cielo-mag', String(magLimit));
    render();
  });

  // Tema modal buttons
  document.querySelectorAll('.tema-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setMode(parseInt(btn.dataset.tema, 10));
    });
  });

  // Close panels when tapping canvas
  canvas.addEventListener('mousedown', () => { if (menuOpen) closeAllPanels(); });
  canvas.addEventListener('touchstart', () => { if (menuOpen) closeAllPanels(); }, { passive: true });

  // Apply saved mode
  applyMode();

  // Geolocation
  requestGeolocation();

  // Render
  render();
  setInterval(render, 30000);

  window.addEventListener('resize', () => {
    astrolabe.resize();
    render();
  });
}

init();
