# Análisis del proyecto `encuestas-mne`

## Resumen ejecutivo

He revisado el repositorio `juanlus85/encuestas-mne` y, en conjunto, el proyecto se ve **trabajable y bastante avanzado**. No parece un prototipo vacío, sino una aplicación ya orientada a operación real de campo para encuestas y conteos peatonales. La base funcional está clara: existe una interfaz para encuestadores, un panel administrativo, almacenamiento estructurado de respuestas, exportación de datos, métricas, mapas, cuotas, turnos y trabajo con GPS/fotografías.

La arquitectura está resuelta como una **aplicación full-stack TypeScript** con frontend en React/Vite y backend en Express + tRPC, apoyada en **MySQL mediante Drizzle ORM**. Además, el repositorio contiene migraciones, semillas, pruebas y bastante lógica de negocio ya aterrizada, especialmente para residentes, visitantes, rechazos y conteos peatonales.

Dicho eso, para trabajar con él de forma productiva conviene asumir desde el principio que **depende de variables de entorno y de una base de datos disponible**. En el entorno de revisión pude instalar dependencias sin problema, pero la suite de pruebas no queda completamente verde si no existe una BD configurada, lo que indica que parte del proyecto está acoplado a infraestructura real o semirreal.

## Qué tipo de proyecto es

Este repositorio implementa una plataforma para trabajo de campo en encuestas urbanas/turísticas. Hay dos líneas funcionales principales. La primera es la **gestión de encuestas** a residentes y visitantes, con formularios bilingües, geolocalización, fotos, asignación automática de franja horaria y exportación de resultados. La segunda es el **módulo de conteo peatonal**, que registra pases, sentidos, subpuntos, sesiones y métricas asociadas.

También incorpora un modelo de roles relativamente maduro. Hay perfiles de **administrador**, **encuestador** y **revisor**, con vistas y permisos diferenciados. Eso es importante porque no es solo una app de captura: también incluye supervisión, análisis y explotación de datos.

| Área | Estado observado | Comentario |
|---|---:|---|
| Captura de encuestas | Alto | Flujo principal implementado |
| Administración de usuarios y plantillas | Alto | CRUD y control por roles |
| Exportación de datos | Alto | Hay soporte CSV y estructura plana |
| Estadísticas y dashboard | Alto | Existen consultas y pantallas dedicadas |
| Conteo peatonal | Alto | Módulo propio con entidades y UI específicas |
| Offline/PWA | Medio-alto | Hay almacenamiento local y soporte instalable |
| Automatización de tests | Medio | Existen tests, pero no todos corren sin BD |

## Stack tecnológico

El `package.json` deja un stack bastante claro. El frontend usa **React 19**, **Vite 7**, **Wouter** para routing, **TanStack Query** y **tRPC** para consumo tipado del backend. En UI utiliza **Tailwind CSS 4**, componentes de **Radix UI**, `lucide-react`, `recharts` y varias utilidades de formularios.

El backend está montado sobre **Express** y **tRPC**, con código TypeScript ejecutado en desarrollo con `tsx`. La persistencia usa **Drizzle ORM** sobre **MySQL** mediante `mysql2`. También hay piezas para autenticación local, cookies de sesión, subida de archivos y soporte de almacenamiento externo.

| Capa | Tecnologías principales |
|---|---|
| Frontend | React, Vite, Wouter, TanStack Query, Tailwind CSS, Radix UI |
| Backend | Node.js, Express, tRPC, TypeScript |
| Base de datos | MySQL, Drizzle ORM, Drizzle Kit |
| Visualización | Recharts, mapas, componentes móviles |
| Infraestructura adicional | PWA, subida de fotos, cookies de sesión, geolocalización |

## Estructura del repositorio

La estructura del código está razonablemente separada. La carpeta `client/` contiene la aplicación web, `server/` agrupa el backend y `drizzle/` incluye migraciones y esquema. La carpeta `shared/` concentra constantes y tipos compartidos entre cliente y servidor, lo cual es una buena señal en una app TypeScript full-stack porque reduce divergencias de contrato.

