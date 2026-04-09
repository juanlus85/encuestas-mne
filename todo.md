# IATUR Encuestas - TODO

## Fase 1: Base de datos y servidor
- [x] Esquema BD: tabla users (roles: admin, encuestador, revisor)
- [x] Esquema BD: tabla survey_templates (plantillas de encuesta ES/EN)
- [x] Esquema BD: tabla questions (preguntas por plantilla)
- [x] Esquema BD: tabla survey_responses (respuestas con trazabilidad completa)
- [x] Esquema BD: tabla field_metrics (rechazos, sustituciones, partes diarios)
- [x] Esquema BD: tabla photos (referencias a fotos S3)
- [x] Migración de BD (pnpm db:push)
- [x] Router: gestión de usuarios (CRUD admin)
- [x] Router: plantillas de encuesta (CRUD admin)
- [x] Router: envío de respuestas (encuestador)
- [x] Router: consulta de resultados (admin/revisor)
- [x] Router: estadísticas y agregaciones (dashboard)
- [x] Router: exportación CSV
- [x] Router: métricas de campo

## Fase 2: Diseño global y autenticación
- [x] Paleta corporativa IATUR (azules institucionales, blancos, grises)
- [x] Tipografía profesional (Inter)
- [x] Logo IATUR en cabecera
- [x] Layout con sidebar para admin/revisor
- [x] Layout mobile-first para encuestador
- [x] Página de login profesional
- [x] Gestión de sesión y redirección por rol

## Fase 3: Módulo encuestador (tablet-first)
- [x] Dashboard encuestador: encuestas activas del día
- [x] Formulario de encuesta paso a paso
- [x] Captura GPS automática al iniciar encuesta
- [x] Registro de hora de inicio y finalización
- [x] Captura de fotografías con cámara del dispositivo
- [x] Subida de fotos a S3
- [x] Soporte bilingüe ES/EN en formulario
- [x] Historial de encuestas del encuestador
- [x] Registro de rechazos y sustituciones

## Fase 4: Panel de administración
- [x] Gestión de usuarios (crear, editar, desactivar encuestadores)
- [x] Editor de plantillas de encuesta
- [x] Editor de preguntas (tipos: opción múltiple, texto, escala, sí/no)
- [x] Listado de respuestas con filtros
- [x] Visor de respuesta individual con fotos y mapa
- [x] Partes de campo diarios por encuestador

## Fase 5: Dashboard de estadísticas
- [x] KPIs: total encuestas, residentes, visitantes, progreso %
- [x] Gráfico de barras: encuestas por día
- [x] Gráfico de dona: distribución por tipo (residente/visitante)
- [x] Gráfico de barras: distribución por encuestador
- [x] Gráfico de franjas horarias
- [x] Filtros: rango de fechas, encuestador, tipo
- [x] Selector de período con período en curso por defecto
- [x] Mapa interactivo con ubicaciones GPS
- [x] Mapa de calor de cobertura en Barrio de Santa Cruz

## Fase 6: Exportación y métricas
- [x] Exportación CSV con todos los metadatos
- [x] Filtros de exportación: fechas, encuestador, tipo
- [x] Métricas de campo: tasa de respuesta, rechazos, sustituciones
- [x] Partes de campo diarios

