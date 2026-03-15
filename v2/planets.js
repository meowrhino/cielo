/**
 * Posiciones planetarias simplificadas (Keplerian elements)
 * Calcula RA/Dec de los 5 planetas visibles a ojo desnudo
 * Precisión: ~1° (suficiente para visualización)
 */

import { eclipticToEquatorial } from './astronomy.js';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);

/**
 * Elementos orbitales medios en J2000 + tasas por siglo
 * Fuente: Meeus / JPL low-precision elements
 * [a (AU), e, I (deg), L (deg), longPeri (deg), longNode (deg)]
 * + rates per century
 */
const ELEMENTS = {
  mercury: {
    a: [0.38710, 0], e: [0.20563, 0.00002],
    I: [7.005, -0.0060], L: [252.251, 149472.675],
    wbar: [77.456, 0.160], node: [48.331, -0.125],
    color: '#b0b0b0', mag: 0.0, label: 'mercurio'
  },
  venus: {
    a: [0.72333, 0], e: [0.00677, -0.00005],
    I: [3.395, -0.0008], L: [181.980, 58517.816],
    wbar: [131.564, 0.009], node: [76.680, -0.279],
    color: '#fffff0', mag: -4.0, label: 'venus'
  },
  earth: {
    a: [1.00000, 0], e: [0.01671, -0.00004],
    I: [0, 0], L: [100.464, 35999.373],
    wbar: [102.937, 0.324], node: [0, 0],
    color: null, mag: null, label: null
  },
  mars: {
    a: [1.52368, 0], e: [0.09340, 0.00009],
    I: [1.850, -0.0013], L: [355.453, 19140.300],
    wbar: [336.040, 0.443], node: [49.558, -0.296],
    color: '#cc6644', mag: 1.0, label: 'marte'
  },
  jupiter: {
    a: [5.20261, 0], e: [0.04849, 0.00016],
    I: [1.303, -0.0020], L: [34.351, 3034.906],
    wbar: [14.331, 0.215], node: [100.464, 0.177],
    color: '#f0e8d0', mag: -2.0, label: 'júpiter'
  },
  saturn: {
    a: [9.55491, 0], e: [0.05551, -0.00035],
    I: [2.489, 0.0025], L: [50.077, 1222.114],
    wbar: [93.057, 0.562], node: [113.665, -0.251],
    color: '#e8dcc0', mag: 0.5, label: 'saturno'
  }
};

/**
 * Resuelve la ecuación de Kepler: M = E - e*sin(E)
 */
function solveKepler(M, e) {
  let E = M;
  for (let i = 0; i < 10; i++) {
    E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

/**
 * Calcula posición heliocéntrica eclíptica de un planeta
 * Retorna {x, y, z} en AU
 */
function heliocentricPosition(el, T) {
  const a = el.a[0] + el.a[1] * T;
  const e = el.e[0] + el.e[1] * T;
  const I = (el.I[0] + el.I[1] * T) * DEG;
  const L = ((el.L[0] + el.L[1] * T) % 360) * DEG;
  const wbar = ((el.wbar[0] + el.wbar[1] * T) % 360) * DEG;
  const node = ((el.node[0] + el.node[1] * T) % 360) * DEG;

  const w = wbar - node; // argumento del perihelio
  const M = L - wbar;    // anomalía media
  const E = solveKepler(M, e);

  // Posición en el plano orbital
  const xOrb = a * (Math.cos(E) - e);
  const yOrb = a * Math.sqrt(1 - e * e) * Math.sin(E);

  // Rotar al sistema eclíptico
  const cosW = Math.cos(w), sinW = Math.sin(w);
  const cosN = Math.cos(node), sinN = Math.sin(node);
  const cosI = Math.cos(I), sinI = Math.sin(I);

  const x = (cosW * cosN - sinW * sinN * cosI) * xOrb +
            (-sinW * cosN - cosW * sinN * cosI) * yOrb;
  const y = (cosW * sinN + sinW * cosN * cosI) * xOrb +
            (-sinW * sinN + cosW * cosN * cosI) * yOrb;
  const z = (sinW * sinI) * xOrb + (cosW * sinI) * yOrb;

  return { x, y, z };
}

/**
 * Calcula posiciones de los 5 planetas visibles
 * @param {Date} time
 * @returns {Array<{name, label, ra, dec, magnitude, color}>}
 */
export function computePlanetPositions(time) {
  const daysSinceJ2000 = (time.getTime() - J2000) / 86400000;
  const T = daysSinceJ2000 / 36525; // siglos julianos

  // Posición de la Tierra
  const earth = heliocentricPosition(ELEMENTS.earth, T);

  const planets = [];
  const names = ['mercury', 'venus', 'mars', 'jupiter', 'saturn'];

  for (const name of names) {
    const el = ELEMENTS[name];
    const pos = heliocentricPosition(el, T);

    // Posición geocéntrica (eclíptica)
    const dx = pos.x - earth.x;
    const dy = pos.y - earth.y;
    const dz = pos.z - earth.z;

    // Longitud y latitud eclíptica geocéntrica
    const lon = Math.atan2(dy, dx);
    const lat = Math.atan2(dz, Math.sqrt(dx * dx + dy * dy));

    const { ra, dec } = eclipticToEquatorial(lon, lat);

    planets.push({
      name,
      label: el.label,
      ra,
      dec,
      magnitude: el.mag,
      color: el.color
    });
  }

  return planets;
}