La organización práctica del repositorio sugiere que el desarrollo ha sido incremental y muy orientado al dominio. Además del código principal, hay scripts auxiliares para seeds, diagnosis y generación SQL, lo que suele indicar mantenimiento real del sistema y no solo desarrollo de interfaz.

| Ruta | Función principal |
|---|---|
| `client/src/pages` | Pantallas de negocio: encuestas, estadísticas, exportación, mapas, usuarios, turnos |
| `client/src/components` | Componentes reutilizables y layouts |
| `server/_core` | Arranque del servidor, contexto, auth, utilidades base |
| `server/routers.ts` | Definición principal de endpoints/procedimientos tRPC |
| `server/db.ts` | Acceso a datos y consultas de negocio |
| `drizzle/schema.ts` | Esquema principal de la base de datos |
| `drizzle/*.sql` | Migraciones versionadas |
| `shared/*` | Tipos, cuotas, puntos, constantes y helpers compartidos |

## Arquitectura funcional

El punto de entrada del servidor está en `server/_core/index.ts`. Ahí se ve un arranque clásico con **Express**, creación del servidor HTTP, registro de rutas de autenticación, montaje del middleware de tRPC en `/api/trpc` y uso de Vite en desarrollo o archivos estáticos en producción. También se fuerza la zona horaria `Europe/Madrid`, lo cual encaja con el contexto operativo del proyecto.

En el cliente, la navegación principal está en `client/src/App.tsx`, con páginas diferenciadas para login, home, encuestas, resultados, estadísticas, exportación, conteos y configuración. No parece una SPA genérica; la aplicación ya tiene rutas asociadas a flujos reales de operación.

La pieza central del negocio está en `server/routers.ts`. Ahí aparecen procedimientos para usuarios, plantillas, preguntas, respuestas, fotos, dashboard, GPS, conteos peatonales, rechazos, turnos y cierres de turno. El patrón es consistente: procedimientos protegidos por rol, validación con **Zod**, y una capa de persistencia detrás en `server/db.ts`.

## Modelo de datos

El esquema de `drizzle/schema.ts` es uno de los puntos más fuertes del repositorio. No solo guarda una tabla principal de respuestas, sino que además usa varias estrategias de almacenamiento para facilitar explotación y exportación.

Primero, existe `survey_responses`, que conserva la encuesta con trazabilidad amplia: plantilla, encuestador, GPS, franja, idioma, timestamps y un JSON de respuestas. Segundo, existe una estructura **plana** pensada para análisis y exportación, donde cada pregunta relevante se proyecta a columnas específicas. Tercero, se inserta también una capa **normalizada por pregunta** en `survey_answers`, lo que facilita reportes analíticos más flexibles.

Ese diseño híbrido es útil porque combina auditoría, exportabilidad y analítica. Desde el punto de vista de mantenimiento, implica que tocar el envío de encuestas exige revisar con cuidado tres niveles de persistencia: el registro principal, la inserción plana y la inserción normalizada.

| Entidad | Propósito |
|---|---|
| `users` | Gestión de roles, login y asignación de tipo de encuesta |
| `survey_templates` | Plantillas activas/inactivas de residentes o visitantes |
| `questions` | Preguntas bilingües y tipadas por plantilla |
| `survey_responses` | Registro principal completo de cada entrevista |
| `photos` | Fotos asociadas a respuestas/preguntas |
| `field_metrics` | Métricas de campo y seguimiento diario |
| `pedestrian_sessions` / `pedestrian_intervals` | Conteo peatonal por sesión e intervalos |
| `pedestrian_passes` / `pedestrian_directions` | Pases individuales y sentidos por punto |
| `counting_sessions` | Sesiones cronometradas de conteo |

## Flujo de encuestas en frontend

