/**
 * Carta astral — estética meowrhino
 * Constelaciones reales grandes, texto horizontal, aspectos,
 * retrogradación, dignidades, panel info al click
 */
import {
  computeAscendant,
  equatorialToEclipticLon,
  computeSunEclipticLon,
  computeMoonEclipticLon
} from './astronomy.js';
import { computePlanetPositions } from './planets.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const SIGNS = [
  { name: 'aries',       constId: 'Ari' },
  { name: 'tauro',       constId: 'Tau' },
  { name: 'géminis',     constId: 'Gem' },
  { name: 'cáncer',      constId: 'Cnc' },
  { name: 'leo',         constId: 'Leo' },
  { name: 'virgo',       constId: 'Vir' },
  { name: 'libra',       constId: 'Lib' },
  { name: 'escorpio',    constId: 'Sco' },
  { name: 'sagitario',   constId: 'Sgr' },
  { name: 'capricornio', constId: 'Cap' },
  { name: 'acuario',     constId: 'Aqr' },
  { name: 'piscis',      constId: 'Psc' }
];

const DOMICILE = {
  sol: ['leo'], luna: ['cáncer'],
  mercurio: ['géminis', 'virgo'], venus: ['tauro', 'libra'],
  marte: ['aries', 'escorpio'], júpiter: ['sagitario', 'piscis'],
  saturno: ['capricornio', 'acuario']
};
const EXALTATION = {
  sol: 'aries', luna: 'tauro', mercurio: 'virgo', venus: 'piscis',
  marte: 'capricornio', júpiter: 'cáncer', saturno: 'libra'
};
const DETRIMENT = {
  sol: ['acuario'], luna: ['capricornio'],
  mercurio: ['sagitario', 'piscis'], venus: ['aries', 'escorpio'],
  marte: ['tauro', 'libra'], júpiter: ['géminis', 'virgo'],
  saturno: ['cáncer', 'leo']
};
const FALL = {
  sol: 'libra', luna: 'escorpio', mercurio: 'piscis', venus: 'virgo',
  marte: 'cáncer', júpiter: 'capricornio', saturno: 'aries'
};

const ASPECTS = [
  { name: 'conjunción', angle: 0,   orb: 8,  color: [255,255,255], dash: [] },
  { name: 'sextil',     angle: 60,  orb: 5,  color: [100,180,255], dash: [4, 4] },
  { name: 'cuadratura', angle: 90,  orb: 7,  color: [255,80,80],   dash: [] },
  { name: 'trígono',    angle: 120, orb: 7,  color: [80,200,120],  dash: [] },
  { name: 'oposición',  angle: 180, orb: 8,  color: [255,80,80],   dash: [6, 3] }
];

