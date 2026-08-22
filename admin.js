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
const deleteCompletedOrder = async orderId => {
  const { data, error } = await client.functions.invoke('admin-order', { body: { action:'delete', orderId } });
  if (error || data?.error) throw new Error(data?.error || error.message || 'Не удалось удалить заказ.');
  return data;
};

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
    element.innerHTML = `<img src="${photo?.signedUrl || ''}" alt="Фотография к заказу" style="object-position:${cropX}% ${cropY}%"><div><h2>Заказ #${esc(order.id.slice(0, 8))} · ${esc(order.canvas_size)}</h2><p><b>${esc(order.full_name)}</b> · ${esc(order.phone)} · ${esc(order.email || '—')}</p><p>${esc(order.address)}</p><p>${esc(order.comment || 'Без комментария')} · ${(order.price_kop / 100).toLocaleString('ru-RU')} ₽</p><p>Кадрирование: ${cropX}% по горизонтали, ${cropY}% по вертикали</p><p>Эффект: ${esc(photoEffect)}</p></div><div class="order-status"><select aria-label="Статус заказа"><option value="new">Новый</option><option value="in_progress">В работе</option><option value="shipped">Отправлен</option><option value="done">Готов</option><option value="cancelled">Отменён</option></select><button class="order-delete" type="button" hidden>Удалить заказ</button><p class="notification-message" role="status"></p></div>`;
    const select = element.querySelector('select');
    const deleteButton = element.querySelector('.order-delete');
    const message = element.querySelector('.notification-message');
    select.value = order.status;
    deleteButton.hidden = order.status !== 'done';
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
      deleteButton.hidden = order.status !== 'done';
      await sendStatusNotification(order.id, message);
      select.disabled = false;
    });
    deleteButton.addEventListener('click', async () => {
      if (!window.confirm(`Удалить завершённый заказ #${order.id.slice(0, 8)}? Восстановить его и фотографию будет нельзя.`)) return;
      deleteButton.disabled = true;
      message.textContent = 'Удаляем заказ…';
      message.classList.remove('success');
      try {
        await deleteCompletedOrder(order.id);
        element.remove();
        if (!list.children.length) list.textContent = 'Заказов пока нет.';
      } catch (error) {
        message.textContent = error instanceof Error ? error.message : 'Не удалось удалить заказ.';
        deleteButton.disabled = false;
      }
    });
    list.append(element);
  }
}

const chatConversations = document.querySelector('#chat-conversations');
const chatMessages = document.querySelector('#admin-chat-messages');
const chatTitle = document.querySelector('#admin-chat-title');
const chatReplyForm = document.querySelector('#admin-chat-form');
let selectedConversationToken = null;
let adminChatChannel = null;
let chatPollingTimer = null;
const adminChatRequest = async body => {
  const { data, error } = await client.functions.invoke('admin-chat', { body });
  if (error || data?.error) throw new Error(data?.error || error.message || 'Ошибка чата.');
  return data;
};
const chatDate = value => new Intl.DateTimeFormat('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }).format(new Date(value));
const renderAdminMessage = message => {
  if (!message?.id || chatMessages.querySelector(`[data-message-id="${message.id}"]`)) return;
  const item = document.createElement('p');
  item.className = `admin-message ${message.sender === 'admin' ? 'admin' : ''}`;
  item.dataset.messageId = message.id;
  item.textContent = message.body;
  const time = document.createElement('small');
  time.textContent = message.sender === 'admin' ? `Вы · ${chatDate(message.created_at)}` : `Клиент · ${chatDate(message.created_at)}`;
  item.append(time);
  chatMessages.append(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;
};
const loadConversation = async token => {
  selectedConversationToken = token;
  chatMessages.replaceChildren();
  chatTitle.textContent = 'Загружаем диалог…';
  chatReplyForm.hidden = true;
  const data = await adminChatRequest({ action:'history', conversationToken: token });
  data.messages.forEach(renderAdminMessage);
  chatTitle.textContent = 'Диалог с клиентом';
  chatReplyForm.hidden = false;
  document.querySelectorAll('.admin-conversation').forEach(button => button.classList.toggle('active', button.dataset.token === token));
  if (adminChatChannel) client.removeChannel(adminChatChannel);
  adminChatChannel = client.channel(`canvaso:chat:${token}`)
    .on('broadcast', { event:'message' }, payload => renderAdminMessage(payload.payload))
    .subscribe();
};
async function loadChats() {
  if (!chatConversations) return;
  try {
    const { conversations } = await adminChatRequest({ action:'list' });
    chatConversations.replaceChildren();
    if (!conversations.length) { chatConversations.innerHTML = '<p class="empty-chats">Диалогов пока нет.</p>'; return; }
    conversations.forEach(conversation => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'admin-conversation'; button.dataset.token = conversation.visitor_token;
      const name = conversation.visitor_name || conversation.visitor_contact || 'Клиент';
      button.innerHTML = `<strong>${esc(name)}</strong><small>${esc(conversation.last_message || '')}</small><small>${chatDate(conversation.last_message_at)}</small>`;
      button.addEventListener('click', () => loadConversation(conversation.visitor_token).catch(error => { chatTitle.textContent = error.message; }));
      chatConversations.append(button);
    });
    if (selectedConversationToken) document.querySelectorAll('.admin-conversation').forEach(button => button.classList.toggle('active', button.dataset.token === selectedConversationToken));
  } catch (error) {
    chatConversations.innerHTML = `<p class="empty-chats">${esc(error.message || 'Не удалось загрузить чаты.')}</p>`;
  }
}
const startChatPolling = () => {
  if (chatPollingTimer || !client) return;
  chatPollingTimer = window.setInterval(() => { void loadChats(); }, 5000);
};
const stopChatPolling = () => {
  if (!chatPollingTimer) return;
  window.clearInterval(chatPollingTimer);
  chatPollingTimer = null;
};
chatReplyForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!selectedConversationToken) return;
  const textarea = chatReplyForm.elements.message;
  const button = chatReplyForm.querySelector('button');
  const text = textarea.value.trim();
  if (!text) return;
  button.disabled = true;
  try {
    const { message } = await adminChatRequest({ action:'send', conversationToken:selectedConversationToken, message:text });
    renderAdminMessage(message);
    textarea.value = '';
    void loadChats();
  } catch (error) { chatTitle.textContent = error.message || 'Не удалось отправить сообщение.'; }
  finally { button.disabled = false; }
});

document.querySelector('#login-form').onsubmit = async event => {
  event.preventDefault();
  if (!client) { errorText.textContent = 'Заполните supabase-config.js'; return; }
  const data = new FormData(event.target);
  const { error } = await client.auth.signInWithPassword({ email:data.get('email'), password:data.get('password') });
  if (error) { errorText.textContent = error.message; return; }
  login.hidden = true;
  panel.hidden = false;
  loadOrders();
  loadChats();
  startChatPolling();
};
document.querySelector('#logout').onclick = async () => { await client.auth.signOut(); stopChatPolling(); panel.hidden = true; login.hidden = false; };
if (client) client.auth.getSession().then(({ data }) => { if (data.session) { login.hidden = true; panel.hidden = false; loadOrders(); loadChats(); startChatPolling(); } });
