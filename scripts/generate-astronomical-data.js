import SunCalc from 'suncalc';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DAYS = 45;
const DEFAULT_STAR_CATALOG_SOURCE = 'builtin';
const DEFAULT_BSC_URLS = [
  'https://cdsarc.u-strasbg.fr/ftp/cats/V/50/catalog',
  'https://cdsarc.cds.unistra.fr/ftp/cats/V/50/catalog'
];

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseStartDate(value) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getStarCatalogSource() {
  const raw = (process.env.STAR_CATALOG_SOURCE || DEFAULT_STAR_CATALOG_SOURCE).toLowerCase();
  if (raw === 'bsc' || raw === 'yale' || raw === 'bright') return 'bsc';
  return 'builtin';
}

function parseBscLine(line) {
  if (!line || line.length < 110) return null;

  // Columnas según formato fijo del BSC v5 (catalog).
  const hr = Number.parseInt(line.slice(0, 4), 10);
  const name = line.slice(4, 14).trim();
  const raH = Number.parseInt(line.slice(75, 77), 10);
  const raM = Number.parseInt(line.slice(77, 79), 10);
  const raS = Number.parseFloat(line.slice(79, 83));
  const decSign = line.slice(83, 84);
  const decD = Number.parseInt(line.slice(84, 86), 10);
  const decM = Number.parseInt(line.slice(86, 88), 10);
  const decS = Number.parseFloat(line.slice(88, 90));
  const mag = Number.parseFloat(line.slice(102, 107));

  if (!Number.isFinite(raH) || !Number.isFinite(raM) || !Number.isFinite(raS)) return null;
  if (!Number.isFinite(decD) || !Number.isFinite(decM) || !Number.isFinite(decS)) return null;
  if (!Number.isFinite(mag)) return null;

  const ra = raH + raM / 60 + raS / 3600;
  const decAbs = decD + decM / 60 + decS / 3600;
  const dec = decSign === '-' ? -decAbs : decAbs;

  return {
    name: name || `HR ${Number.isFinite(hr) ? hr : ''}`.trim(),
    ra,
    dec,
    mag
  };
}

async function downloadBscCatalog(filePath, urls) {
  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`No se pudo descargar BSC (${response.status} ${response.statusText})`);
      }
      const text = await response.text();
      fs.writeFileSync(filePath, text);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('No se pudo descargar BSC');
}

async function generateStarCatalogFromBsc() {
  const dataDir = path.join(__dirname, '..', 'data');
  const starsDir = path.join(dataDir, 'stars');
  const bscPath = process.env.BSC_PATH || path.join(starsDir, 'bsc5.dat');
  const bscUrls = process.env.BSC_URL ? [process.env.BSC_URL] : DEFAULT_BSC_URLS;

  if (!fs.existsSync(starsDir)) {
    fs.mkdirSync(starsDir, { recursive: true });
  }

  if (!fs.existsSync(bscPath)) {
    console.log('Descargando Yale Bright Star Catalog...');
    await downloadBscCatalog(bscPath, bscUrls);
  }

  const raw = fs.readFileSync(bscPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const catalog = [];

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const star = parseBscLine(line);
    if (star) catalog.push(star);
  }

  if (catalog.length < 1000) {
    throw new Error(`El catálogo BSC parece incompleto (${catalog.length} estrellas parseadas)`);
  }

  return catalog;
}

// Configuración de Barcelona
const BARCELONA = {
  lat: 41.3851,
  lon: 2.1734,
  name: 'Barcelona'
};

// Calcular antípoda de Barcelona
const ANTIPODA = {
  lat: -BARCELONA.lat,
  lon: BARCELONA.lon > 0 ? BARCELONA.lon - 180 : BARCELONA.lon + 180,
  name: 'Antípoda de Barcelona'
};

/**
 * Genera datos solares para un rango de días
 */
