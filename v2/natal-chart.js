/**
 * Renderizado de carta astral (rueda zodiacal)
 * Muestra el cielo actual como carta natal con casas whole sign
 */
import {
  computeAscendant,
  equatorialToEclipticLon,
  computeSunEclipticLon,
  computeMoonEclipticLon
} from './astronomy.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const SIGNS = [
  { name: 'aries',       symbol: '\u2648' },
  { name: 'tauro',       symbol: '\u2649' },
  { name: 'g\u00e9minis',      symbol: '\u264A' },
  { name: 'c\u00e1ncer',      symbol: '\u264B' },
  { name: 'leo',         symbol: '\u264C' },
  { name: 'virgo',       symbol: '\u264D' },
  { name: 'libra',       symbol: '\u264E' },
  { name: 'escorpio',    symbol: '\u264F' },
  { name: 'sagitario',   symbol: '\u2650' },
  { name: 'capricornio', symbol: '\u2651' },
  { name: 'acuario',     symbol: '\u2652' },
  { name: 'piscis',      symbol: '\u2653' }
];

export function createNatalChart(canvas) {
  const ctx = canvas.getContext('2d');
  let W, H, cx, cy, outerR, innerR, planetR;

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
    innerR = base * 0.82;
    planetR = base * 0.65;
  }

  resize();

  /**
   * Convierte longitud eclíptica a ángulo en el canvas
   * El ascendente se sitúa a la izquierda (9 en punto = 180°)
   * La rueda gira en sentido antihorario
   */
  function eclipticToAngle(eclipticLon, ascendant) {
    return (180 + ascendant - eclipticLon) * DEG;
  }

  function drawBackground() {
    ctx.fillStyle = '#07040a';
    ctx.fillRect(0, 0, W, H);
  }

  function drawZodiacWheel(ascendant) {
    // Outer circle
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, TAU);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, TAU);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.stroke();

    // Planet circle (dashed)
    ctx.beginPath();
    ctx.arc(cx, cy, planetR, 0, TAU);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.setLineDash([3, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sign divisions and symbols
    for (let i = 0; i < 12; i++) {
      const signStart = i * 30; // ecliptic longitude where sign starts
      const angle = eclipticToAngle(signStart, ascendant);

      // Division line
      ctx.beginPath();
      ctx.moveTo(cx + innerR * Math.cos(angle), cy - innerR * Math.sin(angle));
      ctx.lineTo(cx + outerR * Math.cos(angle), cy - outerR * Math.sin(angle));
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Sign symbol in the middle of the segment
      const midAngle = eclipticToAngle(signStart + 15, ascendant);
      const symbolR = (outerR + innerR) / 2;
      const sx = cx + symbolR * Math.cos(midAngle);
      const sy = cy - symbolR * Math.sin(midAngle);

      ctx.font = `${Math.max(12, outerR * 0.07)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillText(SIGNS[i].symbol, sx, sy);
    }
  }

  function drawHouses(ascendant) {
    // Whole sign houses: house 1 starts at the sign containing the ascendant
    const house1Sign = Math.floor(ascendant / 30) * 30;

    for (let i = 0; i < 12; i++) {
      const houseStart = house1Sign + i * 30;
      const angle = eclipticToAngle(houseStart, ascendant);

      // House cusp line (from center to inner ring)
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + innerR * Math.cos(angle), cy - innerR * Math.sin(angle));
      ctx.strokeStyle = i === 0 || i === 3 || i === 6 || i === 9
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = i === 0 ? 1.5 : 0.5;
      ctx.stroke();

      // House number
      const midAngle = eclipticToAngle(houseStart + 15, ascendant);
      const numR = innerR * 0.25;
      const nx = cx + numR * Math.cos(midAngle);
      const ny = cy - numR * Math.sin(midAngle);

      ctx.font = `${Math.max(8, outerR * 0.04)}px Inknut Antiqua, Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillText(String(i + 1), nx, ny);
    }
  }

  function drawAscendantMarker(ascendant) {
    const angle = eclipticToAngle(ascendant, ascendant); // should be π (left)
    const x1 = cx + (outerR + 8) * Math.cos(angle);
    const y1 = cy - (outerR + 8) * Math.sin(angle);

    // Arrow pointing inward
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + 10 * Math.cos(angle - 0.3), y1 - 10 * Math.sin(angle - 0.3));
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + 10 * Math.cos(angle + 0.3), y1 - 10 * Math.sin(angle + 0.3));
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label "asc"
    const labelR = outerR + 22;
    ctx.font = `${Math.max(9, outerR * 0.04)}px Inknut Antiqua, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillText('asc', cx + labelR * Math.cos(angle), cy - labelR * Math.sin(angle));
  }

  function drawBody(eclipticLon, ascendant, label, color, size) {
    const angle = eclipticToAngle(eclipticLon, ascendant);
    const px = cx + planetR * Math.cos(angle);
    const py = cy - planetR * Math.sin(angle);

    // Glow
    const grd = ctx.createRadialGradient(px, py, 0, px, py, size * 4);
    grd.addColorStop(0, color.replace(')', ', 0.2)').replace('rgb', 'rgba'));
    grd.addColorStop(1, color.replace(')', ', 0)').replace('rgb', 'rgba'));
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(px, py, size * 4, 0, TAU);
    ctx.fill();

    // Body dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, TAU);
    ctx.fill();

    // Label
    const labelR = planetR - size - 14;
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy - labelR * Math.sin(angle);
    ctx.font = `${Math.max(8, outerR * 0.035)}px Inknut Antiqua, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillText(label, lx, ly);

    // Degree in sign
    const signIdx = Math.floor(eclipticLon / 30);
    const degInSign = (eclipticLon % 30).toFixed(0);
    const degLabel = `${degInSign}° ${SIGNS[signIdx].name}`;
    const degR = planetR + size + 12;
    const dx = cx + degR * Math.cos(angle);
    const dy = cy - degR * Math.sin(angle);
    ctx.font = `${Math.max(7, outerR * 0.028)}px Inknut Antiqua, Georgia, serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillText(degLabel, dx, dy);
  }

  function render(time, state) {
    drawBackground();

    const ascendant = computeAscendant(time, state.lat, state.lon);

    drawZodiacWheel(ascendant);
    drawHouses(ascendant);
    drawAscendantMarker(ascendant);

    // Sun
    const sunLon = computeSunEclipticLon(time);
    drawBody(sunLon, ascendant, 'sol', 'rgb(255, 200, 80)', 6);

    // Moon
    const moonLon = computeMoonEclipticLon(time);
    drawBody(moonLon, ascendant, 'luna', 'rgb(200, 210, 230)', 5);

    // Planets
    if (state.planets) {
      for (const planet of state.planets) {
        const lon = equatorialToEclipticLon(planet.ra, planet.dec);
        const col = planet.color || '#ffffff';
        const r = parseInt(col.slice(1, 3), 16);
        const g = parseInt(col.slice(3, 5), 16);
        const b = parseInt(col.slice(5, 7), 16);
        drawBody(lon, ascendant, planet.label, `rgb(${r}, ${g}, ${b})`, 4);
      }
    }
  }

  return { render, resize };
}
