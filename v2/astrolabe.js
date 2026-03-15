/**
 * Renderizado del astrolabio en Canvas 2D
 * Disco circular: zenit en centro, horizonte en borde
 * Soporta zoom suave en una región del cielo
 */
import { equatorialToHorizontal, azimuthalProject, geoJsonToRaDec, interpolateHourly } from './astronomy.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export function createAstrolabe(canvas) {
  const ctx = canvas.getContext('2d');
  let W, H, cx, cy, radius;
  let hitTargets = [];

  // Zoom state
  let zoom = { level: 1, cx: 0, cy: 0 }; // cx/cy in normalized coords (-1..1)
  let zoomAnim = null; // { from, to, start, duration }

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
   * Aplica zoom: centra en zoom.cx/cy y escala por zoom.level
   */
  function toPixel(nx, ny) {
    const zx = (nx - zoom.cx) * zoom.level;
    const zy = (ny - zoom.cy) * zoom.level;
    return {
      px: cx + zx * radius,
      py: cy + zy * radius
    };
  }

  /**
   * Inicia animación de zoom hacia un punto (en coordenadas normalizadas)
   */
  function zoomTo(targetCx, targetCy, targetLevel, duration = 450) {
    zoomAnim = {
      from: { level: zoom.level, cx: zoom.cx, cy: zoom.cy },
      to: { level: targetLevel, cx: targetCx, cy: targetCy },
      start: performance.now(),
      duration
    };
  }

  function zoomReset(duration = 400) {
    zoomTo(0, 0, 1, duration);
  }

  /**
   * Desplaza el centro del zoom por un delta en píxeles
   */
  function panBy(dxPx, dyPx) {
    if (zoom.level <= 1) return;
    zoom.cx += dxPx / (radius * zoom.level);
    zoom.cy += dyPx / (radius * zoom.level);
  }

  /**
   * Actualiza el zoom si hay animación activa
   * Retorna true si la animación sigue activa
   */
  function updateZoom() {
    if (!zoomAnim) return false;

    const t = Math.min(1, (performance.now() - zoomAnim.start) / zoomAnim.duration);
    // ease-out cubic
    const e = 1 - Math.pow(1 - t, 3);

    zoom.level = zoomAnim.from.level + (zoomAnim.to.level - zoomAnim.from.level) * e;
    zoom.cx = zoomAnim.from.cx + (zoomAnim.to.cx - zoomAnim.from.cx) * e;
    zoom.cy = zoomAnim.from.cy + (zoomAnim.to.cy - zoomAnim.from.cy) * e;

    if (t >= 1) {
      zoomAnim = null;
    }
    return t < 1;
  }

  function isAnimating() {
    return zoomAnim !== null;
  }

  function getZoomLevel() {
    return zoom.level;
  }

  /**
   * Dibuja los anillos de referencia y marcas cardinales
   */
  function drawFrame() {
    // Anillo del horizonte
    const horizonCenter = toPixel(0, 0);
    const horizonEdge = toPixel(1, 0);
    const visibleRadius = Math.abs(horizonEdge.px - horizonCenter.px);

    ctx.beginPath();
    ctx.arc(horizonCenter.px, horizonCenter.py, visibleRadius, 0, TAU);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Anillos de altitud (30° y 60°)
    for (const alt of [30, 60]) {
      const r = ((90 - alt) / 90) * visibleRadius;
      ctx.beginPath();
      ctx.arc(horizonCenter.px, horizonCenter.py, r, 0, TAU);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([4, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Zenit dot
    const zenith = toPixel(0, 0);
    ctx.beginPath();
    ctx.arc(zenith.px, zenith.py, 1.5, 0, TAU);
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
      const { x, y } = azimuthalProject(c.az, -5);
      const { px, py } = toPixel(x, y);
      // Only draw if on screen
      if (px > -50 && px < W + 50 && py > -50 && py < H + 50) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillText(c.label, px, py);
      }
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

      // Cull off-screen stars
      if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;

      // Tamaño y brillo según magnitud — escalar con zoom
      const brightness = Math.max(0.08, (magLimit - star.mag) / magLimit);
      const baseSize = Math.max(0.3, (magLimit - star.mag) / magLimit * 2.5);
      const size = baseSize * Math.min(zoom.level, 3); // Scale stars with zoom but cap

      // Color sutil según magnitud
      let r = 255, g = 255, b = 255;
      if (star.mag < 1) {
        if (star.dec > 0) { r = 255; g = 245; b = 220; }
        else { r = 220; g = 230; b = 255; }
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

    const lineOpacity = zoom.level > 1.5 ? 0.15 : 0.07;
    ctx.strokeStyle = `rgba(255, 255, 255, ${lineOpacity})`;
    ctx.lineWidth = zoom.level > 1.5 ? 1 : 0.5;

    for (const constellation of lines) {
      const { geometry, properties } = constellation;
      if (geometry.type !== 'MultiLineString') continue;

      const allPoints = [];

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
          if (Math.sqrt(dx * dx + dy * dy) > radius * zoom.level * 1.2) { hasGap = true; break; }
        }
        if (hasGap) continue;

        // Check if any point is on screen
        const onScreen = points.some(p => p.px > -100 && p.px < W + 100 && p.py > -100 && p.py < H + 100);
        if (!onScreen) continue;

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

        if (centX > -50 && centX < W + 50 && centY > -50 && centY < H + 50) {
          const fontSize = zoom.level > 1.5 ? 10 : 8;
          ctx.font = `${fontSize}px Inknut Antiqua, Georgia, serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const nameOpacity = zoom.level > 1.5 ? 0.2 : 0.12;
          ctx.fillStyle = `rgba(255, 255, 255, ${nameOpacity})`;
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

    // Cull off-screen
    if (px < -100 || px > W + 100 || py < -100 || py > H + 100) return;

    const sunRadius = 8 * Math.min(zoom.level, 2.5);

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

    // Cull off-screen
    if (px < -100 || px > W + 100 || py < -100 || py > H + 100) return;

    const moonRadius = 6 * Math.min(zoom.level, 2.5);

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

    // Fase
    const phase = moonData.phase;
    if (phase < 0.98 && phase > 0.02) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, moonRadius, 0, TAU);
      ctx.clip();

      ctx.fillStyle = '#000';
      ctx.beginPath();
      if (phase < 0.5) {
        ctx.arc(px, py, moonRadius, -Math.PI / 2, Math.PI / 2);
        ctx.ellipse(px, py, Math.abs(moonRadius * (1 - 2 * phase)), moonRadius, 0, Math.PI / 2, -Math.PI / 2);
      } else {
        ctx.arc(px, py, moonRadius, Math.PI / 2, -Math.PI / 2);
        ctx.ellipse(px, py, Math.abs(moonRadius * (2 * phase - 1)), moonRadius, 0, -Math.PI / 2, Math.PI / 2);
      }
      ctx.fill();
      ctx.restore();
    } else if (phase <= 0.02) {
      ctx.fillStyle = 'rgba(0,0,0,0.9)';
      ctx.beginPath();
      ctx.arc(px, py, moonRadius, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200, 210, 230, 0.15)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(px, py, moonRadius, 0, TAU);
      ctx.stroke();
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
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.5);
      grd.addColorStop(0, '#0a1628');
      grd.addColorStop(1, '#040810');
      ctx.fillStyle = grd;
    } else {
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
    drawStars(state.starCatalog, state.lat, state.lon, time);
    drawSun(state.sunData, time);
    drawMoon(state.moonData, time);
  }

  function getHitTargets() {
    return hitTargets;
  }

  function getLogicalWidth() { return W; }
  function getLogicalHeight() { return H; }

  return {
    render, resize, getHitTargets, toPixel,
    getLogicalWidth, getLogicalHeight,
    zoomTo, zoomReset, updateZoom, isAnimating, getZoomLevel, panBy
  };
}
