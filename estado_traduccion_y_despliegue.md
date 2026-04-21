# Estado actual de traducción y despliegue

## Avances completados

Se han traducido total o parcialmente los siguientes módulos de interfaz:

- `client/src/pages/Login.tsx`
- `client/src/pages/Home.tsx`
- `client/src/components/EncuestadorLayout.tsx`
- `client/src/components/DashboardLayout.tsx`
- `client/src/pages/SurveyForm.tsx`
- `client/src/pages/Configuracion.tsx`
- `client/src/pages/Cuotas.tsx`
- `client/src/pages/Usuarios.tsx` (avance importante, aún con restos)
- `client/src/pages/Exportar.tsx` (avance parcial relevante)
- `client/src/pages/Estadisticas.tsx` (avance parcial relevante)
- `client/src/pages/Mapa.tsx` (avance parcial relevante)
- `client/src/pages/CierreTurno.tsx` (avance parcial relevante)
- `client/src/pages/MisHorarios.tsx` (avance parcial relevante)
- `client/src/pages/ConteoPeatonal.tsx` (avance parcial relevante)

## Validación técnica

Después de cada bloque de cambios relevantes se ha ejecutado:

```bash
pnpm check
```

El proyecto sigue compilando correctamente en TypeScript tras las modificaciones realizadas hasta este punto.

## Despliegue VPS / Plesk

Se ha preparado un borrador de guía en:

- `guia_despliegue_plesk_borrador.md`

Puntos ya confirmados para el entorno objetivo:

- Panel: **Plesk**
- Base de datos: **MySQL**
- Acceso: **SSH con permisos suficientes**
- Runtime: **Node.js 23.11.1**
- Dominio objetivo de referencia: **mne.organizus.es**

## Pendientes principales

Los archivos con más texto residual en español siguen siendo, a fecha de la última auditoría automática:

1. `client/src/pages/Exportar.tsx`
2. `client/src/pages/Usuarios.tsx`
3. `client/src/pages/Estadisticas.tsx`
4. `client/src/pages/Mapa.tsx`
5. `client/src/pages/CierreTurno.tsx`
6. `client/src/pages/ConteoPeatonal.tsx`

## Observaciones

La aplicación todavía no puede considerarse **100% en inglés**, pero ya están cubiertos varios de los flujos más importantes. La última auditoría automática detectó **355 cadenas candidatas** todavía en español, con mucha concentración en backend interno y en unos pocos módulos grandes del frontend.

Ya están cubiertos varios de los flujos más importantes:

- acceso y login
- inicio y navegación principal
- formulario de encuesta
- cuotas
- configuración
- parte de usuarios
- parte de exportación
- parte de estadísticas
- parte de mapa
- parte de cierre de turno
- parte de mis horarios
- parte de conteo peatonal

## Siguiente paso recomendado

Completar la traducción de los módulos pendientes y, cuando eso termine, preparar una entrega final con:

1. lista de archivos modificados,
2. guía de despliegue definitiva para Plesk,
3. checklist de variables de entorno y base de datos,
4. posibles pasos para publicar cambios en el VPS.