## Transversal
- [x] Diseño responsive: tablet (10-11"), móvil, escritorio
- [x] Indicador de versión en pie de página (Versión v1.0. DD/MM/YYYY)
- [x] Tests vitest (6 tests pasando)

## Login propio con usuario y contraseña
- [x] Ampliar tabla users con campos username y passwordHash
- [x] Endpoint POST /api/auth/login (username + password → cookie de sesión)
- [x] Endpoint POST /api/auth/logout propio (reutiliza el de OAuth)
- [x] Pantalla de login con formulario usuario/contraseña
- [x] Gestión de contraseña en panel de usuarios (crear/cambiar)
- [x] Tests del sistema de login (3 tests: hash, verify, salting)

## Carga de preguntas reales IATUR
- [x] Plantilla "Encuesta a Residentes" con preguntas P.01-P.13 (29 preguntas, ID 30001)

## Encuesta a Visitantes
- [x] Plantilla "Encuesta a Visitantes" con preguntas P1-P15 (cuestionario IATUR)
- [x] Metadatos de campo específicos: punto de encuesta, bloque horario, código de ventana, minutos inicio/fin
- [ ] Cuotas de visitantes: 40 no sevillanos, 180 nacionales, 180 extranjeros

## Cambios reunión 27/03 - Concepción Foronda
- [x] Ajustar objetivo visitantes de 400 a 450 (total 750)
- [x] Actualizar calendario: inicio 15 abril, fin encuestas 6 junio
- [x] Especialización de encuestadores: asignar tipo (residentes/visitantes/ambos) en perfil de usuario
- [x] Filtrar encuestas disponibles según tipo asignado al encuestador
- [x] Tramo de 30 min automático calculado en exportación CSV
- [x] Precisión GPS (metros) en exportación CSV
- [x] Módulo de conteo peatonal: BD y servidor
- [x] Módulo de conteo peatonal: UI para encuestador (conteo por dirección, fotos cada minuto)
- [x] Módulo de conteo peatonal: visor en panel de administración
- [x] Formato de exportación configurable (separador: coma, punto y coma, tabulador + BOM UTF-8)

## Bug: Dashboard muestra 0 encuestas
- [x] Diagnosticar por qué el dashboard muestra 0 aunque hay respuestas en BD
- [x] Corregir la consulta/router del dashboard (alias SQL t.type → ${surveyTemplates.type})

## Bug: SelectItem value vacío en /conteo-resultados
- [x] Corregir SelectItem con value="" en ConteoResultados.tsx (cambiado a value="all")

## Mejoras UX (27/03)
- [x] Botón de cerrar sesión visible en la cabecera/sidebar para todos los roles
- [x] Botón "Siguiente" pegado debajo de la pregunta en el formulario (no al pie de página)
- [x] Menú de conteo peatonal visible para encuestadores en su sidebar (verificado: sí aparece con rol encuestador)

## Bugs pendientes (post-mejoras UX)
- [x] Menú conteo peatonal no aparece para encuestadores (añadido acceso directo en pantalla de inicio del encuestador)
- [x] ConteoResultados (admin) carga a todo el ancho y desaparece el sidebar (añadido DashboardLayout)

## Rediseño módulo conteo peatonal (boceto 27/03)
- [x] BD: tabla pedestrian_passes (pases individuales) y pedestrian_directions (sentidos por punto)
- [x] Router tRPC: passes.add, directions.list, directions.create/update/delete, passes.stats
- [x] UI encuestador pantalla 1: selector de punto de conteo
- [x] UI encuestador pantalla 2: botones 1-8 + botón grupo (modal con número), selector de sentido, botón Añadir
- [x] Panel admin: gestión de sentidos por punto (crear/editar/eliminar) en /conteo-sentidos
- [x] Panel admin: visor de resultados con filtros por fecha, hora, franja y encuestador en /conteo-resultados
- [x] Tests vitest: 8 tests de conteo (17 en total, todos pasando)

## Mejoras 28/03
- [x] Exportación CSV de conteos peatonales (con filtros: punto, encuestador, fechas)
- [x] PWA instalable en Android e iPhone (manifest.json, service worker, iconos)
- [x] Teclado numérico (inputmode="numeric") en diálogo de grupo grande en conteo
- [x] Scroll automático al inicio al entrar en pantalla de conteo y formulario de encuesta

## Mejoras 28/03 (tarde)
- [x] BD: tabla survey_rejections (encuestador, punto, GPS, fecha, hora, tipo residente/visitante)
- [x] Router tRPC: rejections.add, rejections.list, rejections.stats, rejections.csvExport
- [x] UI encuestador: botones de rechazo rápido junto a "Encuesta Visitantes" y "Encuesta Residentes"
- [x] Mapa de calor de conteos peatonales en /mapa-conteos (separado del mapa de encuestas)
- [x] Exportación CSV de rechazos (incluida en el router rejections.csvExport)
- [x] Tests vitest: 4 tests de rechazos (21 en total, todos pasando)

## Bug: Pantallas arrancan desplazadas hacia abajo en móvil
- [x] Corrección global: componente ScrollToTop en App.tsx que resetea window + documentElement + body en cada cambio de ruta

## Bug: Mapa de calor de conteos no muestra datos
- [x] Corregido: faltaba la librería `visualization` en el script de Google Maps + rediseño del componente para inicializar el mapa después de tener los datos (no antes)

## Correcciones 28/03 (noche)
- [x] BD: surveyPoint, latitude, longitude, gpsAccuracy ya estaban en survey_rejections (schema correcto)
- [x] UI encuestador: selector de punto de encuesta en pantalla principal (persiste en localStorage); GPS con watchPosition continuo
- [x] Rechazos en estadísticas: sección de rechazos con total, por tipo, tasa de rechazo y desglose por punto
- [x] GPS en conteos: cambiado de getCurrentPosition a watchPosition para GPS continuo y más preciso

## Bug: TypeError Invalid URL en VPS propio
- [x] Causa: getLoginUrl() llamada al renderizar useAuth() con VITE_OAUTH_PORTAL_URL vacío
- [x] Corrección: getLoginUrl() devuelve /login si OAuth no está configurado (try/catch + guard)
- [x] Instalado vite-plugin-pwa que faltaba en devDependencies

## Bug: Error 500 en /api/auth/local/login en VPS
- [x] Causa: appId y name vacios en JWT cuando VITE_APP_ID no esta configurado en VPS
- [x] Corregido: createSessionToken usa 'local-app' como fallback; verifySession no requiere name no-vacio
- [x] Reinstalado vite-plugin-pwa que faltaba en node_modules
