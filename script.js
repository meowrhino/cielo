// Importar módulos de renderizado
import { renderSunEast, renderSunWest } from './modules/sun-renderer-v2.js';
import { renderMoonPosition, renderMoonPhase } from './modules/moon-renderer-v2.js';
import { renderNightSkyBarcelona, renderNightSkyAntipode, loadConstellationLines } from './modules/sky-renderer-v2.js';

// Referencia al contenedor principal
const app = document.getElementById("content");

// Configuración de Barcelona
const CONFIG = {
  location: {
    name: "Barcelona",
    lat: 41.3851,
    lon: 2.1734
  }
};

// Definimos la cuadrícula (1 = pantalla activa, 0 = hueco)
const grid = [
  [0, 1, 0], // norte
  [1, 1, 1], // oeste, centro, este
  [0, 1, 0], // sur
];

// Mapa de coordenadas → nombre de panel
const nombresEspeciales = {
  "0_1": "norte",
  "1_0": "oeste",
  "1_1": "centro",
  "1_2": "este",
  "2_1": "sur",
};

// Posición inicial (centro)
let posY = 1;
let posX = 1;

// Estado global
let isDaytime = true;
let currentSunData = null;
let currentMoonData = null;
let starCatalog = null;
let currentTime = new Date();
const DEBUG_TIME = new Date(2025, 11, 28, 8, 4, 0); // new Date(2025, 11, 28, 8, 4, 0)
const DEFAULT_SUN_RANGE_DEG = 90;
const DEFAULT_STAR_MAG_LIMIT = 6;
let debugReadout = null;
let sunDataAll = null;
let moonDataAll = null;
let currentDateKey = null;

if (globalThis.CIELO_SUN_RANGE_DEG == null) {
  globalThis.CIELO_SUN_RANGE_DEG = DEFAULT_SUN_RANGE_DEG;
}

if (globalThis.CIELO_STAR_MAG_LIMIT == null) {
  globalThis.CIELO_STAR_MAG_LIMIT = DEFAULT_STAR_MAG_LIMIT;
}

function getNow() {
  return DEBUG_TIME ? new Date(DEBUG_TIME) : new Date();
}

