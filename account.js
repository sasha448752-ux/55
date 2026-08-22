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
  return `<article class="order">${photo}<div class="order-info"><h2>Заказ №${escapeHtml(order.id.slice(0,8))}</h2><p>${new Date(order.created_at).toLocaleDateString('ru-RU')} · Холст ${escapeHtml(order.canvas_size)}</p><span class="status">${escapeHtml(statusNames[order.status] || order.status)}</span></div><strong class="order-price">${(order.price_kop / 100).toLocaleString('ru-RU')} ₽</strong></article>`;
};
const loadOrderPreview = async (order, index) => {
  if (!order.photo_path) return;
  const frame = document.querySelector(`#order-photo-${index}`);
  if (!frame) return;
  const { data: photo } = await supabaseClient.storage.from('order-photos').createSignedUrl(order.photo_path, 3600);
  if (!photo?.signedUrl || !frame.isConnected) {
    frame?.classList.remove('is-loading');
    frame?.classList.add('order-photo-empty');
    if (frame) frame.textContent = 'Фото пока недоступно';
    return;
  }
  const image = new Image();
  image.className = 'order-photo';
  image.alt = `Фотография для заказа №${order.id.slice(0, 8)}`;
  image.loading = index === 0 ? 'eager' : 'lazy';
  image.decoding = 'async';
  if (index === 0) image.fetchPriority = 'high';
  image.onload = () => frame.classList.remove('is-loading');
  image.onerror = () => {
    frame.classList.remove('is-loading');
    frame.classList.add('order-photo-empty');
    frame.textContent = 'Фото пока недоступно';
  };
  frame.replaceChildren(image);
  image.src = photo.signedUrl;
};
const showAccount = async user => {
  authPanel.hidden = true;
  customerPanel.hidden = false;
  document.querySelector('#customer-email').textContent = user.email || '';
  ordersList.innerHTML = '<p class="empty">Загружаем заказы…</p>';
  const {data, error} = await supabaseClient.from('orders').select('id,created_at,canvas_size,price_kop,status,photo_path').order('created_at',{ascending:false});
  if (error) { ordersList.innerHTML = '<p class="empty">Не удалось загрузить заказы. Выполните customer-account-migration.sql в Supabase.</p>'; return; }
  if (!data.length) { ordersList.innerHTML = '<p class="empty">У вас пока нет заказов. После оформления авторизованным пользователем они появятся здесь.</p>'; return; }
  // Render the order details immediately. Private preview URLs are requested
  // independently, so one large photo never blocks the whole page.
  ordersList.innerHTML = data.map(renderOrder).join('');
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
  if (error) { setMessage(error.message); return; }
  if (result.session) { showAccount(result.user); return; }
  setMessage('Аккаунт создан. Подтвердите email и затем войдите.', true);
});
document.querySelector('#logout-button').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  customerPanel.hidden = true;
  authPanel.hidden = false;
  authForm.reset();
  setMessage('');
});
if (supabaseClient) supabaseClient.auth.getUser().then(({data}) => { if (data.user) showAccount(data.user); });
