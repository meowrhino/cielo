/**
 * Renderizado del astrolabio en Canvas 2D
 * Disco circular: zenit en centro, horizonte en borde
 * Soporta zoom suave en una región del cielo
 */
import { equatorialToHorizontal, azimuthalProject, geoJsonToRaDec, computeSunPosition } from './astronomy.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** Nombres propios de estrellas brillantes (mag < 2.5) */
const STAR_NAMES = [
  { ra: 101.3, dec: -16.7, name: 'sirius' },
  { ra: 96.0, dec: -52.7, name: 'canopus' },
  { ra: 213.9, dec: 19.2, name: 'arcturus' },
  { ra: 279.2, dec: 38.8, name: 'vega' },
  { ra: 78.6, dec: 46.0, name: 'capella' },
  { ra: 78.6, dec: -8.2, name: 'rigel' },
  { ra: 114.8, dec: 5.2, name: 'procyon' },
  { ra: 88.8, dec: 7.4, name: 'betelgeuse' },
  { ra: 297.7, dec: 8.9, name: 'altair' },
  { ra: 68.0, dec: 16.5, name: 'aldebaran' },
  { ra: 201.3, dec: -11.2, name: 'spica' },
  { ra: 247.4, dec: -26.4, name: 'antares' },
  { ra: 116.3, dec: 28.0, name: 'pollux' },
  { ra: 344.4, dec: -29.6, name: 'fomalhaut' },
  { ra: 310.4, dec: 45.3, name: 'deneb' },
  { ra: 152.1, dec: 12.0, name: 'regulus' },
  { ra: 186.6, dec: -63.1, name: 'acrux' },
  { ra: 219.9, dec: -60.8, name: 'mimosa' },
  { ra: 210.9, dec: -60.4, name: 'gacrux' },
  { ra: 263.4, dec: -37.1, name: 'shaula' },
  { ra: 165.9, dec: 61.8, name: 'dubhe' },
  { ra: 104.7, dec: -28.9, name: 'wezen' },
  { ra: 37.9, dec: 89.3, name: 'polaris' },
  { ra: 95.7, dec: -17.9, name: 'mirzam' },
  { ra: 187.8, dec: -57.1, name: 'hadar' },
  { ra: 24.4, dec: -57.2, name: 'achernar' },
  { ra: 81.3, dec: 6.3, name: 'bellatrix' },
  { ra: 81.6, dec: -1.9, name: 'alnilam' },
  { ra: 104.0, dec: -26.4, name: 'adhara' },
  { ra: 113.6, dec: 31.9, name: 'castor' },
  { ra: 206.9, dec: 49.3, name: 'alioth' },
  { ra: 193.5, dec: 55.0, name: 'mizar' },
  { ra: 200.9, dec: 54.9, name: 'alkaid' },
  { ra: 83.0, dec: -0.3, name: 'mintaka' },
  { ra: 84.1, dec: -1.2, name: 'alnilam' },
  { ra: 85.2, dec: -1.9, name: 'alnitak' },
  { ra: 191.9, dec: -59.7, name: 'alfa centauri' },
  { ra: 233.7, dec: 26.7, name: 'alphecca' },
  { ra: 283.8, dec: 33.4, name: 'albireo' },
  { ra: 305.6, dec: 40.3, name: 'sadr' },
  { ra: 269.2, dec: 51.5, name: 'eltanin' },
  { ra: 257.6, dec: -16.0, name: 'sabik' },
  { ra: 253.1, dec: -38.0, name: 'kaus australis' },
  { ra: 286.4, dec: -27.7, name: 'nunki' },
  { ra: 252.2, dec: -69.0, name: 'atria' },
  { ra: 49.9, dec: 41.1, name: 'mirfak' },
  { ra: 51.1, dec: 49.9, name: 'algol' },
  { ra: 41.0, dec: 23.5, name: 'alcyone' },
];

