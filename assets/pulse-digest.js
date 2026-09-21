/* Пульс МИРЭА: журнал студента → дайджест. Запускать НА СТРАНИЦЕ /lessons/visiting-logs.
   Необязательные настройки объявить ДО вставки:
     window.__PD = 2   // дней вперёд, считая сегодня
     window.__PW = 1   // сколько прошлых недель просмотреть ради посещаемости (0 = только текущая) */
window.__mireaPulse = async () => {
  const DAYS = window.__PD ?? 2, PASTW = window.__PW ?? 1;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  if (!/visiting-logs/.test(location.pathname)) return 'НЕ ТА СТРАНИЦА: открой /lessons/visiting-logs';

  const MONTHS = ['январ', 'феврал', 'март', 'апрел', 'ма[йя]', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
  const cal = () => document.querySelector('.swiper-slide-active .weekly-calendar')
    || document.querySelectorAll('.weekly-calendar')[1] || document.querySelector('.weekly-calendar');
  const slide = () => document.querySelectorAll('.swiper')[1]?.querySelector('.swiper-slide-active');
  const daySpan = n => [...cal().querySelectorAll('span')]
    .find(e => e.textContent.trim() === String(n) && !e.children.length);
  const dayNums = () => [...cal().querySelectorAll('span')]
    .filter(e => /^\d{1,2}$/.test(e.textContent.trim()) && !e.children.length)
    .map(e => +e.textContent.trim());
  const arrow = dir => { const i = document.querySelector('.anticon-' + dir); return i && (i.closest('button,a,div[role="button"]') || i); };
  // Месяц/год берём из шапки: при переходе через границу месяца номера дней сами по себе врут.
  const header = () => {
    // Только связка «месяц ГОД»: иначе «МАтематический анализ» из карточек читается как май.
    const t = document.body.innerText.toLowerCase();
    const re = new RegExp('(' + MONTHS.join('|') + ')[а-яё]*\\s+(20\\d{2})');
    const hit = t.match(re);
    if (!hit) return { m: new Date().getMonth(), y: new Date().getFullYear() };
    return { m: MONTHS.findIndex(m => new RegExp('^' + m).test(hit[1])), y: +hit[2] };
  };

  const RE = {
    type: /^(ЛК|ПР|ЛАБ|СР|КР|ЗАЧ|ЭКЗ)$/, mark: /^(Н|\+|＋)$/, pair: /^\d+ пара$/,
    time: /^\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}$/, room: /^[А-ЯЁA-Z]{1,4}-[\dА-ЯЁ]/,
    teacher: /^[А-ЯЁ][а-яё-]+\s+[А-ЯЁ]\.\s*[А-ЯЁ]\./
  };
  // Разбор по образцам, а не по порядку строк: у прошедших и будущих пар он разный.
  const parseDay = () => {
    const s = slide(); if (!s) return [];
    return [...s.querySelectorAll('a[href^="/lessons/visiting-logs/"]')].map(a => {
      const lines = a.innerText.split('\n').map(x => x.trim()).filter(Boolean);
      const o = { type: '', mark: '', time: '', room: '', teacher: '', subject: '' }, rest = [];
      for (const x of lines) {
        if (!o.type && RE.type.test(x)) o.type = x;
        else if (!o.mark && RE.mark.test(x)) o.mark = x;
        else if (!o.time && RE.time.test(x)) o.time = x.replace(/\s/g, '');
        else if (RE.pair.test(x)) continue;
        else if (!o.room && RE.room.test(x)) o.room = x;
        else if (!o.teacher && RE.teacher.test(x)) o.teacher = x;
        else rest.push(x);
      }
      o.subject = rest.filter(x => !/^Перерыв$|минут$/.test(x)).join(' ').slice(0, 60);
      return o;
    });
  };

  const now = new Date(), d2 = n => String(n).padStart(2, '0');
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const weekTxt = (document.body.innerText.match(/\d+\s*недел[а-яё]*/) || [''])[0];

  const ahead = [], missed = [], missedBy = {};
  let marked = 0, skipped = 0, scanned = 0;
  // Ключ для сшивки с БРС: в журнале «Иностранный язык 2 п/г», в БРС просто «Иностранный язык».
  const norm = s => s.replace(/\s+\d+\s*п\/г.*$/i, '').replace(/\s+\d+\s*\/\s*\d+/, '').trim().toLowerCase();

  const scanWeek = async (collectFuture) => {
    const { m, y } = header();
    for (const dnum of dayNums()) {
      const dt = new Date(y, m, dnum);
      const diff = Math.round((dt - midnight) / 86400000);
      const isToday = diff === 0, isPast = diff < 0;
      if (!isPast && !(collectFuture && diff >= 0 && diff < DAYS)) continue;
      const sp = daySpan(dnum); if (!sp) continue;
      sp.click(); await wait(850);
      const lessons = parseDay(); scanned++;
      if (isPast) {
        for (const l of lessons) {
          if (l.mark === 'Н') {
            skipped++;
            missed.push(`  ${d2(dnum)}.${d2(m + 1)} ${l.time.split('-')[0]} ${l.subject}`);
            const k = norm(l.subject); if (k) missedBy[k] = (missedBy[k] || 0) + 1;
          }
          else if (l.mark) marked++;
        }
        continue;
      }
      ahead.push(isToday ? `📍 СЕГОДНЯ ${dow[dt.getDay()]} ${d2(dnum)}.${d2(m + 1)}`
        : `➡️ ${dow[dt.getDay()].toUpperCase()} ${d2(dnum)}.${d2(m + 1)}`);
      if (!lessons.length) ahead.push('  Нет занятий');
      for (const l of lessons) ahead.push(
        `  ${l.time.split('-')[0]} ${l.type} ${l.subject}${l.room ? ' · ' + l.room : ''}${l.teacher ? ' · ' + l.teacher : ''}`);
    }
  };

  await scanWeek(true);
  for (let i = 0; i < PASTW; i++) {
    const a = arrow('left'); if (!a) break;
    a.click(); await wait(1400);
    await scanWeek(false);
  }
  // Вернуть календарь туда, где нашли.
  for (let i = 0; i < PASTW; i++) { const a = arrow('right'); if (!a) break; a.click(); await wait(700); }

  if (window.__FMT === 'json') return JSON.stringify({ kind: 'pulse', week: weekTxt, ahead, marked, skipped, missed, missedBy });

  const L = [`ПУЛЬС · ${weekTxt}`.trim(), ...ahead];
  if (marked || skipped) {
    L.push(`📊 Посещаемость (${PASTW + 1} нед.): отмечено ${marked}, без отметки ${skipped}`);
    missed.slice(0, 10).forEach(m => L.push('  Н · ' + m.trim()));
    if (skipped) L.push('  «Н» = нет отметки. Могла не сработать отметка, а не прогул — сверяй, прежде чем паниковать.');
  } else if (scanned) L.push('📊 Отметок посещаемости за просмотренные дни нет.');
  // Хвост забирает вызывающий и передаёт в brs-digest как window.__MISSED. Пользователю не показывать.
  if (Object.keys(missedBy).length) L.push('⟦MISSED⟧' + JSON.stringify(missedBy));
  return L.join('\n');
};
// Кладём сам скрипт в localStorage: повторный вызов в этой сессии — одной строкой,
// без повторной вставки всего текста. Источник — только наш же код, origin тот же.
try { localStorage.setItem('mirea:src:pulse', '(' + window.__mireaPulse + ')'); } catch (_) { }
await window.__mireaPulse();
