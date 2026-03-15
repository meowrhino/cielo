/**
 * Cálculos astronómicos puros
 * LST, conversión ecuatorial→horizontal, proyección azimutal,
 * posiciones sol/luna
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const J2000 = new Date('2000-01-01T12:00:00Z').getTime();

export const OBLIQUITY = 23.4393; // oblicuidad de la eclíptica

/**
 * Calcula el Local Sidereal Time en grados
 */
export function localSiderealTime(time, lon) {
  const days = (time.getTime() - J2000) / 86400000;
  const gmst = (280.46061837 + 360.98564736629 * days) % 360;
  return ((gmst + lon) % 360 + 360) % 360;
}

/**
 * Convierte coordenadas ecuatoriales (RA/Dec) a horizontales (Az/Alt)
 */
export function equatorialToHorizontal(ra, dec, lat, lon, time) {
  const lst = localSiderealTime(time, lon);
  const ha = (lst - ra) * DEG;
  const latR = lat * DEG;
  const decR = dec * DEG;

  const sinAlt = Math.sin(decR) * Math.sin(latR) +
                 Math.cos(decR) * Math.cos(latR) * Math.cos(ha);
  const altitude = Math.asin(sinAlt) * RAD;

  const cosAz = (Math.sin(decR) - Math.sin(latR) * sinAlt) /
                (Math.cos(latR) * Math.cos(Math.asin(sinAlt)));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * RAD;

  if (Math.sin(ha) > 0) azimuth = 360 - azimuth;

  return { azimuth, altitude };
}

/**
 * Proyección azimutal equidistante
 * Centro = zenit, borde = horizonte
 * Devuelve coordenadas normalizadas (-1 a 1)
 */
export function azimuthalProject(azimuth, altitude) {
  const azRad = azimuth * DEG;
  const r = (90 - altitude) / 90; // 0 en zenit, 1 en horizonte
  return {
    x: r * Math.sin(azRad),
    y: -r * Math.cos(azRad) // negativo para que N esté arriba
  };
}

/**
 * Convierte coordenadas GeoJSON (lon/lat) a RA/Dec
 */
export function geoJsonToRaDec(lon, lat) {
  return {
    ra: lon < 0 ? lon + 360 : lon,
    dec: lat
  };
}

/**
 * Interpola linealmente entre dos valores de hourlyData
 */
export function interpolateHourly(hourlyData, time) {
  const h = time.getHours();
  const m = time.getMinutes();
  const t = h + m / 60;

  const h0 = Math.floor(t);
  const h1 = (h0 + 1) % 24;
  const frac = t - h0;

  const d0 = hourlyData.find(d => d.hour === h0);
  const d1 = hourlyData.find(d => d.hour === h1);

  if (!d0) return null;
  if (!d1) return d0;

  return {
    azimuth: d0.azimuth + (d1.azimuth - d0.azimuth) * frac,
    altitude: d0.altitude + (d1.altitude - d0.altitude) * frac,
    isVisible: d0.isVisible
  };
}

/**
 * Parsea "HH:MM" a horas decimales
 */
export function parseTime(str) {
  const [h, m] = str.split(':').map(Number);
  return h + m / 60;
}

/**
 * Convierte eclíptica a ecuatorial (RA, Dec)
 * lon/lat en radianes
 */
export function eclipticToEquatorial(lon, lat) {
  const eps = OBLIQUITY * DEG;
  const cosEps = Math.cos(eps);
  const sinEps = Math.sin(eps);

  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);

  const ra = Math.atan2(sinLon * cosEps - Math.tan(lat) * sinEps, cosLon);
  const dec = Math.asin(sinLat * cosEps + cosLat * sinEps * sinLon);

  return {
    ra: ((ra * RAD) + 360) % 360,
    dec: dec * RAD
  };
}

/**
 * Posición del sol (RA/Dec) — algoritmo simplificado (~1° precisión)
 * Fuente: Meeus, Astronomical Algorithms
 */
export function computeSunPosition(time) {
  const days = (time.getTime() - J2000) / 86400000;
  const T = days / 36525;

  // Longitud media y anomalía media del sol
  const L0 = (280.46646 + 36000.76983 * T) % 360;
  const M = (357.52911 + 35999.05029 * T) % 360;
  const Mrad = M * DEG;

  // Ecuación del centro
  const C = (1.9146 - 0.004817 * T) * Math.sin(Mrad)
          + 0.019993 * Math.sin(2 * Mrad)
          + 0.000290 * Math.sin(3 * Mrad);

  // Longitud eclíptica del sol (latitud eclíptica ≈ 0)
  const sunLon = (L0 + C) * DEG;

  return eclipticToEquatorial(sunLon, 0);
}

