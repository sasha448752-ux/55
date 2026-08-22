const configured = window.SUPABASE_URL && !window.SUPABASE_URL.startsWith('YOUR_');
const client = configured ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;
const login = document.querySelector('#login');
const panel = document.querySelector('#orders-panel');
const errorText = document.querySelector('#login-error');
const list = document.querySelector('#orders');
const esc = value => String(value || '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
const cropValue = value => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(Math.max(0, Math.min(100, number))) : 50;
};
const effectNames = { none:'Без эффекта', black_white:'Ч/Б', warm:'Тёплый свет', vintage:'Винтаж', contrast:'Контраст' };

const sendStatusNotification = async (orderId, message) => {
  const { data, error } = await client.functions.invoke('order-status-notify', { body: { orderId } });
  if (error || data?.error) {
    message.textContent = 'Статус сохранён. Письмо пока не отправлено: сервис уведомлений не настроен.';
    message.classList.remove('success');
    return;
  }
  if (data?.skipped === 'no_email') {
    message.textContent = 'Статус сохранён. У клиента не указан email.';
    message.classList.remove('success');
    return;
  }
  if (data?.skipped === 'already_sent') {
    message.textContent = 'Статус сохранён. Письмо по этому статусу уже отправлялось.';
    message.classList.add('success');
    return;
  }
  message.textContent = 'Статус сохранён. Клиент получил уведомление на email.';
  message.classList.add('success');
};

async function loadOrders() {
  const { data, error } = await client.from('orders').select('*').order('created_at', { ascending:false });
  if (error) { list.textContent = 'Нет доступа: добавьте пользователя в admin_users.'; return; }
  if (!data.length) { list.textContent = 'Заказов пока нет.'; return; }
  list.innerHTML = '';
  for (const order of data) {
    const { data: photo } = await client.storage.from('order-photos').createSignedUrl(order.photo_path, 3600);
    const cropX = cropValue(order.crop_position?.x);
    const cropY = cropValue(order.crop_position?.y);
    const photoEffect = effectNames[order.photo_effect] || effectNames.none;
    const element = document.createElement('article');
    element.className = 'order';
    element.innerHTML = `<img src="${photo?.signedUrl || ''}" alt="Фотография к заказу" style="object-position:${cropX}% ${cropY}%"><div><h2>Заказ #${esc(order.id.slice(0, 8))} · ${esc(order.canvas_size)}</h2><p><b>${esc(order.full_name)}</b> · ${esc(order.phone)} · ${esc(order.email || '—')}</p><p>${esc(order.address)}</p><p>${esc(order.comment || 'Без комментария')} · ${(order.price_kop / 100).toLocaleString('ru-RU')} ₽</p><p>Кадрирование: ${cropX}% по горизонтали, ${cropY}% по вертикали</p><p>Эффект: ${esc(photoEffect)}</p></div><div class="order-status"><select aria-label="Статус заказа"><option value="new">Новый</option><option value="in_progress">В работе</option><option value="shipped">Отправлен</option><option value="done">Готов</option><option value="cancelled">Отменён</option></select><p class="notification-message" role="status"></p></div>`;
    const select = element.querySelector('select');
    const message = element.querySelector('.notification-message');
    select.value = order.status;
    select.addEventListener('change', async () => {
      select.disabled = true;
      message.textContent = 'Сохраняем статус…';
      message.classList.remove('success');
      const { error: updateError } = await client.from('orders').update({ status:select.value }).eq('id', order.id);
      if (updateError) {
        message.textContent = `Не удалось сохранить: ${updateError.message}`;
        select.value = order.status;
        select.disabled = false;
        return;
      }
      order.status = select.value;
      await sendStatusNotification(order.id, message);
      select.disabled = false;
    });
    list.append(element);
  }
}

document.querySelector('#login-form').onsubmit = async event => {
  event.preventDefault();
  if (!client) { errorText.textContent = 'Заполните supabase-config.js'; return; }
  const data = new FormData(event.target);
  const { error } = await client.auth.signInWithPassword({ email:data.get('email'), password:data.get('password') });
  if (error) { errorText.textContent = error.message; return; }
  login.hidden = true;
  panel.hidden = false;
  loadOrders();
};
document.querySelector('#logout').onclick = async () => { await client.auth.signOut(); panel.hidden = true; login.hidden = false; };
if (client) client.auth.getSession().then(({ data }) => { if (data.session) { login.hidden = true; panel.hidden = false; loadOrders(); } });
