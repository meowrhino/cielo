/**
 * Renderizado de carta astral (rueda zodiacal)
 * Constelaciones reales como símbolos, aspectos ptolemaicos,
 * retrogradación, dignidades esenciales
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
const RAD = 180 / Math.PI;

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

// Dignidades esenciales (domicilio tradicional)
const DOMICILE = {
  sol:       ['leo'],
  luna:      ['cáncer'],
  mercurio:  ['géminis', 'virgo'],
  venus:     ['tauro', 'libra'],
  marte:     ['aries', 'escorpio'],
  júpiter:   ['sagitario', 'piscis'],
  saturno:   ['capricornio', 'acuario']
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

// Aspectos ptolemaicos
const ASPECTS = [
  { name: 'conjunción', angle: 0,   orb: 8,  style: 'rgba(255,255,255,0.15)', dash: [] },
  { name: 'sextil',     angle: 60,  orb: 5,  style: 'rgba(100,180,255,0.12)', dash: [4, 4] },
  { name: 'cuadratura', angle: 90,  orb: 7,  style: 'rgba(255,80,80,0.12)',   dash: [] },
  { name: 'trígono',    angle: 120, orb: 7,  style: 'rgba(80,200,120,0.12)',  dash: [] },
  { name: 'oposición',  angle: 180, orb: 8,  style: 'rgba(255,80,80,0.15)',   dash: [6, 3] }
];

export function createNatalChart(canvas) {
  const ctx = canvas.getContext('2d');
  let W, H, cx, cy, outerR, innerR, planetR, aspectR;
  let constellationShapes = null; // cached mini-shapes

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
    innerR = base * 0.80;
    planetR = base * 0.62;
    aspectR = base * 0.42;
    constellationShapes = null; // re-compute on resize
  }

  resize();

  function eclipticToAngle(eclipticLon, ascendant) {
    return (180 + ascendant - eclipticLon) * DEG;
  }

  /**
   * Pre-compute normalized constellation shapes for the zodiac band.
   * Each shape is an array of polylines with coords normalized to [-1,1].
   */
  function buildConstellationShapes(constellationLines) {
    if (!constellationLines) return {};
    const shapes = {};

    for (const sign of SIGNS) {
      const feature = constellationLines.find(f => f.properties.id === sign.constId);
      if (!feature) continue;

      const allPts = [];
      for (const line of feature.geometry.coordinates) {
        for (const [lon, lat] of line) allPts.push([lon, lat]);
      }
      if (allPts.length === 0) continue;

      // Bounding box
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [x, y] of allPts) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }

      const rangeX = maxX - minX || 1;
      const rangeY = maxY - minY || 1;
      const scale = Math.max(rangeX, rangeY);
      const cxN = (minX + maxX) / 2;
      const cyN = (minY + maxY) / 2;

      const lines = [];
      for (const line of feature.geometry.coordinates) {
        const pts = line.map(([x, y]) => [(x - cxN) / scale, (y - cyN) / scale]);
        lines.push(pts);
      }

      shapes[sign.constId] = lines;
    }

    return shapes;
  }

  function drawBackground() {
    ctx.fillStyle = '#07040a';
    ctx.fillRect(0, 0, W, H);
  }

  function drawZodiacWheel(ascendant) {
    // Outer circle
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, TAU);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, TAU);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.stroke();

    // Sign divisions
    for (let i = 0; i < 12; i++) {
      const signStart = i * 30;
      const angle = eclipticToAngle(signStart, ascendant);

      ctx.beginPath();
      ctx.moveTo(cx + innerR * Math.cos(angle), cy - innerR * Math.sin(angle));
      ctx.lineTo(cx + outerR * Math.cos(angle), cy - outerR * Math.sin(angle));
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  /**
   * Draw mini constellation figures in each zodiac segment
   */
  function drawConstellationSymbols(ascendant) {
    if (!constellationShapes) return;

    const bandR = (outerR + innerR) / 2;
    const symbolSize = (outerR - innerR) * 0.32;

    for (let i = 0; i < 12; i++) {
      const sign = SIGNS[i];
      const shape = constellationShapes[sign.constId];
      if (!shape) continue;

      const midAngle = eclipticToAngle(i * 30 + 15, ascendant);
      const centerX = cx + bandR * Math.cos(midAngle);
      const centerY = cy - bandR * Math.sin(midAngle);

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(-midAngle + Math.PI / 2);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 0.7;
      ctx.lineCap = 'round';

      for (const line of shape) {
        if (line.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(line[0][0] * symbolSize, -line[0][1] * symbolSize);
        for (let j = 1; j < line.length; j++) {
          ctx.lineTo(line[j][0] * symbolSize, -line[j][1] * symbolSize);
        }
        ctx.stroke();
      }

      // Tiny dots at vertices
      for (const line of shape) {
        for (const [px, py] of line) {
          ctx.beginPath();
          ctx.arc(px * symbolSize, -py * symbolSize, 1, 0, TAU);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.fill();
        }
      }

      ctx.restore();

      // Sign name outside (subtle)
      const nameR = outerR + 14;
      const nx = cx + nameR * Math.cos(midAngle);
      const ny = cy - nameR * Math.sin(midAngle);
      let nameAngle = -midAngle + Math.PI / 2;
      if (nameAngle > Math.PI / 2) nameAngle -= Math.PI;
      if (nameAngle < -Math.PI / 2) nameAngle += Math.PI;
      ctx.save();
      ctx.translate(nx, ny);
      ctx.rotate(nameAngle);
      ctx.font = `${Math.max(7, outerR * 0.028)}px Inknut Antiqua, Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillText(sign.name, 0, 0);
      ctx.restore();
    }
  }

  function drawHouses(ascendant) {
    const house1Sign = Math.floor(ascendant / 30) * 30;

    for (let i = 0; i < 12; i++) {
      const houseStart = house1Sign + i * 30;
      const angle = eclipticToAngle(houseStart, ascendant);

      // Angular axes (1/7, 4/10) thicker
      const isAxis = (i === 0 || i === 3 || i === 6 || i === 9);

      ctx.beginPath();
      ctx.moveTo(cx + (isAxis ? 0 : aspectR * 0.5) * Math.cos(angle),
                 cy - (isAxis ? 0 : aspectR * 0.5) * Math.sin(angle));
      ctx.lineTo(cx + innerR * Math.cos(angle), cy - innerR * Math.sin(angle));
      ctx.strokeStyle = isAxis ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = isAxis ? 1 : 0.5;
      ctx.stroke();

      // House number
      const midAngle = eclipticToAngle(houseStart + 15, ascendant);
      const numR = innerR * 0.15;
      const nx = cx + numR * Math.cos(midAngle);
      const ny = cy - numR * Math.sin(midAngle);

      ctx.font = `${Math.max(7, outerR * 0.03)}px Inknut Antiqua, Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillText(String(i + 1), nx, ny);
    }
  }

  function drawAscendantMarker(ascendant) {
    const angle = eclipticToAngle(ascendant, ascendant);

    // Small triangle pointing inward
    const tipR = outerR + 3;
    const baseR = outerR + 10;
    const spread = 0.06;

    ctx.beginPath();
    ctx.moveTo(cx + tipR * Math.cos(angle), cy - tipR * Math.sin(angle));
    ctx.lineTo(cx + baseR * Math.cos(angle - spread), cy - baseR * Math.sin(angle - spread));
    ctx.lineTo(cx + baseR * Math.cos(angle + spread), cy - baseR * Math.sin(angle + spread));
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fill();

    // "asc" label
    const labelR = outerR + 20;
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy - labelR * Math.sin(angle);
    ctx.font = `${Math.max(8, outerR * 0.032)}px Inknut Antiqua, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillText('asc', lx, ly);
  }

  /**
   * Get dignity status for a planet in a sign
   */
  function getDignity(label, signName) {
    if (DOMICILE[label] && DOMICILE[label].includes(signName)) return 'domicilio';
    if (EXALTATION[label] === signName) return 'exaltación';
    if (DETRIMENT[label] && DETRIMENT[label].includes(signName)) return 'detrimento';
    if (FALL[label] === signName) return 'caída';
    return null;
  }

  /**
   * Draw a celestial body on the chart
   */
  function drawBody(eclipticLon, ascendant, label, color, size, retrograde, collected, actualLon, labelTier) {
    const realLon = actualLon != null ? actualLon : eclipticLon;
    const angle = eclipticToAngle(eclipticLon, ascendant);
    const realAngle = eclipticToAngle(realLon, ascendant);
    const px = cx + planetR * Math.cos(realAngle);
    const py = cy - planetR * Math.sin(realAngle);

    // Glow
    const grd = ctx.createRadialGradient(px, py, 0, px, py, size * 3.5);
    grd.addColorStop(0, color.replace(')', ', 0.2)').replace('rgb', 'rgba'));
    grd.addColorStop(1, color.replace(')', ', 0)').replace('rgb', 'rgba'));
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(px, py, size * 3.5, 0, TAU);
    ctx.fill();

    // Dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, TAU);
    ctx.fill();

    // Label + retrograde marker — stagger tiers to reduce overlap
    const tierOffset = (labelTier || 0) * 16;
    const labelR = planetR - size - 12 - tierOffset;
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy - labelR * Math.sin(angle);
    // Keep text upright — flip if on the bottom half
    let textAngle = -angle + Math.PI / 2;
    if (textAngle > Math.PI / 2) textAngle -= Math.PI;
    if (textAngle < -Math.PI / 2) textAngle += Math.PI;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(textAngle);
    ctx.font = `${Math.max(7, outerR * 0.032)}px Inknut Antiqua, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    const displayLabel = retrograde ? `${label} ℞` : label;
    ctx.fillText(displayLabel, 0, 0);
    ctx.restore();

    // Degree + dignity
    const signIdx = Math.floor(((eclipticLon % 360) + 360) % 360 / 30);
    const degInSign = (((eclipticLon % 360) + 360) % 360 % 30).toFixed(0);
    const signName = SIGNS[signIdx].name;
    const dignity = getDignity(label, signName);
    let degText = `${degInSign}°`;
    if (dignity) degText += ` · ${dignity}`;

    const degR = planetR + size + 10;
    const dx = cx + degR * Math.cos(angle);
    const dy = cy - degR * Math.sin(angle);
    let degAngle = -angle + Math.PI / 2;
    if (degAngle > Math.PI / 2) degAngle -= Math.PI;
    if (degAngle < -Math.PI / 2) degAngle += Math.PI;
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(degAngle);
    ctx.font = `${Math.max(6, outerR * 0.024)}px Inknut Antiqua, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = dignity ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.14)';
    ctx.fillText(degText, 0, 0);
    ctx.restore();

    // Collect for aspects (use real position)
    if (collected) collected.push({ lon: realLon, label, px, py });
  }

  /**
   * Draw aspect lines between planets
   */
  function drawAspects(bodies) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        let diff = Math.abs(bodies[i].lon - bodies[j].lon);
        if (diff > 180) diff = 360 - diff;

        for (const aspect of ASPECTS) {
          const err = Math.abs(diff - aspect.angle);
          if (err <= aspect.orb) {
            const strength = 1 - err / aspect.orb;

            ctx.beginPath();
            ctx.moveTo(bodies[i].px, bodies[i].py);
            ctx.lineTo(bodies[j].px, bodies[j].py);
            ctx.strokeStyle = aspect.style;
            ctx.lineWidth = 0.5 + strength * 0.8;
            ctx.setLineDash(aspect.dash);
            ctx.globalAlpha = 0.5 + strength * 0.5;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.setLineDash([]);
            break; // one aspect per pair
          }
        }
      }
    }
  }

  /**
   * Detect retrograde by comparing ecliptic longitude now vs 1 day ago
   */
  function isRetrograde(planetName, time) {
    const now = computePlanetPositions(time);
    const yesterday = computePlanetPositions(new Date(time.getTime() - 86400000));

    const pNow = now.find(p => p.name === planetName);
    const pYest = yesterday.find(p => p.name === planetName);
    if (!pNow || !pYest) return false;

    const lonNow = equatorialToEclipticLon(pNow.ra, pNow.dec);
    const lonYest = equatorialToEclipticLon(pYest.ra, pYest.dec);

    // Account for 360/0 wrap
    let diff = lonNow - lonYest;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    return diff < 0; // moving backwards = retrograde
  }

  function render(time, state) {
    // Build constellation shapes if needed
    if (!constellationShapes && state.constellationLines) {
      constellationShapes = buildConstellationShapes(state.constellationLines);
    }

    drawBackground();

    const ascendant = computeAscendant(time, state.lat, state.lon);
    const bodies = [];

    drawZodiacWheel(ascendant);
    drawConstellationSymbols(ascendant);
    drawHouses(ascendant);
    drawAscendantMarker(ascendant);

    // Collect all body positions first, then spread clusters
    const allBodies = [];

    // Sun
    const sunLon = computeSunEclipticLon(time);
    allBodies.push({ lon: sunLon, label: 'sol', color: 'rgb(255, 200, 80)', size: 5, retro: false });

    // Moon
    const moonLon = computeMoonEclipticLon(time);
    allBodies.push({ lon: moonLon, label: 'luna', color: 'rgb(200, 210, 230)', size: 4, retro: false });

    // Planets
    if (state.planets) {
      const retroMap = {};
      for (const planet of state.planets) {
        retroMap[planet.name] = isRetrograde(planet.name, time);
      }
      for (const planet of state.planets) {
        const lon = equatorialToEclipticLon(planet.ra, planet.dec);
        const col = planet.color || '#ffffff';
        const r = parseInt(col.slice(1, 3), 16);
        const g = parseInt(col.slice(3, 5), 16);
        const b = parseInt(col.slice(5, 7), 16);
        allBodies.push({ lon, label: planet.label, color: `rgb(${r}, ${g}, ${b})`, size: 3.5, retro: retroMap[planet.name] });
      }
    }

    // Spread clustered bodies so labels don't overlap
    allBodies.sort((a, b) => a.lon - b.lon);
    const minSep = 8;
    for (let pass = 0; pass < 5; pass++) {
      for (let i = 1; i < allBodies.length; i++) {
        const prevLon = allBodies[i - 1].displayLon || allBodies[i - 1].lon;
        const currLon = allBodies[i].displayLon || allBodies[i].lon;
        let diff = currLon - prevLon;
        if (diff < 0) diff += 360;
        if (diff < minSep) {
          const shift = (minSep - diff) / 2;
          allBodies[i - 1].displayLon = prevLon - shift;
          allBodies[i].displayLon = currLon + shift;
        }
      }
    }

    // Alternate label radius for adjacent planets to reduce overlap
    for (let i = 0; i < allBodies.length; i++) {
      allBodies[i].labelTier = 0;
      if (i > 0) {
        const prevLon = allBodies[i - 1].displayLon || allBodies[i - 1].lon;
        const currLon = allBodies[i].displayLon || allBodies[i].lon;
        let diff = Math.abs(currLon - prevLon);
        if (diff > 180) diff = 360 - diff;
        if (diff < 12) {
          allBodies[i].labelTier = (allBodies[i - 1].labelTier + 1) % 2;
        }
      }
    }

    // Draw all bodies
    for (const b of allBodies) {
      drawBody(b.displayLon || b.lon, ascendant, b.label, b.color, b.size, b.retro, bodies, b.lon, b.labelTier);
    }

    // Aspects
    drawAspects(bodies);
  }

  return { render, resize };
}
