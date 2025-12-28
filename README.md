# cielo

Visualización astronómica minimalista desde Barcelona con ASCII.

Una experiencia web poética que muestra el cielo nocturno, la posición del sol y la luna desde Barcelona, usando solo datos precalculados y representaciones ASCII minimalistas.

**Por [meowrhino.studio](https://meowrhino.studio)**

## 🌍 Concepto

Esta web muestra diferentes vistas del cielo según la hora del día:

### Durante el día en Barcelona:
- **Panel Este (derecha)**: Trayectoria del sol desde la salida hasta el mediodía
- **Panel Oeste (izquierda)**: Trayectoria del sol desde el mediodía hasta la puesta
- **Panel Sur (abajo)**: Cielo nocturno de la antípoda de Barcelona

### Durante la noche en Barcelona:
- **Panel Norte (arriba)**: Cielo nocturno visible desde Barcelona
- **Panel Este (derecha)**: Fase lunar actual
- **Panel Oeste (izquierda)**: Posición de la luna en el cielo

### Siempre visible:
- **Panel Centro**: Hub de navegación con información básica

## 🎨 Características

- **Navegación tipo cruz**: Sistema de 5 paneles con transiciones suaves
- **Visualizaciones ASCII**: Todo representado con caracteres minimalistas
- **Sin cálculos en cliente**: Todos los datos astronómicos están precalculados
- **Actualización automática**: GitHub Actions regenera los datos mensualmente
- **Vanilla JavaScript**: Sin frameworks ni dependencias externas en el cliente
- **Responsive**: Adaptado a diferentes tamaños de pantalla

## 📂 Estructura del proyecto

```
cielo/
├── index.html              # Página principal
├── style.css               # Estilos globales
├── script.js               # Lógica principal y navegación
├── modules/                # Módulos de renderizado
│   ├── sun-renderer.js     # Renderizado ASCII del sol
│   ├── moon-renderer.js    # Renderizado ASCII de la luna
│   └── sky-renderer.js     # Renderizado ASCII del cielo nocturno
├── data/                   # Datos astronómicos precalculados
│   ├── sun/
│   │   └── barcelona.json  # Datos solares
│   ├── moon/
│   │   └── barcelona.json  # Datos lunares
│   ├── stars/
│   │   └── catalog.json    # Catálogo de estrellas
│   └── metadata.json       # Metadata de generación
├── scripts/                # Scripts de generación
│   └── generate-astronomical-data.js
├── .github/workflows/      # GitHub Actions
│   └── update-data.yml     # Workflow de actualización mensual
├── package.json
└── README.md
```

## 🚀 Despliegue en GitHub Pages

1. **Activar GitHub Pages**:
   - Ve a Settings → Pages
   - En "Source", selecciona "Deploy from a branch"
   - Selecciona la rama `main` y la carpeta `/ (root)`
   - Guarda los cambios

2. **Esperar el despliegue**:
   - GitHub Pages construirá y desplegará automáticamente
   - La web estará disponible en: `https://meowrhino.github.io/cielo/`

3. **Verificar el workflow**:
   - El GitHub Action se ejecutará automáticamente el primer día de cada mes
   - También puedes ejecutarlo manualmente desde la pestaña "Actions"

## 🔧 Desarrollo local

### Requisitos
- Node.js 22+
- npm

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/meowrhino/cielo.git
cd cielo

# Instalar dependencias
npm install

# Generar datos astronómicos
npm run generate-data
```

### Servidor local

Para probar la web localmente, necesitas un servidor HTTP simple:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node.js
npx http-server
```

Luego abre `http://localhost:8000` en tu navegador.

## 📊 Datos astronómicos

Los datos se generan usando la librería [SunCalc](https://github.com/mourner/suncalc), que proporciona cálculos precisos de posiciones solares y lunares.

### Datos del sol
- Hora de salida y puesta
- Azimut y altitud por hora
- Mediodía solar

### Datos de la luna
- Fase lunar
- Iluminación
- Posición (azimut y altitud)
- Hora de salida y puesta

### Catálogo de estrellas
- 15 estrellas más brillantes visibles desde Barcelona
- Coordenadas ecuatoriales (ascensión recta y declinación)
- Magnitud aparente

## 🌐 Lógica día/noche

La web determina automáticamente si es de día o noche en Barcelona basándose en:
1. La hora actual del sistema del usuario
2. Los datos de salida y puesta del sol precalculados
3. Si el sol está sobre el horizonte → **día**
4. Si el sol está bajo el horizonte → **noche**

Esta lógica controla qué paneles muestran qué contenido.

## 🎯 Navegación

- **Flechas en pantalla**: Haz clic en las flechas para moverte entre paneles
- **Teclado** (opcional): Se puede implementar navegación con teclas de dirección
- **Centro**: Siempre puedes volver al centro desde cualquier panel

## 🛠️ Tecnologías

### Frontend
- HTML5
- CSS3 (con variables CSS y flexbox)
- JavaScript ES6+ (módulos)

### Backend (generación de datos)
- Node.js
- SunCalc (cálculos astronómicos)

### CI/CD
- GitHub Actions (actualización mensual automática)

## 📝 Notas técnicas

### ¿Por qué precalcular?
- **Performance**: El cliente no necesita hacer cálculos complejos
- **Simplicidad**: Solo lee JSON y renderiza
- **Offline-friendly**: Los datos están disponibles localmente
- **Precisión**: Los cálculos se hacen una vez con precisión

### Actualización de datos
El GitHub Action genera datos para los próximos 45 días, con un margen de seguridad para evitar que los datos se queden obsoletos entre actualizaciones mensuales.

## 📄 Licencia

MIT License - Creado por [meowrhino.studio](https://meowrhino.studio)

## 🌟 Créditos

- Cálculos astronómicos: [SunCalc](https://github.com/mourner/suncalc) por Vladimir Agafonkin
- Inspiración de navegación: [Rika Michi](https://meowrhino.github.io/rikamichie/)
- Estilo ASCII: [Villagranota](https://meowrhino.github.io/villagranota/)

---

**Hecho con ♥ por meowrhino.studio**
