/* Persistencia local (localStorage) + utilidades generales. */

const STORAGE_KEY = 'gymlog.v1';
let S = null; // estado global

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    S = raw ? migrate(JSON.parse(raw)) : defaultState();
  } catch (e) {
    console.error(e);
    S = defaultState();
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); }
  catch (e) { toast('No se pudo guardar: el almacenamiento está lleno. Exportá tus datos.'); }
}

/* Completa campos faltantes para que un backup viejo/incompleto no rompa la app. */
function migrate(data) {
  const d = defaultState();
  const out = Object.assign({}, d, data);
  out.settings = Object.assign({}, d.settings, data.settings || {});
  out.meso = Object.assign({}, d.meso, data.meso || {});
  if (!Array.isArray(out.meso.weeks) || !out.meso.weeks.length) out.meso.weeks = d.meso.weeks;
  out.supplements = Object.assign({}, d.supplements, data.supplements || {});
  out.supplements.log = out.supplements.log || {};
  ['sessions', 'walks', 'bodyweight', 'calibrations'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
  out.exercises = out.exercises || d.exercises;
  out.routine = out.routine && out.routine.templates ? out.routine : d.routine;
  out.bwMax = out.bwMax || {};
  return out;
}

function exportData() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gym-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function importData(file, onDone) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object' || !data.exercises || !data.routine) throw new Error('formato');
      if (!confirm('Esto reemplaza TODOS los datos actuales por los del archivo. ¿Seguir?')) return;
      S = migrate(data);
      save();
      onDone && onDone(true);
    } catch (e) {
      alert('El archivo no es un backup válido de esta app.');
      onDone && onDone(false);
    }
  };
  reader.readAsText(file);
}

/* ---------- utilidades ---------- */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function todayStr(d = new Date()) {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function parseDay(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDay(s); d.setDate(d.getDate() + n); return todayStr(d); }
function mondayOf(s) { const d = parseDay(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return todayStr(d); }

const nf1 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const fmt = n => (n == null || isNaN(n)) ? '–' : nf1.format(n);
const fmt2 = n => (n == null || isNaN(n)) ? '–' : nf2.format(n);
const fmtInt = n => (n == null || isNaN(n)) ? '–' : Math.round(n).toLocaleString('es-AR');
function num(v) { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; }
const round05 = n => Math.round(n * 2) / 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function fmtDate(s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return parseDay(s).toLocaleDateString('es-AR', opts);
}
function fmtDuration(min) {
  if (min == null) return '–';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}
function fmtClock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