La pantalla `client/src/pages/SurveyForm.tsx` confirma que el producto está bastante aterrizado. El formulario capta GPS al iniciar, permite fotografías, renderiza preguntas bilingües y maneja varios tipos de respuesta: opción única, múltiple, sí/no, escala, número y texto.

Hay además lógica específica de negocio para residentes y visitantes. Por ejemplo, se asignan automáticamente la **franja horaria** y la **ventana temporal**, se ocultan preguntas meta del formulario, y existe una **salida anticipada** en residentes cuando una respuesta invalida continuar la entrevista. También se ven decisiones UX importantes ya implementadas, como mostrar puntos de encuesta como botones visibles en lugar de un desplegable y mostrar español e inglés a la vez.

Este archivo es clave si vas a tocar producto o lógica de captura, porque centraliza buena parte del comportamiento real del encuestador.

## Autenticación y permisos

El proyecto soporta autenticación con cookie de sesión y, al menos, **login local por usuario/contraseña**. El entorno también contempla piezas de OAuth, aunque el propio repositorio indica cambios para reducir dependencia de ese acceso en ciertos despliegues. En el modelo de usuario aparecen `admin`, `encuestador`, `revisor` y `user`, y los procedimientos del router están protegidos por middleware según rol.

Desde el punto de vista de mantenimiento, esto está bien encaminado. La consecuencia práctica es que si quieres modificar pantallas o endpoints debes revisar siempre si el acceso está controlado desde frontend, backend o ambos.

## Estado operativo observado

Pude instalar dependencias correctamente con `pnpm install --frozen-lockfile`. Eso sugiere que el lockfile está utilizable y que el repositorio no está roto a nivel de resolución de paquetes.

Sin embargo, al ejecutar `pnpm test` la suite no quedó completamente en verde en este entorno. El resultado fue **3 archivos de test aprobados y 1 fallando**, con **10 tests correctos y 11 fallidos**. El patrón de error más relevante es `DB not available` en pruebas del módulo de conteo y rechazos, lo que apunta a que esos tests requieren una base de datos real o una configuración que aquí no estaba disponible.

| Comprobación | Resultado | Lectura |
|---|---:|---|
| Instalación de dependencias | Correcta | El proyecto se deja montar |
| Ejecución de tests | Parcialmente fallida | La BD es requisito práctico |
| Organización del código | Buena | Se puede intervenir por módulos |
| Madurez funcional | Alta | Hay mucho negocio ya implementado |

## Variables de entorno que parecen necesarias

En `server/_core/env.ts` se observan varias variables importantes. Como mínimo, para levantar el backend con funcionalidad real parece necesario disponer de `DATABASE_URL`, `JWT_SECRET` y probablemente `VITE_APP_ID` o equivalentes según el modo de despliegue. También aparecen parámetros para OAuth y para almacenamiento de archivos.

| Variable | Uso aparente |
|---|---|
| `DATABASE_URL` | Conexión a MySQL |
| `JWT_SECRET` | Firma/seguridad de cookies o sesión |
| `VITE_APP_ID` | Identidad de aplicación en ciertos flujos |
| `OAUTH_SERVER_URL` | Integración OAuth si está habilitada |
| `OWNER_OPEN_ID` | Identificador privilegiado/propietario |
| `BUILT_IN_FORGE_API_URL` | API de almacenamiento/forge |
| `BUILT_IN_FORGE_API_KEY` | Credencial del almacenamiento/forge |

## Cómo lo abordaría para empezar a trabajar con el proyecto

Si tu objetivo es **mantenerlo o evolucionarlo**, mi recomendación es empezar por validar tres capas antes de tocar funcionalidad. La primera es el **arranque local**, asegurando variables de entorno mínimas y una base MySQL accesible. La segunda es la **base de datos**, porque gran parte del valor del sistema está en cómo persiste respuestas, métricas y conteos. La tercera es el **flujo del encuestador**, porque es la parte más sensible del producto.

