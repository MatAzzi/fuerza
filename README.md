# Fuerza: registro de entrenamiento (PWA)

Es una app web mobile-first que funciona sin conexión. Los datos quedan solo en el dispositivo. No necesita build, dependencias ni cuenta.

## Arquitectura

| Pieza | Qué hace |
|---|---|
| `index.html` | Estructura de la app: barra de navegación, temporizador, hoja inferior y avisos. |
| `styles.css` | Tema oscuro y botones grandes, pensados para usar el teléfono con una mano. |
| `js/data.js` | Valores por defecto: ejercicios, rutina Push/Pull, las 6 semanas del mesociclo y los suplementos. |
| `js/store.js` | Guarda el estado en `localStorage` (clave `gymlog.v1`). También exporta e importa JSON, migra datos viejos y tiene utilidades de formato es-AR. |
| `js/logic.js` | Reglas de entrenamiento: semana del mesociclo, plan del día, precarga, 1RM de Epley, detección de inconsistencias, sesgo de RIR, doble progresión y estadísticas. |
| `js/charts.js` | Gráficos SVG propios, sin librerías. Tocás un punto o una barra y ves el valor. Cada gráfico tiene una tabla. |
| `js/ui.js` | Pantallas, hojas modales y acciones. Las pantallas se arman con plantillas y los eventos se manejan por delegación con `data-a`. |
| `js/app.js` | Arranque, temporizador de descanso (sonido y vibración), pantalla encendida (Wake Lock) y registro del service worker. |
| `sw.js` | Guarda la app en caché para que funcione offline. |

Toda la app vive en un único objeto de estado en memoria. Cada cambio llama a `save()` y vuelve a dibujar la pantalla actual. La navegación usa el hash de la URL (`#/home`, `#/session`, etc.).

## Modelo de datos (resumido)

```
state = {
  settings:    { bodyweightKg, restCompound, restIsolation, applyBias, wakeLock, sound },
  exercises:   { [id]: { name, kind: weight|bw|reps|time, type: compound|isolation,
                         inc, rest?, perSide?, failureOk?, muscles: {grupo: 1|0.5}, alts? } },
  routine:     { order: [templateId…], templates: { [id]: { name, subtitle, exercises: [{exId, sets, repMin, repMax}] } } },
  meso:        { n, offset, weeks: [{ label, sets: tres|completas|mitad, rirComp, rirIso, load, deload? }] },
  nextIdx,     activeId,
  sessions:    [{ id, templateId, name, date, startedAt, endedAt, meso: {n, week, deload},
                  sleep, energy, notes,
                  exercises: [{ uid, exId, plannedSets, repMin, repMax, targetRir, load, notes,
                                sets: [{ w, reps, rir, warmup, mode, extra, bw, t, calib?, test? }],
                                draft, warnings, suggestion }] }],
  walks:       [{ id, date, km, minutes, feel, note }],
  bodyweight:  [{ date, kg }],
  supplements: { items: [{id, name}], log: { 'AAAA-MM-DD': [id…] } },
  bwMax:       { [exId]: { reps, mode, extra, date } },
  calibrations:[{ date, exId, weight, repsA, predicted, extra, method }]
}
```

## Reglas principales

- **Semana del mesociclo.** Avanza cada 4 sesiones terminadas, así una semana sin entrenar no te saca del ciclo. Se puede corregir con ±1 semana desde Ajustes.
- **Series de calentamiento.** No cuentan en el volumen ni en la progresión.
- **Dominadas y fondos.** La carga se calcula como peso corporal + lastre − asistencia. La primera vez se pide un test de máximo. Las series de trabajo se planifican con ese máximo menos 2 o 3 reps. Cuando completás 3×8 con RIR 2, la app sugiere progresar.
- **Sesgo de RIR.** Es el promedio de las últimas 6 calibraciones: reps extra reales menos RIR predicho. Si está activado en Ajustes, se suma al RIR que reportás antes de calcular la progresión.
- **Calibración al fallo.** Solo se ofrece en ejercicios marcados como "máquina o bajo riesgo". Nunca se ofrece en sentadilla, press banca, peso muerto, press militar ni press inclinado con barra.

## Cómo usarla

El service worker necesita HTTPS o `localhost`:

- **En la PC, para probar:** `python -m http.server 8000` en esta carpeta y abrir `http://localhost:8000`.
- **En el teléfono:** subir la carpeta a un hosting estático con HTTPS (GitHub Pages, Netlify o Cloudflare Pages), abrirla en Chrome o Safari y elegir "Agregar a pantalla de inicio". Desde ahí funciona sin conexión.
- **Al cambiar archivos:** subir `VERSION` en `sw.js` para que el teléfono descargue la versión nueva.

Exportá un backup JSON de vez en cuando desde Ajustes. Si borrás los datos del navegador, se pierde todo.

> Esta app es una herramienta de registro. No reemplaza la consulta con un médico ni con un entrenador.