function findStarName(ra, dec) {
  for (const s of STAR_NAMES) {
    const dra = Math.abs(ra - s.ra);
    const ddec = Math.abs(dec - s.dec);
    if (dra < 1.5 && ddec < 1.5) return s.name;
  }
  return null;
}

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
    zoom.cx += dxPx / (radius * Math.max(zoom.level, 1));
    zoom.cy += dyPx / (radius * Math.max(zoom.level, 1));
  }

  /**
   * Establece el centro de vista directamente (para modo AR)
   */
  function setViewCenter(newCx, newCy) {
    zoom.cx = newCx;
    zoom.cy = newCy;
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

  function setZoomLevel(level) {
    zoom.level = level;
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
  function drawStars(catalog, lat, lon, time, magLimit) {
    if (!catalog) return;

    magLimit = magLimit || 6;
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
        const properName = findStarName(star.ra, star.dec);
        hitTargets.push({
          type: 'star',
          px, py,
          radius: Math.max(size * 3, 12),
          data: { name: properName || star.name, mag: star.mag, azimuth, altitude, ra: star.ra, dec: star.dec }
        });
      }

      count++;
    }

    return count;
  }

  /**
   * Dibuja las líneas de constelaciones
   */
  function drawConstellations(lines, lat, lon, time, magLimit) {
    if (!lines) return;

    const BELOW_HORIZON_LIMIT = -15; // mostrar hasta -15° bajo el horizonte

    for (const constellation of lines) {
      const { geometry, properties } = constellation;
      if (geometry.type !== 'MultiLineString') continue;

      const allPoints = [];

      for (const lineCoords of geometry.coordinates) {
        const points = [];
        let anyTooLow = false;
        let minAlt = 90;

        for (const [geoLon, geoLat] of lineCoords) {
          const { ra, dec } = geoJsonToRaDec(geoLon, geoLat);
          const { azimuth, altitude } = equatorialToHorizontal(ra, dec, lat, lon, time);

          if (altitude < BELOW_HORIZON_LIMIT) { anyTooLow = true; break; }
          if (altitude < minAlt) minAlt = altitude;

          const proj = azimuthalProject(azimuth, Math.max(altitude, 0.5));
          const { px, py } = toPixel(proj.x, proj.y);
          points.push({ px, py, altitude });
        }

        if (anyTooLow || points.length < 2) continue;

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

        // Opacidad según altitud mínima de la línea
        const belowFactor = minAlt < 0 ? Math.max(0.15, 1 + minAlt / 15) : 1;
        const magFactor = magLimit != null ? Math.max(0, Math.min(1, (magLimit - 2) / 4)) : 1;
        const baseOpacity = zoom.level > 1.5 ? 0.15 : 0.07;
        const lineOpacity = baseOpacity * belowFactor * magFactor;

        ctx.strokeStyle = `rgba(255, 255, 255, ${lineOpacity})`;
        ctx.lineWidth = zoom.level > 1.5 ? 1 : 0.5;

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
        const avgAlt = allPoints.reduce((s, p) => s + p.altitude, 0) / allPoints.length;
        const nameFade = avgAlt < 0 ? Math.max(0.15, 1 + avgAlt / 15) : 1;

        if (centX > -50 && centX < W + 50 && centY > -50 && centY < H + 50) {
          const fontSize = zoom.level > 1.5 ? 10 : 8;
          ctx.font = `${fontSize}px Inknut Antiqua, Georgia, serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const nameMagFade = magLimit != null ? Math.max(0, Math.min(1, (magLimit - 2) / 4)) : 1;
          const nameOpacity = (zoom.level > 1.5 ? 0.2 : 0.12) * nameFade * nameMagFade;
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
   * Dibuja el sol — posición dinámica vía RA/Dec
   */
  function drawSun(sunData, sunPosition, lat, lon, time) {
    if (!sunPosition) return;

    const { azimuth, altitude } = equatorialToHorizontal(sunPosition.ra, sunPosition.dec, lat, lon, time);
    if (altitude < -5) return;

    const { x, y } = azimuthalProject(azimuth, Math.max(altitude, 0));
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

    // Trayectoria del sol (arco del día) — computada dinámicamente
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 200, 60, 0.08)';
    ctx.lineWidth = 1;
    let first = true;
    const today = new Date(time);
    for (let h = 0; h < 24; h++) {
      today.setHours(h, 0, 0, 0);
      const hPos = computeSunPosition(today);
      const hHoriz = equatorialToHorizontal(hPos.ra, hPos.dec, lat, lon, today);
      if (hHoriz.altitude < 0) continue;
      const proj = azimuthalProject(hHoriz.azimuth, hHoriz.altitude);
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
        altitude: altitude.toFixed(1),
        azimuth: azimuth.toFixed(1),
        sunrise: sunData ? sunData.sunrise : '',
        sunset: sunData ? sunData.sunset : ''
      }
    });
  }

  /**
   * Dibuja la luna con su fase — posición dinámica vía RA/Dec
   */
  function drawMoon(moonData, moonPosition, lat, lon, time) {
    if (!moonPosition) return;

    const { azimuth, altitude } = equatorialToHorizontal(moonPosition.ra, moonPosition.dec, lat, lon, time);
    if (altitude < 0) return;

    const { x, y } = azimuthalProject(azimuth, altitude);
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

    // Fase (usar datos del archivo si disponibles)
    const phase = moonData ? moonData.phase : 0.5;
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
        phase: moonData ? moonData.phaseName : '',
        illumination: moonData ? moonData.illumination : '',
        altitude: altitude.toFixed(1),
        azimuth: azimuth.toFixed(1),
        moonrise: moonData ? moonData.moonrise : '',
        moonset: moonData ? moonData.moonset : ''
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

  /**
   * Dibuja los planetas visibles
   */
  function drawPlanets(planets, lat, lon, time) {
    if (!planets) return;

    for (const planet of planets) {
      const { azimuth, altitude } = equatorialToHorizontal(planet.ra, planet.dec, lat, lon, time);
      if (altitude < 0) continue;

      const { x, y } = azimuthalProject(azimuth, altitude);
      const { px, py } = toPixel(x, y);

      if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;

      const baseSize = Math.max(2, (6 - planet.magnitude) / 2);
      const size = baseSize * Math.min(zoom.level, 3);

      // Color del planeta
      const col = planet.color;
      const r = parseInt(col.slice(1, 3), 16);
      const g = parseInt(col.slice(3, 5), 16);
      const b = parseInt(col.slice(5, 7), 16);

      // Glow coloreado
      const glowR = size * 5;
      const grd = ctx.createRadialGradient(px, py, 0, px, py, glowR);
      grd.addColorStop(0, `rgba(${r},${g},${b},0.3)`);
      grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, glowR, 0, TAU);
      ctx.fill();

      // Disco del planeta
      ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, TAU);
      ctx.fill();

      // Etiqueta
      if (zoom.level > 1.5 || planet.magnitude < 0) {
        ctx.font = '9px Inknut Antiqua, Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(${r},${g},${b},0.5)`;
        ctx.fillText(planet.label, px, py + size + 12);
      }

      hitTargets.push({
        type: 'planet',
        px, py,
        radius: Math.max(size * 3, 15),
        data: { name: planet.name, label: planet.label, magnitude: planet.magnitude, azimuth, altitude }
      });
    }
  }

  function render(time, state) {
    hitTargets = [];

    drawBackground(state.isDaytime);
    drawFrame();
    drawConstellations(state.constellationLines, state.lat, state.lon, time, state.magLimit);
    drawStars(state.starCatalog, state.lat, state.lon, time, state.magLimit);
    drawPlanets(state.planets, state.lat, state.lon, time);
    drawSun(state.sunData, state.sunPosition, state.lat, state.lon, time);
    drawMoon(state.moonData, state.moonPosition, state.lat, state.lon, time);
  }

  function getHitTargets() {
    return hitTargets;
  }

  function getLogicalWidth() { return W; }
  function getLogicalHeight() { return H; }

  return {
    render, resize, getHitTargets, toPixel,
    getLogicalWidth, getLogicalHeight,
    zoomTo, zoomReset, updateZoom, isAnimating, getZoomLevel, setZoomLevel, panBy,
    setViewCenter
  };
}
