/* Самопроверка окружения. Запускать на странице online-edu.mirea.ru ИЛИ pulse.mirea.ru —
   скрипт сам поймёт, где он, и проверит то, что относится к этому сайту.
   Нужен при первом запуске у нового человека и когда что-то отвалилось. */
window.__mireaDoctor = async () => {
  const L = [], ok = s => L.push('  ✓ ' + s), bad = s => L.push('  ✗ ' + s), note = s => L.push('    ' + s);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (/online-edu\.mirea\.ru$/.test(location.hostname)) {
    L.push('СДО');
    const cfg = window.M && M.cfg;
    if (!cfg) { bad('страница Moodle не распознана — открой /my/'); return L.join('\n'); }
    if (!(cfg.userId > 1)) { bad('вход не выполнен (userId ' + cfg.userId + ')'); note('открой /auth/oidc/?source=loginpage и войди'); return L.join('\n'); }
    ok('вход выполнен, userId ' + cfg.userId);

    const lang = document.documentElement.lang || cfg.language || '?';
    (/^ru/i.test(lang) ? ok : bad)('язык интерфейса: ' + lang);
    if (!/^ru/i.test(lang)) note('статусы сдачи читаются и по-английски, но остальное проверено только на русском');

    const ws = async (m, a = {}) => {
      const r = await fetch(`/lib/ajax/service.php?sesskey=${cfg.sesskey}&info=${m}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ index: 0, methodname: m, args: a }]) });
      const j = await r.json();
      return j[0].error ? { ERR: j[0].exception.errorcode } : j[0].data;
    };
    const now = Math.floor(Date.now() / 1000);
    const need = [
      ['дедлайны', 'core_calendar_get_action_events_by_timesort', { timesortfrom: now, limitnum: 5 }],
      ['курсы', 'core_course_get_enrolled_courses_by_timeline_classification', { classification: 'inprogress', limit: 0 }],
      ['уведомления', 'message_popup_get_popup_notifications', { useridto: cfg.userId, limit: 1 }]
    ];
    let ev = null, courses = null;
    for (const [label, m, args] of need) {
      const r = await ws(m, args);
      if (r && r.ERR) { bad(`${label}: ${r.ERR}`); note('без этого сводка будет неполной, см. reference/api.md'); }
      else { ok(label + ' доступны'); if (m.includes('calendar')) ev = r; if (m.includes('courses')) courses = r; }
    }
    if (courses) {
      const n = (courses.courses || []).length;
      (n ? ok : bad)(`активных курсов: ${n}`);
      if (!n) note('если семестр не начался, сводка будет пустой — это не поломка');
    }
    if (ev) {
      const n = (ev.events || []).length;
      ok(`ближайших событий: ${n}`);
      const a = (ev.events || []).find(e => e.modulename === 'assign');
      if (!a) note('заданий в горизонте нет — статусы сдачи проверить не на чем');
      else {
        try {
          const doc = new DOMParser().parseFromString(await (await fetch(a.url || a.viewurl)).text(), 'text/html');
          const rows = [...doc.querySelectorAll('table tr')].map(tr => [...tr.querySelectorAll('th,td')].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(': '));
          const hit = rows.find(t => /^(Состояние ответа|Submission status)/.test(t));
          (hit ? ok : bad)('страница задания разбирается' + (hit ? '' : ' — строка статуса не найдена'));
          if (!hit) note('шаблон курса нестандартный, статусы будут «?»');
        } catch (_) { bad('страница задания не открылась'); }
      }
    }
  } else if (/pulse\.mirea\.ru$/.test(location.hostname)) {
    L.push('ПУЛЬС');
    const authed = !/\/api\/auth\/login/.test(document.body.innerHTML) && !/Войти\s*$/m.test(document.body.innerText.slice(0, 200));
    (authed ? ok : bad)('вход ' + (authed ? 'выполнен' : 'не выполнен'));
    if (!authed) note('перейди на /api/auth/login?redirectUri=https%3A%2F%2Fpulse.mirea.ru%2Fservices&rememberMe=True');
    const probe = async (path, what, marker) => {
      try {
        const t = await (await fetch(path)).text();
        (t.length > 500 ? ok : bad)(what + ' отвечает');
      } catch (_) { bad(what + ' недоступен'); }
    };
    await probe('/lessons/visiting-logs', 'журнал студента');
    await probe('/services/merged-disciplines', 'дисциплины (БРС)');
    note('страницы отдаются пустым каркасом — реальная проверка только после отрисовки');
    if (/visiting-logs/.test(location.pathname)) {
      const cal = document.querySelectorAll('.weekly-calendar').length;
      const sw = document.querySelectorAll('.swiper').length;
      (cal && sw >= 2 ? ok : bad)(`разметка журнала: календарей ${cal}, swiper ${sw}`);
      if (!(cal && sw >= 2)) note('вёрстка Пульса изменилась — чинить селекторы в pulse-digest.js');
    }
    if (/merged-disciplines/.test(location.pathname)) {
      const cards = document.querySelectorAll('a[href^="/services/merged-disciplines/"]').length - 1;
      (cards > 0 ? ok : bad)(`карточек дисциплин: ${cards}`);
    }
  } else {
    return 'Открой online-edu.mirea.ru или pulse.mirea.ru — здесь проверять нечего.';
  }

  L.push('ОКРУЖЕНИЕ');
  (tz === 'Europe/Moscow' ? ok : note)(`часовой пояс машины: ${tz}`);
  if (tz !== 'Europe/Moscow') note('сроки всё равно показываются по Москве — расхождение с часами ноутбука это норма');
  return L.join('\n');
};
try { localStorage.setItem('mirea:src:doctor', '(' + window.__mireaDoctor + ')'); } catch (_) { }
await window.__mireaDoctor();
