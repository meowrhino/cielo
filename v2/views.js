/**
 * Vistas inmersivas para sol, luna y constelaciones
 * Se renderizan en el contenedor #detail-view
 */

import { sunPoetry, moonPoetry, constellationPoetry } from './poetry.js';
import { interpolateHourly, azimuthalProject, equatorialToHorizontal, geoJsonToRaDec } from './astronomy.js';

const TAU = Math.PI * 2;

/**
 * Renderiza la vista inmersiva del sol
 */
export function renderSunView(container, sunData, time) {
  container.innerHTML = '';

  const lines = sunPoetry(sunData, time);

  // Texto poético
  const textDiv = document.createElement('div');
  textDiv.className = 'detail-text';
  textDiv.innerHTML = lines.map((line, i) =>
    i === 0
      ? `<div class="detail-title">${line}</div>`
      : `<div class="detail-line">${line}</div>`
  ).join('');
  container.appendChild(textDiv);

  // Mini canvas con arco solar
  const canvas = document.createElement('canvas');
  canvas.className = 'detail-canvas';
  container.appendChild(canvas);

  requestAnimationFrame(() => drawSunArc(canvas, sunData, time));
}

/**
 * Dibuja el arco del sol en un canvas
 */
function drawSunArc(canvas, sunData, time) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const margin = 40;

  // Horizonte
  const horizonY = H * 0.7;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, horizonY);
  ctx.lineTo(W - margin, horizonY);
  ctx.stroke();

  // Recoger puntos visibles
  const visiblePoints = sunData.hourlyData
    .filter(h => h.isVisible)
    .map(h => ({
      x: margin + ((h.azimuth - sunData.azimuthSunrise) / (sunData.azimuthSunset - sunData.azimuthSunrise)) * (W - 2 * margin),
      y: horizonY - (h.altitude / sunData.altitudeNoon) * (horizonY - margin),
      hour: h.hour
    }));

  if (visiblePoints.length < 2) return;

  // Arco
  ctx.strokeStyle = 'rgba(255, 200, 60, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y);
  for (let i = 1; i < visiblePoints.length; i++) {
    ctx.lineTo(visiblePoints[i].x, visiblePoints[i].y);
  }
  ctx.stroke();

  // Marcas horarias
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.font = '10px Inknut Antiqua, Georgia, serif';
  ctx.textAlign = 'center';
  for (const p of visiblePoints) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, TAU);
    ctx.fill();
    if (p.hour % 3 === 0) {
      ctx.fillText(`${p.hour}:00`, p.x, p.y + 14);
    }
  }

  // Posición actual del sol
  const pos = interpolateHourly(sunData.hourlyData, time);
  if (pos && pos.isVisible) {
    const nowX = margin + ((pos.azimuth - sunData.azimuthSunrise) / (sunData.azimuthSunset - sunData.azimuthSunrise)) * (W - 2 * margin);
    const nowY = horizonY - (pos.altitude / sunData.altitudeNoon) * (horizonY - margin);

    // Glow
    const glow = ctx.createRadialGradient(nowX, nowY, 0, nowX, nowY, 20);
    glow.addColorStop(0, 'rgba(255, 200, 60, 0.3)');
    glow.addColorStop(1, 'rgba(255, 200, 60, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(nowX, nowY, 20, 0, TAU);
    ctx.fill();

    // Disco
    ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';
    ctx.beginPath();
    ctx.arc(nowX, nowY, 5, 0, TAU);
    ctx.fill();
  }

  // Labels
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.font = '10px Inknut Antiqua, Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(sunData.sunrise, margin, horizonY + 16);
  ctx.textAlign = 'right';
  ctx.fillText(sunData.sunset, W - margin, horizonY + 16);
}

/**
 * Renderiza la vista inmersiva de la luna
 */
export function renderMoonView(container, moonData, time) {
  container.innerHTML = '';

  const lines = moonPoetry(moonData, time);

  // Texto poético
  const textDiv = document.createElement('div');
  textDiv.className = 'detail-text';
  textDiv.innerHTML = lines.map((line, i) =>
    i === 0
      ? `<div class="detail-title">${line}</div>`
      : `<div class="detail-line">${line}</div>`
  ).join('');
  container.appendChild(textDiv);

  // Canvas con fase lunar grande
  const canvas = document.createElement('canvas');
  canvas.className = 'detail-canvas';
  container.appendChild(canvas);

  requestAnimationFrame(() => drawMoonPhase(canvas, moonData));
}

/**
 * Dibuja la fase lunar grande
 */
