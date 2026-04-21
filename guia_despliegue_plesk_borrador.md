# Guía de despliegue en Plesk para `mne.organizus.es`

## Resumen técnico

Este proyecto es una aplicación **Node.js + Express + Vite + MySQL**. En desarrollo usa Vite como middleware, pero en producción el servidor Express sirve los archivos estáticos ya compilados. El flujo previsto para producción es el siguiente:

1. Instalar dependencias con `pnpm install`.
2. Generar el build con `pnpm build`.
3. Ejecutar el servidor con `pnpm start`.
4. Exponer la aplicación detrás del proxy de **Plesk Node.js**.
5. Validar la conexión con MySQL y reiniciar la aplicación desde Plesk tras cada cambio relevante.

## Variables de entorno necesarias

El proyecto usa estas variables mínimas en servidor:

| Variable | Obligatoria | Descripción |
|---|---:|---|
| `NODE_ENV` | Sí | Debe ser `production` en Plesk. |
| `PORT` | Sí | Puerto interno que Plesk asigna o el que se configure en la app Node.js. |
| `DATABASE_URL` | Sí | Cadena de conexión MySQL usada por Drizzle / mysql2. |
| `JWT_SECRET` | Sí | Se usa como secreto de cookie / sesión local. |
| `VITE_APP_ID` | Según uso | Identificador de aplicación, si el flujo OAuth lo requiere. |
| `OAUTH_SERVER_URL` | Según uso | URL del servidor OAuth si se mantiene ese login. |
| `OWNER_OPEN_ID` | Según uso | Identificador del propietario si la app lo necesita. |
| `BUILT_IN_FORGE_API_URL` | Opcional | Integración adicional del entorno original. |
| `BUILT_IN_FORGE_API_KEY` | Opcional | Clave de integración adicional. |

## Comandos del proyecto

| Comando | Uso |
|---|---|
| `pnpm install` | Instala dependencias |
| `pnpm build` | Compila frontend y backend |
| `pnpm start` | Inicia el servidor en producción |
| `pnpm check` | Verifica TypeScript |
| `pnpm test` | Ejecuta pruebas |
| `pnpm db:push` | Genera y aplica migraciones |

## Configuración sugerida en Plesk

### Opción recomendada

Usar una **aplicación Node.js** sobre el dominio o subdominio `mne.organizus.es`.

### Ajustes sugeridos

| Campo Plesk | Valor sugerido |
|---|---|
| Document root | Carpeta del proyecto |
| Application root | Carpeta del proyecto |
| Application startup file | `dist/index.js` |
| Application mode | `production` |
| Node.js version | `23.11.1` |
| Package manager | `pnpm` |

## Secuencia recomendada de despliegue

```bash
pnpm install
pnpm check
pnpm build
pnpm db:push
pnpm start
```

## Notas importantes para Plesk

> El backend busca un puerto disponible a partir de `PORT`, por lo que conviene que Plesk inyecte correctamente esa variable. En un despliegue estable, lo ideal es que el puerto preferido ya esté reservado para la app y no tenga que buscar otro libre.

> En producción, Express sirve archivos estáticos compilados. Por tanto, **no** debe arrancarse con `pnpm dev`, sino con `pnpm build` seguido de `pnpm start`.

## Base de datos MySQL

La aplicación usa `DATABASE_URL`, por lo que en Plesk conviene construirla con el formato:

```text
mysql://USUARIO:CLAVE@HOST:PUERTO/BASE_DE_DATOS
```

Ejemplo:

```text
mysql://mne_user:clave_segura@127.0.0.1:3306/mne_db
```

## Riesgos o puntos a validar antes del despliegue final

> La aplicación sigue en proceso de adaptación completa al inglés, por lo que antes del despliegue definitivo conviene cerrar la última ronda de traducción y hacer una revisión funcional básica en producción.


1. Confirmar si se mantendrá el login OAuth, el login local o ambos.
2. Verificar si la base de datos del VPS ya tiene las tablas creadas.
3. Revisar si Plesk permite `pnpm` directamente o si habrá que dejarlo preparado con `corepack enable`.
4. Confirmar si las subidas de imágenes necesitan almacenamiento local o S3.
5. Revisar rutas absolutas y permisos de escritura para ficheros temporales.

## Siguiente paso recomendado

Preparar un `.env.production` real para `mne.organizus.es`, terminar la última ronda de traducción al inglés y dejar un checklist exacto de despliegue en Plesk con los valores concretos del servidor.
