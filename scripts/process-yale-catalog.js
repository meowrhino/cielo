/**
 * Script para procesar el Yale Bright Star Catalog (BSC5) en formato JSON
 * y generar un catálogo optimizado para cielo
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.join(__dirname, '../data/stars/bsc5-raw.json');
const OUTPUT_FILE = path.join(__dirname, '../data/stars/catalog.json');

/**
 * Convierte coordenadas RA en formato "HH:MM:SS.SS" a grados decimales
 */
function raToDecimal(raString) {
  const parts = raString.split(':');
  const hours = parseFloat(parts[0]);
  const minutes = parseFloat(parts[1]);
  const seconds = parseFloat(parts[2]);
  return (hours + minutes / 60 + seconds / 3600) * 15; // 15 grados por hora
}

/**
 * Convierte coordenadas DEC en formato "+DD:MM:SS.SS" a grados decimales
 */
function decToDecimal(decString) {
  const sign = decString[0] === '-' ? -1 : 1;
  const parts = decString.substring(1).split(':');
  const degrees = parseFloat(parts[0]);
  const minutes = parseFloat(parts[1]);
  const seconds = parseFloat(parts[2]);
  return sign * (degrees + minutes / 60 + seconds / 3600);
}

/**
 * Procesa el catálogo BSC5 y genera un catálogo optimizado
 */
function processCatalog() {
  console.log('📖 Leyendo catálogo Yale BSC5...');
  
  const rawData = fs.readFileSync(INPUT_FILE, 'utf8');
  const stars = JSON.parse(rawData);
  
  console.log(`✅ ${stars.length} estrellas encontradas en el catálogo`);
  
  // Procesar y filtrar estrellas
  const processedStars = stars
    .map(star => {
      try {
        const mag = parseFloat(star.MAG);
        const ra = raToDecimal(star.RA);
        const dec = decToDecimal(star.DEC);
        
        // Validar datos
        if (!Number.isFinite(mag) || !Number.isFinite(ra) || !Number.isFinite(dec)) {
          return null;
        }
        
        return {
          hr: star.harvard_ref_,
          name: `HR ${star.harvard_ref_}`,
          ra: Math.round(ra * 1000) / 1000, // 3 decimales
          dec: Math.round(dec * 1000) / 1000,
          mag: Math.round(mag * 100) / 100 // 2 decimales
        };
      } catch (error) {
        return null;
      }
    })
    .filter(star => star !== null)
    .sort((a, b) => a.mag - b.mag); // Ordenar por brillo (más brillantes primero)
  
  console.log(`✨ ${processedStars.length} estrellas procesadas correctamente`);
  
  // Estadísticas
  const magCounts = {
    'mag < 1': processedStars.filter(s => s.mag < 1).length,
    'mag 1-3': processedStars.filter(s => s.mag >= 1 && s.mag < 3).length,
    'mag 3-5': processedStars.filter(s => s.mag >= 3 && s.mag < 5).length,
    'mag 5-6': processedStars.filter(s => s.mag >= 5 && s.mag < 6).length,
    'mag 6+': processedStars.filter(s => s.mag >= 6).length
  };
  
  const hemispheres = {
    'Norte (dec > 0)': processedStars.filter(s => s.dec > 0).length,
    'Sur (dec < 0)': processedStars.filter(s => s.dec < 0).length
  };
  
  console.log('\n📊 Estadísticas del catálogo:');
  console.log('Por magnitud:');
  Object.entries(magCounts).forEach(([range, count]) => {
    console.log(`  ${range}: ${count} estrellas`);
  });
  console.log('\nPor hemisferio:');
  Object.entries(hemispheres).forEach(([hemisphere, count]) => {
    console.log(`  ${hemisphere}: ${count} estrellas`);
  });
  
  // Guardar catálogo procesado
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(processedStars, null, 2), 'utf8');
  
  console.log(`\n✅ Catálogo guardado en: ${OUTPUT_FILE}`);
  console.log(`📦 Tamaño: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2)} KB`);
}

// Ejecutar
try {
  processCatalog();
} catch (error) {
  console.error('❌ Error procesando catálogo:', error);
  process.exit(1);
}