function drawMoonPhase(canvas, moonData) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const cx = W / 2;
  const cy = H / 2;
  const moonR = Math.min(W, H) * 0.25;

  // Glow
  const glow = ctx.createRadialGradient(cx, cy, moonR * 0.8, cx, cy, moonR * 3);
  glow.addColorStop(0, 'rgba(200, 210, 230, 0.06)');
  glow.addColorStop(1, 'rgba(200, 210, 230, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, moonR * 3, 0, TAU);
  ctx.fill();

  // Disco lunar
  ctx.fillStyle = '#c8cfe0';
  ctx.beginPath();
  ctx.arc(cx, cy, moonR, 0, TAU);
  ctx.fill();

  // Fase
  const phase = moonData.phase;
  if (phase > 0.02 && phase < 0.98) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, moonR, 0, TAU);
    ctx.clip();

    ctx.fillStyle = '#0a0a0f';
    ctx.beginPath();
    if (phase < 0.5) {
      ctx.arc(cx, cy, moonR, -Math.PI / 2, Math.PI / 2);
      ctx.ellipse(cx, cy, Math.abs(moonR * (1 - 2 * phase)), moonR, 0, Math.PI / 2, -Math.PI / 2);
    } else {
      ctx.arc(cx, cy, moonR, Math.PI / 2, -Math.PI / 2);
      ctx.ellipse(cx, cy, Math.abs(moonR * (2 * phase - 1)), moonR, 0, -Math.PI / 2, Math.PI / 2);
    }
    ctx.fill();
    ctx.restore();
  } else if (phase <= 0.02) {
    ctx.fillStyle = 'rgba(10, 10, 15, 0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, moonR, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200, 210, 230, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, moonR, 0, TAU);
    ctx.stroke();
  }
}

/**
 * Renderiza la vista inmersiva de una constelación
 */
export function renderConstellationView(container, constellationData, starCatalog, constellationLines, lat, lon, time) {
  container.innerHTML = '';

  const { name, id } = constellationData;

  // Encontrar la constelación en las líneas
  const constellation = constellationLines.find(c => c.properties.id === id);
  if (!constellation) {
    container.innerHTML = `<div class="detail-text"><div class="detail-title">${name}</div></div>`;
    return;
  }

  // Calcular centroide para poetry
  let sumAz = 0, sumAlt = 0, count = 0;
  const starPoints = [];

  for (const lineCoords of constellation.geometry.coordinates) {
    for (const [geoLon, geoLat] of lineCoords) {
      const { ra, dec } = geoJsonToRaDec(geoLon, geoLat);
      const { azimuth, altitude } = equatorialToHorizontal(ra, dec, lat, lon, time);
      if (altitude > 0) {
        sumAz += azimuth;
        sumAlt += altitude;
        count++;
      }
    }
  }

  const avgAz = count > 0 ? sumAz / count : 0;
  const avgAlt = count > 0 ? sumAlt / count : 0;
  const lines = constellationPoetry(name, avgAz, avgAlt);

  // Texto
  const textDiv = document.createElement('div');
  textDiv.className = 'detail-text';
  textDiv.innerHTML = lines.map((line, i) =>
    i === 0
      ? `<div class="detail-title">${line}</div>`
      : `<div class="detail-line">${line}</div>`
  ).join('');
  container.appendChild(textDiv);

  // Canvas con la constelación aislada
  const canvas = document.createElement('canvas');
  canvas.className = 'detail-canvas';
  container.appendChild(canvas);

  requestAnimationFrame(() => drawConstellation(canvas, constellation, lat, lon, time));
}

/**
 * Dibuja una constelación aislada
 */
function drawConstellation(canvas, constellation, lat, lon, time) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;

  // Recoger todos los puntos de la constelación
  const allPoints = [];
  const lineSegments = [];

  for (const lineCoords of constellation.geometry.coordinates) {
    const points = [];
    for (const [geoLon, geoLat] of lineCoords) {
      const { ra, dec } = geoJsonToRaDec(geoLon, geoLat);
      const { azimuth, altitude } = equatorialToHorizontal(ra, dec, lat, lon, time);
      if (altitude < 0) break;
      points.push({ azimuth, altitude });
      allPoints.push({ azimuth, altitude });
    }
    if (points.length >= 2) lineSegments.push(points);
  }

  if (allPoints.length === 0) return;

  // Calcular bounding box y centrar
  const minAz = Math.min(...allPoints.map(p => p.azimuth));
  const maxAz = Math.max(...allPoints.map(p => p.azimuth));
  const minAlt = Math.min(...allPoints.map(p => p.altitude));
  const maxAlt = Math.max(...allPoints.map(p => p.altitude));
  const centerAz = (minAz + maxAz) / 2;
  const centerAlt = (minAlt + maxAlt) / 2;
  const span = Math.max(maxAz - minAz, maxAlt - minAlt, 20);
  const scale = Math.min(W, H) * 0.6 / span;

  function toScreen(az, alt) {
    return {
      x: W / 2 + (az - centerAz) * scale,
      y: H / 2 - (alt - centerAlt) * scale
    };
  }

  // Líneas
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  for (const seg of lineSegments) {
    ctx.beginPath();
    const p0 = toScreen(seg[0].azimuth, seg[0].altitude);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < seg.length; i++) {
      const p = toScreen(seg[i].azimuth, seg[i].altitude);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // Puntos (estrellas)
  for (const pt of allPoints) {
    const { x, y } = toScreen(pt.azimuth, pt.altitude);

    // Glow
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 8);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, TAU);
    ctx.fill();
  }
}
