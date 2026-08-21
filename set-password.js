const configured = window.SUPABASE_URL && !window.SUPABASE_URL.startsWith('YOUR_') && window.SUPABASE_ANON_KEY && !window.SUPABASE_ANON_KEY.startsWith('YOUR_');
const client = configured && window.supabase ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;
const form = document.querySelector('#set-password-form');
const message = document.querySelector('#password-message');
const loading = document.querySelector('#password-loading');
const setMessage = (text, success = false) => { message.textContent = text; message.classList.toggle('success', success); };

const openPasswordForm = async () => {
  if (!client) { loading.textContent = 'Сервис личного кабинета временно недоступен.'; return; }
  const { data: { session } } = await client.auth.getSession();
  if (!session) { loading.textContent = 'Ссылка недействительна или истекла. Оформите заказ повторно или обратитесь в поддержку.'; return; }
  loading.hidden = true;
  form.hidden = false;
};

form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = new FormData(form);
  const password = String(data.get('password') || '');
  if (password !== String(data.get('password_confirm') || '')) { setMessage('Пароли не совпадают.'); return; }
  const button = form.querySelector('button');
  button.disabled = true;
  setMessage('Сохраняем пароль…');
  const { error } = await client.auth.updateUser({ password });
  button.disabled = false;
  if (error) { setMessage('Не удалось сохранить пароль. Откройте ссылку из письма ещё раз.'); return; }
  setMessage('Пароль сохранён. Переходим в личный кабинет…', true);
  setTimeout(() => { window.location.href = 'account.html'; }, 900);
});

openPasswordForm();
