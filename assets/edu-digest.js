/* СДО МИРЭА: собирает дайджест целиком в странице, наружу отдаёт готовый текст.
   Запускать на любой странице online-edu.mirea.ru при живой сессии.
   Настройки (необязательно) объявить ДО вставки: window.__MH = 14 (горизонт, дней). */
window.__mireaEdu = async () => {
  const H = window.__MH || 14, KEY = 'mirea:edu:v2';
  const now = Math.floor(Date.now() / 1000);
  const ws = async (methodname, args = {}) => {
    const r = await fetch(`/lib/ajax/service.php?sesskey=${M.cfg.sesskey}&info=${methodname}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ index: 0, methodname, args }])
    });
    const j = await r.json();
    if (j[0].error) throw new Error(methodname + ': ' + j[0].exception.errorcode);
    return j[0].data;
  };
  const d2 = n => String(n).padStart(2, '0');
  const fmt = t => { const x = new Date(t * 1000); return `${d2(x.getDate())}.${d2(x.getMonth() + 1)} ${d2(x.getHours())}:${d2(x.getMinutes())}`; };
  const hrs = t => Math.round((t - now) / 3600);

  let ev = [], notif = [], unread = 0, warn = [];
  try {
    ev = (await ws('core_calendar_get_action_events_by_timesort',
      { timesortfrom: now, timesortto: now + H * 86400, limitnum: 50 })).events || [];
  } catch (e) { warn.push('дедлайны: ' + e.message); }
  try {
    unread = await ws('message_popup_get_unread_popup_notification_count', { useridto: M.cfg.userId });
    notif = (await ws('message_popup_get_popup_notifications', { useridto: M.cfg.userId, limit: 20 })).notifications || [];
  } catch (e) { warn.push('уведомления: ' + e.message); }

  // Статус сдачи: только для заданий, только в горизонте. Параллельно, но без фанатизма.
  const status = {};
  const assigns = ev.filter(e => e.modulename === 'assign');
  await Promise.all(assigns.map(async e => {
    // e.url — страница статуса. action.url ведёт на форму правки (&action=editsubmission), таблицы там нет.
    const url = e.url || e.viewurl || ((e.action && e.action.url) || '').split('&action=')[0];
    if (!url) return;
    try {
      const doc = new DOMParser().parseFromString(await (await fetch(url)).text(), 'text/html');
      const rows = [...doc.querySelectorAll('table tr')].map(tr =>
        [...tr.querySelectorAll('th,td')].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(': '));
      const st = rows.find(t => /^Состояние ответа/.test(t)) || '';
      const gr = rows.find(t => /^Оценка:/.test(t)) || '';
      status[e.id] = /Отправлено для оценивания/.test(st) ? 'сдано'
        : /еще не представлены|не представлен/i.test(st) ? 'НЕ СДАНО' : '?';
      if (/Отправлено/.test(st) && gr && !/^Оценка: *-?$/.test(gr)) status[e.id] += ' · ' + gr.replace('Оценка: ', 'оценка ');
    } catch (_) { status[e.id] = '?'; }
  }));

  // Диф с прошлым запуском — живёт в браузере, мне в контекст не попадает.
  let prev = {};
  try { prev = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { }
  const cur = {}; ev.forEach(e => cur[e.id] = status[e.id] || e.modulename);
  const isFirst = !Object.keys(prev).length;
  const changes = [];
  if (!isFirst) {
    ev.forEach(e => {
      const was = prev[e.id], is = cur[e.id];
      if (was === undefined) changes.push(`+ новый срок · ${e.name} · ${fmt(e.timesort)}`);
      else if (was !== is && /сдано/.test(is) && !/сдано/.test(was)) changes.push(`✓ сдано · ${e.name}`);
      else if (was !== is && /оценка/.test(is)) changes.push(`★ оценили · ${e.name} · ${is}`);
    });
    Object.keys(prev).forEach(id => { if (!cur[id]) changes.push(`– пропало из списка (сдано либо закрыто) · id${id}`); });
  }
  try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (_) { }

  // Рендер
  const L = [];
  const line = e => {
    const st = status[e.id] ? ' · ' + status[e.id] : '';
    const c = e.course && (e.course.shortname || e.course.fullname) || '';
    return `  ${fmt(e.timesort)} · ${e.name.replace(/ - срок сдачи| закрывается/, '')} · ${c.split('_')[0]}${st}`;
  };
  const pend = e => !/сдано/.test(status[e.id] || '');
  const urgent = ev.filter(e => hrs(e.timesort) <= 48 && pend(e));
  const soon = ev.filter(e => hrs(e.timesort) > 48 && pend(e));
  const done = ev.filter(e => !pend(e)).length;

  L.push(`СДО · непрочитанных: ${unread} · горизонт ${H} дн.`);
  if (urgent.length) { L.push('🔥 СРОЧНО (< 48 ч)'); urgent.forEach(e => L.push(line(e))); }
  if (soon.length) { L.push('📅 БЛИЖАЙШЕЕ'); soon.forEach(e => L.push(line(e))); }
  if (changes.length) { L.push('🆕 С ПРОШЛОГО РАЗА'); changes.slice(0, 12).forEach(c => L.push('  ' + c)); }
  else if (isFirst) L.push('  (первый запуск — дальше буду показывать только изменения)');
  if (done) L.push(`✅ уже сдано в горизонте: ${done}`);
  const unreadN = notif.filter(n => !n.read).slice(0, 5);
  if (unreadN.length) { L.push('🔔 НЕПРОЧИТАННЫЕ'); unreadN.forEach(n => L.push(`  ${fmt(n.timecreated)} · ${(n.subject || '').slice(0, 80)}`)); }
  if (!urgent.length && !soon.length) L.push('  Открытых дедлайнов в горизонте нет.');
  if (warn.length) L.push('⚠️ не собралось: ' + warn.join('; '));
  return L.join('\n');
};
// Кладём сам скрипт в localStorage: повторный вызов в этой сессии — одной строкой,
// без повторной вставки всего текста. Источник — только наш же код, origin тот же.
try { localStorage.setItem('mirea:src:edu', '(' + window.__mireaEdu + ')'); } catch (_) { }
await window.__mireaEdu();
