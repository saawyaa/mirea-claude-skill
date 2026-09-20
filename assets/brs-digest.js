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
        if (!o.form && /^(ЗАЧ|ЭКЗ|ДИФЗАЧ|КР|КП)$/.test(x)) o.form = x;
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
  let prev = {}; try { prev = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { }
  const cur = {}; items.forEach(i => cur[i.name] = i.got);
  const grew = Object.keys(cur).filter(k => prev[k] !== undefined && cur[k] > prev[k])
    .map(k => `  ↑ ${k}: ${prev[k]} → ${cur[k]} (+${(cur[k] - prev[k]).toFixed(1)})`);
  const isFirst = !Object.keys(prev).length;
  try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (_) { }

  const pad = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));
  const byNeed = [...items].sort((a, b) => (b.need ?? 0) - (a.need ?? 0));
  const show = window.__BRSALL ? byNeed : byNeed.slice(0, 12);

  const L = [`БРС · ${items.length} дисциплин`];
  for (const i of show) {
    const left = i.need != null ? `до «${i.target || '?'}»: ещё ${i.need}` : 'порог не указан';
    const pv = i.perVisit != null ? ` · посещение +${i.perVisit}` : '';
    L.push(`  ${pad(i.name, 34)} ${(i.form + (i.part ? ' ' + i.part : '')).padEnd(9)} ${String(i.got).padStart(5)}/${i.max}  ${left}${pv}`);
  }
  const sum = items.reduce((s, i) => s + i.got, 0), cap = items.reduce((s, i) => s + i.max, 0);
  L.push(`Σ ${sum.toFixed(1)} из ${cap}`);
  if (grew.length) { L.push('🆕 ПРИБАВИЛОСЬ'); grew.forEach(g => L.push(g)); }
  else if (isFirst) L.push('  (первый запуск — дальше покажу только прирост баллов)');
  L.push('  Пороги и прогноз — расчёт Пульса, не мой.');
  return L.join('\n');
};
try { localStorage.setItem('mirea:src:brs', '(' + window.__mireaBrs + ')'); } catch (_) { }
await window.__mireaBrs();
