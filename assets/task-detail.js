/* Что именно задано: срок, статус, условие, прикреплённые файлы.
   Запускать на любой странице online-edu.mirea.ru.
   Обязательно ДО вставки: window.__TASK = 'тетрадь 3' — часть названия задания.
   Необязательно: window.__TASKH = 60 — в каком горизонте (дней) искать задание. */
window.__mireaTask = async () => {
  const q = (window.__TASK || '').trim().toLowerCase();
  if (!q) return 'Не задано, что искать: объяви window.__TASK = "часть названия" перед вызовом.';
  const H = window.__TASKH || 60;
  const now = Math.floor(Date.now() / 1000);
  const ws = async (methodname, args = {}) => {
    const r = await fetch(`/lib/ajax/service.php?sesskey=${M.cfg.sesskey}&info=${methodname}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ index: 0, methodname, args }])
    });
    const j = await r.json();
    if (j[0].error) throw new Error(j[0].exception.errorcode);
    return j[0].data;
  };

  // Ищем среди событий календаря: там уже есть прямая ссылка, лазить по страницам курсов не нужно.
  const ev = (await ws('core_calendar_get_action_events_by_timesort',
    { timesortfrom: now - 30 * 86400, timesortto: now + H * 86400, limitnum: 50 })).events || [];   // 50 — потолок Moodle, больше отдаёт ошибку
  const hits = ev.filter(e => e.name.toLowerCase().includes(q));
  if (!hits.length) {
    const names = [...new Set(ev.map(e => e.name.replace(/ - срок сдачи| закрывается/, '')))].slice(0, 15);
    return `Не нашёл «${window.__TASK}» среди событий за последние 30 и ближайшие ${H} дней.\nЕсть: ` + names.join(' | ');
  }
  if (hits.length > 3) return `Слишком общо: под «${window.__TASK}» подходит ${hits.length}. Уточни.\n` +
    hits.slice(0, 8).map(e => '  · ' + e.name).join('\n');

  const d2 = n => String(n).padStart(2, '0');
  const fmt = t => { const x = new Date(t * 1000); return `${d2(x.getDate())}.${d2(x.getMonth() + 1)} ${d2(x.getHours())}:${d2(x.getMinutes())}`; };
  const out = [];

  for (const e of hits) {
    const url = e.url || e.viewurl || ((e.action && e.action.url) || '').split('&action=')[0];
    out.push(`▸ ${e.name.replace(/ - срок сдачи| закрывается/, '')}`);
    out.push(`  курс: ${((e.course && (e.course.shortname || e.course.fullname)) || '').split('_')[0]}`);
    out.push(`  срок: ${fmt(e.timesort)}${e.overdue ? '  ПРОСРОЧЕНО' : ''}`);
    if (!url) { out.push('  ссылка не найдена'); continue; }

    let doc;
    try { doc = new DOMParser().parseFromString(await (await fetch(url)).text(), 'text/html'); }
    catch (_) { out.push('  страница не открылась'); continue; }

    const rows = [...doc.querySelectorAll('table tr')].map(tr =>
      [...tr.querySelectorAll('th,td')].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(': '));
    const st = rows.find(t => /^Состояние ответа/.test(t)) || '';
    if (st) out.push('  статус: ' + st.replace('Состояние ответа на задание: ', ''));
    const gr = rows.find(t => /^Оценка:/.test(t));
    if (gr && !/^Оценка: *-?$/.test(gr)) out.push('  ' + gr.toLowerCase());

    // Условие: берём блок описания, режем — в чат не нужен весь текст методички.
    const introEl = doc.querySelector('.activity-description, #intro, [id^="intro"]');
    const intro = introEl ? introEl.textContent.replace(/\s+/g, ' ').trim() : '';
    if (intro) out.push('  условие: ' + intro.slice(0, 400) + (intro.length > 400 ? '…' : ''));

    // Файлы: студенту нужны имя и ссылка, а не разметка вокруг них.
    const files = [...doc.querySelectorAll('a[href*="pluginfile.php"]')]
      .map(a => ({ n: a.textContent.replace(/\s+/g, ' ').trim(), h: a.href }))
      .filter(f => f.n && !/^https?:/.test(f.n));
    const uniq = [...new Map(files.map(f => [f.h, f])).values()].slice(0, 10);
    if (uniq.length) { out.push(`  файлы (${uniq.length}):`); uniq.forEach(f => out.push(`    ${f.n}\n      ${f.h}`)); }

    // Материалы часто лежат не в задании, а отдельным элементом курса рядом:
    // «Практические задания. Рабочая тетрадь 3» + папка «К рабочей тетради 3».
    if (!uniq.length && e.course && e.course.viewurl) {
      const nums = (e.name.match(/\d+/g) || []).slice(-1);
      if (nums.length) {
        try {
          const cdoc = new DOMParser().parseFromString(await (await fetch(e.course.viewurl)).text(), 'text/html');
          const near = [...cdoc.querySelectorAll('li.activity')]
            .map(li => ({
              n: (li.querySelector('.instancename') || {}).textContent || '',
              h: ((li.querySelector('a.aalink, a.stretched-link') || {}).href) || ''
            }))
            .filter(x => x.h && !x.h.includes('/mod/assign/') && new RegExp('\\b' + nums[0] + '\\b').test(x.n))
            .slice(0, 5);
          if (near.length) {
            out.push('  материалы рядом в курсе:');
            near.forEach(x => out.push(`    ${x.n.replace(/\s+/g, ' ').trim()}\n      ${x.h}`));
          }
        } catch (_) { /* страница курса не открылась — не критично */ }
      }
    }
    out.push(`  открыть: ${url}`);
  }
  return out.join('\n');
};
try { localStorage.setItem('mirea:src:task', '(' + window.__mireaTask + ')'); } catch (_) { }
await window.__mireaTask();
