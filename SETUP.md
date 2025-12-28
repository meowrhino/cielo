# Configuración Manual

Debido a las restricciones de permisos de GitHub Apps, algunos pasos deben realizarse manualmente:

## 1. Activar GitHub Pages

1. Ve a: https://github.com/meowrhino/cielo/settings/pages
2. En **"Source"**, selecciona:
   - Branch: `master`
   - Folder: `/ (root)`
3. Haz clic en **"Save"**
4. Espera unos minutos y la web estará disponible en: https://meowrhino.github.io/cielo/

## 2. Añadir el GitHub Action (opcional)

El archivo `.github/workflows/update-data.yml` ya está en el repositorio local, pero necesitas subirlo manualmente:

### Opción A: Desde la interfaz web de GitHub

1. Ve a: https://github.com/meowrhino/cielo
2. Crea la carpeta `.github/workflows/` si no existe
3. Sube el archivo `update-data.yml` que está en tu repositorio local

### Opción B: Desde tu máquina local

```bash
# Clona el repositorio si aún no lo has hecho
git clone https://github.com/meowrhino/cielo.git
cd cielo

# Copia el archivo de workflow
mkdir -p .github/workflows
cp /ruta/al/archivo/update-data.yml .github/workflows/

# Commit y push
git add .github/workflows/update-data.yml
git commit -m "Add GitHub Action for monthly data updates"
git push
```

## 3. Verificar el despliegue

Una vez activado GitHub Pages, verifica que la web funciona correctamente:

- URL: https://meowrhino.github.io/cielo/
- Navega entre los paneles usando las flechas
- Verifica que los datos astronómicos se cargan correctamente
- Comprueba que el estado día/noche es correcto según tu hora local

## 4. Ejecutar el workflow manualmente (opcional)

Si añadiste el GitHub Action:

1. Ve a: https://github.com/meowrhino/cielo/actions
2. Selecciona "Update Astronomical Data"
3. Haz clic en "Run workflow"
4. Selecciona la rama `master` y confirma

Esto generará datos astronómicos actualizados inmediatamente.

---

**Nota**: El workflow se ejecutará automáticamente el primer día de cada mes a las 00:00 UTC.
