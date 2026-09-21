/* Список файлов, доступных для скачивания из СДО.
   Запускать на любой странице online-edu.mirea.ru.
   Без настроек — файлы текущей страницы.
   window.__FILESRC = '/mod/folder/view.php?id=979955' — разобрать другую страницу, не уходя с текущей. */
window.__mireaFiles = async () => {
  const src = (window.__FILESRC || '').trim();
  let doc = document, where = location.pathname + location.search;
  if (src) {
    try {
      doc = new DOMParser().parseFromString(await (await fetch(src)).text(), 'text/html');
      where = src;
    } catch (_) { return 'Страница ' + src + ' не открылась.'; }
  }

  // Файлы в Moodle отдаются через pluginfile.php — это и есть прямые ссылки.
  const raw = [...doc.querySelectorAll('a[href*="pluginfile.php"]')].map(a => {
    const name = a.textContent.replace(/\s+/g, ' ').trim();
    const href = a.href || a.getAttribute('href');
    // Размер Moodle иногда пишет рядом со ссылкой
    const near = (a.closest('li, div, span') || {}).textContent || '';
    const size = (near.match(/\d+([.,]\d+)?\s*(КБ|МБ|ГБ|KB|MB|GB|bytes|байт)/i) || [])[0] || '';
    return { name, href, size };
  }).filter(f => f.href && f.name && !/^https?:/.test(f.name));

  const files = [...new Map(raw.map(f => [f.href, f])).values()];
  if (!files.length) {
    const folders = [...doc.querySelectorAll('a[href*="/mod/folder/"], a[href*="/mod/resource/"]')]
      .map(a => ({ n: (a.querySelector('.instancename') || a).textContent.replace(/\s+/g, ' ').trim(), h: a.href }))
      .filter(x => x.n).slice(0, 10);
    const L = [`Прямых файлов на ${where} нет.`];
    if (folders.length) {
      L.push('Рядом есть элементы, внутри которых они могут лежать:');
      [...new Map(folders.map(f => [f.h, f])).values()].forEach(f =>
        L.push(`  ${f.n}\n    __FILESRC = '${f.h.replace(location.origin, '')}'`));
    }
    return L.join('\n');
  }

  const L = [`ФАЙЛЫ · ${where} · ${files.length}`];
  files.forEach((f, i) => {
    L.push(`  ${i + 1}. ${f.name}${f.size ? '  (' + f.size + ')' : ''}`);
    L.push(`     ${f.href}`);
  });
  L.push('  Скачивать curl-ом с кукой сессии — см. SKILL.md, раздел про файлы.');
  return L.join('\n');
};
try { localStorage.setItem('mirea:src:files', '(' + window.__mireaFiles + ')'); } catch (_) { }
await window.__mireaFiles();
