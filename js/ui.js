/* Interfaz: pantallas, hojas (modales) y acciones. Render por plantillas + delegación de eventos. */

const UI = { route: 'home', param: null, progressEx: null, weekMonday: null, histTab: 'sesiones', notesOpen: {} };
const $ = (sel, root = document) => root.querySelector(sel);

const RIR_SCALE = '0 fallo · 1 una más · 2 dos más · 3 moderado · 4+ muy cómodo';
const FEEL = { 1: '😫 Muy mal', 2: '😕 Pesado', 3: '😐 Normal', 4: '🙂 Bien', 5: '💪 Excelente' };
const BARBELL_NO_FAILURE = ['sentadilla', 'banca', 'rumano', 'banca_cerrado', 'inclinado_barra', 'militar'];

/** El fallo solo se ofrece en máquinas / ejercicios de bajo riesgo, nunca en sentadilla, banca o peso muerto con barra. */
function failureAllowed(ex) {
  if (!ex || !ex.failureOk || ex.kind === 'time') return false;
  if (BARBELL_NO_FAILURE.includes(ex.id)) return false;
  return !/(sentadilla con barra|press banca|peso muerto)/i.test(ex.name);
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 3200);
}

function go(route, param) {
  const h = '#/' + route + (param ? '/' + encodeURIComponent(param) : '');
  if (location.hash === h) render(); else location.hash = h;
}

function parseHash() {
  const [, route = 'home', param = null] = location.hash.split('/');
  UI.route = route || 'home';
  UI.param = param ? decodeURIComponent(param) : null;
}

/* ---------- componentes ---------- */

const icon = {
  up: '▲', down: '▼', keep: '●', warn: '⚠️', ok: '✓', info: 'ⓘ'
};

function chipGroup(group, values, selected, labels) {
  return `<div class="chips" data-group="${group}">${values.map(v =>
    `<button type="button" class="chip ${String(v) === String(selected) ? 'on' : ''}" data-a="pick" data-v="${v}">${labels ? labels[v] : v}</button>`).join('')}</div>`;
}
const picked = (root, group) => { const el = root.querySelector(`[data-group="${group}"] .on`); return el ? el.dataset.v : null; };

function stepper(uidv, field, value, step, unit) {
  return `<div class="stepper">
    <button type="button" class="step-btn" data-a="step" data-uid="${uidv}" data-field="${field}" data-d="${-step}">−</button>
    <label class="step-val"><input inputmode="decimal" data-in="draft" data-uid="${uidv}" data-field="${field}" value="${value == null ? '' : fmt(value)}" placeholder="—"><span>${unit}</span></label>
    <button type="button" class="step-btn" data-a="step" data-uid="${uidv}" data-field="${field}" data-d="${step}">+</button>
  </div>`;
}

function targetText(entry, ex) {
  const reps = entry.repMin === entry.repMax ? entry.repMin : `${entry.repMin}-${entry.repMax}`;
  const unit = ex && ex.kind === 'time' ? ' seg' : '';
  return `${entry.plannedSets}×${reps}${unit}${ex && ex.perSide ? ' por lado' : ''}`;
}

function suggestionBox(sg, prefix, applyUid) {
  if (!sg) return '';
  const cls = sg.type === 'up' ? 'good' : sg.type === 'down' ? 'bad' : 'neutral';
  return `<div class="suggest ${cls}"><span class="sg-icon">${icon[sg.type] || icon.info}</span><div><b>${prefix}</b> ${esc(sg.text)}
    ${applyUid && sg.type !== 'deload' ? `<div><button class="btn small" data-a="applySuggestion" data-uid="${applyUid}">Aplicar a esta sesión</button></div>` : ''}</div></div>`;
}

function disclaimer() {
  return `<p class="disclaimer">Esta app es una herramienta de registro. No reemplaza la consulta con un médico ni con un entrenador.</p>`;
}

/* ---------- pantalla: inicio ---------- */

function screenHome() {
  const mi = mesoInfo();
  const active = activeSession();
  const order = S.routine.order;
  const nextId = order[S.nextIdx % order.length];
  const t = S.routine.templates[nextId];
  const today = todayStr();
  const taken = S.supplements.log[today] || [];
  const wk = weekSummary(mondayOf(today));
  const cfg = mi.cfg;

  const mesoNote = mi.finished
    ? `<p>Completaste las ${mi.total} semanas. Conviene repetir los tests de máximo de dominadas y fondos.</p><button class="btn primary" data-a="newMeso">Empezar mesociclo ${mi.n + 1}</button>`
    : cfg.deload ? '<p class="note">Descarga: mitad de las series y 40% menos de peso. Las sugerencias de progresión se pausan.</p>'
    : mi.week === 1 ? '<p class="note">Semana de calibración: buscá pesos con los que llegues al rango de reps dejando el RIR objetivo en reserva.</p>' : '';

  return `
  ${active ? `<section class="card accent"><div class="row"><div><div class="eyebrow">Sesión en curso</div><h2>${esc(active.name)}</h2></div>
    <button class="btn primary" data-a="goSession">Continuar</button></div></section>` : ''}

  <section class="card">
    <div class="eyebrow">Mesociclo ${mi.n} · Semana ${mi.week} de ${mi.total}</div>
    <h3>${esc(cfg.label || '')}${mi.finished ? ' · terminado' : ''}</h3>
    <div class="stats3">
      <div><span class="big">${rirLabel(cfg.rirComp)}</span><small>RIR compuestos</small></div>
      <div><span class="big">${rirLabel(cfg.rirIso)}</span><small>RIR aislamiento</small></div>
      <div><span class="big">${cfg.sets === 'tres' ? '3' : cfg.sets === 'mitad' ? '½' : '100%'}</span><small>${cfg.sets === 'tres' ? 'series en compuestos' : cfg.sets === 'mitad' ? 'de las series' : 'de las series'}</small></div>
    </div>
    <div class="weekdots">${order.map((id, i) => `<span class="${i < mi.inWeek ? 'on' : ''}" title="${esc(S.routine.templates[id].name)}"></span>`).join('')}<small>${mi.inWeek}/${order.length} sesiones esta semana del ciclo</small></div>
    ${mesoNote}
  </section>

  ${!active && t ? `<section class="card next">
    <div class="eyebrow">Hoy toca</div>
    <h1>${esc(t.name)} <small>${esc(t.subtitle || '')}</small></h1>
    <ul class="preview">${t.exercises.map(x => {
      const ex = S.exercises[x.exId]; if (!ex) return '';
      const p = planEntry(x, cfg);
      return `<li><span>${esc(ex.name)}</span><span class="muted">${targetText(p, ex)}</span></li>`;
    }).join('')}</ul>
    <button class="btn primary huge" data-a="askReadiness" data-id="${nextId}">Empezar ${esc(t.name)}</button>
    <button class="btn ghost" data-a="pickSession">Cambiar sesión</button>
  </section>` : ''}

  <section class="card">
    <div class="row"><h3>Suplementos de hoy</h3><span class="pill">🔥 Racha: ${supplementStreak()} días</span></div>
    <div class="chips wrap">${S.supplements.items.map(it =>
      `<button class="chip lg ${taken.includes(it.id) ? 'on' : ''}" data-a="toggleSupp" data-id="${it.id}">${taken.includes(it.id) ? '✓ ' : ''}${esc(it.name)}</button>`).join('')}</div>
    <p class="muted small">Solo registro: no es una recomendación de dosis.</p>
  </section>

  <section class="card">
    <div class="row"><h3>Esta semana</h3><a href="#/week" class="link">Ver resumen</a></div>
    <div class="stats3">
      <div><span class="big">${wk.sessions.length}</span><small>sesiones</small></div>
      <div><span class="big">${fmt(wk.km)}</span><small>km caminados</small></div>
      <div><span class="big">${fmt(currentBodyweight())}</span><small>kg peso</small></div>
    </div>
    <div class="row gap">
      <button class="btn" data-a="walkSheet">+ Caminata</button>
      <button class="btn" data-a="bwSheet">+ Peso corporal</button>
    </div>
  </section>
  ${disclaimer()}`;
}

/* ---------- pantalla: sesión en curso ---------- */

