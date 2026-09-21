/* БРС МИРЭА: баллы по дисциплинам. Запускать НА СТРАНИЦЕ pulse.mirea.ru/services/merged-disciplines.
   Пороги и прогнозы не вычисляем сами — берём то, что посчитал Пульс.
   Настройка до вставки: window.__BRSALL = true — показать все, а не только недобор. */
window.__mireaBrs = async () => {
  if (!/merged-disciplines/.test(location.pathname)) return 'НЕ ТА СТРАНИЦА: открой /services/merged-disciplines';
  const KEY = 'mirea:brs:v1';
  const num = s => parseFloat(String(s).replace(',', '.'));

  const items = [...document.querySelectorAll('a[href^="/services/merged-disciplines/"]')]
    .filter(a => a.getAttribute('href').split('/').length > 3)
    .map(a => {
      const L = a.innerText.split('\n').map(x => x.trim()).filter(Boolean);
      const o = { form: '', part: '', name: '', got: null, max: null, target: '', perVisit: null, need: null };
      for (const x of L) {
        let m;
        // Формы контроля не перечисляем: бывают ДИФЗАЧ, КП, КР и что угодно ещё.
        // «БРС» исключаем явно — это подпись блока, а не форма, и стоит в карточке рядом.
        if (!o.form && x !== 'БРС' && /^[А-ЯЁ]{2,8}$/.test(x)) o.form = x;
        else if (!o.part && /^\d+\s*\/\s*\d+$/.test(x)) o.part = x.replace(/\s/g, '');
        else if ((m = x.match(/^([\d.,]+)\s+из\s+([\d.,]+)$/))) { o.got = num(m[1]); o.max = num(m[2]); }
        else if ((m = x.match(/^\+([\d.,]+)/))) { o.perVisit = num(m[1]); const n = x.match(/ещё\s+([\d.,]+)/); if (n) o.need = num(n[1]); }
        else if ((m = x.match(/ещё\s+([\d.,]+)/))) o.need = num(m[1]);
        else if (/^БРС$/.test(x) || /^За одно посещение/.test(x)) continue;
        else if (o.got !== null && !o.target) o.target = x;   // строка сразу после баллов — целевая оценка
        else if (!o.name) o.name = x;
      }
      return o;
    })
    .filter(o => o.name && o.got !== null);

  if (!items.length) return 'БРС: карточки не распознались. Страница загрузилась? Подожди ~4 с и повтори.';

  // Диф с прошлым запуском живёт в браузере, в контекст не попадает.
  let prev = window.__PREV || null;
  if (!prev) { try { prev = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { prev = {}; } }
  const cur = {}; items.forEach(i => cur[i.name] = i.got);
  const grew = Object.keys(cur).filter(k => prev[k] !== undefined && cur[k] > prev[k])
    .map(k => `  ↑ ${k}: ${prev[k]} → ${cur[k]} (+${(cur[k] - prev[k]).toFixed(1)})`);
  const isFirst = !Object.keys(prev).length;
  try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (_) { }

  if (window.__FMT === 'json') return JSON.stringify({ kind: 'brs', items, grew, sum: +items.reduce((a, i) => a + i.got, 0).toFixed(1) });

  const pad = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));
  // Полоса даёт то, чего не видно в голых числах: насколько далеко до порога.
  const bar = (got, max, need) => {
    const target = need != null ? got + need : max;     // порог, а не потолок: до него и меряем
    const w = 10, f = Math.max(0, Math.min(w, Math.round(got / target * w)));
    return '▰'.repeat(f) + '▱'.repeat(w - f);
  };
  const byNeed = [...items].sort((a, b) => (b.need ?? 0) - (a.need ?? 0));
  const show = window.__BRSALL ? byNeed : byNeed.slice(0, 12);

  const L = [`БРС · ${items.length} дисциплин`];
  for (const i of show) {
    const left = i.need != null ? `до «${i.target || '?'}»: ещё ${i.need}` : 'порог не указан';
    const pv = i.perVisit != null ? ` · посещение +${i.perVisit}` : '';
    L.push(`  ${pad(i.name, 30)} ${(i.form + (i.part ? ' ' + i.part : '')).padEnd(9)} ${bar(i.got, i.max, i.need)} ${String(i.got).padStart(5)}/${i.max}  ${left}${pv}`);
  }
  const sum = items.reduce((s, i) => s + i.got, 0), cap = items.reduce((s, i) => s + i.max, 0);
  L.push(`Σ ${sum.toFixed(1)} из ${cap}`);

  // Цена пропусков: журнал знает, сколько пар пропущено, БРС — сколько стоит одно посещение.
  // Порознь обе цифры абстрактны, вместе — конкретны.
  const miss = window.__MISSED;
  if (miss && Object.keys(miss).length) {
    const nrm = s => s.replace(/\s+\d+\s*п\/г.*$/i, '').replace(/\s+\d+\s*\/\s*\d+/, '').trim().toLowerCase();
    const lost = [];
    for (const i of items) {
      const n = miss[nrm(i.name)];
      if (n && i.perVisit) lost.push({ name: i.name, n, pts: +(n * i.perVisit).toFixed(2) });
    }
    if (lost.length) {
      const total = lost.reduce((a, x) => a + x.pts, 0);
      L.push(`💸 ПРОПУСКИ СТОИЛИ ${total.toFixed(1)} балла`);
      // «1 пар» выглядит как недоделка и подрывает доверие к остальным цифрам
      const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return n + ' ' + (m > 4 && m < 21 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c); };
      lost.sort((a, b) => b.pts - a.pts).forEach(x => L.push(`  ${x.name} · ${plural(x.n, 'пара', 'пары', 'пар')} · −${x.pts}`));
      L.push('  Отметку могли не поставить — проверь, прежде чем считать это потерей.');
    }
  }
  if (grew.length) { L.push('🆕 ПРИБАВИЛОСЬ'); grew.forEach(g => L.push(g)); }
  else if (isFirst) L.push('  (первый запуск — дальше покажу только прирост баллов)');
  L.push('  Пороги и прогноз — расчёт Пульса, не мой.');
  L.push('⟦SNAP⟧' + JSON.stringify(cur));   // в ~/.local/state/mirea/brs.json, пользователю не показывать
  return L.join('\n');
};
try { localStorage.setItem('mirea:src:brs', '(' + window.__mireaBrs + ')'); } catch (_) { }
await window.__mireaBrs();
