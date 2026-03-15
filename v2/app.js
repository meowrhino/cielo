/**
 * App principal — carga de datos, estado, loop de actualización
 */
import { parseTime } from './astronomy.js';
import { createAstrolabe } from './astrolabe.js';
import { setupInteraction } from './interaction.js';
import { renderSunView, renderMoonView, renderConstellationView } from './views.js';

const BARCELONA = { name: 'barcelona', lat: 41.3851, lon: 2.1734, label: '41.4°N · 2.2°E' };
const ANTIPODA = { name: 'antípoda', lat: -41.3851, lon: 182.1734, label: '41.4°S · 177.8°E' };

// Estado
let sunDataAll = null;
let moonDataAll = null;
let starCatalog = null;
let constellationLines = null;
let astrolabe = null;

let face = BARCELONA; // cara actual del astrolabio
let mode = 'astrolabe'; // 'astrolabe' | 'detail'
let detailTarget = null; // { type, data } del objeto seleccionado

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

  // Si estamos en detail mode, re-renderizar la vista
  if (mode === 'detail' && detailTarget) {
    renderDetailView(now, state);
  }
}

function renderDetailView(now, state) {
  const container = document.getElementById('detail-content');
  if (!container || !detailTarget) return;

  switch (detailTarget.type) {
    case 'sun':
      renderSunView(container, state.sunData, now);
      break;
    case 'moon':
      renderMoonView(container, state.moonData, now);
      break;
    case 'constellation':
      renderConstellationView(container, detailTarget.data, starCatalog, constellationLines, face.lat, face.lon, now);
      break;
  }
}

/**
 * Entra en modo detail: astrolabio se encoge, vista aparece
 */
function enterDetail(target) {
  mode = 'detail';
  detailTarget = target;

  const wrapper = document.getElementById('astrolabe-wrapper');
  const detailView = document.getElementById('detail-view');

  wrapper.classList.add('minimap');
  detailView.classList.remove('hidden');
  document.body.classList.add('detail-mode');

  // Re-render astrolabio en tamaño minimap
  setTimeout(() => {
    astrolabe.resize();
    render();
  }, 50);
}

/**
 * Vuelve al astrolabio fullscreen
 */
function exitDetail() {
  mode = 'astrolabe';
  detailTarget = null;

  const wrapper = document.getElementById('astrolabe-wrapper');
  const detailView = document.getElementById('detail-view');

  detailView.classList.add('hidden');
  document.body.classList.remove('detail-mode');
  wrapper.classList.remove('minimap');

  // Wait for CSS transition to finish before resizing
  setTimeout(() => {
    astrolabe.resize();
    render();
  }, 550);
}

/**
 * Flip del astrolabio: Barcelona ↔ antípoda
 */
function flipAstrolabe() {
  const wrapper = document.getElementById('astrolabe-wrapper');
  wrapper.classList.add('flipping');

  setTimeout(() => {
    face = face === BARCELONA ? ANTIPODA : BARCELONA;
    render();
  }, 250); // Mitad de la animación (cuando scaleY=0)

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
      if (target.type === 'sun' || target.type === 'moon' || target.type === 'constellation') {
        enterDetail(target);
      }
    }
  });

  // Minimap click → volver a fullscreen
  const wrapper = document.getElementById('astrolabe-wrapper');
  wrapper.addEventListener('click', (e) => {
    if (mode === 'detail') {
      e.stopPropagation();
      exitDetail();
    }
  });

  // Detail view click en vacío → volver
  const detailView = document.getElementById('detail-view');
  detailView.addEventListener('click', (e) => {
    if (e.target === detailView || e.target === document.getElementById('detail-content')) {
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
