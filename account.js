const isConfigured = window.SUPABASE_URL && !window.SUPABASE_URL.startsWith('YOUR_') && window.SUPABASE_ANON_KEY && !window.SUPABASE_ANON_KEY.startsWith('YOUR_');
const supabaseClient = isConfigured && window.supabase ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;
const authPanel = document.querySelector('#auth-panel');
const customerPanel = document.querySelector('#customer-panel');
const authForm = document.querySelector('#auth-form');
const authMessage = document.querySelector('#auth-message');
const ordersList = document.querySelector('#customer-orders');
const statusNames = {new:'Новый',in_progress:'В работе',shipped:'Отправлен',done:'Готов',cancelled:'Отменён'};

const escapeHtml = value => String(value || '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const setMessage = (message, success = false) => { authMessage.textContent = message; authMessage.classList.toggle('success', success); };
const canvasRatio = value => {
  const [width, height] = String(value || '').match(/\d+/g)?.slice(0, 2).map(Number) || [];
  return width && height ? `${width} / ${height}` : '4 / 3';
};
const renderOrder = (order, index) => {
  const ratio = canvasRatio(order.canvas_size);
  const photo = order.photo_path
    ? `<div class="order-photo-frame is-loading" id="order-photo-${index}" style="aspect-ratio:${ratio}" aria-label="Загружаем фотографию заказа"></div>`
    : `<div class="order-photo-frame order-photo-empty" style="aspect-ratio:${ratio}">Фото готовится</div>`;
  return `<article class="order">${photo}<div class="order-info"><h2>Заказ №${escapeHtml(order.id.slice(0,8))}</h2><p>${new Date(order.created_at).toLocaleDateString('ru-RU')} · Холст ${escapeHtml(order.canvas_size)}</p><span class="status">${escapeHtml(statusNames[order.status] || order.status)}</span><details><summary>Подробнее о заказе</summary><p>Холст ${escapeHtml(order.canvas_size)} — 1 шт.</p><p>Получатель: ${escapeHtml(order.full_name)}</p><p>Телефон: ${escapeHtml(order.phone)}</p><p>Адрес: ${escapeHtml(order.address)}</p><p>Комментарий: ${escapeHtml(order.comment || 'Не указан')}</p><p>Условия оплаты уточните у менеджера.</p><label>Номер заказа<input readonly value="${escapeHtml(order.id)}" aria-label="Полный номер заказа"></label><button type="button" class="secondary copy-order" data-order="${escapeHtml(order.id)}">Скопировать номер</button><a href="https://t.me/CANVASO_bot" target="_blank" rel="noopener noreferrer">Связаться по заказу в Telegram</a><p>Сообщите поддержке номер заказа.</p></details></div><strong class="order-price">${(order.price_kop / 100).toLocaleString('ru-RU')} ₽</strong></article>`;
};
const loadOrderPreview = async (order, index) => {
  if (!order.photo_path) return;
  const frame = document.querySelector(`#order-photo-${index}`);
  if (!frame) return;
  const unavailable = () => {
    if (!frame.isConnected) return;
    frame.classList.remove('is-loading');
    frame.classList.add('order-photo-empty');
    frame.textContent = 'Фото пока недоступно';
  };
  let photo;
  try {
    const result = await supabaseClient.storage.from('order-photos').createSignedUrl(order.photo_path, 3600);
    if (!result.error) photo = result.data;
  } catch { unavailable(); return; }
  if (!frame.isConnected) return;
  if (!photo?.signedUrl) {
    unavailable();
    return;
  }
  const image = new Image();
  image.className = 'order-photo';
  image.alt = `Фотография для заказа №${order.id.slice(0, 8)}`;
  image.loading = index === 0 ? 'eager' : 'lazy';
  image.decoding = 'async';
  if (index === 0) image.fetchPriority = 'high';
  image.onload = () => frame.classList.remove('is-loading');
  image.onerror = unavailable;
  frame.replaceChildren(image);
  image.src = photo.signedUrl;
};
let accountLoadVersion = 0;
const showAccount = async (user, refreshOnly = false) => {
  const version = ++accountLoadVersion;
  const refreshButton = document.querySelector('#refresh-orders');
  refreshButton.disabled = true;
  refreshButton.onclick = () => {
    if (!refreshButton.disabled && !customerPanel.hidden) void showAccount(user, true);
  };
  authPanel.hidden = true;
  customerPanel.hidden = false;
  document.querySelector('#customer-email').textContent = user.email || '';
  const profile = document.querySelector('#profile-form');
  if (!refreshOnly) {
    profile.elements.full_name.value = user.user_metadata?.full_name || '';
    profile.elements.phone.value = user.user_metadata?.phone || '';
    profile.elements.email.value = user.email || '';
  }
  ordersList.innerHTML = '<p class="empty">Загружаем заказы…</p>';
  let response;
  try {
    response = await supabaseClient.from('orders').select('id,created_at,canvas_size,price_kop,status,photo_path,full_name,phone,address,comment').eq('customer_id', user.id).order('created_at',{ascending:false});
  } catch {
    response = { error: true };
  }
  if (version !== accountLoadVersion) return;
  refreshButton.disabled = false;
  const { data, error } = response || {};
  if (error || !Array.isArray(data)) { ordersList.innerHTML = '<p class="empty">Не удалось загрузить заказы. Нажмите «Обновить заказы» или обратитесь в поддержку.</p>'; return; }
  if (!data.length) { ordersList.innerHTML = '<p class="empty">У вас пока нет заказов. После оформления авторизованным пользователем они появятся здесь.</p>'; return; }
  // Render the order details immediately. Private preview URLs are requested
  // independently, so one large photo never blocks the whole page.
  ordersList.innerHTML = data.map(renderOrder).join('');
  ordersList.querySelectorAll('article.order details').forEach((details, index) => {
    window.CanvasCustomerOrderDetails?.attach(details, supabaseClient, data[index].id);
  });
  void Promise.all(data.map(loadOrderPreview));
};

if (!supabaseClient) setMessage('Личный кабинет будет доступен после настройки Supabase.');
authForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabaseClient) return;
  const button = document.querySelector('#login-button');
  button.disabled = true;
  setMessage('Выполняем вход…');
  const data = new FormData(authForm);
  const {data:result, error} = await supabaseClient.auth.signInWithPassword({email:data.get('email'),password:data.get('password')});
  button.disabled = false;
  if (error) { setMessage('Не удалось войти: проверьте email и пароль.'); return; }
  showAccount(result.user);
});
document.querySelector('#register-button').addEventListener('click', async () => {
  if (!supabaseClient) return;
  const data = new FormData(authForm);
  const email = data.get('email'), password = data.get('password');
  if (!email || !password) { setMessage('Введите email и пароль не короче 6 символов.'); return; }
  const button = document.querySelector('#register-button');
  button.disabled = true;
  setMessage('Создаём аккаунт…');
  const {data:result, error} = await supabaseClient.auth.signUp({email,password});
  button.disabled = false;
  if (error) { setMessage('Не удалось создать аккаунт. Проверьте данные или попробуйте восстановить пароль.'); return; }
  if (result.session) { showAccount(result.user); return; }
  setMessage('Аккаунт создан. Подтвердите email и затем войдите.', true);
});
document.querySelector('#logout-button').addEventListener('click', async () => {
  ++accountLoadVersion;
  ordersList.replaceChildren();
  document.querySelector('#profile-form').reset();
  document.querySelector('#customer-email').textContent = '';
  customerPanel.hidden = true;
  authPanel.hidden = false;
  authForm.reset();
  setMessage('');
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  } catch { setMessage('Не удалось подтвердить выход. Проверьте подключение и повторите выход после входа в кабинет.'); }
});
if (supabaseClient) {
  const initialVersion = accountLoadVersion;
  supabaseClient.auth.getUser().then(({data}) => { if (data.user && initialVersion === accountLoadVersion) showAccount(data.user); });
}

