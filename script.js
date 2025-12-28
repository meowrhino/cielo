// Importar módulos de renderizado
import { renderSunEast, renderSunWest } from './modules/sun-renderer.js';
import { renderMoonPosition, renderMoonPhase } from './modules/moon-renderer.js';
import { renderNightSkyBarcelona, renderNightSkyAntipode } from './modules/sky-renderer.js';

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

        // Añadir branding
        const branding = document.createElement("div");
        branding.classList.add("branding");
        branding.textContent = "meowrhino.studio";
        celda.appendChild(branding);

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
    { dy: -1, dx: 0, clase: "btn_arriba", label: "↑" },
    { dy: 1, dx: 0, clase: "btn_abajo", label: "↑" },
    { dy: 0, dx: -1, clase: "btn_izquierda", label: "↑" },
    { dy: 0, dx: 1, clase: "btn_derecha", label: "↑" },
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
    <div class="centro-title">cielo</div>
    <div class="centro-subtitle">${dateStr}</div>
    <div class="centro-subtitle">${timeStr} · ${isDaytime ? 'día' : 'noche'}</div>
    <div class="centro-subtitle" style="margin-top: 1rem;">${CONFIG.location.name} · ${CONFIG.location.lat}°N ${CONFIG.location.lon}°E</div>
  `;
}

function renderizarNorte(wrapper) {
  if (!isDaytime) {
    // Mostrar cielo nocturno de Barcelona
    wrapper.innerHTML = `
      <div class="info-panel">
        <div class="info-title">cielo nocturno · barcelona</div>
        <div class="ascii-container" id="cielo-norte"></div>
      </div>
    `;
    
    const container = wrapper.querySelector('#cielo-norte');
    if (container && starCatalog) {
      container.textContent = renderNightSkyBarcelona(starCatalog, currentTime);
    }
  } else {
    wrapper.innerHTML = `
      <div class="info-panel">
        <div class="info-title">norte</div>
        <div class="info-data">El sol está sobre el horizonte.<br>El cielo nocturno no es visible.</div>
      </div>
    `;
  }
}

function renderizarSur(wrapper) {
  if (isDaytime) {
    // Mostrar cielo nocturno de la antípoda
    wrapper.innerHTML = `
      <div class="info-panel">
        <div class="info-title">cielo nocturno · antípoda</div>
        <div class="ascii-container" id="cielo-sur"></div>
      </div>
    `;
    
    const container = wrapper.querySelector('#cielo-sur');
    if (container && starCatalog) {
      container.textContent = renderNightSkyAntipode(starCatalog, currentTime);
    }
  } else {
    wrapper.innerHTML = `
      <div class="info-panel">
        <div class="info-title">sur</div>
        <div class="info-data">El sol está bajo el horizonte.<br>El cielo de la antípoda no es visible.</div>
      </div>
    `;
  }
}

function renderizarEste(wrapper) {
  if (isDaytime) {
    // Mostrar trayectoria del sol (mañana)
    wrapper.innerHTML = `
      <div class="info-panel">
        <div class="info-title">sol · mañana</div>
        <div class="ascii-container ascii-large" id="sol-este"></div>
      </div>
    `;
    
    const container = wrapper.querySelector('#sol-este');
    if (container && currentSunData) {
      container.textContent = renderSunEast(currentSunData, currentTime);
    }
  } else {
    // Mostrar fase lunar
    wrapper.innerHTML = `
      <div class="info-panel">
        <div class="info-title">fase lunar</div>
        <div class="ascii-container ascii-large" id="luna-fase"></div>
      </div>
    `;
    
    const container = wrapper.querySelector('#luna-fase');
    if (container && currentMoonData) {
      container.textContent = renderMoonPhase(currentMoonData);
    }
  }
}

function renderizarOeste(wrapper) {
  if (isDaytime) {
    // Mostrar trayectoria del sol (tarde)
    wrapper.innerHTML = `
      <div class="info-panel">
        <div class="info-title">sol · tarde</div>
        <div class="ascii-container ascii-large" id="sol-oeste"></div>
      </div>
    `;
    
    const container = wrapper.querySelector('#sol-oeste');
    if (container && currentSunData) {
      container.textContent = renderSunWest(currentSunData, currentTime);
    }
  } else {
    // Mostrar posición lunar
    wrapper.innerHTML = `
      <div class="info-panel">
        <div class="info-title">posición lunar</div>
        <div class="ascii-container ascii-large" id="luna-posicion"></div>
      </div>
    `;
    
    const container = wrapper.querySelector('#luna-posicion');
    if (container && currentMoonData) {
      container.textContent = renderMoonPosition(currentMoonData, currentTime);
    }
  }
}

// === CARGA DE DATOS ===

async function cargarDatos() {
  try {
    // Cargar datos del sol
    const responseSun = await fetch('data/sun/barcelona.json');
    const sunData = await responseSun.json();
    
    // Cargar datos de la luna
    const responseMoon = await fetch('data/moon/barcelona.json');
    const moonData = await responseMoon.json();
    
    // Cargar catálogo de estrellas
    const responseStars = await fetch('data/stars/catalog.json');
    starCatalog = await responseStars.json();
    
    // Determinar si es de día o noche
    currentTime = new Date();
    const currentHour = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTimeDecimal = currentHour + currentMinutes / 60;
    
    // Buscar datos del día actual
    const today = currentTime.toISOString().split('T')[0];
    const todayDataSun = sunData.find(d => d.date === today);
    const todayDataMoon = moonData.find(d => d.date === today);
    
    if (todayDataSun) {
      currentSunData = todayDataSun;
      const sunrise = parseTime(todayDataSun.sunrise);
      const sunset = parseTime(todayDataSun.sunset);
      isDaytime = currentTimeDecimal >= sunrise && currentTimeDecimal < sunset;
    }
    
    if (todayDataMoon) {
      currentMoonData = todayDataMoon;
    }
    
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
  currentTime = new Date();
  
  // Verificar si cambió el estado día/noche
  if (currentSunData) {
    const currentHour = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTimeDecimal = currentHour + currentMinutes / 60;
    const sunrise = parseTime(currentSunData.sunrise);
    const sunset = parseTime(currentSunData.sunset);
    const newIsDaytime = currentTimeDecimal >= sunrise && currentTimeDecimal < sunset;
    
    if (newIsDaytime !== isDaytime) {
      isDaytime = newIsDaytime;
      renderizarPanelActual();
    }
  }
  
  // Re-renderizar panel actual si es el centro (para actualizar hora)
  const nombrePanel = nombresEspeciales[`${posY}_${posX}`];
  if (nombrePanel === 'centro') {
    renderizarPanelActual();
  }
}

// === INICIALIZACIÓN ===

async function init() {
  crearPantallas();
  const success = await cargarDatos();
  
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
