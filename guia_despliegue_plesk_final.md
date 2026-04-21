# Guía de despliegue en Plesk para `mne.organizus.es`

## Resumen

Este proyecto funciona como una aplicación **Node.js + Express + Vite + MySQL**. En desarrollo usa Vite como middleware, pero en producción el servidor Express sirve el frontend compilado desde `dist`. Por tanto, para desplegarlo correctamente en **Plesk** hay que instalar dependencias, compilar el proyecto, configurar las variables de entorno y arrancar la aplicación con `pnpm start`.

## Stack y comandos reales del proyecto

| Elemento | Valor |
|---|---|
| Runtime principal | Node.js |
| Gestor de paquetes | `pnpm` |
| Build frontend/backend | `pnpm build` |
| Arranque producción | `pnpm start` |
| Verificación TypeScript | `pnpm check` |
| Migraciones | `pnpm db:push` |
| Punto de arranque compilado | `dist/index.js` |

## Variables de entorno mínimas

La plantilla base se ha dejado en el archivo `.env.production.example`.

| Variable | Obligatoria | Uso |
|---|---:|---|
| `NODE_ENV` | Sí | Debe ser `production` |
| `PORT` | Sí | Puerto interno de la app |
| `DATABASE_URL` | Sí | Conexión MySQL |
| `JWT_SECRET` | Sí | Secreto de autenticación local |
| `VITE_APP_ID` | No siempre | Depende del login OAuth |
| `OAUTH_SERVER_URL` | No siempre | Depende del login OAuth |
| `OWNER_OPEN_ID` | No siempre | Depende del login OAuth |
| `BUILT_IN_FORGE_API_URL` | Opcional | Integración heredada |
| `BUILT_IN_FORGE_API_KEY` | Opcional | Integración heredada |

Ejemplo mínimo:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://mne_user:CAMBIAR@127.0.0.1:3306/mne_db
JWT_SECRET=CAMBIAR_POR_UN_SECRETO_LARGO
VITE_APP_ID=
OAUTH_SERVER_URL=
OWNER_OPEN_ID=
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
```

## Configuración sugerida en Plesk

| Campo de Plesk | Valor recomendado |
|---|---|
| Dominio/subdominio | `mne.organizus.es` |
| Versión Node.js | `23.11.1` |
| Application mode | `production` |
| Application root | Carpeta del proyecto |
| Document root | Carpeta del proyecto o la definida por Plesk para la app Node |
| Startup file | `dist/index.js` |
| Package manager | `pnpm` |

## Secuencia recomendada de despliegue

### 1. Subir el proyecto al servidor

Sube el proyecto completo al servidor Plesk, conservando `package.json`, `pnpm-lock`, `client`, `server`, `shared`, `drizzle` y los archivos de configuración.

### 2. Crear el archivo de entorno

Copia `.env.production.example` a `.env.production` y rellena los valores reales del servidor.

### 3. Instalar dependencias

```bash
pnpm install
```

### 4. Validar el proyecto antes de compilar

```bash
pnpm check
```

### 5. Generar la versión de producción

```bash
pnpm build
```

### 6. Preparar la base de datos

Si la base está vacía o es nueva:

```bash
pnpm db:push
```

Si la base ya existe y contiene datos, conviene revisar antes de ejecutar migraciones.

### 7. Arrancar la aplicación

```bash
pnpm start
```

Después, reinicia la aplicación desde Plesk para que tome el entorno definitivo.

## Verificaciones recomendadas tras el despliegue

| Comprobación | Qué validar |
|---|---|
| Carga inicial | Que `https://mne.organizus.es` abra correctamente |
| Login | Que el acceso local con usuario/contraseña funcione |
| Base de datos | Que la app lea y escriba en MySQL |
| API | Que `/api/trpc` responda sin errores de servidor |
| Frontend | Que los assets compilados se sirvan correctamente |
| Flujos clave | Login, home, encuesta, exportación y usuarios |

## Notas importantes

> El servidor intenta arrancar en `PORT` y, si está ocupado, busca otro puerto cercano. En un despliegue estable con Plesk es mejor que el puerto asignado esté libre y fijo para evitar comportamientos inesperados.

> La app debe ejecutarse en producción con `pnpm build` seguido de `pnpm start`. No conviene usar `pnpm dev` en Plesk.

> El proyecto está ya bastante avanzado hacia una interfaz en inglés, pero todavía conviene hacer una revisión visual final en producción antes de considerarlo cerrado al 100%.

## Archivos de apoyo incluidos

En el repositorio de trabajo he dejado además estos archivos para ayudarte:

| Archivo | Uso |
|---|---|
| `.env.production.example` | Plantilla de entorno |
| `checklist_despliegue_plesk.md` | Checklist rápido de despliegue |
| `estado_traduccion_y_despliegue.md` | Estado actual de traducción y validación |
| `guia_despliegue_plesk_borrador.md` | Borrador técnico previo |

## Siguiente paso recomendado

Lo más práctico ahora es terminar la última ronda de limpieza de textos en inglés, preparar un `.env.production` real con tus credenciales y hacer un primer despliegue controlado en `mne.organizus.es`.
