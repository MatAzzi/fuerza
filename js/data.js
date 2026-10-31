/* Datos por defecto: biblioteca de ejercicios, rutina, mesociclo y ajustes. */

const MUSCLES = {
  pecho: 'Pecho', espalda: 'Espalda', hombros: 'Hombros', biceps: 'Bíceps',
  triceps: 'Tríceps', cuads: 'Cuádriceps', isquios: 'Isquios', gluteos: 'Glúteos', core: 'Core'
};

/*
 * kind: 'weight' (con carga) | 'bw' (peso corporal con lastre/asistencia, regla especial)
 *       | 'reps' (peso corporal simple) | 'time' (segundos)
 * type: 'compound' | 'isolation'
 * inc: incremento sugerido en kg
 * failureOk: se permite ir al fallo técnico (máquinas / bajo riesgo) -> habilita modo calibración
 * muscles: { grupo: 1 (primario) | 0.5 (secundario) }
 */
const DEFAULT_EXERCISES = [
  { id: 'sentadilla', name: 'Sentadilla con barra', kind: 'weight', type: 'compound', inc: 5, muscles: { cuads: 1, gluteos: 0.5 } },
  { id: 'banca', name: 'Press banca', kind: 'weight', type: 'compound', inc: 2.5, muscles: { pecho: 1, triceps: 0.5, hombros: 0.5 } },
  { id: 'militar', name: 'Press militar con barra', kind: 'weight', type: 'compound', inc: 2.5, muscles: { hombros: 1, triceps: 0.5 }, alts: ['militar_mancuernas'] },
  { id: 'militar_mancuernas', name: 'Press militar con mancuernas', kind: 'weight', type: 'compound', inc: 2, muscles: { hombros: 1, triceps: 0.5 } },
  { id: 'inclinado_mancuernas', name: 'Press inclinado con mancuernas', kind: 'weight', type: 'compound', inc: 2, muscles: { pecho: 1, hombros: 0.5, triceps: 0.5 } },
  { id: 'fondos', name: 'Fondos en paralelas', kind: 'bw', type: 'compound', inc: 2.5, muscles: { pecho: 1, triceps: 1, hombros: 0.5 } },
  { id: 'plancha', name: 'Plancha frontal', kind: 'time', type: 'isolation', inc: 0, muscles: { core: 1 } },

  { id: 'rumano', name: 'Peso muerto rumano', kind: 'weight', type: 'compound', inc: 5, muscles: { isquios: 1, gluteos: 1, espalda: 0.5 } },
  { id: 'dominadas', name: 'Dominadas', kind: 'bw', type: 'compound', inc: 2.5, muscles: { espalda: 1, biceps: 0.5 }, alts: ['jalon'] },
  { id: 'jalon', name: 'Jalón al pecho', kind: 'weight', type: 'compound', inc: 2.5, failureOk: true, muscles: { espalda: 1, biceps: 0.5 } },
  { id: 'remo_barra', name: 'Remo con barra', kind: 'weight', type: 'compound', inc: 2.5, muscles: { espalda: 1, biceps: 0.5 } },
  { id: 'remo_mancuerna', name: 'Remo con mancuerna a una mano', kind: 'weight', type: 'compound', inc: 2, perSide: true, muscles: { espalda: 1, biceps: 0.5 } },
  { id: 'curl_barra', name: 'Curl de bíceps con barra', kind: 'weight', type: 'isolation', inc: 2, failureOk: true, muscles: { biceps: 1 } },
  { id: 'face_pull', name: 'Face pull', kind: 'weight', type: 'isolation', inc: 1, failureOk: true, muscles: { hombros: 1, espalda: 0.5 }, alts: ['pajaros'] },
  { id: 'pajaros', name: 'Pájaros (vuelos posteriores)', kind: 'weight', type: 'isolation', inc: 1, failureOk: true, muscles: { hombros: 1, espalda: 0.5 } },

  { id: 'prensa', name: 'Prensa de piernas', kind: 'weight', type: 'compound', inc: 5, failureOk: true, muscles: { cuads: 1, gluteos: 0.5 } },
  { id: 'inclinado_barra', name: 'Press inclinado con barra', kind: 'weight', type: 'compound', inc: 2.5, muscles: { pecho: 1, hombros: 0.5, triceps: 0.5 } },
  { id: 'hombros_sentado', name: 'Press de hombros con mancuernas sentado', kind: 'weight', type: 'compound', inc: 2, muscles: { hombros: 1, triceps: 0.5 } },
  { id: 'banca_cerrado', name: 'Press banca agarre cerrado', kind: 'weight', type: 'compound', inc: 2.5, muscles: { triceps: 1, pecho: 0.5 } },
  { id: 'bulgara', name: 'Sentadilla búlgara', kind: 'weight', type: 'compound', inc: 2, perSide: true, muscles: { cuads: 1, gluteos: 1 }, alts: ['zancadas'] },
  { id: 'zancadas', name: 'Zancadas', kind: 'weight', type: 'compound', inc: 2, perSide: true, muscles: { cuads: 1, gluteos: 1 } },
  { id: 'laterales', name: 'Elevaciones laterales', kind: 'weight', type: 'isolation', inc: 1, failureOk: true, muscles: { hombros: 1 } },
  { id: 'elev_piernas', name: 'Elevación de piernas', kind: 'reps', type: 'isolation', inc: 0, muscles: { core: 1 } },

  { id: 'hip_thrust', name: 'Hip thrust', kind: 'weight', type: 'compound', inc: 5, muscles: { gluteos: 1, isquios: 0.5 } },
  { id: 'pendlay', name: 'Remo Pendlay', kind: 'weight', type: 'compound', inc: 2.5, muscles: { espalda: 1, biceps: 0.5 }, alts: ['remo_barra'] },
  { id: 'jalon_neutro', name: 'Jalón al pecho agarre neutro', kind: 'weight', type: 'compound', inc: 2.5, failureOk: true, muscles: { espalda: 1, biceps: 0.5 } },
  { id: 'curl_femoral', name: 'Curl femoral', kind: 'weight', type: 'isolation', inc: 2.5, failureOk: true, muscles: { isquios: 1 } },
  { id: 'martillo', name: 'Curl martillo', kind: 'weight', type: 'isolation', inc: 1, failureOk: true, muscles: { biceps: 1 } },
  { id: 'pallof', name: 'Pallof press', kind: 'weight', type: 'isolation', inc: 1, perSide: true, failureOk: true, muscles: { core: 1 } }
];