async function requestPasswordLink(email, button, message) {
  if (!supabaseClient) return;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { message.textContent = 'Укажите корректный email.'; return; }
  button.disabled = true;
  try {
    const redirectTo = new URL('set-password.html', window.location.href).href;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
    message.textContent = error ? 'Не удалось отправить письмо. Попробуйте позже.' : 'Если аккаунт существует, письмо со ссылкой придёт на указанный email.';
  } catch { message.textContent = 'Нет связи с сервисом. Попробуйте позже.'; }
  finally { button.disabled = false; }
}
document.querySelector('#recover-button').onclick = event => requestPasswordLink(authForm.elements.email.value.trim(), event.currentTarget, authMessage);
document.querySelector('#change-password').onclick = async event => {
  const button = event.currentTarget;
  const { data } = await supabaseClient.auth.getUser();
  if (data.user) await requestPasswordLink(data.user.email, button, document.querySelector('#profile-message'));
};
document.querySelector('#profile-form').onsubmit = async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');
  const message = document.querySelector('#profile-message');
  button.disabled = true;
  try {
    const { data, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !data.user) throw new Error();
    const email = form.elements.email.value.trim();
    const changedEmail = email.toLowerCase() !== data.user.email.toLowerCase();
    const attributes = { data: { full_name: form.elements.full_name.value.trim(), phone: form.elements.phone.value.trim() } };
    if (changedEmail) attributes.email = email;
    const { error } = await supabaseClient.auth.updateUser(attributes);
    if (error) throw error;
    message.textContent = changedEmail ? 'Профиль сохранён. Подтвердите новый email по письму; проверьте оба почтовых ящика.' : 'Профиль сохранён.';
  } catch { message.textContent = 'Не удалось сохранить профиль. Проверьте подключение и попробуйте позже.'; }
  finally { button.disabled = false; }
};
ordersList.addEventListener('click', async event => {
  const button = event.target.closest('.copy-order');
  if (!button) return;
  try { await navigator.clipboard.writeText(button.dataset.order); button.textContent = 'Номер скопирован'; }
  catch { const input = button.parentElement.querySelector('input'); input.focus(); input.select(); button.textContent = 'Номер выделен — скопируйте его'; }
});
