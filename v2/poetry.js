/**
 * Textos poéticos mínimos para las vistas inmersivas
 * Sin verbos, solo atmósfera
 */

import { parseTime } from './astronomy.js';

/**
 * Dirección cardinal desde azimut
 */
function cardinalDir(az) {
  const dirs = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
  const i = Math.round(az / 45) % 8;
  return dirs[i];
}

/**
 * Altura descrita en palabras
 */
function altitudeWord(alt) {
  if (alt > 70) return 'sobre tu cabeza';
  if (alt > 45) return 'alto';
  if (alt > 20) return 'a media altura';
  if (alt > 5) return 'cerca del horizonte';
  return 'en el horizonte';
}

/**
 * Formato de duración en horas y minutos
 */
function formatDuration(hours) {
  const h = Math.floor(Math.abs(hours));
  const m = Math.round((Math.abs(hours) - h) * 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/**
 * Textos para la vista del sol
 */
export function sunPoetry(sunData, time) {
  if (!sunData) return ['sol', 'sin datos'];

  const now = time.getHours() + time.getMinutes() / 60;
  const sunrise = parseTime(sunData.sunrise);
  const sunset = parseTime(sunData.sunset);
  const dayLength = sunset - sunrise;
  const isUp = now >= sunrise && now < sunset;

  const lines = ['sol'];

  if (isUp) {
    const sinceRise = now - sunrise;
    const untilSet = sunset - now;

    // Posición interpolada
    const h = Math.floor(now);
    const hourData = sunData.hourlyData.find(d => d.hour === h);
    if (hourData) {
      lines.push(`${cardinalDir(hourData.azimuth)} · ${altitudeWord(hourData.altitude)}`);
    }

    if (sinceRise < 1) {
      lines.push(`amanecer hace ${formatDuration(sinceRise)}`);
    } else if (untilSet < 1) {
      lines.push(`atardecer en ${formatDuration(untilSet)}`);
    } else {
      lines.push(`arriba desde hace ${formatDuration(sinceRise)}`);
    }
  } else {
    if (now < sunrise) {
      lines.push(`amanece en ${formatDuration(sunrise - now)}`);
    } else {
      lines.push(`se fue hace ${formatDuration(now - sunset)}`);
    }
    lines.push('bajo el horizonte');
  }

  lines.push(`el día dura ${formatDuration(dayLength)}`);
  lines.push(`↑ ${sunData.sunrise} · ↓ ${sunData.sunset}`);

  return lines;
}

/**
 * Textos para la vista de la luna
 */
export function moonPoetry(moonData, time) {
  if (!moonData) return ['luna', 'sin datos'];

  const lines = ['luna'];

  lines.push(`${moonData.phaseName} · ${moonData.illumination}%`);

  // Posición actual
  const h = Math.floor(time.getHours() + time.getMinutes() / 60);
  const hourData = moonData.hourlyData.find(d => d.hour === h);
  if (hourData && hourData.altitude > 0) {
    lines.push(`${cardinalDir(hourData.azimuth)} · ${altitudeWord(hourData.altitude)}`);

    // ¿Sube o baja?
    const nextH = moonData.hourlyData.find(d => d.hour === (h + 1) % 24);
    if (nextH) {
      lines.push(nextH.altitude > hourData.altitude ? 'subiendo' : 'bajando');
    }
  } else {
    lines.push('bajo el horizonte');
  }

  if (moonData.moonrise) lines.push(`sale ${moonData.moonrise}`);
  if (moonData.moonset) lines.push(`pone ${moonData.moonset}`);

  return lines;
}

/**
 * Textos para la vista de constelación
 */
export function constellationPoetry(name, azimuth, altitude) {
  const lines = [name.toLowerCase()];

  lines.push(`${cardinalDir(azimuth)} · ${altitudeWord(altitude)}`);

  return lines;
}