function tx(exId, sets, repMin, repMax) { return { exId, sets, repMin, repMax }; }

const DEFAULT_ROUTINE = {
  order: ['pushA', 'pullA', 'pushB', 'pullB'],
  templates: {
    pushA: { name: 'Push A', subtitle: 'Pesado', exercises: [
      tx('sentadilla', 4, 6, 8), tx('banca', 4, 6, 8), tx('militar', 3, 8, 10),
      tx('inclinado_mancuernas', 3, 8, 10), tx('fondos', 3, 8, 12), tx('plancha', 3, 30, 45)
    ] },
    pullA: { name: 'Pull A', subtitle: 'Pesado', exercises: [
      tx('rumano', 4, 6, 8), tx('dominadas', 4, 6, 10), tx('remo_barra', 3, 8, 10),
      tx('remo_mancuerna', 3, 10, 10), tx('curl_barra', 3, 10, 12), tx('face_pull', 3, 15, 15)
    ] },
    pushB: { name: 'Push B', subtitle: 'Volumen', exercises: [
      tx('prensa', 4, 10, 12), tx('inclinado_barra', 4, 8, 10), tx('hombros_sentado', 3, 10, 10),
      tx('banca_cerrado', 3, 10, 10), tx('bulgara', 3, 10, 10), tx('laterales', 3, 15, 15),
      tx('elev_piernas', 3, 10, 12)
    ] },
    pullB: { name: 'Pull B', subtitle: 'Volumen', exercises: [
      tx('hip_thrust', 4, 8, 10), tx('pendlay', 4, 8, 10), tx('jalon_neutro', 4, 10, 10),
      tx('curl_femoral', 3, 12, 12), tx('martillo', 3, 10, 12), tx('face_pull', 3, 15, 15),
      tx('pallof', 3, 12, 12)
    ] }
  }
};

/*
 * sets: 'tres' (máx. 3 series en compuestos) | 'completas' | 'mitad'
 * rirComp / rirIso: RIR objetivo (1.5 se muestra como "1-2")
 * load: % del peso habitual
 */
const DEFAULT_MESO_WEEKS = [
  { label: 'Calibración', sets: 'tres', rirComp: 3, rirIso: 1, load: 100 },
  { label: 'Adaptación', sets: 'tres', rirComp: 3, rirIso: 1, load: 100 },
  { label: 'Acumulación', sets: 'completas', rirComp: 2, rirIso: 1, load: 100 },
  { label: 'Acumulación', sets: 'completas', rirComp: 2, rirIso: 1, load: 100 },
  { label: 'Intensificación', sets: 'completas', rirComp: 1.5, rirIso: 1, load: 100 },
  { label: 'Descarga', sets: 'mitad', rirComp: 3, rirIso: 1, load: 60, deload: true }
];

const DEFAULT_SUPPLEMENTS = [
  { id: 'creatina', name: 'Creatina' },
  { id: 'magnesio', name: 'Magnesio bisglicinato' },
  { id: 'd3k2', name: 'Vitamina D3 + K2' },
  { id: 'omega3', name: 'Omega-3' }
];

function defaultState() {
  const exercises = {};
  DEFAULT_EXERCISES.forEach(e => { exercises[e.id] = JSON.parse(JSON.stringify(e)); });
  return {
    schema: 1,
    settings: {
      bodyweightKg: 78,
      restCompound: 120,
      restIsolation: 90,
      applyBias: true,
      wakeLock: true,
      sound: true
    },
    exercises,
    routine: JSON.parse(JSON.stringify(DEFAULT_ROUTINE)),
    meso: { n: 1, offset: 0, startedAt: new Date().toISOString(), weeks: JSON.parse(JSON.stringify(DEFAULT_MESO_WEEKS)) },
    nextIdx: 0,
    sessions: [],
    activeId: null,
    walks: [],
    bodyweight: [],
    supplements: { items: JSON.parse(JSON.stringify(DEFAULT_SUPPLEMENTS)), log: {} },
    bwMax: {},
    calibrations: []
  };
}
