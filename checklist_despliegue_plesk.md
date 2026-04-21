# Checklist de despliegue en Plesk para `mne.organizus.es`

## 1. Preparación en el servidor

- Crear o verificar el subdominio `mne.organizus.es` en Plesk.
- Activar **Node.js 23.11.1** para el dominio.
- Confirmar que el proyecto quedará en la carpeta de la aplicación del dominio.
- Confirmar acceso a MySQL y existencia de una base de datos dedicada.

## 2. Variables de entorno

Crear un archivo `.env.production` a partir de `.env.production.example` con valores reales.

Variables mínimas:

| Variable | Ejemplo | Nota |
|---|---|---|
| `NODE_ENV` | `production` | Obligatoria |
| `PORT` | `3000` | Plesk puede inyectar otro valor |
| `DATABASE_URL` | `mysql://usuario:clave@127.0.0.1:3306/base` | Obligatoria |
| `JWT_SECRET` | cadena larga aleatoria | Obligatoria |
| `VITE_APP_ID` | vacío o valor real | Según login OAuth |
| `OAUTH_SERVER_URL` | vacío o URL real | Según login OAuth |
| `OWNER_OPEN_ID` | vacío o valor real | Según login OAuth |

## 3. Instalación inicial

```bash
pnpm install
pnpm check
pnpm build
```

## 4. Base de datos

Si la base de datos está vacía:

```bash
pnpm db:push
```

Si ya existe una base con datos, revisar antes de ejecutar migraciones.

## 5. Arranque en producción

Comando de arranque esperado:

```bash
pnpm start
```

Archivo de inicio esperado por Plesk:

```text
dist/index.js
```

## 6. Verificaciones después del arranque

- Comprobar que la app carga en `https://mne.organizus.es`.
- Probar login local con usuario y contraseña.
- Confirmar que la API responde correctamente.
- Revisar conexión con MySQL.
- Validar que el frontend compilado se sirve correctamente.
- Hacer una prueba básica de creación o consulta de datos.

## 7. Observaciones importantes

- El proyecto usa `pnpm build` antes de arrancar en producción.
- No debe ejecutarse `pnpm dev` en Plesk.
- El servidor intenta usar `PORT` y, si está ocupado, busca otro libre cercano; en Plesk conviene que el puerto asignado esté disponible.
- Antes del despliegue definitivo conviene cerrar la última ronda de traducción al inglés y revisar visualmente la interfaz.
