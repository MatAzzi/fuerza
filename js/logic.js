/* Lógica de entrenamiento: mesociclo, planificación, precarga, 1RM, RIR, progresión, estadísticas. */

/* ---------- básicos ---------- */

function currentBodyweight() {
  const list = S.bodyweight.slice().sort((a, b) => a.date.localeCompare(b.date));
  return list.length ? list[list.length - 1].kg : S.settings.bodyweightKg;
}

const finishedSessions = () => S.sessions.filter(s => s.endedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
const activeSession = () => S.sessions.find(s => s.id === S.activeId) || null;
const exName = id => (S.exercises[id] && S.exercises[id].name) || id;
const isCompound = ex => ex && ex.type === 'compound';

function rirLabel(r) {
  if (r == null) return '–';
  if (r % 1 !== 0) return `${Math.floor(r)}-${Math.ceil(r)}`;
  return r >= 5 ? '5+' : String(r);
}

function restFor(ex) {
  if (ex && ex.rest) return ex.rest;
  return isCompound(ex) ? S.settings.restCompound : S.settings.restIsolation;
}

/* ---------- mesociclo ---------- */

function mesoInfo() {
  const weeks = S.meso.weeks;
  const done = finishedSessions().filter(s => s.meso && s.meso.n === S.meso.n).length;
  const perWeek = Math.max(1, S.routine.order.length);
  const week = Math.max(1, Math.floor(done / perWeek) + 1 + (S.meso.offset || 0));
  const finished = week > weeks.length;
  const w = Math.min(week, weeks.length);
  return { n: S.meso.n, week: w, total: weeks.length, cfg: weeks[w - 1], finished, done, inWeek: done % perWeek };
}

function newMesocycle() {
  S.meso.n += 1;
  S.meso.offset = 0;
  S.meso.startedAt = new Date().toISOString();
  save();
}

/* ---------- planificación de cada ejercicio para hoy ---------- */

function bwProposal(tex, maxReps) {
  const hi = Math.max(1, maxReps - 2);
  const lo = Math.max(1, maxReps - (maxReps >= 8 ? 3 : 2));
  let sets = tex.sets;
  if (lo < tex.repMin) sets = Math.min(8, Math.ceil((tex.sets * tex.repMin) / lo));
  return { sets, repMin: lo, repMax: hi };
}

function planEntry(tex, cfg) {
  const ex = S.exercises[tex.exId];
  const compound = isCompound(ex);
  let sets = tex.sets, repMin = tex.repMin, repMax = tex.repMax, bwPlan = false;

  if (ex && ex.kind === 'bw' && S.bwMax[ex.id]) {
    const p = bwProposal(tex, S.bwMax[ex.id].reps);
    sets = p.sets; repMin = p.repMin; repMax = p.repMax; bwPlan = true;
  } else if (cfg.sets === 'tres' && compound) {
    sets = Math.min(sets, 3);
  }
  if (cfg.sets === 'mitad') sets = Math.max(1, Math.ceil(sets / 2));

  return {
    uid: uid(), exId: tex.exId, plannedSets: sets, repMin, repMax, bwPlan,
    targetRir: compound ? cfg.rirComp : cfg.rirIso,
    load: cfg.load, notes: '', sets: [], draft: null, warnings: [], suggestion: null, open: false
  };
}

function startSession(templateId, sleep, energy) {
  const t = S.routine.templates[templateId];
  const mi = mesoInfo();
  const session = {
    id: uid(), templateId, name: t.name, date: todayStr(), startedAt: new Date().toISOString(), endedAt: null,
    meso: { n: mi.n, week: mi.week, deload: !!mi.cfg.deload, calibration: mi.week === 1 },
    sleep, energy, notes: '',
    exercises: t.exercises.filter(x => S.exercises[x.exId]).map(x => planEntry(x, mi.cfg))
  };
  session.exercises.forEach(e => { e.draft = makeDraft(session, e); });
  if (session.exercises[0]) session.exercises[0].open = true;
  S.sessions.push(session);
  S.activeId = session.id;
  save();
  return session;
}

function addExerciseToSession(session, exId) {
  const cfg = S.meso.weeks[session.meso.week - 1] || mesoInfo().cfg;
  const e = planEntry({ exId, sets: 3, repMin: 8, repMax: 12 }, cfg);
  e.draft = makeDraft(session, e);
  session.exercises.forEach(x => { x.open = false; });
  e.open = true;
  session.exercises.push(e);
  save();
}

function swapExercise(session, entry, newExId) {
  const tex = { exId: newExId, sets: entry.plannedSets, repMin: entry.repMin, repMax: entry.repMax };
  const cfg = S.meso.weeks[session.meso.week - 1] || mesoInfo().cfg;
  const fresh = planEntry(tex, cfg);
  Object.assign(entry, { exId: newExId, bwPlan: fresh.bwPlan, targetRir: fresh.targetRir });
  if (fresh.bwPlan) Object.assign(entry, { plannedSets: fresh.plannedSets, repMin: fresh.repMin, repMax: fresh.repMax });
  entry.draft = makeDraft(session, entry);
  save();
}

/* ---------- historial del ejercicio / precarga ---------- */

const workingSets = entry => entry.sets.filter(s => !s.warmup);
const progressionSets = entry => entry.sets.filter(s => !s.warmup && !s.calib && !s.test);

/** Última vez que se hizo el ejercicio (prefiere sesiones que no sean de descarga). */
function lastEntryFor(exId, excludeId) {
  const list = finishedSessions().filter(s => s.id !== excludeId).reverse();
  let fallback = null;
  for (const s of list) {
    const e = s.exercises.find(x => x.exId === exId && workingSets(x).length);
    if (!e) continue;
    if (!s.meso || !s.meso.deload) return { session: s, entry: e };
    if (!fallback) fallback = { session: s, entry: e };
  }
  return fallback;
}

function makeDraft(session, entry) {
  const ex = S.exercises[entry.exId] || {};
  const done = workingSets(entry);
  const prevInSession = done[done.length - 1];
  const last = lastEntryFor(entry.exId, session.id);
  const lastSets = last ? progressionSets(last.entry) : [];
  const lastSameIdx = lastSets[done.length] || lastSets[lastSets.length - 1];
  const deloadNow = session.meso && session.meso.deload;
  const lastWasDeload = last && last.session.meso && last.session.meso.deload;

  const d = { w: null, reps: entry.repMin, warmup: false, mode: 'bw', extra: 0 };

  if (prevInSession) {
    d.w = prevInSession.w; d.mode = prevInSession.mode || 'bw'; d.extra = prevInSession.extra || 0;
    d.reps = lastSameIdx ? lastSameIdx.reps : prevInSession.reps;
  } else if (lastSameIdx) {
    d.w = lastSameIdx.w; d.reps = lastSameIdx.reps;
    d.mode = lastSameIdx.mode || 'bw'; d.extra = lastSameIdx.extra || 0;
    if (deloadNow && !lastWasDeload && ex.kind === 'weight' && d.w) d.w = round05(d.w * (entry.load / 100));
  }
  if (ex.kind === 'bw' && entry.bwPlan && !prevInSession && !lastSameIdx) d.reps = entry.repMin;
  if (ex.kind !== 'weight' && d.w == null) d.w = 0;
  return d;
}

/* ---------- carga, 1RM, volumen ---------- */

function setLoad(set, ex) {
  if (!ex) return set.w || 0;
  if (ex.kind === 'bw') {
    const bw = set.bw || currentBodyweight();
    if (set.mode === 'lastre') return bw + (set.extra || 0);
    if (set.mode === 'asist') return Math.max(0, bw - (set.extra || 0));
    return bw;
  }
  if (ex.kind === 'time') return 0;
  return set.w || 0;
}

/** Epley con RIR: 1RM = peso × (1 + (reps + RIR) / 30) */
function e1rm(load, reps, rir) {
  if (!load || !reps) return null;
  return load * (1 + (reps + (rir || 0)) / 30);
}

function setVolume(set, ex) {
  if (set.warmup || !ex || ex.kind === 'time') return 0;
  return setLoad(set, ex) * (set.reps || 0);
}

function sessionVolume(session) {
  let v = 0, sets = 0;
  session.exercises.forEach(e => {
    const ex = S.exercises[e.exId];
    workingSets(e).forEach(s => { v += setVolume(s, ex); sets += 1; });
  });
  return { volume: v, sets };
}

function previousSameType(session) {
  const list = finishedSessions().filter(s => s.templateId === session.templateId && s.startedAt < session.startedAt);
  return list[list.length - 1] || null;
}

function setLabel(set, ex) {
  if (!ex) return `${fmt(set.w)} kg × ${set.reps}`;
  if (ex.kind === 'time') return `${fmt(set.reps)} seg${set.w ? ` · ${fmt(set.w)} kg` : ''}`;
  if (ex.kind === 'bw') {
    const m = set.mode === 'lastre' ? ` +${fmt(set.extra)} kg` : set.mode === 'asist' ? ` −${fmt(set.extra)} kg asist.` : ' PC';
    return `${set.reps} reps${m}`;
  }
  if (ex.kind === 'reps') return `${set.reps} reps${set.w ? ` · +${fmt(set.w)} kg` : ''}`;
  return `${fmt(set.w)} kg × ${set.reps}`;
}

/* ---------- sesgo de RIR (modo calibración) ---------- */

/** Sesgo promedio: reps extra reales − RIR predicho. Positivo = subestimás tu RIR (te quedaban más reps). */
function rirBias() {
  const list = S.calibrations.slice(-6);
  if (!list.length) return null;
  return list.reduce((a, c) => a + (c.extra - c.predicted), 0) / list.length;
}
function activeBias() { const b = rirBias(); return S.settings.applyBias && b != null ? b : 0; }

function biasText(b) {
  if (b == null) return 'Todavía no hiciste ninguna calibración.';
  const n = fmt(Math.abs(b));
  if (b > 0.25) return `Tendés a subestimar tu RIR por ${n} reps (te quedan más reps de las que creés).`;
  if (b < -0.25) return `Tendés a sobreestimar tu RIR por ${n} reps (estás más cerca del fallo de lo que creés).`;
  return 'Tu percepción del RIR es bastante precisa.';
}

/* ---------- detección de inconsistencias ---------- */

function analyzeEntry(entry) {
  const ex = S.exercises[entry.exId];
  const warnings = [];
  if (!ex || ex.kind === 'time') return warnings;
  const sets = progressionSets(entry);
  const rest = restFor(ex);

  // 1) caída del 1RM estimado con el mismo peso
  const byLoad = {};
  sets.forEach(s => { const k = setLoad(s, ex).toFixed(2); (byLoad[k] = byLoad[k] || []).push(s); });
  Object.values(byLoad).forEach(group => {
    if (group.length < 2) return;
    const first = group[0], lastS = group[group.length - 1];
    const a = e1rm(setLoad(first, ex), first.reps, first.rir), b = e1rm(setLoad(lastS, ex), lastS.reps, lastS.rir);
    if (a && b && (a - b) / a > 0.08) {
      warnings.push({ type: 'e1rm', text: `El 1RM estimado bajó ${fmt(((a - b) / a) * 100)}% entre la 1ª y la última serie con el mismo peso. Probablemente sobreestimaste tu RIR: llegaste más cerca del fallo de lo que pensabas.` });
    }
  });

  // 2) caída de 3+ reps entre series consecutivas con el mismo peso y descanso completo
  for (let i = 1; i < sets.length; i++) {
    const p = sets[i - 1], c = sets[i];
    const sameLoad = Math.abs(setLoad(p, ex) - setLoad(c, ex)) < 0.01;
    const restOk = !c.t || !p.t || (c.t - p.t) / 1000 >= rest * 0.75;
    if (sameLoad && restOk && p.reps - c.reps >= 3) {
      warnings.push({ type: 'drop', text: `Perdiste ${p.reps - c.reps} reps de la serie ${i} a la ${i + 1} con el mismo peso y descanso: seguramente estuviste más cerca del fallo de lo que reportaste (RIR ${rirLabel(p.rir)}).` });
      break;
    }
  }
  return warnings;
}

/* ---------- progresión automática (doble progresión) ---------- */

function suggestFor(entry, session) {
  const ex = S.exercises[entry.exId];
  const sets = progressionSets(entry);
  if (!ex || !sets.length) return null;
  if (session.meso && session.meso.deload) {
    return { type: 'deload', text: 'Semana de descarga: no se ajusta la progresión. En el próximo mesociclo volvé a los pesos de antes de la descarga.' };
  }
  const target = entry.targetRir;
  const bias = activeBias();
  const adj = sets.map(s => (s.rir == null ? target : s.rir + bias));
  const avg = adj.reduce((a, b) => a + b, 0) / adj.length;
  const top = entry.repMax, floor = entry.repMin;
  const allTop = sets.every(s => s.reps >= top);
  const atTarget = adj.every(r => r >= target - 0.5);
  const flagged = (entry.warnings || []).length > 0;
  const biasNote = bias ? ` (RIR ajustado por tu sesgo de calibración: ${bias > 0 ? '+' : ''}${fmt(bias)})` : '';
  const lastSet = sets[sets.length - 1];

  if (ex.kind === 'time' || ex.kind === 'reps') {
    const unit = ex.kind === 'time' ? 'seg' : 'reps';
    if (allTop && atTarget) return { type: 'up', text: `Llegaste al techo (${top} ${unit}) en todas las series. Subí la dificultad: agregá peso o una variante más difícil.`, reps: floor, weight: lastSet.w };
    return { type: 'keep', text: `Mantené e intentá sumar ${ex.kind === 'time' ? '5 seg' : '1 rep'} por serie hasta llegar a ${top} ${unit}.`, reps: Math.min(top, lastSet.reps + (ex.kind === 'time' ? 5 : 1)), weight: lastSet.w };
  }

  if (ex.kind === 'bw') {
    const strong = sets.filter((s, i) => s.reps >= 8 && adj[i] >= 2).length >= 3;
    const mode = lastSet.mode || 'bw', extra = lastSet.extra || 0;
    if (strong && !flagged) {
      if (mode === 'asist') return { type: 'up', text: `¡3 series de 8+ con RIR 2! Reducí la asistencia: de ${fmt(extra)} a ${fmt(Math.max(0, extra - 5))} kg (o una banda más liviana).${biasNote}`, mode: extra - 5 > 0 ? 'asist' : 'bw', extra: Math.max(0, extra - 5), reps: floor };
      return { type: 'up', text: `¡3 series de 8+ con RIR 2! Agregá lastre: ${fmt(mode === 'lastre' ? extra + 2.5 : 2.5)} kg.${biasNote}`, mode: 'lastre', extra: mode === 'lastre' ? extra + 2.5 : 2.5, reps: floor };
    }
    if (avg <= target - 1.5) return { type: 'down', text: `Estuviste muy cerca del fallo. Hacé series más chicas (1-2 reps menos) o sumá asistencia.${biasNote}`, mode, extra, reps: Math.max(1, lastSet.reps - 1) };
    return { type: 'keep', text: `Mantené y sumá reps. Cuando completes 3 series de 8 con RIR 2, la app te va a sugerir progresar.${flagged ? ' Ojo con las señales de fatiga de hoy.' : ''}`, mode, extra, reps: Math.min(top, lastSet.reps + 1) };
  }

  const w = lastSet.w || 0;
  const inc = ex.inc || (isCompound(ex) ? 2.5 : 1);
  if (avg <= target - 1.5) {
    const nw = round05(w * 0.95);
    return { type: 'down', text: `RIR real (${fmt(avg)}) muy por debajo del objetivo (${rirLabel(target)}). Bajá el peso un 5%: ${fmt(nw)} kg.${biasNote}`, weight: nw, reps: floor };
  }
  if (avg >= target + 2) {
    if (flagged) return { type: 'keep', text: `Reportaste RIR alto, pero hubo señales de que estabas más cerca del fallo. Mantené ${fmt(w)} kg y prestá atención al RIR.`, weight: w, reps: lastSet.reps };
    return { type: 'up', text: `RIR muy por encima del objetivo: el peso te quedó liviano. Subí a ${fmt(w + inc)} kg.${biasNote}`, weight: w + inc, reps: floor };
  }
  if (allTop && atTarget) {
    if (flagged) return { type: 'keep', text: `Llegaste al techo, pero las series muestran señales de que el RIR real fue menor. Repetí ${fmt(w)} kg una vez más antes de subir.`, weight: w, reps: top };
    return { type: 'up', text: `¡Techo del rango (${top}) en todas las series con el RIR objetivo! Subí a ${fmt(w + inc)} kg y volvé a ${floor} reps.${biasNote}`, weight: w + inc, reps: floor };
  }
  return { type: 'keep', text: `Mantené ${fmt(w)} kg e intentá sumar reps hasta llegar a ${top} en todas las series.`, weight: w, reps: Math.min(top, lastSet.reps + 1) };
}

function finishSession(session) {
  session.exercises.forEach(e => {
    e.warnings = analyzeEntry(e);
    e.suggestion = suggestFor(e, session);
  });
  session.endedAt = new Date().toISOString();
  const idx = S.routine.order.indexOf(session.templateId);
  if (idx >= 0) S.nextIdx = (idx + 1) % S.routine.order.length;
  S.activeId = null;
  save();
}

/** Sugerencia guardada de la última vez para este ejercicio. */
function lastSuggestion(exId, excludeId) {
  const last = finishedSessions().filter(s => s.id !== excludeId).reverse()
    .map(s => s.exercises.find(e => e.exId === exId && e.suggestion)).find(Boolean);
  return last ? last.suggestion : null;
}

/* ---------- estadísticas ---------- */

function exerciseHistory(exId) {
  const ex = S.exercises[exId];
  return finishedSessions().map(s => {
    const e = s.exercises.filter(x => x.exId === exId);
    if (!e.length) return null;
    const sets = e.flatMap(workingSets);
    if (!sets.length) return null;
    let maxW = 0, best = 0, vol = 0;
    sets.forEach(st => {
      const l = setLoad(st, ex);
      maxW = Math.max(maxW, ex && ex.kind === 'weight' ? (st.w || 0) : l);
      best = Math.max(best, e1rm(l, st.reps, st.rir) || 0);
      vol += setVolume(st, ex);
    });
    return { date: s.date, maxW, e1rm: best || null, vol, sets: sets.length, maxReps: Math.max(...sets.map(x => x.reps || 0)) };
  }).filter(Boolean);
}

function weeklyVolumeFor(exId) {
  const map = {};
  exerciseHistory(exId).forEach(h => { const k = mondayOf(h.date); map[k] = (map[k] || 0) + h.vol; });
  return Object.keys(map).sort().map(k => ({ date: k, y: map[k] }));
}

function weekSummary(monday) {
  const end = addDays(monday, 6);
  const inWeek = d => d >= monday && d <= end;
  const sessions = finishedSessions().filter(s => inWeek(s.date));
  const muscles = {};
  Object.keys(MUSCLES).forEach(m => { muscles[m] = 0; });
  sessions.forEach(s => s.exercises.forEach(e => {
    const ex = S.exercises[e.exId];
    if (!ex) return;
    const n = workingSets(e).length;
    Object.entries(ex.muscles || {}).forEach(([m, f]) => { if (m in muscles) muscles[m] += n * f; });
  }));
  const walks = S.walks.filter(w => inWeek(w.date));
  const days = [...Array(7)].map((_, i) => addDays(monday, i)).filter(d => d <= todayStr());
  const supp = S.supplements.items.map(it => ({
    name: it.name,
    done: days.filter(d => (S.supplements.log[d] || []).includes(it.id)).length,
    of: days.length
  }));
  const vol = sessions.reduce((a, s) => a + sessionVolume(s).volume, 0);
  const avg = k => { const v = sessions.map(s => s[k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  return { sessions, muscles, walks, km: walks.reduce((a, w) => a + (w.km || 0), 0), supp, vol, sleep: avg('sleep'), energy: avg('energy') };
}

function supplementStreak() {
  const ids = S.supplements.items.map(i => i.id);
  if (!ids.length) return 0;
  const full = d => ids.every(id => (S.supplements.log[d] || []).includes(id));
  let d = todayStr();
  if (!full(d)) d = addDays(d, -1);
  let n = 0;
  while (full(d)) { n++; d = addDays(d, -1); }
  return n;
}

/** Rendimiento (volumen vs. sesión anterior del mismo tipo) agrupado por puntaje de sueño/energía. */
function readinessCorrelation() {
  const rows = { sleep: {}, energy: {} };
  finishedSessions().forEach(s => {
    const prev = previousSameType(s);
    if (!prev) return;
    const a = sessionVolume(prev).volume, b = sessionVolume(s).volume;
    if (!a) return;
    const delta = (b - a) / a * 100;
    ['sleep', 'energy'].forEach(k => {
      if (s[k] == null) return;
      (rows[k][s[k]] = rows[k][s[k]] || []).push(delta);
    });
  });
  const out = {};
  ['sleep', 'energy'].forEach(k => {
    out[k] = [1, 2, 3, 4, 5].map(v => {
      const l = rows[k][v] || [];
      return { score: v, n: l.length, avg: l.length ? l.reduce((x, y) => x + y, 0) / l.length : null };
    });
  });
  return out;
}
