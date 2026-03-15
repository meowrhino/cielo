/**
 * Cálculos astronómicos puros
 * LST, conversión ecuatorial→horizontal, proyección azimutal
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const J2000 = new Date('2000-01-01T12:00:00Z').getTime();

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