/**
 * Posición de la luna (RA/Dec) — algoritmo simplificado (~1-2° precisión)
 * Usa los términos principales de la teoría de Brown/Meeus
 */
export function computeMoonPosition(time) {
  const days = (time.getTime() - J2000) / 86400000;
  const T = days / 36525;

  // Argumentos fundamentales (grados)
  const Lp = (218.3165 + 481267.8813 * T) % 360; // longitud media luna
  const D  = (297.8502 + 445267.1115 * T) % 360;  // elongación media
  const M  = (357.5291 + 35999.0503 * T) % 360;   // anomalía media sol
  const Mp = (134.9634 + 477198.8676 * T) % 360;   // anomalía media luna
  const F  = (93.2720 + 483202.0175 * T) % 360;    // argumento de latitud

  const Dr = D * DEG, Mr = M * DEG, Mpr = Mp * DEG, Fr = F * DEG;

  // Términos principales de longitud (grados)
  const lonCorr =
      6.289 * Math.sin(Mpr)
    + 1.274 * Math.sin(2 * Dr - Mpr)
    + 0.658 * Math.sin(2 * Dr)
    + 0.214 * Math.sin(2 * Mpr)
    - 0.186 * Math.sin(Mr)
    - 0.114 * Math.sin(2 * Fr);

  // Términos principales de latitud (grados)
  const latCorr =
      5.128 * Math.sin(Fr)
    + 0.281 * Math.sin(Mpr + Fr)
    + 0.278 * Math.sin(Mpr - Fr)
    + 0.173 * Math.sin(2 * Dr - Fr);

  const moonLon = (Lp + lonCorr) * DEG;
  const moonLat = latCorr * DEG;

  return eclipticToEquatorial(moonLon, moonLat);
}

/**
 * Calcula el ascendente (longitud eclíptica del punto que sube por el horizonte este)
 * Devuelve grados 0-360
 */
export function computeAscendant(time, lat, lon) {
  const eps = OBLIQUITY * DEG;
  const phi = lat * DEG;
  const thetaL = localSiderealTime(time, lon) * DEG;

  const asc = Math.atan2(
    Math.cos(thetaL),
    -(Math.sin(thetaL) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))
  );
  return ((asc * RAD) + 360) % 360;
}

/**
 * Convierte RA/Dec (grados) a longitud eclíptica (grados)
 */
export function equatorialToEclipticLon(ra, dec) {
  const eps = OBLIQUITY * DEG;
  const raR = ra * DEG;
  const decR = dec * DEG;
  const lon = Math.atan2(
    Math.sin(raR) * Math.cos(eps) + Math.tan(decR) * Math.sin(eps),
    Math.cos(raR)
  );
  return ((lon * RAD) + 360) % 360;
}

/**
 * Longitud eclíptica del sol (grados) — para carta natal
 */
export function computeSunEclipticLon(time) {
  const days = (time.getTime() - J2000) / 86400000;
  const T = days / 36525;
  const L0 = (280.46646 + 36000.76983 * T) % 360;
  const M = (357.52911 + 35999.05029 * T) % 360;
  const Mrad = M * DEG;
  const C = (1.9146 - 0.004817 * T) * Math.sin(Mrad)
          + 0.019993 * Math.sin(2 * Mrad)
          + 0.000290 * Math.sin(3 * Mrad);
  return ((L0 + C) % 360 + 360) % 360;
}

/**
 * Longitud eclíptica de la luna (grados) — para carta natal
 */
export function computeMoonEclipticLon(time) {
  const days = (time.getTime() - J2000) / 86400000;
  const T = days / 36525;
  const Lp = (218.3165 + 481267.8813 * T) % 360;
  const D  = (297.8502 + 445267.1115 * T) % 360;
  const M  = (357.5291 + 35999.0503 * T) % 360;
  const Mp = (134.9634 + 477198.8676 * T) % 360;
  const F  = (93.2720 + 483202.0175 * T) % 360;
  const Dr = D * DEG, Mr = M * DEG, Mpr = Mp * DEG, Fr = F * DEG;
  const lonCorr =
      6.289 * Math.sin(Mpr)
    + 1.274 * Math.sin(2 * Dr - Mpr)
    + 0.658 * Math.sin(2 * Dr)
    + 0.214 * Math.sin(2 * Mpr)
    - 0.186 * Math.sin(Mr)
    - 0.114 * Math.sin(2 * Fr);
  return ((Lp + lonCorr) % 360 + 360) % 360;
}
