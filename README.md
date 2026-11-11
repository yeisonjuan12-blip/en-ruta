# En Ruta — Delivery Nuevo Chimbote

Sistema administrativo para “En Ruta”, delivery service. PWA local-only.

## Instalación
1. Abre este sitio en tu navegador móvil (Chrome/Safari).
2. Selecciona “Instalar app” o “Agregar a pantalla de inicio”.
3. La app funcionará offline usando almacenamiento interno.

## Respaldo
- **Exportar:** Ajustes > Respaldo > Descargar archivo.
- **Importar:** Ajustes > Respaldo > Importar archivo.
- La app realiza respaldos automáticos si está habilitado en Ajustes.

## Sincronizar entre dispositivos (opcional)
1. Crea un token clásico de GitHub con **solo** el permiso `gist`:
   https://github.com/settings/tokens/new?scopes=gist&description=en-ruta-sync
2. En el primer dispositivo: **Ajustes > Sincronización entre dispositivos**, pega el token y pulsa **Conectar y sincronizar**.
3. En el segundo dispositivo: pega el **mismo token** y pulsa **Conectar**. La app descargará automáticamente la copia existente.
4. La sincronización automática sube los cambios y baja los de la nube al abrir la app.

> La sincronización es opcional. Sin internet, la app sigue funcionando con los datos locales.
> Si dos dispositivos editan sin conexión al mismo tiempo, se conserva el último cambio guardado.
> El token se guarda solo en cada navegador y no se incluye en los respaldos. Puedes revocarlo cuando quieras.

## Soporte
- No requiere servidor propio: funciona offline y la sincronización usa un Gist privado de GitHub.
- Los datos se guardan en el navegador. No borres el caché del navegador si no has exportado tu respaldo.