function generateSunData(location, startDate, days) {
  const data = [];
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    const times = SunCalc.getTimes(date, location.lat, location.lon);
    const sunPos = SunCalc.getPosition(times.solarNoon, location.lat, location.lon);
    const sunrisePos = SunCalc.getPosition(times.sunrise, location.lat, location.lon);
    const sunsetPos = SunCalc.getPosition(times.sunset, location.lat, location.lon);
    
    // Convertir radianes a grados
    const azimuthToDegrees = (rad) => ((rad * 180 / Math.PI + 180) % 360);
    const altitudeToDegrees = (rad) => (rad * 180 / Math.PI);
    
    data.push({
      date: date.toISOString().split('T')[0],
      sunrise: times.sunrise.toTimeString().slice(0, 5),
      sunset: times.sunset.toTimeString().slice(0, 5),
      solarNoon: times.solarNoon.toTimeString().slice(0, 5),
      azimuthSunrise: Math.round(azimuthToDegrees(sunrisePos.azimuth)),
      azimuthSunset: Math.round(azimuthToDegrees(sunsetPos.azimuth)),
      azimuthNoon: Math.round(azimuthToDegrees(sunPos.azimuth)),
      altitudeNoon: Math.round(altitudeToDegrees(sunPos.altitude)),
      // Datos por hora para determinar posición actual del sol
      hourlyData: generateHourlyData(date, location)
    });
  }
  
  return data;
}

/**
 * Genera datos horarios del sol
 */
function generateHourlyData(date, location) {
  const hourlyData = [];
  
  for (let hour = 0; hour < 24; hour++) {
    const hourDate = new Date(date);
    hourDate.setHours(hour, 0, 0, 0);
    
    const pos = SunCalc.getPosition(hourDate, location.lat, location.lon);
    const azimuthToDegrees = (rad) => ((rad * 180 / Math.PI + 180) % 360);
    const altitudeToDegrees = (rad) => (rad * 180 / Math.PI);
    
    hourlyData.push({
      hour,
      azimuth: Math.round(azimuthToDegrees(pos.azimuth)),
      altitude: Math.round(altitudeToDegrees(pos.altitude)),
      isVisible: pos.altitude > 0
    });
  }
  
  return hourlyData;
}

/**
 * Genera datos lunares para un rango de días
 */
function generateMoonData(location, startDate, days) {
  const data = [];
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    date.setHours(12, 0, 0, 0); // Mediodía
    
    const moonIllumination = SunCalc.getMoonIllumination(date);
    const moonPos = SunCalc.getMoonPosition(date, location.lat, location.lon);
    const moonTimes = SunCalc.getMoonTimes(date, location.lat, location.lon);
    
    const azimuthToDegrees = (rad) => ((rad * 180 / Math.PI + 180) % 360);
    const altitudeToDegrees = (rad) => (rad * 180 / Math.PI);
    
    // Determinar fase lunar
    const phase = moonIllumination.phase;
    let phaseName = '';
    if (phase < 0.05 || phase > 0.95) phaseName = 'nueva';
    else if (phase < 0.25) phaseName = 'creciente';
    else if (phase < 0.30) phaseName = 'cuarto creciente';
    else if (phase < 0.45) phaseName = 'gibosa creciente';
    else if (phase < 0.55) phaseName = 'llena';
    else if (phase < 0.70) phaseName = 'gibosa menguante';
    else if (phase < 0.75) phaseName = 'cuarto menguante';
    else phaseName = 'menguante';
    
    data.push({
      date: date.toISOString().split('T')[0],
      phase: Math.round(phase * 100) / 100,
      phaseName,
      illumination: Math.round(moonIllumination.fraction * 100),
      azimuth: Math.round(azimuthToDegrees(moonPos.azimuth)),
      altitude: Math.round(altitudeToDegrees(moonPos.altitude)),
      moonrise: moonTimes.rise ? moonTimes.rise.toTimeString().slice(0, 5) : null,
      moonset: moonTimes.set ? moonTimes.set.toTimeString().slice(0, 5) : null,
      // Datos por hora
      hourlyData: generateMoonHourlyData(date, location)
    });
  }
  
  return data;
}

/**
 * Genera datos horarios de la luna
 */
function generateMoonHourlyData(date, location) {
  const hourlyData = [];
  
  for (let hour = 0; hour < 24; hour++) {
    const hourDate = new Date(date);
    hourDate.setHours(hour, 0, 0, 0);
    
    const pos = SunCalc.getMoonPosition(hourDate, location.lat, location.lon);
    const azimuthToDegrees = (rad) => ((rad * 180 / Math.PI + 180) % 360);
    const altitudeToDegrees = (rad) => (rad * 180 / Math.PI);
    
    hourlyData.push({
      hour,
      azimuth: Math.round(azimuthToDegrees(pos.azimuth)),
      altitude: Math.round(altitudeToDegrees(pos.altitude)),
      isVisible: pos.altitude > 0
    });
  }
  
  return hourlyData;
}

