/* Arranque: temporizador de descanso, pantalla encendida, service worker. */

const TIMER_KEY = 'gymlog.timer';
let TIMER = JSON.parse(localStorage.getItem(TIMER_KEY) || 'null');
let audioCtx = null;
let wakeLock = null;

function unlockAudio() {
  if (audioCtx || !window.AudioContext) return;
  try { audioCtx = new AudioContext(); } catch (e) { audioCtx = null; }
}

function beep() {
  if (!S.settings.sound) return;
  if (navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 500]);
  if (!audioCtx) return;
  [0, 0.25, 0.5].forEach(t => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = 880; o.type = 'sine';
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.4, audioCtx.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.2);
    o.connect(g).connect(audioCtx.destination);
    o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.22);
  });
}

function startTimer(seconds, label) {
  TIMER = { end: Date.now() + seconds * 1000, total: seconds, label, alerted: false };
  localStorage.setItem(TIMER_KEY, JSON.stringify(TIMER));
  tick();
}
function stopTimer() { TIMER = null; localStorage.removeItem(TIMER_KEY); tick(); }
function adjustTimer(sec) {
  if (!TIMER) return;
  TIMER.end += sec * 1000; TIMER.total += sec; TIMER.alerted = false;
  localStorage.setItem(TIMER_KEY, JSON.stringify(TIMER));
  tick();
}

function tick() {
  const bar = document.getElementById('timer');
  if (!TIMER) { bar.classList.add('hidden'); }
  else {
    const left = (TIMER.end - Date.now()) / 1000;
    bar.classList.remove('hidden');
    if (left <= 0) {
      if (!TIMER.alerted) { TIMER.alerted = true; localStorage.setItem(TIMER_KEY, JSON.stringify(TIMER)); beep(); }
      bar.classList.add('done');
      document.getElementById('tTime').textContent = '¡Dale!';
      document.getElementById('tLabel').textContent = 'Descanso terminado';
      document.getElementById('tFill').style.width = '100%';
      if (left < -20) stopTimer();
    } else {
      bar.classList.remove('done');
      document.getElementById('tTime').textContent = fmtClock(left);
      document.getElementById('tLabel').textContent = `Descanso · ${TIMER.label || ''}`;
      document.getElementById('tFill').style.width = `${(1 - left / TIMER.total) * 100}%`;
    }
  }
  const el = document.getElementById('elapsed');
  const s = activeSession();
  if (el && s) el.textContent = fmtClock((Date.now() - new Date(s.startedAt).getTime()) / 1000);
}

async function updateWakeLock() {
  const want = S.settings.wakeLock && UI.route === 'session' && activeSession() && document.visibilityState === 'visible';
  try {
    if (want && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!want && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}

actions.timerMinus = () => adjustTimer(-15);
actions.timerPlus = () => adjustTimer(15);
actions.timerSkip = () => stopTimer();

document.addEventListener('visibilitychange', () => { updateWakeLock(); tick(); });

function init() {
  loadState();
  if (!location.hash) location.replace('#/' + (S.activeId ? 'session' : 'home'));
  parseHash();
  bindEvents();
  render();
  setInterval(tick, 250);
  tick();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW', err));
  }
}

init();