function screenSession() {
  const s = activeSession();
  if (!s) return `<section class="card"><p>No hay ninguna sesión en curso.</p><button class="btn primary" data-a="goHome">Ir al inicio</button></section>`;
  const cfg = S.meso.weeks[s.meso.week - 1] || mesoInfo().cfg;
  const tot = sessionVolume(s);
  return `
  <section class="card session-head">
    <div class="row">
      <div><div class="eyebrow">Semana ${s.meso.week} · ${esc(cfg.label || '')}</div><h2>${esc(s.name)}</h2></div>
      <div class="r"><div class="big" id="elapsed">0:00</div><small class="muted">${tot.sets} series · ${fmtInt(tot.volume)} kg</small></div>
    </div>
    <div class="muted small">RIR objetivo: compuestos ${rirLabel(cfg.rirComp)} · aislamiento ${rirLabel(cfg.rirIso)}${cfg.deload ? ' · Descarga: −40% de peso' : ''}${s.meso.calibration ? ' · Semana de calibración' : ''}</div>
  </section>
  ${s.exercises.map((e, i) => exerciseCard(s, e, i)).join('')}
  <section class="card">
    <button class="btn" data-a="addExerciseSheet">+ Agregar ejercicio</button>
    <label class="field"><span>Notas de la sesión</span><textarea data-in="sessionNotes" rows="2" placeholder="Cómo te sentiste, molestias, etc.">${esc(s.notes)}</textarea></label>
    <button class="btn primary huge" data-a="finishSession">Terminar sesión</button>
    <button class="btn ghost danger" data-a="discardSession">Descartar sesión</button>
  </section>
  ${disclaimer()}`;
}

function exerciseCard(s, e, i) {
  const ex = S.exercises[e.exId] || { name: e.exId, kind: 'weight' };
  const done = workingSets(e).length;
  const complete = done >= e.plannedSets;
  const head = `<button class="ex-head" data-a="toggleEx" data-uid="${e.uid}">
      <span class="ex-num ${complete ? 'done' : ''}">${complete ? '✓' : i + 1}</span>
      <span class="ex-title"><b>${esc(ex.name)}</b><small>${targetText(e, ex)} · RIR ${rirLabel(e.targetRir)}</small></span>
      <span class="pill">${done}/${e.plannedSets}</span>
    </button>`;
  if (!e.open) return `<section class="card ex">${head}</section>`;

  const last = lastEntryFor(e.exId, s.id);
  const lastSg = lastSuggestion(e.exId, s.id);
  const bwMax = S.bwMax[e.exId];
  const warnings = analyzeEntry(e);
  const liveSg = complete ? suggestFor(Object.assign({}, e, { warnings }), s) : null;
  const d = e.draft || makeDraft(s, e);
  const setNo = done + 1;
  const isExtra = setNo > e.plannedSets;

  let bwBlock = '';
  if (ex.kind === 'bw') {
    bwBlock = !bwMax
      ? `<div class="suggest neutral"><span class="sg-icon">${icon.info}</span><div><b>Test de máximo pendiente.</b> Hacé una serie a fallo técnico (última rep con buena técnica) para que la app proponga tus series de trabajo.
         <div><button class="btn small primary" data-a="maxTestSheet" data-uid="${e.uid}">Hacer test de máximo</button></div></div></div>`
      : `<div class="muted small">Máximo: ${bwMax.reps} reps (${fmtDate(bwMax.date)}) → series de ${e.repMin}-${e.repMax} reps. <button class="link" data-a="maxTestSheet" data-uid="${e.uid}">Repetir test</button></div>`;
  }

  const calibNote = !last && !(ex.kind === 'bw') ? `<div class="muted small">Sin historial: buscá un peso con el que llegues a ${e.repMin}-${e.repMax} reps dejando RIR ${rirLabel(e.targetRir)}.</div>` : '';

  const setsHtml = e.sets.map((st, idx) => {
    const l = setLoad(st, ex);
    const one = ex.kind !== 'time' && !st.warmup ? e1rm(l, st.reps, st.rir) : null;
    const n = st.warmup ? 'C' : e.sets.slice(0, idx + 1).filter(x => !x.warmup).length;
    return `<button class="set-row ${st.warmup ? 'warm' : ''}" data-a="editSetSheet" data-uid="${e.uid}" data-i="${idx}">
      <span class="set-n">${n}</span><span>${setLabel(st, ex)}</span>
      <span class="muted">${st.warmup ? 'calentamiento' : `RIR ${rirLabel(st.rir)}`}${st.calib ? ' · calib.' : ''}${st.test ? ' · test' : ''}</span>
      <span class="muted r">${one ? `1RM ${fmt(one)}` : ''}</span></button>`;
  }).join('');

  const step = ex.kind === 'weight' ? Math.min(ex.inc || 2.5, 2.5) : 2.5;
  let inputs = '';
  if (ex.kind === 'weight') inputs = stepper(e.uid, 'w', d.w, step, 'kg') + stepper(e.uid, 'reps', d.reps, 1, 'reps');
  else if (ex.kind === 'bw') {
    inputs = `<div class="seg">${[['bw', 'Peso corporal'], ['lastre', 'Lastre'], ['asist', 'Asistencia']].map(([m, l]) =>
      `<button class="${d.mode === m ? 'on' : ''}" data-a="draftMode" data-uid="${e.uid}" data-m="${m}">${l}</button>`).join('')}</div>
      ${d.mode !== 'bw' ? stepper(e.uid, 'extra', d.extra, 2.5, d.mode === 'asist' ? 'kg asist.' : 'kg extra') : ''}
      ${stepper(e.uid, 'reps', d.reps, 1, 'reps')}`;
  } else if (ex.kind === 'time') inputs = stepper(e.uid, 'reps', d.reps, 5, 'seg');
  else inputs = stepper(e.uid, 'reps', d.reps, 1, 'reps') + `<details class="mini"><summary>Agregar peso</summary>${stepper(e.uid, 'w', d.w, 1, 'kg')}</details>`;

  const editor = `<div class="editor ${d.warmup ? 'warm' : ''}">
    <div class="row"><b>${d.warmup ? 'Serie de calentamiento' : isExtra ? `Serie extra (${setNo})` : `Serie ${setNo} de ${e.plannedSets}`}</b>
      <button class="chip ${d.warmup ? 'on' : ''}" data-a="toggleWarm" data-uid="${e.uid}">Calentamiento</button></div>
    ${inputs}
    ${d.warmup
      ? `<button class="btn primary huge" data-a="saveSet" data-uid="${e.uid}" data-rir="">Guardar calentamiento</button>`
      : `<div class="rir-label">RIR percibido — tocá para guardar la serie <button class="link" data-a="rirHelp">${icon.info} guía</button></div>
         <div class="rir-chips">${[0, 1, 2, 3, 4, 5].map(r => `<button class="rir ${r === Math.round(e.targetRir) ? 'target' : ''}" data-a="saveSet" data-uid="${e.uid}" data-rir="${r}">${r === 5 ? '5+' : r}</button>`).join('')}</div>
         <div class="rir-scale">${RIR_SCALE}. Si la técnica se rompe o la velocidad cae mucho, estás cerca del límite.</div>`}
  </div>`;

  const notesShown = e.notes || UI.notesOpen[e.uid];
  return `<section class="card ex open">${head}
    ${last ? `<div class="muted small">Última vez (${fmtDate(last.session.date)}): ${workingSets(last.entry).map(x => setLabel(x, ex)).join(' · ')}</div>` : ''}
    ${suggestionBox(lastSg, 'Sugerencia:', lastSg && lastSg.type !== 'deload' && !done ? e.uid : null)}
    ${bwBlock}${calibNote}
    <div class="sets">${setsHtml}</div>
    ${warnings.map(w => `<div class="warn">${icon.warn} ${esc(w.text)}</div>`).join('')}
    ${complete ? suggestionBox(liveSg, 'Para la próxima:') : ''}
    ${editor}
    ${notesShown ? `<label class="field"><span>Notas del ejercicio</span><textarea data-in="exNotes" data-uid="${e.uid}" rows="2">${esc(e.notes)}</textarea></label>` : ''}
    <div class="ex-actions">
      ${!notesShown ? `<button class="btn small" data-a="openNotes" data-uid="${e.uid}">Notas</button>` : ''}
      ${failureAllowed(ex) ? `<button class="btn small" data-a="calibSheet" data-uid="${e.uid}">🎯 Calibrar RIR</button>` : ''}
      ${(ex.alts || []).filter(a => S.exercises[a]).map(a => `<button class="btn small" data-a="swapEx" data-uid="${e.uid}" data-ex="${a}">Usar ${esc(S.exercises[a].name)}</button>`).join('')}
      <button class="btn small" data-a="addSetPlan" data-uid="${e.uid}">+1 serie</button>
      <button class="btn small danger" data-a="removeEx" data-uid="${e.uid}">Quitar</button>
      ${complete ? `<button class="btn small primary" data-a="nextEx" data-uid="${e.uid}">Siguiente →</button>` : ''}
    </div>
  </section>`;
}

/* ---------- pantalla: historial ---------- */