A nivel de lectura de código, empezaría por este orden: `package.json`, `server/_core/index.ts`, `server/routers.ts`, `server/db.ts`, `drizzle/schema.ts`, `client/src/pages/Home.tsx` y `client/src/pages/SurveyForm.tsx`. Ese recorrido da una visión muy buena de arranque, endpoints, persistencia y experiencia principal.

## Dónde tocar según el tipo de cambio

Si quieres modificar reglas de negocio o validaciones del envío de encuestas, el punto más importante será `server/routers.ts`, especialmente el procedimiento de `responses.submit`, y su reflejo en `server/db.ts`. Si el cambio afecta a columnas exportadas o a cómo se guarda cada pregunta, tendrás que revisar además el almacenamiento plano y normalizado.

Si quieres cambiar experiencia de usuario del encuestador, la ruta principal está en `client/src/pages/SurveyForm.tsx`, y en segundo plano `client/src/pages/Home.tsx` y los componentes/layouts del cliente. Si el cambio es de panel administrativo, probablemente tocarás páginas como `Resultados.tsx`, `Estadisticas.tsx`, `Exportar.tsx` y los procedimientos de dashboard/exportación del servidor.

| Tipo de cambio | Archivos prioritarios |
|---|---|
| Envío y validación de encuestas | `server/routers.ts`, `server/db.ts`, `drizzle/schema.ts` |
| Formulario del encuestador | `client/src/pages/SurveyForm.tsx` |
| Dashboard y reporting | `client/src/pages/Estadisticas.tsx`, `server/db.ts` |
| Exportación CSV | `client/src/pages/Exportar.tsx`, `server/routers.ts`, `server/db.ts` |
| Usuarios y permisos | `server/routers.ts`, auth local, pantallas de usuarios |
| Conteo peatonal | páginas de conteo + tablas/consultas específicas en backend |

## Riesgos y puntos de atención

El principal riesgo técnico no es tanto la interfaz, sino la **densidad de lógica de negocio acoplada a estructuras concretas de preguntas y columnas**. En este proyecto hay mucho comportamiento que depende de tipos de encuesta, orden de preguntas, exclusión de preguntas `META`, campos `v_pXX` y `r_pXX`, y reglas específicas para residentes/visitantes. Eso significa que una modificación aparentemente pequeña en cuestionarios puede impactar frontend, backend, exportación y base de datos a la vez.

El segundo punto de atención es la **dependencia de infraestructura**. Sin la base de datos, el proyecto no se puede validar completamente. Si vas a trabajar de verdad con él, conviene resolver pronto un entorno reproducible con `.env`, esquema migrado y datos mínimos de prueba.

El tercer punto es la coexistencia de una aplicación aparentemente madura con un historial de desarrollo rápido. El `todo.md` muestra muchísimas iteraciones, correcciones y cambios de alcance. Eso es bueno porque deja rastro funcional, pero también sugiere que puede haber zonas donde la consistencia interna dependa más de convenciones del equipo que de abstracciones limpias.

## Valoración final

Mi conclusión es que **sí, se puede trabajar con este proyecto**, y además tiene suficiente base como para continuar sobre él sin empezar de cero. La aplicación ya contiene lógica de negocio concreta, módulos completos y una estructura razonable. No lo catalogaría como un repositorio “bonito pero vacío”, sino como una base funcional bastante seria.

La contrapartida es que no conviene entrar a modificarlo a ciegas. Para trabajar bien con él necesitarás alinear **entorno**, **base de datos**, **flujos del encuestador** y **mapeos de persistencia/exportación**. Una vez controladas esas cuatro piezas, el repositorio parece perfectamente mantenible.

## Siguiente paso recomendado

Mi siguiente paso recomendado sería preparar una **puesta en marcha local guiada**, verificando variables de entorno, arranque del servidor, migraciones y recorrido de las pantallas principales. Después de eso, ya se podría pasar a una segunda fase más útil: o bien un **mapa del código para desarrollo** por módulos, o bien directamente una **intervención concreta** sobre el cambio que quieras hacer.
