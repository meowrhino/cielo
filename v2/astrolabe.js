/**
 * Renderizado del astrolabio en Canvas 2D
 * Disco circular: zenit en centro, horizonte en borde
 */
import { equatorialToHorizontal, azimuthalProject, geoJsonToRaDec, interpolateHourly } from './astronomy.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export function createAstrolabe(canvas) {
  const ctx = canvas.getContext('2d');
  let W, H, cx, cy, radius;
  let hitTargets = []; // Para interaction.js

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const parent = canvas.parentElement;
    const rect = parent ? parent.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
    W = rect.width;
    H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cx = W / 2;
    cy = H / 2;
    radius = Math.min(W, H) * 0.44;
  }

  resize();

  /**
   * Convierte coordenadas normalizadas del astrolabio (-1..1) a píxeles
   */
  function toPixel(nx, ny) {
    return {
      px: cx + nx * radius,
      py: cy + ny * radius
    };
  }

  /**
   * Dibuja los anillos de referencia y marcas cardinales
   */
  function drawFrame() {
    // Anillo del horizonte
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Anillos de altitud (30° y 60°)
    for (const alt of [30, 60]) {
      const r = ((90 - alt) / 90) * radius;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([4, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Zenit dot
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5, 0, TAU);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fill();

    // Marcas cardinales
    const cardinals = [
      { label: 'N', az: 0 },
      { label: 'E', az: 90 },
      { label: 'S', az: 180 },
      { label: 'O', az: 270 }
    ];

    ctx.font = '10px Inknut Antiqua, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const c of cardinals) {
      const { x, y } = azimuthalProject(c.az, -5); // Ligeramente fuera del horizonte
      const { px, py } = toPixel(x, y);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillText(c.label, px, py);
    }
  }

  /**
   * Dibuja las estrellas visibles
   */
  function drawStars(catalog, lat, lon, time) {
    if (!catalog) return;

    const magLimit = 6;
    let count = 0;

    for (const star of catalog) {
      if (star.mag > magLimit) continue;

      const { azimuth, altitude } = equatorialToHorizontal(star.ra, star.dec, lat, lon, time);
      if (altitude < 0) continue;

      const { x, y } = azimuthalProject(azimuth, altitude);
      const { px, py } = toPixel(x, y);

      // Tamaño y brillo según magnitud
      const brightness = Math.max(0.08, (magLimit - star.mag) / magLimit);
      const size = Math.max(0.3, (magLimit - star.mag) / magLimit * 2.5);

      // Color sutil según magnitud (más brillantes ligeramente azuladas o doradas)
      let r = 255, g = 255, b = 255;
      if (star.mag < 1) {
        // Estrellas brillantes: ligero tono
        if (star.dec > 0) { r = 255; g = 245; b = 220; } // dorado
        else { r = 220; g = 230; b = 255; } // azulado
      }

      // Glow para estrellas brillantes
      if (star.mag < 2) {
        const glowR = size * 4;
        const grd = ctx.createRadialGradient(px, py, 0, px, py, glowR);
        grd.addColorStop(0, `rgba(${r},${g},${b},${brightness * 0.3})`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(px, py, glowR, 0, TAU);
        ctx.fill();
      }

      // Punto de la estrella
      ctx.fillStyle = `rgba(${r},${g},${b},${brightness})`;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, TAU);
      ctx.fill();

      // Hit target para estrellas brillantes
      if (star.mag < 2.5) {
        hitTargets.push({
          type: 'star',
          px, py,
          radius: Math.max(size * 3, 12),
          data: { name: star.name, mag: star.mag, azimuth, altitude }
        });
      }

      count++;
    }

    return count;
  }

  /**
   * Dibuja las líneas de constelaciones
   */
  function drawConstellations(lines, lat, lon, time) {
    if (!lines) return;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 0.5;

    for (const constellation of lines) {
      const { geometry, properties } = constellation;
      if (geometry.type !== 'MultiLineString') continue;

      const allPoints = []; // Para centroide

      for (const lineCoords of geometry.coordinates) {
        const points = [];
        let allVisible = true;

        for (const [geoLon, geoLat] of lineCoords) {
          const { ra, dec } = geoJsonToRaDec(geoLon, geoLat);
          const { azimuth, altitude } = equatorialToHorizontal(ra, dec, lat, lon, time);

          if (altitude < 0) { allVisible = false; break; }

          const proj = azimuthalProject(azimuth, altitude);
          const { px, py } = toPixel(proj.x, proj.y);
          points.push({ px, py });
        }

        if (!allVisible || points.length < 2) continue;

        // Descartar líneas con saltos enormes (wrap-around)
        let hasGap = false;
        for (let i = 1; i < points.length; i++) {
          const dx = points[i].px - points[i - 1].px;
          const dy = points[i].py - points[i - 1].py;
          if (Math.sqrt(dx * dx + dy * dy) > radius * 1.2) { hasGap = true; break; }
        }
        if (hasGap) continue;

        // Dibujar línea
        ctx.beginPath();
        ctx.moveTo(points[0].px, points[0].py);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].px, points[i].py);
        }
        ctx.stroke();

        allPoints.push(...points);
      }

      // Nombre de constelación en el centroide
      if (allPoints.length > 0) {
        const centX = allPoints.reduce((s, p) => s + p.px, 0) / allPoints.length;
        const centY = allPoints.reduce((s, p) => s + p.py, 0) / allPoints.length;

        ctx.font = '8px Inknut Antiqua, Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillText(properties.name, centX, centY);

        hitTargets.push({
          type: 'constellation',
          px: centX, py: centY,
          radius: 30,
          data: { name: properties.name, id: properties.id }
        });
      }
    }
  }

  /**
   * Dibuja el sol
   */
  function drawSun(sunData, time) {
    if (!sunData || !sunData.hourlyData) return;

    const pos = interpolateHourly(sunData.hourlyData, time);
    if (!pos || !pos.isVisible) return;

    const { x, y } = azimuthalProject(pos.azimuth, pos.altitude);
    const { px, py } = toPixel(x, y);
    const sunRadius = 8;

    // Glow exterior
    const glow = ctx.createRadialGradient(px, py, sunRadius * 0.5, px, py, sunRadius * 8);
    glow.addColorStop(0, 'rgba(255, 200, 60, 0.15)');
    glow.addColorStop(0.5, 'rgba(255, 180, 40, 0.05)');
    glow.addColorStop(1, 'rgba(255, 160, 20, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, sunRadius * 8, 0, TAU);
    ctx.fill();

    // Disco solar
    const disc = ctx.createRadialGradient(px, py, 0, px, py, sunRadius);
    disc.addColorStop(0, 'rgba(255, 240, 200, 0.95)');
    disc.addColorStop(0.7, 'rgba(255, 200, 80, 0.9)');
    disc.addColorStop(1, 'rgba(255, 180, 40, 0.6)');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(px, py, sunRadius, 0, TAU);
    ctx.fill();

    // Trayectoria del sol (arco del día)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 200, 60, 0.08)';
    ctx.lineWidth = 1;
    let first = true;
    for (const h of sunData.hourlyData) {
      if (!h.isVisible) continue;
      const proj = azimuthalProject(h.azimuth, h.altitude);
      const pt = toPixel(proj.x, proj.y);
      if (first) { ctx.moveTo(pt.px, pt.py); first = false; }
      else ctx.lineTo(pt.px, pt.py);
    }
    ctx.stroke();

    hitTargets.push({
      type: 'sun',
      px, py,
      radius: sunRadius * 3,
      data: {
        altitude: pos.altitude.toFixed(1),
        azimuth: pos.azimuth.toFixed(1),
        sunrise: sunData.sunrise,
        sunset: sunData.sunset
      }
    });
  }

  /**
   * Dibuja la luna con su fase
   */
  function drawMoon(moonData, time) {
    if (!moonData || !moonData.hourlyData) return;

    const pos = interpolateHourly(moonData.hourlyData, time);
    if (!pos || pos.altitude < 0) return;

    const { x, y } = azimuthalProject(pos.azimuth, pos.altitude);
    const { px, py } = toPixel(x, y);
    const moonRadius = 6;

    // Glow
    const glow = ctx.createRadialGradient(px, py, moonRadius, px, py, moonRadius * 5);
    glow.addColorStop(0, 'rgba(200, 210, 230, 0.08)');
    glow.addColorStop(1, 'rgba(200, 210, 230, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, moonRadius * 5, 0, TAU);
    ctx.fill();

    // Disco lunar (parte iluminada)
    ctx.fillStyle = '#c8cfe0';
    ctx.beginPath();
    ctx.arc(px, py, moonRadius, 0, TAU);
    ctx.fill();

    // Fase: sombra sobre el disco
    // phase: 0=nueva, 0.25=cuarto creciente, 0.5=llena, 0.75=cuarto menguante
    const phase = moonData.phase;
    if (phase < 0.98 && phase > 0.02) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, moonRadius, 0, TAU);
      ctx.clip();

      // Terminador: elipse que simula la sombra
      const illuminationAngle = phase * TAU;
      const shadowX = Math.cos(illuminationAngle) * moonRadius;

      ctx.fillStyle = '#000';
      ctx.beginPath();
      // Dibujar sombra como semicírculo + elipse
      if (phase < 0.5) {
        // Creciente: sombra ocupa la derecha
        ctx.arc(px, py, moonRadius, -Math.PI / 2, Math.PI / 2);
        ctx.ellipse(px, py, Math.abs(moonRadius * (1 - 2 * phase)), moonRadius, 0, Math.PI / 2, -Math.PI / 2);
      } else {
        // Menguante: sombra ocupa la izquierda
        ctx.arc(px, py, moonRadius, Math.PI / 2, -Math.PI / 2);
        ctx.ellipse(px, py, Math.abs(moonRadius * (2 * phase - 1)), moonRadius, 0, -Math.PI / 2, Math.PI / 2);
      }
      ctx.fill();
      ctx.restore();
    } else if (phase <= 0.02 || phase >= 0.98) {
      // Luna nueva: cubrir todo
      if (phase <= 0.02 || phase >= 0.98) {
        ctx.fillStyle = phase <= 0.02 ? 'rgba(0,0,0,0.9)' : 'transparent';
        if (phase <= 0.02) {
          ctx.beginPath();
          ctx.arc(px, py, moonRadius, 0, TAU);
          ctx.fill();
          // Borde tenue para que se vea
          ctx.strokeStyle = 'rgba(200, 210, 230, 0.15)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.arc(px, py, moonRadius, 0, TAU);
          ctx.stroke();
        }
      }
    }

    hitTargets.push({
      type: 'moon',
      px, py,
      radius: moonRadius * 3,
      data: {
        phase: moonData.phaseName,
        illumination: moonData.illumination,
        altitude: pos.altitude.toFixed(1),
        azimuth: pos.azimuth.toFixed(1),
        moonrise: moonData.moonrise,
        moonset: moonData.moonset
      }
    });
  }

  /**
   * Dibuja el gradiente de fondo según día/noche
   */
  function drawBackground(isDaytime) {
    if (isDaytime) {
      // De día: gradiente azul muy sutil (no puro negro)
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.5);
      grd.addColorStop(0, '#0a1628');
      grd.addColorStop(1, '#040810');
      ctx.fillStyle = grd;
    } else {
      // De noche: negro profundo
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.5);
      grd.addColorStop(0, '#050510');
      grd.addColorStop(1, '#000005');
      ctx.fillStyle = grd;
    }
    ctx.fillRect(0, 0, W, H);
  }

  function render(time, state) {
    hitTargets = [];

    drawBackground(state.isDaytime);
    drawFrame();
    drawConstellations(state.constellationLines, state.lat, state.lon, time);
    const starCount = drawStars(state.starCatalog, state.lat, state.lon, time);
    drawSun(state.sunData, time);
    drawMoon(state.moonData, time);

  }

  function getHitTargets() {
    return hitTargets;
  }

  function getLogicalWidth() { return W; }
  function getLogicalHeight() { return H; }

  return { render, resize, getHitTargets, toPixel, getLogicalWidth, getLogicalHeight };
}