function screenHistory() {
  const tabs = [['sesiones', 'Sesiones'], ['caminatas', 'Caminatas'], ['peso', 'Peso corporal']];
  let body = '';
  if (UI.histTab === 'sesiones') {
    const list = finishedSessions().reverse();
    body = list.length ? list.map(s => {
      const v = sessionVolume(s), prev = previousSameType(s);
      const pv = prev ? sessionVolume(prev).volume : null;
      const delta = pv ? (v.volume - pv) / pv * 100 : null;
      const dur = (new Date(s.endedAt) - new Date(s.startedAt)) / 60000;
      return `<button class="card list-item" data-a="openSession" data-id="${s.id}">
        <div class="row"><b>${esc(s.name)}</b><span class="muted">${fmtDate(s.date)}</span></div>
        <div class="row muted small"><span>Sem. ${s.meso ? s.meso.week : '–'} · ${fmtDuration(dur)} · ${v.sets} series</span>
        <span>${fmtInt(v.volume)} kg ${deltaTag(delta)}</span></div></button>`;
    }).join('') : '<p class="muted center">Todavía no terminaste ninguna sesión.</p>';
  } else if (UI.histTab === 'caminatas') {
    const list = S.walks.slice().sort((a, b) => b.date.localeCompare(a.date));
    body = `<button class="btn primary" data-a="walkSheet">+ Registrar caminata</button>` + (list.length ? list.map(w => `
      <div class="card list-item"><div class="row"><b>${fmt(w.km)} km · ${fmtDuration(w.minutes)}</b><span class="muted">${fmtDate(w.date)}</span></div>
      <div class="row muted small"><span>${w.feel ? FEEL[w.feel] : ''}${w.km && w.minutes ? ` · ritmo ${fmtClock((w.minutes * 60) / w.km)} min/km` : ''}${w.note ? ' · ' + esc(w.note) : ''}</span>
      <button class="link danger" data-a="delWalk" data-id="${w.id}">Borrar</button></div></div>`).join('') : '<p class="muted center">Sin caminatas registradas.</p>');
  } else {
    const list = S.bodyweight.slice().sort((a, b) => b.date.localeCompare(a.date));
    body = `<button class="btn primary" data-a="bwSheet">+ Registrar peso</button>` + (list.length ? list.map(b => `
      <div class="card list-item row"><span>${fmtDate(b.date)}</span><b>${fmt(b.kg)} kg</b><button class="link danger" data-a="delBw" data-date="${b.date}">Borrar</button></div>`).join('') : '<p class="muted center">Sin registros de peso.</p>');
  }
  return `<div class="seg tabs">${tabs.map(([k, l]) => `<button class="${UI.histTab === k ? 'on' : ''}" data-a="histTab" data-t="${k}">${l}</button>`).join('')}</div>${body}`;
}

function deltaTag(delta) {
  if (delta == null) return '';
  const cls = delta >= 0 ? 'good' : 'bad';
  return `<span class="delta ${cls}">${delta >= 0 ? '▲ +' : '▼ '}${fmt(delta)}%</span>`;
}

function screenSessionDetail(id) {
  const s = S.sessions.find(x => x.id === id);
  if (!s) return '<p>Sesión no encontrada.</p>';
  const v = sessionVolume(s), prev = previousSameType(s);
  const pv = prev ? sessionVolume(prev) : null;
  const dur = s.endedAt ? (new Date(s.endedAt) - new Date(s.startedAt)) / 60000 : null;
  return `<button class="link" data-a="back">← Volver</button>
  <section class="card">
    <div class="eyebrow">${fmtDate(s.date, { weekday: 'long', day: 'numeric', month: 'long' })} · Semana ${s.meso ? s.meso.week : '–'}</div>
    <h2>${esc(s.name)}</h2>
    <div class="stats3">
      <div><span class="big">${fmtInt(v.volume)}</span><small>kg de volumen</small></div>
      <div><span class="big">${v.sets}</span><small>series efectivas</small></div>
      <div><span class="big">${fmtDuration(dur)}</span><small>duración</small></div>
    </div>
    ${pv ? `<p>Vs. ${esc(prev.name)} anterior (${fmtDate(prev.date)}): ${fmtInt(pv.volume)} kg ${deltaTag(pv.volume ? (v.volume - pv.volume) / pv.volume * 100 : null)} · series ${pv.sets} → ${v.sets}</p>` : '<p class="muted">Primera sesión de este tipo: sin comparación.</p>'}
    <p class="muted small">Sueño: ${s.sleep || '–'}/5 · Energía: ${s.energy || '–'}/5</p>
    ${s.notes ? `<p class="notes">📝 ${esc(s.notes)}</p>` : ''}
  </section>
  ${s.exercises.filter(e => e.sets.length).map(e => {
    const ex = S.exercises[e.exId];
    return `<section class="card"><h3>${esc(e.exName || exName(e.exId))}</h3>
      ${e.sets.map(st => `<div class="row small ${st.warmup ? 'muted' : ''}"><span>${st.warmup ? 'C' : '•'} ${setLabel(st, ex)}</span><span>${st.warmup ? 'calent.' : 'RIR ' + rirLabel(st.rir)}</span></div>`).join('')}
      ${(e.warnings || []).map(w => `<div class="warn">${icon.warn} ${esc(w.text)}</div>`).join('')}
      ${suggestionBox(e.suggestion, 'Para la próxima:')}
      ${e.notes ? `<p class="notes">📝 ${esc(e.notes)}</p>` : ''}</section>`;
  }).join('')}
  <button class="btn ghost danger" data-a="deleteSession" data-id="${s.id}">Borrar esta sesión</button>`;
}

/* ---------- pantalla: progreso ---------- */