export function createNatalChart(canvas, callbacks = {}) {
  const ctx = canvas.getContext('2d');
  let W, H, cx, cy, outerR, innerR, planetR;
  let constellationShapes = null;
  let hitBodies = []; // for click detection
  let hitConstellations = []; // for constellation click
  let lastAscendant = 0;

  // Zoom state for planet detail
  let zoom = { level: 1, cx: 0, cy: 0, targetLevel: 1, targetCx: 0, targetCy: 0, animating: false, startTime: 0, duration: 400, startLevel: 1, startCx: 0, startCy: 0, panX: 0, panY: 0 };
  let zoomedBody = null;

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
    const base = Math.min(W, H) * 0.42;
    outerR = base;
    innerR = base * 0.78;
    planetR = base * 0.60;
    constellationShapes = null;
  }

  resize();

  function eclipticToAngle(eclipticLon, asc) {
    return (180 + asc - eclipticLon) * DEG;
  }

  function toXY(angle, r) {
    return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
  }

  // === Constellation shapes ===

  function buildConstellationShapes(lines) {
    if (!lines) return {};
    const shapes = {};
    for (const sign of SIGNS) {
      const feature = lines.find(f => f.properties.id === sign.constId);
      if (!feature) continue;
      const allPts = [];
      for (const line of feature.geometry.coordinates)
        for (const [lon, lat] of line) allPts.push([lon, lat]);
      if (!allPts.length) continue;

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [x, y] of allPts) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      const scale = Math.max(maxX - minX, maxY - minY) || 1;
      const cxN = (minX + maxX) / 2, cyN = (minY + maxY) / 2;
      shapes[sign.constId] = feature.geometry.coordinates.map(line =>
        line.map(([x, y]) => [(x - cxN) / scale, (y - cyN) / scale])
      );
    }
    return shapes;
  }

  // === Drawing ===

  function drawBackground() {
    ctx.fillStyle = '#07040a';
    ctx.fillRect(0, 0, W, H);
  }

  function drawWheel(asc) {
    // Outer + inner circles
    for (const [r, op] of [[outerR, 0.08], [innerR, 0.05]]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.strokeStyle = `rgba(255,255,255,${op})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Sign divisions
    for (let i = 0; i < 12; i++) {
      const a = eclipticToAngle(i * 30, asc);
      const p1 = toXY(a, innerR), p2 = toXY(a, outerR);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  function drawConstellations(asc) {
    if (!constellationShapes) return;
    const bandR = (outerR + innerR) / 2;
    const symbolSize = (outerR - innerR) * 0.55;

    for (let i = 0; i < 12; i++) {
      const sign = SIGNS[i];
      const shape = constellationShapes[sign.constId];
      if (!shape) continue;

      const midA = eclipticToAngle(i * 30 + 15, asc);
      const c = toXY(midA, bandR);

      // Draw constellation lines
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 0.9;
      ctx.lineCap = 'round';

      for (const line of shape) {
        if (line.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(c.x + line[0][0] * symbolSize, c.y - line[0][1] * symbolSize);
        for (let j = 1; j < line.length; j++) {
          ctx.lineTo(c.x + line[j][0] * symbolSize, c.y - line[j][1] * symbolSize);
        }
        ctx.stroke();
      }

      // Star dots
      for (const line of shape) {
        for (const [px, py] of line) {
          ctx.beginPath();
          ctx.arc(c.x + px * symbolSize, c.y - py * symbolSize, 1.4, 0, TAU);
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fill();
        }
      }

      // Sign name — horizontal, outside wheel
      const namePos = toXY(midA, outerR + 16);
      ctx.font = `${Math.max(7, outerR * 0.03)}px Inknut Antiqua, Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillText(sign.name, namePos.x, namePos.y);

      // Hit target for constellation click
      hitConstellations.push({ constId: sign.constId, name: sign.name, cx: c.x, cy: c.y, radius: symbolSize * 1.2 });
    }
  }

  function drawHouses(asc) {
    const h1 = Math.floor(asc / 30) * 30;
    for (let i = 0; i < 12; i++) {
      const a = eclipticToAngle(h1 + i * 30, asc);
      const isAxis = (i % 3 === 0);
      const from = isAxis ? 0 : planetR * 0.6;
      const p1 = toXY(a, from), p2 = toXY(a, innerR);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = isAxis ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.025)';
      ctx.lineWidth = isAxis ? 0.8 : 0.5;
      ctx.stroke();

      // House number — horizontal
      const midA = eclipticToAngle(h1 + i * 30 + 15, asc);
      const np = toXY(midA, innerR * 0.12);
      ctx.font = `${Math.max(7, outerR * 0.028)}px Inknut Antiqua, Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillText(String(i + 1), np.x, np.y);
    }
  }

  function drawAscMarker(asc) {
    const a = eclipticToAngle(asc, asc);
    const tip = toXY(a, outerR + 3);
    const b1 = toXY(a - 0.06, outerR + 10);
    const b2 = toXY(a + 0.06, outerR + 10);
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();

    const lp = toXY(a, outerR + 22);
    ctx.font = `${Math.max(8, outerR * 0.034)}px Inknut Antiqua, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('asc', lp.x, lp.y);
  }

  function getDignity(label, signName) {
    if (DOMICILE[label]?.includes(signName)) return 'domicilio';
    if (EXALTATION[label] === signName) return 'exaltación';
    if (DETRIMENT[label]?.includes(signName)) return 'detrimento';
    if (FALL[label] === signName) return 'caída';
    return null;
  }

  function drawBody(lon, displayLon, asc, label, color, size, retro, tier, collected) {
    const realA = eclipticToAngle(lon, asc);
    const dispA = eclipticToAngle(displayLon, asc);
    const pos = toXY(realA, planetR);

    // Glow
    const grd = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, size * 3.5);
    grd.addColorStop(0, color.replace(')', ',0.2)').replace('rgb', 'rgba'));
    grd.addColorStop(1, color.replace(')', ',0)').replace('rgb', 'rgba'));
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, size * 3.5, 0, TAU);
    ctx.fill();

    // Dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, size, 0, TAU);
    ctx.fill();

    // Label — HORIZONTAL, staggered by tier
    const labelPos = toXY(dispA, planetR - size - 14 - tier * 14);
    ctx.font = `${Math.max(7, outerR * 0.032)}px Inknut Antiqua, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(retro ? `${label} ℞` : label, labelPos.x, labelPos.y);

    // Degree — HORIZONTAL
    const signIdx = Math.floor(((lon % 360) + 360) % 360 / 30);
    const deg = (((lon % 360) + 360) % 360 % 30).toFixed(0);
    const signName = SIGNS[signIdx].name;
    const dignity = getDignity(label, signName);

    const degPos = toXY(dispA, planetR + size + 10 + tier * 10);
    ctx.font = `${Math.max(6, outerR * 0.024)}px Inknut Antiqua, Georgia, serif`;
    ctx.fillStyle = dignity ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.14)';
    let degText = `${deg}°`;
    if (dignity) degText += ` ${dignity}`;
    ctx.fillText(degText, degPos.x, degPos.y);

    // Collect for aspects + hit detection
    const bodyData = {
      lon, label, color, retro, signName, deg: parseInt(deg),
      dignity, px: pos.x, py: pos.y, size
    };
    if (collected) collected.push(bodyData);
    hitBodies.push(bodyData);
  }

  function drawAspects(bodies) {
    const aspectsFound = [];
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        let diff = Math.abs(bodies[i].lon - bodies[j].lon);
        if (diff > 180) diff = 360 - diff;

        for (const aspect of ASPECTS) {
          const err = Math.abs(diff - aspect.angle);
          if (err <= aspect.orb) {
            const strength = 1 - err / aspect.orb;
            const [r, g, b] = aspect.color;
            ctx.beginPath();
            ctx.moveTo(bodies[i].px, bodies[i].py);
            ctx.lineTo(bodies[j].px, bodies[j].py);
            ctx.strokeStyle = `rgba(${r},${g},${b},${0.06 + strength * 0.1})`;
            ctx.lineWidth = 0.4 + strength * 0.6;
            ctx.setLineDash(aspect.dash);
            ctx.stroke();
            ctx.setLineDash([]);

            aspectsFound.push({
              body1: bodies[i].label, body2: bodies[j].label,
              name: aspect.name, orb: err.toFixed(1)
            });
            break;
          }
        }
      }
    }
    // Store aspects on bodies for info panel
    for (const a of aspectsFound) {
      for (const b of bodies) {
        if (b.label === a.body1 || b.label === a.body2) {
          if (!b.aspects) b.aspects = [];
          const other = b.label === a.body1 ? a.body2 : a.body1;
          b.aspects.push(`${a.name} ${other} (${a.orb}°)`);
        }
      }
    }
  }

  function isRetrograde(name, time) {
    const now = computePlanetPositions(time);
    const prev = computePlanetPositions(new Date(time.getTime() - 86400000));
    const pN = now.find(p => p.name === name);
    const pP = prev.find(p => p.name === name);
    if (!pN || !pP) return false;
    let diff = equatorialToEclipticLon(pN.ra, pN.dec) - equatorialToEclipticLon(pP.ra, pP.dec);
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff < 0;
  }

  // === Detail overlay (like astrolabe detail view) ===

  function showDetail(body) {
    const label = document.getElementById('natal-detail-label');
    const info = document.getElementById('natal-detail-info');
    const detail = document.getElementById('natal-detail');

    label.textContent = body.label;

    let html = `<div class="ndi-position">${body.deg}° ${body.signName}${body.retro ? ' ℞' : ''}</div>`;
    if (body.dignity) html += `<div class="ndi-dignity">${body.dignity}</div>`;
    if (body.retro) html += `<div class="ndi-retro">retrógrado</div>`;

    if (body.aspects && body.aspects.length > 0) {
      html += `<div class="ndi-sep"></div>`;
      for (const a of body.aspects) {
        html += `<div class="ndi-aspect">${a}</div>`;
      }
    }

    info.innerHTML = html;
    detail.classList.remove('hidden');
    document.body.classList.add('natal-detail-mode');
  }

  function hideDetail() {
    const detail = document.getElementById('natal-detail');
    if (detail) detail.classList.add('hidden');
    document.body.classList.remove('natal-detail-mode');
  }

  // === Zoom animation ===
  // zoom.cx/cy = the point in canvas-space that gets centered on screen
  // zoom.panX/panY = accumulated drag offset in screen-space

  function zoomToBody(body) {
    zoomedBody = body;
    zoom.startLevel = zoom.level;
    zoom.startCx = zoom.cx;
    zoom.startCy = zoom.cy;
    zoom.targetLevel = 3.5;
    zoom.targetCx = body.px;
    zoom.targetCy = body.py;
    zoom.startTime = performance.now();
    zoom.duration = 450;
    zoom.animating = true;
    zoom.panX = 0;
    zoom.panY = 0;
  }

  function zoomReset() {
    zoomedBody = null;
    zoom.startLevel = zoom.level;
    zoom.startCx = zoom.cx;
    zoom.startCy = zoom.cy;
    zoom.targetLevel = 1;
    zoom.targetCx = cx; // canvas center
    zoom.targetCy = cy;
    zoom.startTime = performance.now();
    zoom.duration = 350;
    zoom.animating = true;
    zoom.panX = 0;
    zoom.panY = 0;
    hideDetail();
  }

  function updateZoom() {
    if (!zoom.animating) return false;
    const elapsed = performance.now() - zoom.startTime;
    const t = Math.min(1, elapsed / zoom.duration);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    zoom.level = zoom.startLevel + (zoom.targetLevel - zoom.startLevel) * ease;
    zoom.cx = zoom.startCx + (zoom.targetCx - zoom.startCx) * ease;
    zoom.cy = zoom.startCy + (zoom.targetCy - zoom.startCy) * ease;

    if (t >= 1) {
      zoom.animating = false;
      zoom.level = zoom.targetLevel;
      zoom.cx = zoom.targetCx;
      zoom.cy = zoom.targetCy;
    }
    return zoom.animating;
  }

  function isZoomed() { return zoom.level > 1.5; }

  // Convert screen coords to canvas (pre-transform) coords
  function screenToCanvas(sx, sy) {
    if (zoom.level <= 1.01) return { x: sx, y: sy };
    // Inverse of: translate(W/2 + panX, H/2 + panY) scale(level) translate(-focusX, -focusY)
    const x = (sx - W / 2 - (zoom.panX || 0)) / zoom.level + zoom.cx;
    const y = (sy - H / 2 - (zoom.panY || 0)) / zoom.level + zoom.cy;
    return { x, y };
  }

  // === Click & drag handler ===

  let dragState = null;

  canvas.addEventListener('mousedown', (e) => {
    dragState = { startX: e.clientX, startY: e.clientY, moved: false };
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;

    if (dragState.moved && isZoomed()) {
      zoom.panX = (zoom.panX || 0) + dx;
      zoom.panY = (zoom.panY || 0) + dy;
      dragState.startX = e.clientX;
      dragState.startY = e.clientY;
      if (callbacks.onNeedRender) callbacks.onNeedRender();
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    if (dragState && !dragState.moved) handleClick(e.clientX, e.clientY, e);
    dragState = null;
  });

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      dragState = { startX: t.clientX, startY: t.clientY, moved: false };
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (!dragState || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - dragState.startX;
    const dy = t.clientY - dragState.startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;

    if (dragState.moved && isZoomed()) {
      e.preventDefault();
      zoom.panX = (zoom.panX || 0) + dx;
      zoom.panY = (zoom.panY || 0) + dy;
      dragState.startX = t.clientX;
      dragState.startY = t.clientY;
      if (callbacks.onNeedRender) callbacks.onNeedRender();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (dragState && !dragState.moved && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      handleClick(t.clientX, t.clientY, e);
    }
    dragState = null;
  });

  function handleClick(clientX, clientY, e) {
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;

    // Transform screen coords to canvas coords for hit detection
    const { x: mx, y: my } = screenToCanvas(sx, sy);

    // Check planet hits (works both zoomed and unzoomed)
    for (const body of hitBodies) {
      const dx = mx - body.px;
      const dy = my - body.py;
      const hitR = isZoomed() ? Math.max(body.size * 2, 12) : Math.max(body.size * 3, 22);
      if (Math.sqrt(dx * dx + dy * dy) < hitR) {
        e.stopPropagation();
        zoomToBody(body);
        showDetail(body);
        if (callbacks.onNeedRender) callbacks.onNeedRender();
        return;
      }
    }

    // If zoomed and didn't hit a planet, zoom out
    if (isZoomed()) {
      zoomReset();
      if (callbacks.onNeedRender) callbacks.onNeedRender();
      return;
    }

    // Check constellation hits (only when not zoomed)
    for (const con of hitConstellations) {
      const dx = mx - con.cx;
      const dy = my - con.cy;
      if (Math.sqrt(dx * dx + dy * dy) < con.radius) {
        e.stopPropagation();
        if (callbacks.onConstellationClick) callbacks.onConstellationClick(con.constId, con.name);
        return;
      }
    }
  }

  // === Main render ===

  function render(time, state) {
    if (!constellationShapes && state.constellationLines) {
      constellationShapes = buildConstellationShapes(state.constellationLines);
    }

    hitBodies = [];
    hitConstellations = [];
    drawBackground();

    // Apply zoom transform — centers focus point on screen + pan offset
    ctx.save();
    if (zoom.level > 1.01) {
      ctx.translate(W / 2 + (zoom.panX || 0), H / 2 + (zoom.panY || 0));
      ctx.scale(zoom.level, zoom.level);
      ctx.translate(-zoom.cx, -zoom.cy);
    }

    const asc = computeAscendant(time, state.lat, state.lon);
    lastAscendant = asc;
    const bodies = [];

    drawWheel(asc);
    drawConstellations(asc);
    drawHouses(asc);
    drawAscMarker(asc);

    // Collect bodies
    const allBodies = [];
    allBodies.push({ lon: computeSunEclipticLon(time), label: 'sol', color: 'rgb(255,200,80)', size: 5, retro: false });
    allBodies.push({ lon: computeMoonEclipticLon(time), label: 'luna', color: 'rgb(200,210,230)', size: 4, retro: false });

    if (state.planets) {
      const retroMap = {};
      for (const p of state.planets) retroMap[p.name] = isRetrograde(p.name, time);
      for (const p of state.planets) {
        const lon = equatorialToEclipticLon(p.ra, p.dec);
        const [r, g, b] = (p.color || '#fff').match(/\w{2}/g).map(h => parseInt(h, 16));
        allBodies.push({ lon, label: p.label, color: `rgb(${r},${g},${b})`, size: 3.5, retro: retroMap[p.name] });
      }
    }

    // Spread clusters
    allBodies.sort((a, b) => a.lon - b.lon);
    const minSep = 9;
    for (let pass = 0; pass < 6; pass++) {
      for (let i = 1; i < allBodies.length; i++) {
        const prev = allBodies[i - 1].displayLon ?? allBodies[i - 1].lon;
        const curr = allBodies[i].displayLon ?? allBodies[i].lon;
        let diff = curr - prev; if (diff < 0) diff += 360;
        if (diff < minSep) {
          const shift = (minSep - diff) / 2;
          allBodies[i - 1].displayLon = prev - shift;
          allBodies[i].displayLon = curr + shift;
        }
      }
    }

    // Assign tiers
    for (let i = 0; i < allBodies.length; i++) {
      allBodies[i].tier = 0;
      if (i > 0) {
        const prev = allBodies[i - 1].displayLon ?? allBodies[i - 1].lon;
        const curr = allBodies[i].displayLon ?? allBodies[i].lon;
        let diff = Math.abs(curr - prev); if (diff > 180) diff = 360 - diff;
        if (diff < 14) allBodies[i].tier = (allBodies[i - 1].tier + 1) % 2;
      }
    }

    // Draw
    for (const b of allBodies) {
      drawBody(b.lon, b.displayLon ?? b.lon, asc, b.label, b.color, b.size, b.retro, b.tier, bodies);
    }

    drawAspects(bodies);

    ctx.restore();
  }

  return { render, resize, updateZoom, isZoomed, zoomReset, getHitBodies: () => hitBodies };
}
