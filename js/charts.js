/* Gráficos SVG livianos (sin librerías). Una sola serie por gráfico; tocá un punto/barra para ver el valor. */

const CHART = { w: 340, h: 170, padL: 38, padR: 10, padT: 12, padB: 24 };

function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) || step0;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
  return { lo, hi, ticks };
}

function shortDate(s) { return parseDay(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' }); }

function chartTable(points, unit) {
  return `<details class="chart-table"><summary>Ver tabla</summary><table>
    ${points.slice().reverse().map(p => `<tr><td>${fmtDate(p.date)}</td><td class="r">${fmt(p.y)} ${unit}</td></tr>`).join('')}
  </table></details>`;
}

function emptyChart(msg) { return `<div class="chart-empty">${esc(msg || 'Todavía no hay datos suficientes.')}</div>`; }

function lineChart(points, { unit = '', title = '', zeroBase = false } = {}) {
  points = points.filter(p => p.y != null);
  if (!points.length) return emptyChart();
  const { w, h, padL, padR, padT, padB } = CHART;
  const ys = points.map(p => p.y);
  const { lo, hi, ticks } = niceTicks(zeroBase ? 0 : Math.min(...ys), Math.max(...ys));
  const t0 = parseDay(points[0].date).getTime(), t1 = parseDay(points[points.length - 1].date).getTime();
  const x = p => points.length === 1 ? (padL + w - padR) / 2 : padL + ((parseDay(p.date).getTime() - t0) / (t1 - t0 || 1)) * (w - padL - padR);
  const y = v => padT + (1 - (v - lo) / (hi - lo || 1)) * (h - padT - padB);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const labelIdx = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const lastP = points[points.length - 1];

  return `<figure class="chart">
    ${title ? `<figcaption>${esc(title)}</figcaption>` : ''}
    <div class="chart-tip" aria-live="polite">Último: <b>${fmt(lastP.y)} ${unit}</b> · ${fmtDate(lastP.date)}</div>
    <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
      ${ticks.map(t => `<line class="grid" x1="${padL}" x2="${w - padR}" y1="${y(t)}" y2="${y(t)}"/>
        <text class="axis" x="${padL - 6}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join('')}
      <line class="baseline" x1="${padL}" x2="${w - padR}" y1="${h - padB}" y2="${h - padB}"/>
      ${labelIdx.map(i => `<text class="axis" x="${x(points[i])}" y="${h - 6}" text-anchor="${points.length === 1 ? 'middle' : i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}">${shortDate(points[i].date)}</text>`).join('')}
      <path class="line" d="${path}"/>
      ${points.map(p => `<circle class="dot" cx="${x(p)}" cy="${y(p.y)}" r="4"/>`).join('')}
      ${points.map(p => `<circle class="hit" cx="${x(p)}" cy="${y(p.y)}" r="14" data-tip="${esc(`${fmt(p.y)} ${unit} · ${fmtDate(p.date)}`)}"/>`).join('')}
    </svg>
    ${chartTable(points, unit)}
  </figure>`;
}

function barChart(points, { unit = '', title = '' } = {}) {
  if (!points.length) return emptyChart();
  const { w, h, padL, padR, padT, padB } = CHART;
  const { hi, ticks } = niceTicks(0, Math.max(...points.map(p => p.y)));
  const n = points.length, slot = (w - padL - padR) / n, bw = Math.min(28, slot - 2);
  const y = v => padT + (1 - v / (hi || 1)) * (h - padT - padB);
  const base = h - padB;
  const lastP = points[n - 1];
  const bar = (p, i) => {
    const x0 = padL + i * slot + (slot - bw) / 2, top = y(p.y), r = Math.min(4, bw / 2, base - top);
    if (base - top < 0.5) return '';
    return `<path class="bar" d="M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + bw - r} Q${x0 + bw},${top} ${x0 + bw},${top + r} V${base} Z"/>`;
  };
  return `<figure class="chart">
    ${title ? `<figcaption>${esc(title)}</figcaption>` : ''}
    <div class="chart-tip" aria-live="polite">Última semana: <b>${fmtInt(lastP.y)} ${unit}</b></div>
    <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
      ${ticks.map(t => `<line class="grid" x1="${padL}" x2="${w - padR}" y1="${y(t)}" y2="${y(t)}"/>
        <text class="axis" x="${padL - 6}" y="${y(t) + 4}" text-anchor="end">${t >= 1000 ? fmt(t / 1000) + 'k' : fmt(t)}</text>`).join('')}
      ${points.map(bar).join('')}
      <line class="baseline" x1="${padL}" x2="${w - padR}" y1="${base}" y2="${base}"/>
      ${[0, n - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => `<text class="axis" x="${padL + i * slot + slot / 2}" y="${h - 6}" text-anchor="middle">${shortDate(points[i].date)}</text>`).join('')}
      ${points.map((p, i) => `<rect class="hit" x="${padL + i * slot}" y="${padT}" width="${slot}" height="${base - padT}" data-tip="${esc(`Semana del ${fmtDate(p.date)}: ${fmtInt(p.y)} ${unit}`)}"/>`).join('')}
    </svg>
    ${chartTable(points, unit)}
  </figure>`;
}

/* Tooltip por toque: actualiza la línea de texto del gráfico y resalta el punto. */
document.addEventListener('click', e => {
  const hit = e.target.closest && e.target.closest('.chart .hit');
  if (!hit) return;
  const fig = hit.closest('.chart');
  fig.querySelector('.chart-tip').innerHTML = `<b>${hit.dataset.tip}</b>`;
  fig.querySelectorAll('.hit.on').forEach(n => n.classList.remove('on'));
  hit.classList.add('on');
});
