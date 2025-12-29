# 🌌 cielo

Visualización astronómica minimalista desde Barcelona en ASCII.

**🔗 [Ver en vivo](https://meowrhino.github.io/cielo/)**

---

## ✨ Características

- **Navegación de 5 paneles** (norte, sur, este, oeste, centro)
- **Cielo nocturno** con 9096 estrellas del Yale Bright Star Catalog
- **Posición del sol** en tiempo real con trayectoria diaria
- **Fases lunares** e información de posición
- **Cálculos astronómicos** precisos desde Barcelona
- **Estilo minimalista** con arte ASCII
- **Sin frameworks** - Solo HTML, CSS y JavaScript vanilla

---

## 🗺️ Paneles

### Centro
Hub de navegación con información del proyecto.

### Norte (de noche)
Cielo nocturno de Barcelona (hemisferio norte celeste, dec > 0°).

### Sur (de día)
Cielo nocturno de la antípoda de Barcelona (hemisferio sur celeste, dec < 0°).

### Este
- **De día**: Trayectoria del sol desde salida hasta mediodía (0° → 180° azimut)
- **De noche**: Fase lunar actual con información textual

### Oeste
- **De día**: Trayectoria del sol desde mediodía hasta puesta (180° → 360° azimut)
- **De noche**: Posición de la luna en el cielo

---

## 📊 Datos

### Catálogo de Estrellas
- **Fuente**: [Yale Bright Star Catalog (BSC5)](https://github.com/aduboisforge/Bright-Star-Catalog-JSON)
- **Estrellas**: 9096 estrellas visibles a simple vista (mag < 6.5)
- **Actualización**: NO requiere actualización (las estrellas no cambian)
- **Archivo**: `data/stars/catalog.json` (805 KB)

### Datos Astronómicos (Sol y Luna)
- **Generación**: Precalculados con [SunCalc](https://github.com/mourner/suncalc)
- **Ubicación**: Barcelona (41.3851°N, 2.1734°E)
- **Actualización**: Automática vía GitHub Actions
- **Archivos**: 
  - `data/sun/barcelona.json`
  - `data/moon/barcelona.json`
  - `data/metadata.json`

---

## ⚙️ GitHub Actions

### 1. `update-star-catalog.yml` (Manual)
Regenera el catálogo de estrellas desde el Yale BSC.

- **Ejecución**: Solo manual (workflow_dispatch)
- **Uso**: Raramente necesario (las estrellas no cambian)
- **Comando**: Actions → Update Star Catalog → Run workflow

### 2. `update-data-yearly.yml` (Automática)
Genera datos astronómicos para 432 días (14 meses).

- **Ejecución**: Automática cada 28 de febrero a las 00:00 UTC
- **También**: Manual vía workflow_dispatch
- **Configuración**: ✅ **ACTIVA POR DEFECTO**

### 3. `update-data-monthly.yml` (Desactivada)
Genera datos astronómicos para 45 días.

- **Ejecución**: ❌ **DESACTIVADA** (schedule comentado)
- **Uso**: Solo manual vía workflow_dispatch
- **Para activar**: 
  1. Editar `.github/workflows/update-data-monthly.yml`
  2. Descomentar el bloque `schedule`
  3. Comentar `update-data-yearly.yml` para evitar conflictos

---

## 🛠️ Desarrollo Local

### Requisitos
- Node.js 22+
- npm

### Instalación
```bash
git clone https://github.com/meowrhino/cielo.git
cd cielo
npm install
```

### Generar Datos

**Catálogo de estrellas** (solo una vez):
```bash
node scripts/process-yale-catalog.js
```

**Datos astronómicos** (45 días por defecto):
```bash
npm run generate-data
```

**Datos astronómicos** (personalizado):
```bash
DAYS=432 npm run generate-data
```

### Servidor Local
```bash
# Con Python
python3 -m http.server 8000

# Con Node.js
npx serve
```

Abrir: http://localhost:8000

---

## 📁 Estructura del Proyecto

```
cielo/
├── index.html              # Página principal
├── style.css               # Estilos (refactorizado y comentado)
├── script.js               # Lógica principal
├── modules/
│   ├── sun-renderer.js     # Renderizado del sol (pantalla completa)
│   ├── moon-renderer.js    # Renderizado de la luna (icono + texto)
│   └── sky-renderer.js     # Renderizado del cielo nocturno (Yale Catalog)
├── scripts/
│   ├── generate-astronomical-data.js  # Generador de datos sol/luna
│   └── process-yale-catalog.js        # Procesador del catálogo BSC
├── data/
│   ├── stars/
│   │   ├── catalog.json    # Catálogo de 9096 estrellas (permanente)
│   │   └── bsc5-raw.json   # Catálogo Yale original
│   ├── sun/
│   │   └── barcelona.json  # Datos solares
│   ├── moon/
│   │   └── barcelona.json  # Datos lunares
│   └── metadata.json       # Metadatos de generación
└── .github/workflows/
    ├── update-star-catalog.yml    # Action: Catálogo (manual)
    ├── update-data-yearly.yml     # Action: Anual (activa)
    └── update-data-monthly.yml    # Action: Mensual (desactivada)
```

---

## 🎨 Símbolos ASCII

### Estrellas (por magnitud)
- `●` mag < 1 (muy brillantes)
- `★` mag 1-3 (brillantes)
- `+` mag 3-5 (medias)
- `·` mag 5-6 (débiles)

### Sol
- `☼` Posición actual
- `·` Trayectoria

### Luna (por fase)
- `○` Luna nueva
- `◐` Cuarto creciente
- `●` Luna llena
- `◑` Cuarto menguante

---

## 🐛 Debugging

El proyecto incluye un panel de debugging (esquina superior derecha) para desarrollo:

- **Controles**: Hora, fecha, rango azimut, magnitud estelar
- **Marcado**: Todo el código debug está marcado con comentarios `// DEBUG:`
- **Para versión final**: Comentar o eliminar las secciones marcadas

---

## 📝 Licencia

MIT License

---

## 👤 Autor

**meowrhino.studio**

🔗 [GitHub](https://github.com/meowrhino) | 🌐 [cielo](https://meowrhino.github.io/cielo/)

---

## 🙏 Créditos

- **Yale Bright Star Catalog**: [BSC5](https://github.com/aduboisforge/Bright-Star-Catalog-JSON)
- **SunCalc**: [mourner/suncalc](https://github.com/mourner/suncalc)
- **Fuente**: [Courier Prime](https://fonts.google.com/specimen/Courier+Prime)
- **Inspiración**: [Rika Michi](https://meowrhino.github.io/rikamichie/) & [Villagranota](https://meowrhino.github.io/villagranota/)
