/* БРС: разбивка по одному предмету. Запускать на любой странице online-edu.mirea.ru.
   Обязательно объявить ДО вставки: window.__BRSC = 'Информатика' — часть названия курса. */
window.__mireaBrsDetail = async () => {
  const q = (window.__BRSC || '').trim().toLowerCase();
  if (!q) return 'Не задан предмет: объяви window.__BRSC = "часть названия" перед вызовом.';
  const ws = async (methodname, args = {}) => {
    const r = await fetch(`/lib/ajax/service.php?sesskey=${M.cfg.sesskey}&info=${methodname}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ index: 0, methodname, args }])
    });
    const j = await r.json();
    if (j[0].error) throw new Error(j[0].exception.errorcode);
    return j[0].data;
  };
  const cs = (await ws('core_course_get_enrolled_courses_by_timeline_classification',
    { classification: 'inprogress', limit: 0 })).courses || [];
  const hits = cs.filter(c => (c.fullname + ' ' + c.shortname).toLowerCase().includes(q));
  if (!hits.length) return `Курс «${window.__BRSC}» не найден. Есть: ` + cs.map(c => c.shortname.split('_')[0]).join(', ');
  if (hits.length > 1) return `Под «${window.__BRSC}» подходит несколько: ` + hits.map(c => c.shortname).join(' | ');
  const c = hits[0];

  const doc = new DOMParser().parseFromString(
    await (await fetch(`/grade/report/user/index.php?id=${c.id}`)).text(), 'text/html');
  // Типы элементов приклеены к названию без пробела — срезаем.
  const PREF = /^(Вычисляемая оценка|Заполняемый вручную элемент|Категория оценок|Итог курса|Тест|Задание|Опрос|Лекция|Форум|Обратная связь)/;
  const rows = [...doc.querySelectorAll('table tr')].map(tr => {
    const cells = [...tr.querySelectorAll('th,td')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
    if (cells.length < 2) return null;
    const name = cells[0].replace(PREF, '').replace(/ Действия.*$/, '').trim();
    const grade = (cells[1] || '').replace(/ Действия.*$/, '').trim();
    const range = (cells[2] || '').trim();
    if (!name || /^Элемент оценивания$/.test(name)) return null;
    return { name, grade, range, has: grade && grade !== '-' };
  }).filter(Boolean);

  const AGG = /^(Текущий контроль|Посещаемость|Достижения|Семестровый контроль|Сумма баллов|Оценка за промежуточную аттестацию)$/;
  const agg = rows.filter(r => AGG.test(r.name));
  const got = rows.filter(r => r.has && !AGG.test(r.name));
  const wait = rows.filter(r => !r.has && !AGG.test(r.name) && r.range);

  const L = [`БРС · ${c.shortname.split('_')[0]}`];
  if (agg.length) { L.push('ИТОГИ'); agg.forEach(r => L.push(`  ${r.name.padEnd(36)} ${(r.grade || '-').padStart(6)}  из ${r.range}`)); }
  if (got.length) { L.push('ПОЛУЧЕНО'); got.forEach(r => L.push(`  ${r.name.slice(0, 40).padEnd(42)} ${r.grade.padStart(6)}  из ${r.range}`)); }
  if (wait.length) {
    L.push(`ЕЩЁ НЕ ОЦЕНЕНО (${wait.length})`);
    wait.slice(0, 15).forEach(r => L.push(`  ${r.name.slice(0, 40).padEnd(42)} ${'—'.padStart(6)}  из ${r.range}`));
    if (wait.length > 15) L.push(`  …ещё ${wait.length - 15}`);
  }
  return L.join('\n');
};
try { localStorage.setItem('mirea:src:brsdetail', '(' + window.__mireaBrsDetail + ')'); } catch (_) { }
await window.__mireaBrsDetail();