function getDateKey(date) {
  return date.toISOString().split('T')[0];
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDebugDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatDebugTime(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function setSunRangeDeg(value) {
  if (!Number.isFinite(value) || value <= 0) return;
  globalThis.CIELO_SUN_RANGE_DEG = value;
}

function setStarMagLimit(value) {
  if (!Number.isFinite(value)) return;
  globalThis.CIELO_STAR_MAG_LIMIT = value;
}

function setDebugDate(dateString) {
  if (!DEBUG_TIME || !dateString) return;
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return;
  DEBUG_TIME.setFullYear(year, month - 1, day);
}

function syncCurrentDataForDate(dateKey) {
  if (sunDataAll) {
    currentSunData = sunDataAll.find(d => d.date === dateKey) || null;
  }

  if (moonDataAll) {
    currentMoonData = moonDataAll.find(d => d.date === dateKey) || null;
  }

  currentDateKey = dateKey;
}

function updateDebugReadout() {
  if (!debugReadout) return;
  const parts = [
    `${formatDebugDate(currentTime)} ${formatDebugTime(currentTime)}`,
    `key ${getDateKey(currentTime)}`
  ];

  parts.push(isDaytime ? 'dia' : 'noche');

  if (currentSunData) {
    parts.push(`sunrise ${currentSunData.sunrise}`);
    parts.push(`sunset ${currentSunData.sunset}`);

    const hour = currentTime.getHours();
    const hourData = currentSunData.hourlyData.find(h => h.hour === hour);
    if (hourData) {
      parts.push(`az ${hourData.azimuth}`);
      parts.push(`alt ${hourData.altitude}`);
      parts.push(`vis ${hourData.isVisible}`);
    }
  }

  parts.push(`range ${globalThis.CIELO_SUN_RANGE_DEG}deg`);
  parts.push(`mag ${globalThis.CIELO_STAR_MAG_LIMIT}`);
  debugReadout.textContent = parts.join(' | ');
}

function setDebugTime(hours, minutes) {
  if (!DEBUG_TIME) return;
  DEBUG_TIME.setHours(hours, minutes, 0, 0);
}

function getDataDateRange() {
  if (!sunDataAll || sunDataAll.length === 0) return null;
  return {
    min: sunDataAll[0].date,
    max: sunDataAll[sunDataAll.length - 1].date
  };
}

function setupDebugControls() {
  if (!DEBUG_TIME) return;

  const container = document.createElement("div");
  container.style.cssText = [
    "position: fixed",
    "top: 2rem",
    "right: 2rem",
    "z-index: 1000",
    "background: rgba(0, 0, 0, 0.85)",
    "color: #f2f2f2",
    "border: 1px solid #444",
    "border-radius: 8px",
    "padding: 10px 12px",
    "font-family: \"Courier Prime\", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
    "font-size: 12px",
    "max-width: 220px"
  ].join("; ");

  container.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 8px;">debug time</div>
    <label style="display: block; margin-bottom: 6px;">
      hour
      <input id="debug-hour" type="range" min="0" max="23" step="1" style="width: 100%;">
      <span id="debug-hour-value"></span>
    </label>
    <label style="display: block; margin-bottom: 6px;">
      min
      <input id="debug-minute" type="range" min="0" max="59" step="1" style="width: 100%;">
      <span id="debug-minute-value"></span>
    </label>
    <label style="display: block; margin-bottom: 6px;">
      day
      <input id="debug-date" type="date" style="width: 100%;">
    </label>
    <label style="display: block; margin-bottom: 6px;">
      range
      <input id="debug-range" type="range" min="15" max="90" step="1" style="width: 100%;">
      <span id="debug-range-value"></span>
    </label>
    <label style="display: block; margin-bottom: 6px;">
      mag
      <input id="debug-mag" type="range" min="-1" max="8" step="0.1" style="width: 100%;">
      <span id="debug-mag-value"></span>
    </label>
    <div id="debug-readout" style="margin-top: 6px; line-height: 1.4;"></div>
  `;

  document.body.appendChild(container);

  const hourInput = container.querySelector("#debug-hour");
  const minuteInput = container.querySelector("#debug-minute");
  const dateInput = container.querySelector("#debug-date");
  const rangeInput = container.querySelector("#debug-range");
  const magInput = container.querySelector("#debug-mag");
  const hourValue = container.querySelector("#debug-hour-value");
  const minuteValue = container.querySelector("#debug-minute-value");
  const rangeValue = container.querySelector("#debug-range-value");
  const magValue = container.querySelector("#debug-mag-value");
  debugReadout = container.querySelector("#debug-readout");

  const apply = () => {
    const hours = Number(hourInput.value);
    const minutes = Number(minuteInput.value);
    const range = Number(rangeInput.value);
    const mag = Number(magInput.value);
    const dateValue = dateInput.value || formatDebugDate(DEBUG_TIME);

    setDebugDate(dateValue);
    setDebugTime(hours, minutes);
    setSunRangeDeg(range);
    setStarMagLimit(mag);
    hourValue.textContent = pad2(hours);
    minuteValue.textContent = pad2(minutes);
    rangeValue.textContent = `${range}deg`;
    magValue.textContent = mag.toFixed(1);
    actualizarTiempo();
    renderizarPanelActual();
    updateDebugReadout();
  };

  const dateRange = getDataDateRange();
  const initialDate = formatDebugDate(DEBUG_TIME);
  let clampedDate = initialDate;
  if (dateRange) {
    if (clampedDate < dateRange.min) clampedDate = dateRange.min;
    if (clampedDate > dateRange.max) clampedDate = dateRange.max;
  }

  hourInput.value = DEBUG_TIME.getHours();
  minuteInput.value = DEBUG_TIME.getMinutes();
  rangeInput.value = globalThis.CIELO_SUN_RANGE_DEG;
  magInput.value = globalThis.CIELO_STAR_MAG_LIMIT;
  dateInput.value = clampedDate;
  if (dateRange) {
    dateInput.min = dateRange.min;
    dateInput.max = dateRange.max;
  }
  hourInput.addEventListener("input", apply);
  minuteInput.addEventListener("input", apply);
  dateInput.addEventListener("input", apply);
  rangeInput.addEventListener("input", apply);
  magInput.addEventListener("input", apply);

  apply();
}

// === FUNCIONES DE INICIALIZACIÓN ===

function crearPantallas() {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] === 1) {
        const celda = document.createElement("div");
        celda.classList.add("celda", `pos_${y}_${x}`);
        celda.dataset.y = y;
        celda.dataset.x = x;

        const wrapper = document.createElement("div");
        wrapper.classList.add("contenido");
        celda.appendChild(wrapper);

        app.appendChild(celda);

        const clave = `${y}_${x}`;
        const nombre = nombresEspeciales[clave];
        if (nombre) {
          celda.classList.add(nombre);
        }
      }
    }
  }
}

function actualizarVista() {
  let todas = document.querySelectorAll(".celda");
  for (let i = 0; i < todas.length; i++) {
    todas[i].classList.remove("activa");
  }

  let selector = ".pos_" + posY + "_" + posX;
  let activa = document.querySelector(selector);

  if (activa) {
    const themeColor = getComputedStyle(activa)
      .getPropertyValue("--theme-color")
      .trim();
    document
      .querySelector('meta[name="theme-color"]')
      .setAttribute("content", themeColor);

    activa.classList.add("activa");
    crearBotonesNavegacion(activa);
  }
}

function crearBotonesNavegacion(celda) {
  let viejos = celda.querySelectorAll(".boton-nav");
  for (let i = 0; i < viejos.length; i++) {
    viejos[i].remove();
  }

  let dirs = [
    { dy: -1, dx: 0, clase: "btn_arriba", label: "norte" },
    { dy: 1, dx: 0, clase: "btn_abajo", label: "sur" },
    { dy: 0, dx: -1, clase: "btn_izquierda", label: "oeste" },
    { dy: 0, dx: 1, clase: "btn_derecha", label: "este" },
  ];

  for (let i = 0; i < dirs.length; i++) {
    let d = dirs[i];
    let nuevaY = posY + d.dy;
    let nuevaX = posX + d.dx;

    if (grid[nuevaY] && grid[nuevaY][nuevaX] === 1) {
      let boton = document.createElement("button");
      boton.classList.add("boton-nav");
      boton.classList.add(d.clase);
      boton.textContent = d.label;

      boton.onclick = function () {
        posY = nuevaY;
        posX = nuevaX;
        actualizarVista();
        renderizarPanelActual();
      };

      celda.appendChild(boton);
    }
  }
}

// === FUNCIONES DE RENDERIZADO ===

function renderizarPanelActual() {
  const nombrePanel = nombresEspeciales[`${posY}_${posX}`];
  const wrapper = document.querySelector(`.pos_${posY}_${posX} .contenido`);
  
  if (!wrapper) return;

  switch (nombrePanel) {
    case "centro":
      renderizarCentro(wrapper);
      break;
    case "norte":
      renderizarNorte(wrapper);
      break;
    case "sur":
      renderizarSur(wrapper);
      break;
    case "este":
      renderizarEste(wrapper);
      break;
    case "oeste":
      renderizarOeste(wrapper);
      break;
  }
}

function renderAsciiWithInfo(container, asciiData) {
  if (!container || !asciiData) return;

  container.innerHTML = '';

  const art = document.createElement('pre');
  art.className = 'ascii-diagram ascii-large';
  art.textContent = asciiData.art;

  const info = document.createElement('div');
  info.className = 'ascii-meta';
  info.textContent = asciiData.info;

  container.appendChild(art);
  container.appendChild(info);
}

function renderizarCentro(wrapper) {
  const timeStr = currentTime.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  const dateStr = currentTime.toLocaleDateString('es-ES', { 
    day: 'numeric', 
    month: 'long',
    year: 'numeric'
  });
  
  wrapper.innerHTML = `
    <div class="centro-stack">
      <div class="centro-subtitle">${dateStr}</div>
      <div class="centro-subtitle">${timeStr} · ${isDaytime ? 'día' : 'noche'}</div>
      <a class="centro-link" href="https://meowrhino.studio" target="_blank" rel="noopener">meowrhino.studio</a>
    </div>
  `;
}

function renderizarNorte(wrapper) {
  if (!isDaytime) {
    // Mostrar cielo nocturno de Barcelona
    wrapper.innerHTML = '';
    const container = document.createElement('div');
    container.id = 'cielo-norte';
    container.style.width = '100%';
    container.style.height = '100%';
    wrapper.appendChild(container);
    
    if (starCatalog) {
      renderNightSkyBarcelona(starCatalog, currentTime, container);
    }
  } else {
    wrapper.innerHTML = '';
  }
}

function renderizarSur(wrapper) {
  if (isDaytime) {
    // Mostrar cielo nocturno de la antípoda
    wrapper.innerHTML = '';
    const container = document.createElement('div');
    container.id = 'cielo-sur';
    container.style.width = '100%';
    container.style.height = '100%';
    wrapper.appendChild(container);
    
    if (starCatalog) {
      renderNightSkyAntipode(starCatalog, currentTime, container);
    }
  } else {
    wrapper.innerHTML = '';
  }
}

function renderizarEste(wrapper) {
  if (isDaytime) {
    // Mostrar trayectoria del sol (mañana)
    wrapper.innerHTML = '';
    
    const panel = document.createElement('div');
    panel.className = 'info-panel';
    panel.style.width = '100%';
    panel.style.height = '100%';
    panel.style.position = 'relative';
    
    const title = document.createElement('div');
    title.className = 'info-title';
    title.textContent = 'sol · mañana';
    title.style.position = 'absolute';
    title.style.top = '2rem';
    title.style.left = '50%';
    title.style.transform = 'translateX(-50%)';
    title.style.zIndex = '10';
    panel.appendChild(title);
    
    const container = document.createElement('div');
    container.id = 'sol-este';
    container.style.width = '100%';
    container.style.height = '100%';
    panel.appendChild(container);
    
    wrapper.appendChild(panel);
    
    if (currentSunData) {
      renderSunEast(currentSunData, currentTime, container);
    }
  } else {
    // Mostrar fase lunar
    wrapper.innerHTML = '';
    
    const panel = document.createElement('div');
    panel.className = 'info-panel';
    panel.style.width = '100%';
    panel.style.height = '100%';
    panel.style.position = 'relative';
    
    const title = document.createElement('div');
    title.className = 'info-title';
    title.textContent = 'fase lunar';
    title.style.position = 'absolute';
    title.style.top = '2rem';
    title.style.left = '50%';
    title.style.transform = 'translateX(-50%)';
    title.style.zIndex = '10';
    panel.appendChild(title);
    
    const container = document.createElement('div');
    container.id = 'luna-fase';
    container.style.width = '100%';
    container.style.height = '100%';
    panel.appendChild(container);
    
    wrapper.appendChild(panel);
    
    if (currentMoonData) {
      renderMoonPhase(currentMoonData, container);
    }
  }
}

function renderizarOeste(wrapper) {
  if (isDaytime) {
    // Mostrar trayectoria del sol (tarde)
    wrapper.innerHTML = '';
    
    const panel = document.createElement('div');
    panel.className = 'info-panel';
    panel.style.width = '100%';
    panel.style.height = '100%';
    panel.style.position = 'relative';
    
    const title = document.createElement('div');
    title.className = 'info-title';
    title.textContent = 'sol · tarde';
    title.style.position = 'absolute';
    title.style.top = '2rem';
    title.style.left = '50%';
    title.style.transform = 'translateX(-50%)';
    title.style.zIndex = '10';
    panel.appendChild(title);
    
    const container = document.createElement('div');
    container.id = 'sol-oeste';
    container.style.width = '100%';
    container.style.height = '100%';
    panel.appendChild(container);
    
    wrapper.appendChild(panel);
    
    if (currentSunData) {
      renderSunWest(currentSunData, currentTime, container);
    }
  } else {
    // Mostrar posición lunar
    wrapper.innerHTML = '';
    
    const panel = document.createElement('div');
    panel.className = 'info-panel';
    panel.style.width = '100%';
    panel.style.height = '100%';
    panel.style.position = 'relative';
    
    const title = document.createElement('div');
    title.className = 'info-title';
    title.textContent = 'posición lunar';
    title.style.position = 'absolute';
    title.style.top = '2rem';
    title.style.left = '50%';
    title.style.transform = 'translateX(-50%)';
    title.style.zIndex = '10';
    panel.appendChild(title);
    
    const container = document.createElement('div');
    container.id = 'luna-posicion';
    container.style.width = '100%';
    container.style.height = '100%';
    panel.appendChild(container);
    
    wrapper.appendChild(panel);
    
    if (currentMoonData) {
      renderMoonPosition(currentMoonData, currentTime, container);
    }
  }
}

// === CARGA DE DATOS ===

async function cargarDatos() {
  try {
    // Cargar datos del sol
    const responseSun = await fetch('data/sun/barcelona.json');
    const sunData = await responseSun.json();
    sunDataAll = sunData;
    
    // Cargar datos de la luna
    const responseMoon = await fetch('data/moon/barcelona.json');
    const moonData = await responseMoon.json();
    moonDataAll = moonData;
    
    // Cargar catálogo de estrellas
    const responseStars = await fetch('data/stars/catalog.json');
    starCatalog = await responseStars.json();
    
    // Cargar líneas de constelaciones
    await loadConstellationLines();
    
    // Determinar si es de día o noche
    currentTime = getNow();
    const currentHour = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTimeDecimal = currentHour + currentMinutes / 60;
    
    // Buscar datos del día actual
    const today = getDateKey(currentTime);
    syncCurrentDataForDate(today);
    
    if (currentSunData) {
      const sunrise = parseTime(currentSunData.sunrise);
      const sunset = parseTime(currentSunData.sunset);
      isDaytime = currentTimeDecimal >= sunrise && currentTimeDecimal < sunset;
    }
    
    updateDebugReadout();
    
    return true;
  } catch (error) {
    console.error('Error cargando datos:', error);
    return false;
  }
}

function parseTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours + minutes / 60;
}

// === ACTUALIZACIÓN PERIÓDICA ===

function actualizarTiempo() {
  currentTime = getNow();
  const dateKey = getDateKey(currentTime);

  if (dateKey !== currentDateKey) {
    syncCurrentDataForDate(dateKey);
  }
  
  // Actualizar el estado día/noche
  if (currentSunData) {
    const currentHour = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTimeDecimal = currentHour + currentMinutes / 60;
    const sunrise = parseTime(currentSunData.sunrise);
    const sunset = parseTime(currentSunData.sunset);
    const newIsDaytime = currentTimeDecimal >= sunrise && currentTimeDecimal < sunset;
    
    // Siempre actualizar isDaytime
    const changed = newIsDaytime !== isDaytime;
    isDaytime = newIsDaytime;
    
    // Solo re-renderizar si cambió el estado
    if (changed) {
      renderizarPanelActual();
    }
  }
  
  // Re-renderizar panel actual si es el centro (para actualizar hora)
  const nombrePanel = nombresEspeciales[`${posY}_${posX}`];
  if (nombrePanel === 'centro') {
    renderizarPanelActual();
  }

  updateDebugReadout();
}

// === INICIALIZACIÓN ===

async function init() {
  crearPantallas();
  const success = await cargarDatos();
  setupDebugControls();
  
  if (!success) {
    console.error('No se pudieron cargar los datos astronómicos');
  }
  
  actualizarVista();
  renderizarPanelActual();
  
  // Actualizar cada minuto
  setInterval(actualizarTiempo, 60000);
}

// Ejecutar al cargar
init();
