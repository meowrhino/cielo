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

export function createNatalChart(canvas) {
  const ctx = canvas.getContext('2d');
  let W, H, cx, cy, outerR, innerR, planetR;
  let constellationShapes = null;
  let hitBodies = []; // for click detection
  let lastAscendant = 0;

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
    const symbolSize = (outerR - innerR) * 0.42; // bigger!

    for (let i = 0; i < 12; i++) {
      const sign = SIGNS[i];
      const shape = constellationShapes[sign.constId];
      if (!shape) continue;

      const midA = eclipticToAngle(i * 30 + 15, asc);
      const c = toXY(midA, bandR);

      // Draw constellation lines (NO rotation — just translate)
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 0.8;
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
          ctx.arc(c.x + px * symbolSize, c.y - py * symbolSize, 1.2, 0, TAU);
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
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

  // === Info panel ===

  function showInfoPanel(body) {
    let existing = document.getElementById('natal-info');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'natal-info';
    panel.className = 'natal-info';

    let html = `<div class="natal-info-title">${body.label}${body.retro ? ' ℞' : ''}</div>`;
    html += `<div class="natal-info-row">${body.deg}° ${body.signName}</div>`;
    if (body.dignity) html += `<div class="natal-info-row natal-info-dignity">${body.dignity}</div>`;
    if (body.retro) html += `<div class="natal-info-row">retrógrado</div>`;

    if (body.aspects && body.aspects.length > 0) {
      html += `<div class="natal-info-sep"></div>`;
      for (const a of body.aspects) {
        html += `<div class="natal-info-row natal-info-aspect">${a}</div>`;
      }
    }

    panel.innerHTML = html;
    document.body.appendChild(panel);

    // Close on click anywhere
    setTimeout(() => {
      const close = () => { panel.remove(); document.removeEventListener('click', close); };
      document.addEventListener('click', close);
    }, 50);
  }

  // === Click handler ===

  function setupClick() {
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const mx = (e.clientX - rect.left);
      const my = (e.clientY - rect.top);

      for (const body of hitBodies) {
        const dx = mx - body.px;
        const dy = my - body.py;
        if (Math.sqrt(dx * dx + dy * dy) < Math.max(body.size * 3, 20)) {
          e.stopPropagation();
          showInfoPanel(body);
          return;
        }
      }
    });
  }

  setupClick();

  // === Main render ===

  function render(time, state) {
    if (!constellationShapes && state.constellationLines) {
      constellationShapes = buildConstellationShapes(state.constellationLines);
    }

    hitBodies = [];
    drawBackground();

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
  }

  return { render, resize, getHitBodies: () => hitBodies };
}
