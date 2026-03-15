/**
 * App principal — carga de datos, estado, loop de actualización
 */
import { parseTime } from './astronomy.js';
import { createAstrolabe } from './astrolabe.js';
import { setupInteraction } from './interaction.js';

const LAT = 41.3851;
const LON = 2.1734;

// Estado
let sunDataAll = null;
let moonDataAll = null;
let starCatalog = null;
let constellationLines = null;
let astrolabe = null;

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

function updateInfoOverlays(now, sunData, moonData, daytime) {
  // Time
  const timeEl = document.getElementById('time-display');
  const dateEl = document.getElementById('date-display');
  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Sun info
  const sunEl = document.getElementById('sun-info');
  if (sunEl && sunData) {
    sunEl.textContent = `sol ↑ ${sunData.sunrise} ↓ ${sunData.sunset}`;
  }

  // Moon info
  const moonEl = document.getElementById('moon-info');
  if (moonEl && moonData) {
    moonEl.textContent = `luna · ${moonData.phaseName} · ${moonData.illumination}%`;
  }
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

function render() {
  const now = new Date();
  const dateKey = getDateKey(now);
  const sunData = findDayData(sunDataAll, dateKey);
  const moonData = findDayData(moonDataAll, dateKey);
  const daytime = isDaytime(sunData, now);

  updateInfoOverlays(now, sunData, moonData, daytime);

  if (astrolabe) {
    astrolabe.render(now, {
      sunData,
      moonData,
      starCatalog,
      constellationLines,
      lat: LAT,
      lon: LON,
      isDaytime: daytime
    });
  }
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

  setupInteraction(canvas, astrolabe);

  // Render inicial
  render();

  // Actualizar cada 30 segundos
  setInterval(render, 30000);

  // Re-render on resize
  window.addEventListener('resize', () => {
    astrolabe.resize();
    render();
  });
}

init();
