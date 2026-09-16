(() => {
  const panel = document.querySelector('#orders-panel');
  const sidebar = document.createElement('aside');
  sidebar.className = 'studio-sidebar';
  sidebar.innerHTML = `<a class="brand" href="admin.html">CANVASO<small>УПРАВЛЕНИЕ СТУДИЕЙ</small></a><p>РАБОЧЕЕ ПРОСТРАНСТВО</p><nav aria-label="Разделы админки"><button data-view="overview">▦ Обзор студии</button><button data-view="orders">▤ Заказы и фотографии</button><button data-view="chats">▧ Чаты с клиентами</button></nav><a class="site-link" href="index.html?preview=canvaso-2026" target="_blank" rel="noopener">Открыть сайт ↗</a>`;
  const content = document.createElement('div'); content.className = 'studio-content';
  while (panel.firstChild) content.append(panel.firstChild);
  panel.append(sidebar, content);
  document.querySelector('#orders-column').prepend(document.querySelector('#bulk-order-actions'));
  const heading = content.querySelector('h1'); heading.textContent = 'Обзор студии';
  const summary = document.createElement('section'); summary.className = 'studio-summary';
  summary.setAttribute('aria-label', 'Сводка загруженных заказов');
  summary.innerHTML = `<article><span>Всего заказов</span><strong id="metric-total">—</strong><small>В загруженном списке</small></article><article><span>Новые заказы</span><strong id="metric-new">—</strong><small>Ожидают обработки</small></article><article><span>В производстве</span><strong id="metric-progress">—</strong><small>Статус «В работе»</small></article><article><span>Сумма заказов</span><strong id="metric-value">—</strong><small>Не оплаченная выручка</small></article>`;
  content.querySelector('header').after(summary);
  const overview = document.createElement('section'); overview.className = 'studio-overview';
  overview.innerHTML = `<div><p class="eyebrow">ПРОИЗВОДСТВО</p><h2>Путь заказа</h2><div id="status-distribution"><p>Показатели появятся после загрузки заказов.</p></div></div><aside><p class="eyebrow">CANVASO · ВАШИ МОМЕНТЫ НА ХОЛСТЕ</p><h2>Каждый кадр —<br>чья-то история.</h2><p>Проверьте новые заказы, согласуйте детали с клиентом и обновите статус после печати.</p><button id="focus-new-orders">Перейти к новым заказам →</button></aside>`;
  summary.after(overview);
  const titles = { overview: 'Обзор студии', orders: 'Заказы и фотографии', chats: 'Чаты с клиентами' };
  const navigate = view => {
    content.dataset.view = view; heading.textContent = titles[view];
    overview.hidden = view !== 'overview';
    document.querySelector('#orders-column').hidden = view === 'chats';
    document.querySelector('.admin-chats').hidden = view === 'orders';
    sidebar.querySelectorAll('button').forEach(button => {
      button.classList.toggle('active', button.dataset.view === view);
      if (button.dataset.view === view) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
  };
  sidebar.querySelectorAll('button').forEach(button => button.onclick = () => navigate(button.dataset.view));
  document.querySelector('#focus-new-orders').onclick = () => {
    navigate('orders');
    const status = document.querySelector('#order-status-filter'); status.value = 'new';
    status.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const refresh = () => {
    const rows = [...document.querySelectorAll('#orders article.order')];
    if (!rows.length && !document.querySelector('#orders').textContent.includes('Заказов пока нет.')) {
      ['total', 'new', 'progress', 'value'].forEach(key => document.querySelector(`#metric-${key}`).textContent = '—');
      document.querySelector('#status-distribution').textContent = 'Показатели недоступны до загрузки заказов.';
      return;
    }
    const names = { new: 'Новые', in_progress: 'В работе', shipped: 'Отправлены', done: 'Готовы', cancelled: 'Отменены' };
    const counts = Object.fromEntries(Object.keys(names).map(status => [status, rows.filter(row => row.dataset.status === status).length]));
    document.querySelector('#metric-total').textContent = rows.length;
    document.querySelector('#metric-new').textContent = counts.new;
    document.querySelector('#metric-progress').textContent = counts.in_progress;
    document.querySelector('#metric-value').textContent = `${(rows.reduce((sum, row) => sum + (Number(row.dataset.price) || 0), 0) / 100).toLocaleString('ru-RU')} ₽`;
    document.querySelector('#status-distribution').replaceChildren(...Object.entries(names).map(([status, name]) => {
      const row = document.createElement('div'); row.className = 'status-row';
      const label = document.createElement('span'); label.textContent = name;
      const meter = document.createElement('meter'); meter.min = 0; meter.max = Math.max(rows.length, 1); meter.value = counts[status]; meter.setAttribute('aria-label', name);
      const count = document.createElement('b'); count.textContent = counts[status];
      row.append(label, meter, count); return row;
    }));
  };
  new MutationObserver(refresh).observe(document.querySelector('#orders'), { childList: true, subtree: true, attributes: true, attributeFilter: ['data-status', 'data-price'] });
  navigate('overview');
  refresh();
})();
