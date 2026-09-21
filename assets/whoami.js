/* Учебный контекст студента: группа, шифр, направление, кафедра, институт.
   Запускать НА СТРАНИЦЕ /services/group.
   Список группы — персональные данные однокурсников, пачкой не выгружается.
   Точечный поиск: window.__WHO = 'Иванов' — вернёт одного человека. */
window.__mireaWho = async () => {
  if (!/\/services\/group/.test(location.pathname)) return 'НЕ ТА СТРАНИЦА: открой /services/group';
  const lines = document.body.innerText.split('\n').map(x => x.trim()).filter(Boolean);
  const after = label => { const i = lines.findIndex(x => x === label); return i >= 0 ? (lines[i + 1] || '') : ''; };

  const L = ['УЧЕБНЫЙ КОНТЕКСТ'];
  // Без \b: в JS граница слова считается по ASCII, перед кириллической буквой её нет.
  const group = (document.body.innerText.match(/[А-ЯЁ]{4}-\d{2}-\d{2}/) || [])[0];
  if (group) L.push('  группа: ' + group);
  const pairs = [['Мой шифр', 'шифр'], ['Направление подготовки', 'направление'],
                 ['Выпускающее подразделение', 'кафедра'], ['Вышестоящее подразделение', 'институт']];
  for (const [label, title] of pairs) { const v = after(label); if (v) L.push(`  ${title}: ${v}`); }

  const total = (document.body.innerText.match(/Список группы\s*\((\d+)\)/) || [])[1];
  if (total) L.push(`  человек в группе: ${total}`);

  const q = (window.__WHO || '').trim().toLowerCase();
  if (q) {
    // Точечный поиск одного человека — не выгрузка списка.
    const people = [];
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^[А-ЯЁ][а-яё-]+ [А-ЯЁ][а-яё-]+( [А-ЯЁ][а-яё-]+)?$/.test(lines[i]) && /@edu\.mirea\.ru$/.test(lines[i + 1] || ''))
        people.push({ fio: lines[i], mail: lines[i + 1] });
    }
    const hit = people.filter(p => p.fio.toLowerCase().includes(q));
    if (!hit.length) L.push(`  «${window.__WHO}» в группе не нашёл`);
    else if (hit.length > 3) L.push(`  под «${window.__WHO}» подходит ${hit.length} человек — уточни`);
    else hit.forEach(p => L.push(`  ${p.fio} · ${p.mail}`));
  } else {
    L.push('  Список группы не показываю: это личные данные однокурсников.');
    L.push('  Нужен конкретный человек — объяви window.__WHO = "фамилия".');
  }
  return L.join('\n');
};
try { localStorage.setItem('mirea:src:who', '(' + window.__mireaWho + ')'); } catch (_) { }
await window.__mireaWho();
