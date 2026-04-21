# Pasar la versión de pruebas al VPS mediante `git pull`

## Estado actual

La versión de pruebas que está funcionando aquí corresponde al commit:

```text
bd8ebb9d17e12c4e7adecb3552272a84da9ced4a
```

Ese commit ya está publicado en `origin/main` del repositorio `juanlus85/encuestas-mne`.

## Flujo recomendado en tu VPS

Si el proyecto ya está clonado en el servidor, la secuencia normal sería esta:

```bash
cd /ruta/de/tu/proyecto
git pull origin main
pnpm install
pnpm check
pnpm build
pnpm start
```

Si en Plesk gestionas el arranque desde el panel, entonces normalmente harías el `git pull`, la instalación, el build y después reiniciarías la aplicación desde Plesk.

## Variables de entorno

Antes del arranque en el VPS, asegúrate de tener configuradas al menos estas variables:

| Variable | Obligatoria |
|---|---:|
| `NODE_ENV` | Sí |
| `PORT` | Sí |
| `DATABASE_URL` | Sí |
| `JWT_SECRET` | Sí |
| `OAUTH_SERVER_URL` | Según tu login |
| `VITE_APP_ID` | Según tu login |
| `OWNER_OPEN_ID` | Según tu login |

## Observación importante

La versión aquí expuesta en Manus es **temporal** y útil como servidor de pruebas, pero no debe considerarse alojamiento permanente. El flujo estable sigue siendo publicar en GitHub y desplegar en tu VPS con `git pull`.