function screenProgress() {
  const withData = Object.values(S.exercises).filter(ex => exerciseHistory(ex.id).length).sort((a, b) => a.name.localeCompare(b.name));
  if (!UI.progressEx || !S.exercises[UI.progressEx]) UI.progressEx = withData[0] ? withData[0].id : null;
  const ex = S.exercises[UI.progressEx];
  const h = ex ? exerciseHistory(ex.id) : [];
  const bwPts = S.bodyweight.slice().sort((a, b) => a.date.localeCompare(b.date)).map(b => ({ date: b.date, y: b.kg }));
  const bias = rirBias();
  const corr = readinessCorrelation();
  const corrRows = k => corr[k].map(r => `<td class="r">${r.avg == null ? '–' : (r.avg >= 0 ? '+' : '') + fmt(r.avg) + '%'}<br><small class="muted">n=${r.n}</small></td>`).join('');

  return `
  <section class="card">
    <h3>Progreso por ejercicio</h3>
    ${withData.length ? `<select class="select" data-in="progressEx">${withData.map(x => `<option value="${x.id}" ${x.id === UI.progressEx ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : '<p class="muted">Registrá algunas sesiones para ver gráficos.</p>'}
    ${ex ? `
      ${ex.kind !== 'time' ? lineChart(h.map(p => ({ date: p.date, y: p.e1rm })), { unit: 'kg', title: '1RM estimado (Epley con RIR)' }) : ''}
      ${ex.kind === 'weight' ? lineChart(h.map(p => ({ date: p.date, y: p.maxW })), { unit: 'kg', title: 'Peso máximo por sesión' })
        : lineChart(h.map(p => ({ date: p.date, y: p.maxReps })), { unit: ex.kind === 'time' ? 'seg' : 'reps', title: ex.kind === 'time' ? 'Mejor tiempo' : 'Máximo de reps', zeroBase: true })}
      ${ex.kind !== 'time' ? barChart(weeklyVolumeFor(ex.id), { unit: 'kg', title: 'Volumen semanal (series × reps × peso)' }) : ''}
      ${ex.kind === 'bw' ? '<p class="muted small">En dominadas y fondos la carga es: peso corporal + lastre − asistencia.</p>' : ''}` : ''}
  </section>

  <section class="card">
    <div class="row"><h3>Peso corporal</h3><button class="btn small" data-a="bwSheet">+ Registrar</button></div>
    ${lineChart(bwPts, { unit: 'kg', title: '' })}
  </section>

  <section class="card">
    <h3>🎯 Calibración del RIR</h3>
    <p><b>${biasText(bias)}</b></p>
    ${bias != null ? `<p class="muted small">Promedio de las últimas ${Math.min(6, S.calibrations.length)} calibraciones. ${S.settings.applyBias ? 'Se aplica a las sugerencias de peso.' : 'No se está aplicando (ver Ajustes).'}</p>` : ''}
    <p class="muted small">Para calibrar: durante una sesión, abrí un ejercicio seguro (prensa, jalón, máquinas, curl…) y tocá «Calibrar RIR». Nunca se ofrece en sentadilla, press banca o peso muerto con barra.</p>
    ${S.calibrations.slice(-6).reverse().map(c => `<div class="row small"><span>${fmtDate(c.date)} · ${esc(exName(c.exId))}</span><span>predijiste ${c.predicted}, hiciste ${c.extra} más</span></div>`).join('')}
  </section>

  <section class="card">
    <h3>Sueño, energía y rendimiento</h3>
    <p class="muted small">Cambio de volumen vs. la sesión anterior del mismo tipo, según el puntaje que pusiste antes de entrenar.</p>
    <div class="table-wrap"><table class="corr"><tr><th></th>${[1, 2, 3, 4, 5].map(v => `<th class="r">${v}</th>`).join('')}</tr>
      <tr><th>Sueño</th>${corrRows('sleep')}</tr><tr><th>Energía</th>${corrRows('energy')}</tr></table></div>
  </section>`;
}

/* ---------- pantalla: resumen semanal ---------- */

function screenWeek() {
  if (!UI.weekMonday) UI.weekMonday = mondayOf(todayStr());
  const m = UI.weekMonday;
  const w = weekSummary(m);
  const maxSets = Math.max(24, ...Object.values(w.muscles));
  const pct = v => (v / maxSets) * 100;
  const isCurrent = m === mondayOf(todayStr());

  return `
  <div class="week-nav">
    <button class="btn" data-a="weekShift" data-d="-7">‹</button>
    <div class="center"><b>${fmtDate(m, { day: 'numeric', month: 'short' })} – ${fmtDate(addDays(m, 6), { day: 'numeric', month: 'short' })}</b><br><small class="muted">${isCurrent ? 'Esta semana' : ''}</small></div>
    <button class="btn" data-a="weekShift" data-d="7" ${isCurrent ? 'disabled' : ''}>›</button>
  </div>

  <section class="card">
    <div class="stats3">
      <div><span class="big">${w.sessions.length}</span><small>sesiones</small></div>
      <div><span class="big">${fmtInt(w.vol)}</span><small>kg volumen</small></div>
      <div><span class="big">${w.sleep ? fmt(w.sleep) : '–'} / ${w.energy ? fmt(w.energy) : '–'}</span><small>sueño / energía</small></div>
    </div>
  </section>

  <section class="card">
    <h3>Series por grupo muscular</h3>
    <p class="muted small">Objetivo orientativo para hipertrofia: 12 a 18 series semanales por grupo (zona sombreada). Los músculos secundarios suman media serie.</p>
    <div class="mbars">${Object.entries(MUSCLES).map(([k, label]) => {
      const v = w.muscles[k];
      const st = v < 12 ? ['low', '↓ bajo'] : v > 18 ? ['high', '↑ alto'] : ['ok', '✓ en rango'];
      return `<div class="mbar"><span class="mname">${label}</span>
        <div class="mtrack"><div class="mband" style="left:${pct(12)}%;width:${pct(18) - pct(12)}%"></div><div class="mfill" style="width:${pct(v)}%"></div></div>
        <span class="mval">${fmt(v)}</span><span class="mstat ${st[0]}">${st[1]}</span></div>`;
    }).join('')}</div>
  </section>

  <section class="card">
    <div class="row"><h3>Caminatas</h3><button class="btn small" data-a="walkSheet">+ Caminata</button></div>
    <p><span class="big">${fmt(w.km)} km</span> <span class="muted">en ${w.walks.length} caminata${w.walks.length === 1 ? '' : 's'} (meta: 1-2 de 8 km)</span></p>
    ${w.walks.map(x => `<div class="row small"><span>${fmtDate(x.date)}</span><span>${fmt(x.km)} km · ${fmtDuration(x.minutes)}${x.feel ? ' · ' + FEEL[x.feel] : ''}</span></div>`).join('')}
  </section>

  <section class="card">
    <h3>Suplementos</h3>
    ${w.supp.map(s => `<div class="row small"><span>${esc(s.name)}</span><span>${s.done}/${s.of} días</span></div>`).join('')}
  </section>`;
}

/* ---------- pantalla: ajustes ---------- */

function screenSettings() {
  const mi = mesoInfo();
  const st = S.settings;
  return `
  <section class="card">
    <h3>Perfil y descansos</h3>
    <label class="field row"><span>Peso corporal de referencia (kg)</span><input class="sm" inputmode="decimal" data-in="setting" data-k="bodyweightKg" value="${fmt(st.bodyweightKg)}"></label>
    <label class="field row"><span>Descanso compuestos (seg)</span><input class="sm" inputmode="numeric" data-in="setting" data-k="restCompound" value="${st.restCompound}"></label>
    <label class="field row"><span>Descanso aislamiento (seg)</span><input class="sm" inputmode="numeric" data-in="setting" data-k="restIsolation" value="${st.restIsolation}"></label>
    <label class="toggle"><input type="checkbox" data-in="settingBool" data-k="wakeLock" ${st.wakeLock ? 'checked' : ''}> Mantener la pantalla encendida durante la sesión</label>
    <label class="toggle"><input type="checkbox" data-in="settingBool" data-k="sound" ${st.sound ? 'checked' : ''}> Sonido y vibración al terminar el descanso</label>
    <label class="toggle"><input type="checkbox" data-in="settingBool" data-k="applyBias" ${st.applyBias ? 'checked' : ''}> Ajustar sugerencias con mi sesgo de RIR calibrado</label>
  </section>

  <section class="card">
    <h3>Mesociclo</h3>
    <p>Mesociclo ${mi.n} · semana ${mi.week} de ${mi.total}. La semana avanza cada ${S.routine.order.length} sesiones terminadas.</p>
    <div class="row gap"><button class="btn" data-a="mesoShift" data-d="-1">− 1 semana</button><button class="btn" data-a="mesoShift" data-d="1">+ 1 semana</button></div>
    <div class="row gap"><button class="btn" data-a="mesoSheet">Editar semanas</button><button class="btn" data-a="newMeso">Nuevo mesociclo</button></div>
  </section>

  <section class="card">
    <h3>Rutina</h3>
    <p class="muted small">Orden de rotación (independiente del día de la semana):</p>
    ${S.routine.order.map((id, i) => `<div class="row list-line">
      <button class="link grow left" data-a="editTemplate" data-id="${id}">${i + 1}. ${esc(S.routine.templates[id].name)} <small class="muted">${S.routine.templates[id].exercises.length} ejercicios</small></button>
      <button class="icon-btn" data-a="moveTemplate" data-id="${id}" data-d="-1">↑</button><button class="icon-btn" data-a="moveTemplate" data-id="${id}" data-d="1">↓</button></div>`).join('')}
    <div class="row gap"><button class="btn" data-a="newTemplate">+ Nueva sesión</button><button class="btn" data-a="go" data-r="library">Biblioteca de ejercicios</button></div>
  </section>

  <section class="card">
    <h3>Suplementos</h3>
    ${S.supplements.items.map(it => `<div class="row list-line"><input class="grow" data-in="suppName" data-id="${it.id}" value="${esc(it.name)}"><button class="icon-btn danger" data-a="delSupp" data-id="${it.id}">✕</button></div>`).join('')}
    <button class="btn small" data-a="addSupp">+ Agregar</button>
  </section>

  <section class="card">
    <h3>Datos</h3>
    <p class="muted small">Todo se guarda solo en este dispositivo. Exportá un backup de vez en cuando.</p>
    <div class="row gap"><button class="btn primary" data-a="export">Exportar JSON</button><button class="btn" data-a="import">Importar JSON</button></div>
    <input type="file" id="importFile" accept="application/json,.json" hidden>
    <button class="btn ghost danger" data-a="resetCalib">Borrar calibraciones de RIR</button>
    <button class="btn ghost danger" data-a="wipe">Borrar todos los datos</button>
  </section>
  ${disclaimer()}`;
}

function screenTemplate(id) {
  const t = S.routine.templates[id];
  if (!t) return '<p>Sesión no encontrada.</p>';
  return `<button class="link" data-a="go" data-r="settings">← Ajustes</button>
  <section class="card">
    <label class="field"><span>Nombre</span><input data-in="tplField" data-id="${id}" data-k="name" value="${esc(t.name)}"></label>
    <label class="field"><span>Descripción</span><input data-in="tplField" data-id="${id}" data-k="subtitle" value="${esc(t.subtitle || '')}"></label>
  </section>
  <section class="card">
    <h3>Ejercicios</h3>
    <div class="tpl-head"><span></span><span>Series</span><span>Mín</span><span>Máx</span><span></span></div>
    ${t.exercises.map((x, i) => `<div class="tpl-ex">
      <button class="link left" data-a="editExercise" data-id="${x.exId}">${esc(exName(x.exId))}</button>
      <input inputmode="numeric" data-in="tplEx" data-id="${id}" data-i="${i}" data-k="sets" value="${x.sets}">
      <input inputmode="numeric" data-in="tplEx" data-id="${id}" data-i="${i}" data-k="repMin" value="${x.repMin}">
      <input inputmode="numeric" data-in="tplEx" data-id="${id}" data-i="${i}" data-k="repMax" value="${x.repMax}">
      <span class="tpl-btns"><button class="icon-btn" data-a="moveTplEx" data-id="${id}" data-i="${i}" data-d="-1">↑</button><button class="icon-btn danger" data-a="delTplEx" data-id="${id}" data-i="${i}">✕</button></span>
    </div>`).join('')}
    <button class="btn" data-a="addTplExSheet" data-id="${id}">+ Agregar ejercicio</button>
    <p class="muted small">En ejercicios por tiempo (plancha) el mínimo y máximo son segundos.</p>
  </section>
  <button class="btn ghost danger" data-a="delTemplate" data-id="${id}">Eliminar esta sesión de la rutina</button>`;
}

function screenLibrary() {
  const list = Object.values(S.exercises).sort((a, b) => a.name.localeCompare(b.name));
  const kinds = { weight: 'con carga', bw: 'peso corporal + lastre/asist.', reps: 'peso corporal', time: 'por tiempo' };
  return `<button class="link" data-a="go" data-r="settings">← Ajustes</button>
  <section class="card"><div class="row"><h3>Biblioteca de ejercicios</h3><button class="btn small primary" data-a="editExercise" data-id="">+ Nuevo</button></div>
  ${list.map(ex => `<button class="list-line link left block" data-a="editExercise" data-id="${ex.id}"><b>${esc(ex.name)}</b><br>
    <small class="muted">${ex.type === 'compound' ? 'Compuesto' : 'Aislamiento'} · ${kinds[ex.kind]} · +${fmt(ex.inc)} kg${failureAllowed(ex) ? ' · permite calibración' : ''}</small></button>`).join('')}
  </section>`;
}

/* ---------- hojas (modales) ---------- */

function openSheet(html) {
  const sh = $('#sheet');
  $('#sheet .sheet-card').innerHTML = `<div class="sheet-grip"></div>${html}`;
  sh.classList.remove('hidden');
  requestAnimationFrame(() => sh.classList.add('show'));
}
function closeSheet() {
  const sh = $('#sheet');
  sh.classList.remove('show');
  setTimeout(() => sh.classList.add('hidden'), 180);
}
const sheetRoot = () => $('#sheet .sheet-card');

function findEntry(uidv) {
  const s = activeSession();
  return s ? { s, e: s.exercises.find(x => x.uid === uidv) } : {};
}

const sheets = {
  readiness(id) {
    const t = S.routine.templates[id];
    openSheet(`<h2>Antes de ${esc(t.name)}</h2>
      <p class="muted">¿Cómo llegás hoy? (para correlacionar con el rendimiento)</p>
      <div class="field"><span>Sueño anoche</span>${chipGroup('sleep', [1, 2, 3, 4, 5], null)}</div>
      <div class="field"><span>Energía ahora</span>${chipGroup('energy', [1, 2, 3, 4, 5], null)}</div>
      <p class="muted small">1 = muy mal · 5 = excelente</p>
      <button class="btn primary huge" data-a="startSession" data-id="${id}">Empezar sesión</button>`);
  },
  pickSession() {
    const order = S.routine.order;
    openSheet(`<h2>Elegí la sesión</h2>${order.map((id, i) => `<button class="btn block ${i === S.nextIdx % order.length ? 'primary' : ''}" data-a="setNext" data-i="${i}">${esc(S.routine.templates[id].name)} <small>${esc(S.routine.templates[id].subtitle || '')}</small></button>`).join('')}
      <p class="muted small">La rotación sigue desde la sesión que elijas.</p>`);
  },
  walk() {
    openSheet(`<h2>Caminata</h2>
      <label class="field"><span>Fecha</span><input type="date" id="wDate" value="${todayStr()}"></label>
      <div class="row gap"><label class="field grow"><span>Distancia (km)</span><input id="wKm" inputmode="decimal" value="8"></label>
      <label class="field grow"><span>Duración (min)</span><input id="wMin" inputmode="numeric" placeholder="ej. 95"></label></div>
      <div class="field"><span>¿Cómo te sentiste?</span>${chipGroup('feel', [1, 2, 3, 4, 5], 3, FEEL)}</div>
      <label class="field"><span>Nota</span><input id="wNote" placeholder="opcional"></label>
      <button class="btn primary huge" data-a="saveWalk">Guardar</button>`);
  },
  bw() {
    openSheet(`<h2>Peso corporal</h2>
      <label class="field"><span>Fecha</span><input type="date" id="bDate" value="${todayStr()}"></label>
      <label class="field"><span>Peso (kg)</span><input id="bKg" inputmode="decimal" value="${fmt(currentBodyweight())}"></label>
      <p class="muted small">Registro semanal opcional, idealmente en ayunas y a la misma hora.</p>
      <button class="btn primary huge" data-a="saveBw">Guardar</button>`);
  },
  rirHelp() {
    openSheet(`<h2>Guía de RIR</h2>
      <p class="muted">RIR = repeticiones en reserva: cuántas reps más podrías haber hecho con buena técnica.</p>
      <table class="rir-table">
        <tr><td><b>0</b></td><td>Fallo total: no sale otra rep.</td></tr>
        <tr><td><b>1</b></td><td>Te quedaba una rep más.</td></tr>
        <tr><td><b>2</b></td><td>Te quedaban dos reps más.</td></tr>
        <tr><td><b>3</b></td><td>Esfuerzo moderado.</td></tr>
        <tr><td><b>4+</b></td><td>Muy cómodo.</td></tr>
      </table>
      <ul class="tips">
        <li>Si la técnica se empieza a romper o la velocidad de la barra cae notablemente, estás cerca del límite (RIR 0-1).</li>
        <li>La mayoría de la gente subestima cuántas reps le quedan. Usá el modo «Calibrar RIR» en máquinas para medir tu sesgo.</li>
        <li>Nunca busques el fallo real en sentadilla, press banca o peso muerto con barra.</li>
      </ul>
      <button class="btn block" data-a="closeSheet">Entendido</button>`);
  },
  editSet(uidv, i) {
    const { e } = findEntry(uidv);
    const st = e.sets[i], ex = S.exercises[e.exId];
    const bw = ex.kind === 'bw';
    openSheet(`<h2>Editar serie</h2>
      ${bw ? `<div class="field"><span>Modo</span>${chipGroup('mode', ['bw', 'lastre', 'asist'], st.mode || 'bw', { bw: 'Peso corporal', lastre: 'Lastre', asist: 'Asistencia' })}</div>
        <label class="field"><span>Kg de lastre / asistencia</span><input id="eExtra" inputmode="decimal" value="${fmt(st.extra || 0)}"></label>`
        : ex.kind !== 'time' ? `<label class="field"><span>Peso (kg)</span><input id="eW" inputmode="decimal" value="${fmt(st.w)}"></label>` : ''}
      <label class="field"><span>${ex.kind === 'time' ? 'Segundos' : 'Repeticiones'}</span><input id="eReps" inputmode="numeric" value="${st.reps}"></label>
      <div class="field"><span>RIR</span>${chipGroup('rir', [0, 1, 2, 3, 4, 5], st.rir, { 0: '0', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5+' })}</div>
      <label class="toggle"><input type="checkbox" id="eWarm" ${st.warmup ? 'checked' : ''}> Serie de calentamiento (no cuenta en el volumen)</label>
      <button class="btn primary huge" data-a="saveEditSet" data-uid="${uidv}" data-i="${i}">Guardar cambios</button>
      <button class="btn ghost danger" data-a="delSet" data-uid="${uidv}" data-i="${i}">Borrar serie</button>`);
  },
  maxTest(uidv) {
    const { e } = findEntry(uidv);
    const ex = S.exercises[e.exId];
    openSheet(`<h2>Test de máximo · ${esc(ex.name)}</h2>
      <p>Después de calentar, hacé <b>una serie al fallo técnico</b>: frená en la última rep que salga con buena técnica completa. No hace falta llegar al fallo muscular.</p>
      <div class="field"><span>Modo</span>${chipGroup('mode', ['bw', 'lastre', 'asist'], 'bw', { bw: 'Peso corporal', lastre: 'Lastre', asist: 'Asistencia' })}</div>
      <label class="field"><span>Kg de lastre / asistencia (si corresponde)</span><input id="mExtra" inputmode="decimal" value="0"></label>
      <label class="field"><span>Reps logradas</span><input id="mReps" inputmode="numeric" placeholder="ej. 9"></label>
      <p class="muted small">La app propone series de trabajo con tu máximo menos 2-3 reps y, si hace falta, más series chicas. Cuando completes 3×8 con RIR 2, te sugiere reducir asistencia o agregar peso.</p>
      <button class="btn primary huge" data-a="saveMaxTest" data-uid="${uidv}">Guardar test</button>`);
  },
  calib(uidv) {
    const { e } = findEntry(uidv);
    const ex = S.exercises[e.exId];
    const w = e.draft && e.draft.w ? round05(e.draft.w * 0.85) : '';
    openSheet(`<h2>🎯 Calibrar RIR · ${esc(ex.name)}</h2>
      <p class="muted">Solo en máquinas o ejercicios de bajo riesgo. Elegí un peso moderado (más o menos el que usás para 12-15 reps).</p>
      <div class="field"><span>Método</span>${chipGroup('method', ['continuo', 'dos'], 'continuo', { continuo: 'Una serie continua (más precisa)', dos: 'Dos series' })}</div>
      <ol class="tips">
        <li>Hacé reps y frená cuando creas que te quedan unas 2-3. Anotá las reps y el RIR que predecís.</li>
        <li><b>Continua:</b> sin soltar, seguí hasta el fallo técnico y anotá cuántas reps extra hiciste.<br><b>Dos series:</b> descansá 3 min y hacé otra serie al mismo peso hasta el fallo técnico.</li>
      </ol>
      <label class="field"><span>Peso (kg)</span><input id="cW" inputmode="decimal" value="${w === '' ? '' : fmt(w)}"></label>
      <label class="field"><span>Reps de la 1ª parte</span><input id="cA" inputmode="numeric" placeholder="ej. 10"></label>
      <div class="field"><span>RIR que predecís</span>${chipGroup('pred', [0, 1, 2, 3, 4, 5], 3, { 0: '0', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5+' })}</div>
      <label class="field"><span>Continua: reps extra hasta el fallo · Dos series: reps totales de la 2ª serie</span><input id="cB" inputmode="numeric" placeholder="ej. 4"></label>
      <button class="btn" data-a="calibRest">⏱ Descanso de 3 min (dos series)</button>
      <button class="btn primary huge" data-a="saveCalib" data-uid="${uidv}">Calcular y guardar</button>`);
  },
  addExercise(target) {
    const list = Object.values(S.exercises).sort((a, b) => a.name.localeCompare(b.name));
    openSheet(`<h2>Agregar ejercicio</h2>
      <input class="search" id="exSearch" placeholder="Buscar…" data-in="exSearch">
      <div id="exList">${list.map(ex => `<button class="btn block left" data-a="pickExercise" data-target="${target}" data-ex="${ex.id}" data-name="${esc(ex.name.toLowerCase())}">${esc(ex.name)}</button>`).join('')}</div>
      <button class="btn ghost" data-a="editExercise" data-id="">+ Crear ejercicio nuevo</button>`);
  },
  exercise(id) {
    const ex = S.exercises[id] || { id: '', name: '', kind: 'weight', type: 'compound', inc: 2.5, muscles: {}, failureOk: false, perSide: false };
    openSheet(`<h2>${id ? 'Editar' : 'Nuevo'} ejercicio</h2>
      <label class="field"><span>Nombre</span><input id="xName" value="${esc(ex.name)}"></label>
      <div class="field"><span>Tipo</span>${chipGroup('type', ['compound', 'isolation'], ex.type, { compound: 'Compuesto', isolation: 'Aislamiento' })}</div>
      <div class="field"><span>Registro</span>${chipGroup('kind', ['weight', 'bw', 'reps', 'time'], ex.kind, { weight: 'Con carga', bw: 'PC + lastre/asist.', reps: 'Solo reps', time: 'Tiempo' })}</div>
      <div class="row gap"><label class="field grow"><span>Incremento (kg)</span><input id="xInc" inputmode="decimal" value="${fmt(ex.inc)}"></label>
      <label class="field grow"><span>Descanso (seg, vacío = default)</span><input id="xRest" inputmode="numeric" value="${ex.rest || ''}"></label></div>
      <label class="toggle"><input type="checkbox" id="xSide" ${ex.perSide ? 'checked' : ''}> Por lado / por pierna</label>
      <label class="toggle"><input type="checkbox" id="xFail" ${ex.failureOk ? 'checked' : ''}> Máquina o bajo riesgo (permite calibración al fallo)</label>
      <p class="muted small">La calibración al fallo nunca se ofrece en sentadilla, press banca o peso muerto con barra, aunque marques esta opción.</p>
      <div class="field"><span>Músculos</span>${Object.entries(MUSCLES).map(([k, l]) => `<div class="row small"><span>${l}</span>${chipGroup('m_' + k, ['0', '0.5', '1'], String(ex.muscles[k] || 0), { 0: '—', 0.5: 'Secundario', 1: 'Primario' })}</div>`).join('')}</div>
      <button class="btn primary huge" data-a="saveExercise" data-id="${id}">Guardar</button>
      ${id ? `<button class="btn ghost danger" data-a="delExercise" data-id="${id}">Eliminar ejercicio</button>` : ''}`);
  },
  meso() {
    openSheet(`<h2>Semanas del mesociclo</h2>
      <div class="table-wrap"><table class="meso-table"><tr><th>Sem</th><th>Series</th><th>RIR comp.</th><th>RIR aisl.</th><th>% peso</th></tr>
      ${S.meso.weeks.map((w, i) => `<tr><td>${i + 1}</td>
        <td><select id="ms_${i}">${[['tres', '3 en comp.'], ['completas', 'Completas'], ['mitad', 'Mitad']].map(([v, l]) => `<option value="${v}" ${w.sets === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
        <td><input id="mc_${i}" inputmode="decimal" value="${fmt(w.rirComp)}"></td>
        <td><input id="mi_${i}" inputmode="decimal" value="${fmt(w.rirIso)}"></td>
        <td><input id="ml_${i}" inputmode="numeric" value="${w.load}"></td></tr>`).join('')}
      </table></div>
      <p class="muted small">RIR 1,5 se muestra como «1-2». Una semana con % de peso menor a 100 se toma como descarga.</p>
      <button class="btn primary huge" data-a="saveMeso">Guardar</button>`);
  }
};

/* ---------- acciones ---------- */

function rerenderSessionSafe() { save(); render(); }

const actions = {
  pick(d, el) { el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('on')); el.classList.add('on'); },
  closeSheet: () => closeSheet(),
  back: () => history.back(),
  go: d => go(d.r),
  goHome: () => go('home'),
  goSession: () => go('session'),
  askReadiness: d => sheets.readiness(d.id),
  pickSession: () => sheets.pickSession(),
  setNext(d) { S.nextIdx = +d.i; save(); closeSheet(); render(); },
  startSession(d) {
    const r = sheetRoot();
    const sl = picked(r, 'sleep'), en = picked(r, 'energy');
    startSession(d.id, sl ? +sl : null, en ? +en : null);
    closeSheet();
    go('session');
  },
  newMeso() { if (confirm('¿Empezar un nuevo mesociclo desde la semana 1?')) { newMesocycle(); render(); toast('Nuevo mesociclo iniciado. Conviene repetir los tests de máximo.'); } },
  toggleSupp(d) {
    const day = todayStr();
    const l = S.supplements.log[day] = S.supplements.log[day] || [];
    const i = l.indexOf(d.id);
    if (i >= 0) l.splice(i, 1); else l.push(d.id);
    save(); render();
  },
  walkSheet: () => sheets.walk(),
  bwSheet: () => sheets.bw(),
  saveWalk() {
    const km = num($('#wKm').value), minutes = num($('#wMin').value);
    if (!km) return toast('Poné la distancia.');
    S.walks.push({ id: uid(), date: $('#wDate').value || todayStr(), km, minutes, feel: +(picked(sheetRoot(), 'feel') || 0) || null, note: $('#wNote').value.trim() });
    save(); closeSheet(); render(); toast('Caminata guardada.');
  },
  delWalk(d) { if (confirm('¿Borrar caminata?')) { S.walks = S.walks.filter(w => w.id !== d.id); save(); render(); } },
  saveBw() {
    const kg = num($('#bKg').value), date = $('#bDate').value || todayStr();
    if (!kg) return toast('Poné el peso.');
    S.bodyweight = S.bodyweight.filter(b => b.date !== date);
    S.bodyweight.push({ date, kg });
    save(); closeSheet(); render(); toast('Peso guardado.');
  },
  delBw(d) { if (confirm('¿Borrar registro?')) { S.bodyweight = S.bodyweight.filter(b => b.date !== d.date); save(); render(); } },

  /* sesión */
  toggleEx(d) { const { e } = findEntry(d.uid); e.open = !e.open; save(); render(); },
  nextEx(d) {
    const s = activeSession();
    const i = s.exercises.findIndex(x => x.uid === d.uid);
    s.exercises.forEach(x => { x.open = false; });
    const nxt = s.exercises.slice(i + 1).find(x => workingSets(x).length < x.plannedSets) || s.exercises[i + 1];
    if (nxt) nxt.open = true;
    save(); render();
    if (nxt) setTimeout(() => { const cards = document.querySelectorAll('.card.ex'); const c = cards[s.exercises.indexOf(nxt)]; c && c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  },
  step(d) {
    const { e } = findEntry(d.uid);
    const f = d.field, cur = e.draft[f] == null ? 0 : e.draft[f];
    e.draft[f] = Math.max(0, +(cur + parseFloat(d.d)).toFixed(2));
    save(); render();
  },
  draftMode(d) { const { e } = findEntry(d.uid); e.draft.mode = d.m; if (d.m === 'bw') e.draft.extra = 0; save(); render(); },
  toggleWarm(d) { const { e } = findEntry(d.uid); e.draft.warmup = !e.draft.warmup; save(); render(); },
  saveSet(d) {
    const { s, e } = findEntry(d.uid);
    const ex = S.exercises[e.exId];
    const dr = e.draft;
    if (!dr.reps) return toast('Poné las repeticiones.');
    if (ex.kind === 'weight' && dr.w == null) return toast('Poné el peso.');
    const warm = !!dr.warmup;
    e.sets.push({ w: dr.w, reps: dr.reps, rir: warm ? null : +d.rir, warmup: warm, mode: ex.kind === 'bw' ? dr.mode : undefined, extra: ex.kind === 'bw' ? dr.extra : undefined, bw: currentBodyweight(), t: Date.now() });
    e.warnings = analyzeEntry(e);
    if (workingSets(e).length >= e.plannedSets) e.suggestion = suggestFor(e, s);
    e.draft = makeDraft(s, e);
    startTimer(warm ? 60 : restFor(ex), ex.name);
    save(); render();
    if (!warm && workingSets(e).length === e.plannedSets) toast('Ejercicio completo ✓');
  },
  rirHelp: () => sheets.rirHelp(),
  editSetSheet: d => sheets.editSet(d.uid, +d.i),
  saveEditSet(d) {
    const { s, e } = findEntry(d.uid);
    const st = e.sets[+d.i], ex = S.exercises[e.exId], r = sheetRoot();
    if ($('#eW')) st.w = num($('#eW').value);
    if ($('#eExtra')) { st.extra = num($('#eExtra').value) || 0; st.mode = picked(r, 'mode') || 'bw'; }
    st.reps = num($('#eReps').value) || st.reps;
    st.warmup = $('#eWarm').checked;
    const rr = picked(r, 'rir');
    st.rir = st.warmup ? null : (rr == null ? st.rir : +rr);
    e.warnings = analyzeEntry(e);
    e.suggestion = workingSets(e).length >= e.plannedSets ? suggestFor(e, s) : null;
    if (ex) e.draft = makeDraft(s, e);
    save(); closeSheet(); render();
  },
  delSet(d) {
    const { s, e } = findEntry(d.uid);
    e.sets.splice(+d.i, 1);
    e.warnings = analyzeEntry(e);
    e.draft = makeDraft(s, e);
    save(); closeSheet(); render();
  },
  applySuggestion(d) {
    const { e } = findEntry(d.uid);
    const sg = lastSuggestion(e.exId, activeSession().id);
    if (!sg) return;
    if (sg.weight != null) e.draft.w = sg.weight;
    if (sg.reps != null) e.draft.reps = sg.reps;
    if (sg.mode) { e.draft.mode = sg.mode; e.draft.extra = sg.extra || 0; }
    e.appliedSg = true;
    save(); render(); toast('Sugerencia aplicada.');
  },
  openNotes(d) { UI.notesOpen[d.uid] = true; render(); },
  addSetPlan(d) { const { e } = findEntry(d.uid); e.plannedSets += 1; save(); render(); },
  removeEx(d) {
    const s = activeSession();
    const e = s.exercises.find(x => x.uid === d.uid);
    if (e.sets.length && !confirm('Este ejercicio tiene series registradas. ¿Quitarlo igual?')) return;
    s.exercises = s.exercises.filter(x => x.uid !== d.uid);
    save(); render();
  },
  swapEx(d) { const { s, e } = findEntry(d.uid); swapExercise(s, e, d.ex); render(); toast(`Cambiado a ${exName(d.ex)}.`); },
  addExerciseSheet: () => sheets.addExercise('session'),
  pickExercise(d) {
    if (d.target === 'session') addExerciseToSession(activeSession(), d.ex);
    else {
      S.routine.templates[d.target].exercises.push({ exId: d.ex, sets: 3, repMin: 8, repMax: 12 });
      save();
    }
    closeSheet(); render();
  },
  maxTestSheet: d => sheets.maxTest(d.uid),
  saveMaxTest(d) {
    const { s, e } = findEntry(d.uid);
    const reps = num($('#mReps').value);
    if (!reps) return toast('Poné las reps logradas.');
    const mode = picked(sheetRoot(), 'mode') || 'bw', extra = num($('#mExtra').value) || 0;
    S.bwMax[e.exId] = { reps, mode, extra, date: todayStr() };
    e.sets.push({ w: 0, reps, rir: 0, warmup: false, mode, extra: mode === 'bw' ? 0 : extra, bw: currentBodyweight(), t: Date.now(), test: true });
    const tex = (S.routine.templates[s.templateId].exercises.find(x => x.exId === e.exId)) || { sets: e.plannedSets, repMin: e.repMin, repMax: e.repMax };
    const p = bwProposal(tex, reps);
    const cfg = S.meso.weeks[s.meso.week - 1];
    Object.assign(e, { plannedSets: (cfg && cfg.sets === 'mitad' ? Math.ceil(p.sets / 2) : p.sets) + 1, repMin: p.repMin, repMax: p.repMax, bwPlan: true });
    e.draft = makeDraft(s, e);
    e.draft.reps = p.repMin; e.draft.mode = mode; e.draft.extra = mode === 'bw' ? 0 : extra;
    startTimer(180, 'Test de máximo');
    save(); closeSheet(); render();
    toast(`Máximo ${reps} reps → ${p.sets} series de ${p.repMin}-${p.repMax}.`);
  },
  calibSheet: d => sheets.calib(d.uid),
  calibRest: () => { startTimer(180, 'Calibración'); toast('Descanso de 3 min iniciado.'); },
  saveCalib(d) {
    const { s, e } = findEntry(d.uid);
    const r = sheetRoot();
    const w = num($('#cW').value), a = num($('#cA').value), b = num($('#cB').value);
    const predicted = +(picked(r, 'pred') || 0), method = picked(r, 'method') || 'continuo';
    if (!w || !a || b == null) return toast('Completá peso, reps y el resultado al fallo.');
    const extra = method === 'continuo' ? b : Math.max(0, b - a);
    const now = Date.now();
    S.calibrations.push({ date: todayStr(), exId: e.exId, weight: w, repsA: a, predicted, extra, method });
    if (method === 'continuo') e.sets.push({ w, reps: a + b, rir: 0, warmup: false, bw: currentBodyweight(), t: now, calib: true });
    else {
      e.sets.push({ w, reps: a, rir: predicted, warmup: false, bw: currentBodyweight(), t: now - 1, calib: true });
      e.sets.push({ w, reps: b, rir: 0, warmup: false, bw: currentBodyweight(), t: now, calib: true });
    }
    e.draft = makeDraft(s, e);
    save();
    const diff = extra - predicted;
    openSheet(`<h2>Resultado</h2>
      <p>Predijiste RIR <b>${predicted}</b> y en realidad te quedaban <b>${extra}</b> reps.</p>
      <p>${diff > 0 ? `Subestimaste tu RIR por ${diff} reps.` : diff < 0 ? `Sobreestimaste tu RIR por ${-diff} reps: estabas más cerca del fallo.` : '¡Predicción exacta!'}</p>
      <p><b>${biasText(rirBias())}</b></p>
      <p class="muted small">${S.settings.applyBias ? 'Este sesgo se usa para ajustar las sugerencias de peso.' : 'Activá «Ajustar sugerencias con mi sesgo» en Ajustes para usarlo.'}</p>
      ${method === 'dos' ? '<p class="muted small">Con dos series hay algo de fatiga acumulada, así que el resultado puede subestimar un poco tus reps reales.</p>' : ''}
      <button class="btn primary block" data-a="closeSheet">Listo</button>`);
    render();
  },
  finishSession() {
    const s = activeSession();
    if (!s) return;
    const n = sessionVolume(s).sets;
    if (!confirm(n ? '¿Terminar la sesión?' : 'No registraste series. ¿Terminar igual?')) return;
    finishSession(s);
    stopTimer();
    go('session-detail', s.id);
    toast('¡Sesión guardada! 💪');
  },
  discardSession() {
    if (!confirm('¿Descartar la sesión en curso? Se pierden las series registradas.')) return;
    S.sessions = S.sessions.filter(x => x.id !== S.activeId);
    S.activeId = null;
    stopTimer(); save(); go('home');
  },

  /* historial */
  histTab(d) { UI.histTab = d.t; render(); },
  openSession: d => go('session-detail', d.id),
  deleteSession(d) {
    if (!confirm('¿Borrar esta sesión del historial?')) return;
    S.sessions = S.sessions.filter(x => x.id !== d.id);
    save(); go('history');
  },
  weekShift(d) { UI.weekMonday = addDays(UI.weekMonday, +d.d); render(); },

  /* ajustes */
  mesoShift(d) { S.meso.offset = (S.meso.offset || 0) + +d.d; if (mesoInfo().week < 1) S.meso.offset -= +d.d; save(); render(); },
  mesoSheet: () => sheets.meso(),
  saveMeso() {
    S.meso.weeks.forEach((w, i) => {
      w.sets = $('#ms_' + i).value;
      w.rirComp = num($('#mc_' + i).value) ?? w.rirComp;
      w.rirIso = num($('#mi_' + i).value) ?? w.rirIso;
      w.load = num($('#ml_' + i).value) ?? 100;
      w.deload = w.load < 100;
    });
    save(); closeSheet(); render(); toast('Mesociclo actualizado.');
  },
  editTemplate: d => go('template', d.id),
  moveTemplate(d) {
    const o = S.routine.order, i = o.indexOf(d.id), j = i + +d.d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    save(); render();
  },
  newTemplate() {
    const id = 'tpl_' + uid();
    S.routine.templates[id] = { name: 'Nueva sesión', subtitle: '', exercises: [] };
    S.routine.order.push(id);
    save(); go('template', id);
  },
  delTemplate(d) {
    if (S.routine.order.length <= 1) return toast('Tiene que quedar al menos una sesión.');
    if (!confirm('¿Eliminar esta sesión de la rutina? El historial se conserva.')) return;
    S.routine.order = S.routine.order.filter(x => x !== d.id);
    delete S.routine.templates[d.id];
    S.nextIdx = S.nextIdx % S.routine.order.length;
    save(); go('settings');
  },
  moveTplEx(d) {
    const l = S.routine.templates[d.id].exercises, i = +d.i, j = i - 1;
    if (j < 0) return;
    [l[i], l[j]] = [l[j], l[i]];
    save(); render();
  },
  delTplEx(d) { S.routine.templates[d.id].exercises.splice(+d.i, 1); save(); render(); },
  addTplExSheet: d => sheets.addExercise(d.id),
  editExercise: d => sheets.exercise(d.id),
  saveExercise(d) {
    const r = sheetRoot();
    const name = $('#xName').value.trim();
    if (!name) return toast('Poné un nombre.');
    const id = d.id || ('ex_' + uid());
    const old = S.exercises[id] || {};
    const muscles = {};
    Object.keys(MUSCLES).forEach(k => { const v = parseFloat(picked(r, 'm_' + k)); if (v) muscles[k] = v; });
    S.exercises[id] = Object.assign({}, old, {
      id, name, type: picked(r, 'type') || 'compound', kind: picked(r, 'kind') || 'weight',
      inc: num($('#xInc').value) ?? 2.5, rest: num($('#xRest').value) || null,
      perSide: $('#xSide').checked, failureOk: $('#xFail').checked, muscles
    });
    save(); closeSheet(); render(); toast('Ejercicio guardado.');
  },
  delExercise(d) {
    const used = Object.values(S.routine.templates).some(t => t.exercises.some(x => x.exId === d.id));
    if (!confirm(used ? 'Este ejercicio está en la rutina: se va a quitar de ahí. El historial se conserva. ¿Eliminar?' : '¿Eliminar ejercicio? El historial se conserva.')) return;
    Object.values(S.routine.templates).forEach(t => { t.exercises = t.exercises.filter(x => x.exId !== d.id); });
    const name = S.exercises[d.id].name;
    delete S.exercises[d.id];
    // se guarda el nombre para que el historial siga legible
    S.sessions.forEach(s => s.exercises.forEach(e => { if (e.exId === d.id) e.exName = name; }));
    save(); closeSheet(); render();
  },
  addSupp() { S.supplements.items.push({ id: 's_' + uid(), name: 'Nuevo suplemento' }); save(); render(); },
  delSupp(d) { if (confirm('¿Quitar de la lista?')) { S.supplements.items = S.supplements.items.filter(x => x.id !== d.id); save(); render(); } },
  export: () => exportData(),
  import() { const f = $('#importFile'); f.value = ''; f.click(); },
  resetCalib() { if (confirm('¿Borrar todas las calibraciones de RIR?')) { S.calibrations = []; save(); render(); } },
  wipe() {
    if (!confirm('¿Borrar TODOS los datos de la app? Exportá un backup antes.')) return;
    if (!confirm('¿Seguro? No se puede deshacer.')) return;
    S = defaultState(); save(); stopTimer(); go('home');
  }
};

/* ---------- inputs ---------- */

const inputs = {
  draft(el) { const { e } = findEntry(el.dataset.uid); const v = num(el.value); e.draft[el.dataset.field] = v == null ? null : Math.max(0, v); rerenderSessionSafe(); },
  sessionNotes(el) { activeSession().notes = el.value; save(); },
  exNotes(el) { const { e } = findEntry(el.dataset.uid); e.notes = el.value; save(); },
  progressEx(el) { UI.progressEx = el.value; render(); },
  setting(el) { const v = num(el.value); if (v != null && v > 0) { S.settings[el.dataset.k] = v; save(); } },
  settingBool(el) { S.settings[el.dataset.k] = el.checked; save(); },
  suppName(el) { const it = S.supplements.items.find(x => x.id === el.dataset.id); if (it && el.value.trim()) { it.name = el.value.trim(); save(); } },
  tplField(el) { S.routine.templates[el.dataset.id][el.dataset.k] = el.value; save(); },
  tplEx(el) {
    const x = S.routine.templates[el.dataset.id].exercises[+el.dataset.i];
    const v = num(el.value);
    if (v != null && v > 0) x[el.dataset.k] = Math.round(v);
    if (x.repMax < x.repMin) x.repMax = x.repMin;
    save();
  },
  exSearch(el) {
    const q = el.value.toLowerCase().trim();
    document.querySelectorAll('#exList [data-name]').forEach(b => { b.style.display = b.dataset.name.includes(q) ? '' : 'none'; });
  }
};

/* ---------- render ---------- */

const SCREENS = {
  home: () => ['Inicio', screenHome()],
  session: () => ['Sesión', screenSession()],
  history: () => ['Historial', screenHistory()],
  'session-detail': () => ['Sesión', screenSessionDetail(UI.param)],
  progress: () => ['Progreso', screenProgress()],
  week: () => ['Resumen semanal', screenWeek()],
  settings: () => ['Ajustes', screenSettings()],
  template: () => ['Editar sesión', screenTemplate(UI.param)],
  library: () => ['Ejercicios', screenLibrary()]
};

function render() {
  const fn = SCREENS[UI.route] || SCREENS.home;
  const [title, html] = fn();
  $('#title').textContent = title;
  $('#main').innerHTML = html;
  const navKey = { 'session-detail': 'history', template: 'settings', library: 'settings' }[UI.route] || UI.route;
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === navKey));
  const sessBtn = $('#nav a[data-r="session"]');
  sessBtn.style.display = activeSession() ? '' : 'none';
  updateWakeLock();
}

function bindEvents() {
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-a]');
    if (!el) return;
    const fn = actions[el.dataset.a];
    if (fn) { ev.preventDefault(); unlockAudio(); fn(el.dataset, el); }
  });
  document.addEventListener('change', ev => {
    const el = ev.target;
    if (el.id === 'importFile' && el.files[0]) return importData(el.files[0], ok => { if (ok) { toast('Datos importados.'); go('home'); } });
    if (el.dataset && el.dataset.in && inputs[el.dataset.in] && el.dataset.in !== 'exSearch') inputs[el.dataset.in](el);
  });
  document.addEventListener('input', ev => {
    const el = ev.target;
    if (el.dataset && el.dataset.in === 'exSearch') inputs.exSearch(el);
    if (el.dataset && (el.dataset.in === 'sessionNotes' || el.dataset.in === 'exNotes')) inputs[el.dataset.in](el);
  });
  document.addEventListener('focusin', ev => { if (ev.target.dataset && ev.target.dataset.in === 'draft') ev.target.select(); });
  $('#sheet').addEventListener('click', ev => { if (ev.target.id === 'sheet') closeSheet(); });
  window.addEventListener('hashchange', () => { parseHash(); closeSheet(); render(); window.scrollTo(0, 0); });
}
