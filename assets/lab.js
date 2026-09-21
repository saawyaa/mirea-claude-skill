/* Проектная зона Пульса: часы работы, оборудование, свои брони.
   Запускать НА СТРАНИЦЕ /services/reservations  ИЛИ  /services/reservations/my-reservations —
   это SPA, страницы нельзя дотянуть через fetch, нужен переход.
   Необязательно: window.__LAB = '3d' — показать только подходящее оборудование. */
window.__mireaLab = async () => {
  const path = location.pathname;
  if (!/\/services\/reservations/.test(path)) return 'НЕ ТА СТРАНИЦА: открой /services/reservations';
  const txt = document.body.innerText;
  const L = [];

  if (/my-reservations/.test(path)) {
    L.push('МОИ БРОНИРОВАНИЯ');
    if (/ещё нет бронирований|нет бронирований/i.test(txt)) { L.push('  Нет ни одной.'); return L.join('\n'); }
    const rows = [...document.querySelectorAll('.ant-card, a[href*="/reservations/"]')]
      .map(e => e.innerText.replace(/\s*\n\s*/g, ' · ').trim())
      .filter(t => t && t.length > 10);
    const uniq = [...new Set(rows)].slice(0, 15);
    uniq.length ? uniq.forEach(r => L.push('  ' + r.slice(0, 120))) : L.push('  Разобрать не удалось — посмотри страницу глазами.');
    return L.join('\n');
  }

  const zone = (txt.match(/Проектная зона\s*\(?([А-ЯЁ]-\d+)\)?/) || [])[1] || '';
  L.push(`ПРОЕКТНАЯ ЗОНА${zone ? ' · ' + zone : ''}`);
  const hours = txt.match(/работает с\s*(\d{1,2}:\d{2})\s*по\s*(\d{1,2}:\d{2})/);
  if (hours) L.push(`  Сегодня: ${hours[1]}–${hours[2]}`);
  else if (/не работает|закрыт/i.test(txt)) L.push('  Сегодня закрыто');

  // Каждая единица оборудования — ссылка вида /services/reservations/equipment/<id>.
  const q = (window.__LAB || '').trim().toLowerCase();
  const items = [...document.querySelectorAll('a[href*="/reservations/equipment/"]')]
    .map(a => {
      const lines = a.innerText.split('\n').map(x => x.trim()).filter(Boolean);
      // Хвост «+2» — число дополнительных меток, к делу не относится.
      const tags = lines.slice(1).filter(x => !/^\+\d+$/.test(x));
      return { name: lines[0] || '', cat: tags[0] || '', href: a.getAttribute('href') };
    })
    .filter(x => x.name);
  const uniq = [...new Map(items.map(i => [i.href, i])).values()];
  const shown = q ? uniq.filter(i => (i.name + ' ' + i.cat).toLowerCase().includes(q)) : uniq;

  if (!uniq.length) { L.push('  Оборудование не распозналось — возможно, страница ещё грузится.'); return L.join('\n'); }
  if (q && !shown.length) {
    L.push(`  По «${window.__LAB}» ничего. Категории: ` + [...new Set(uniq.map(i => i.cat).filter(Boolean))].join(', '));
    return L.join('\n');
  }

  // Группируем по категории: список из тридцати позиций подряд нечитаем.
  const byCat = {};
  shown.forEach(i => { const c = i.cat || 'без категории'; (byCat[c] = byCat[c] || []).push(i.name); });
  L.push(`  Позиций: ${shown.length}${q ? ` (фильтр «${window.__LAB}»)` : ''}`);
  Object.entries(byCat).sort((a, b) => b[1].length - a[1].length).forEach(([c, names]) => {
    L.push(`  ${c}:`);
    names.slice(0, 8).forEach(n => L.push(`    ${n}`));
    if (names.length > 8) L.push(`    …ещё ${names.length - 8}`);
  });
  L.push('  Бронирование — действие на сайте, сам не нажимаю: скажи, и открою нужную страницу.');
  return L.join('\n');
};
try { localStorage.setItem('mirea:src:lab', '(' + window.__mireaLab + ')'); } catch (_) { }
await window.__mireaLab();