/**
 * Genera catálogo de estrellas brillantes (simplificado)
 */
function generateStarCatalogBuiltin() {
  // Estrellas más brillantes visibles desde Barcelona
  // Coordenadas en ascensión recta (horas) y declinación (grados)
  return [
    { name: 'Sirius', ra: 6.75, dec: -16.72, mag: -1.46 },
    { name: 'Arcturus', ra: 14.26, dec: 19.18, mag: -0.05 },
    { name: 'Vega', ra: 18.62, dec: 38.78, mag: 0.03 },
    { name: 'Capella', ra: 5.28, dec: 45.99, mag: 0.08 },
    { name: 'Rigel', ra: 5.24, dec: -8.20, mag: 0.18 },
    { name: 'Procyon', ra: 7.66, dec: 5.22, mag: 0.40 },
    { name: 'Betelgeuse', ra: 5.92, dec: 7.41, mag: 0.45 },
    { name: 'Altair', ra: 19.85, dec: 8.87, mag: 0.76 },
    { name: 'Aldebaran', ra: 4.60, dec: 16.51, mag: 0.87 },
    { name: 'Spica', ra: 13.42, dec: -11.16, mag: 0.98 },
    { name: 'Antares', ra: 16.49, dec: -26.43, mag: 1.06 },
    { name: 'Pollux', ra: 7.76, dec: 28.03, mag: 1.16 },
    { name: 'Fomalhaut', ra: 22.96, dec: -29.62, mag: 1.17 },
    { name: 'Deneb', ra: 20.69, dec: 45.28, mag: 1.25 },
    { name: 'Regulus', ra: 10.14, dec: 11.97, mag: 1.36 }
  ];
}

async function generateStarCatalog() {
  const source = getStarCatalogSource();
  if (source === 'bsc') {
    return generateStarCatalogFromBsc();
  }
  return generateStarCatalogBuiltin();
}

/**
 * Función principal
 */
async function main() {
  console.log('Generando datos astronómicos...');
  
  const startDate = parseStartDate(process.env.START_DATE) || new Date();
  const daysToGenerate = parsePositiveInt(process.env.DAYS_TO_GENERATE, DEFAULT_DAYS);
  
  // Generar datos del sol para Barcelona
  console.log('Generando datos solares para Barcelona...');
  const sunDataBarcelona = generateSunData(BARCELONA, startDate, daysToGenerate);
  
  // Generar datos de la luna para Barcelona
  console.log('Generando datos lunares para Barcelona...');
  const moonDataBarcelona = generateMoonData(BARCELONA, startDate, daysToGenerate);
  
  // Generar catálogo de estrellas
  console.log('Generando catálogo de estrellas...');
  const starCatalog = await generateStarCatalog();
  
  // Crear directorios si no existen
  const dataDir = path.join(__dirname, '..', 'data');
  const sunDir = path.join(dataDir, 'sun');
  const moonDir = path.join(dataDir, 'moon');
  const starsDir = path.join(dataDir, 'stars');
  
  [sunDir, moonDir, starsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Guardar archivos JSON
  console.log('Guardando archivos JSON...');
  fs.writeFileSync(
    path.join(sunDir, 'barcelona.json'),
    JSON.stringify(sunDataBarcelona, null, 2)
  );
  
  fs.writeFileSync(
    path.join(moonDir, 'barcelona.json'),
    JSON.stringify(moonDataBarcelona, null, 2)
  );
  
  fs.writeFileSync(
    path.join(starsDir, 'catalog.json'),
    JSON.stringify(starCatalog, null, 2)
  );
  
  // Guardar metadata
  const metadata = {
    generatedAt: new Date().toISOString(),
    location: BARCELONA,
    daysGenerated: daysToGenerate,
    startDate: startDate.toISOString().split('T')[0],
    endDate: new Date(startDate.getTime() + daysToGenerate * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  };
  
  fs.writeFileSync(
    path.join(dataDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  console.log('✓ Datos generados exitosamente');
  console.log(`  - ${sunDataBarcelona.length} días de datos solares`);
  console.log(`  - ${moonDataBarcelona.length} días de datos lunares`);
  console.log(`  - ${starCatalog.length} estrellas en el catálogo`);
}

main().catch(console.error);
