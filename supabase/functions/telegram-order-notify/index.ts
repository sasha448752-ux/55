import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
}[character] as string));

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const getServiceRoleKey = () => {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacyKey) return legacyKey;
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  return secretKeys ? JSON.parse(secretKeys).default : undefined;
};

const businessDaysToShip = 3;
const formatMoscowDate = (value: Date) => new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(value);
const shippingDeadline = (createdAt: string) => {
  const deadline = new Date(createdAt);
  deadline.setUTCHours(12, 0, 0, 0);
  let addedDays = 0;
  while (addedDays < businessDaysToShip) {
    deadline.setUTCDate(deadline.getUTCDate() + 1);
    const day = deadline.getUTCDay();
    if (day !== 0 && day !== 6) addedDays += 1;
  }
  return deadline;
};

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);

  const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const telegramChatId = Deno.env.get('TELEGRAM_CHAT_ID');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = getServiceRoleKey();
  if (!telegramToken || !telegramChatId || !supabaseUrl || !serviceRoleKey) {
    console.error('Telegram notification function is not configured.');
    return response({ error: 'Telegram notifications are not configured' }, 503);
  }

  let orderId: string;
  try {
    ({ orderId } = await request.json());
  } catch {
    return response({ error: 'Invalid request body' }, 400);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId || '')) {
    return response({ error: 'Invalid order ID' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, created_at, full_name, phone, email, address, comment, canvas_size, price_kop, photo_path, crop_position, photo_effect, telegram_notified_at')
    .eq('id', orderId)
    .single();

  if (orderError || !order) return response({ error: 'Order not found' }, 404);
  if (order.telegram_notified_at) return response({ sent: true, alreadyNotified: true });

  const price = (order.price_kop / 100).toLocaleString('ru-RU');
  const crop = (order.crop_position && typeof order.crop_position === 'object' ? order.crop_position : {}) as Record<string, unknown>;
  const cropCoordinate = (value: unknown) => {
    const coordinate = Number(value);
    return Number.isFinite(coordinate) ? Math.round(Math.max(0, Math.min(100, coordinate))) : 50;
  };
  const cropX = cropCoordinate(crop.x);
  const cropY = cropCoordinate(crop.y);
  const orderedAt = new Date(order.created_at);
  const deadline = shippingDeadline(order.created_at);
  const effectNames: Record<string, string> = { none: 'Без эффекта', black_white: 'Ч/Б', warm: 'Тёплый свет', vintage: 'Винтаж', contrast: 'Контраст' };
  const text = [
    '🆕 <b>Новый заказ на холст</b>',
    `<b>Заказ:</b> #${escapeHtml(order.id.slice(0, 8))}`,
    `<b>Оформлен:</b> ${formatMoscowDate(orderedAt)}`,
    `<b>Передать в доставку до:</b> ${formatMoscowDate(deadline)} (3 рабочих дня)`,
    `<b>Размер:</b> ${escapeHtml(order.canvas_size)}`,
    `<b>Кадрирование:</b> ${cropX}% по горизонтали, ${cropY}% по вертикали`,
    `<b>Эффект:</b> ${effectNames[String(order.photo_effect)] || 'Без эффекта'}`,
    `<b>Сумма:</b> ${price} ₽`,
    '',
    `<b>Клиент:</b> ${escapeHtml(order.full_name)}`,
    `<b>Телефон:</b> ${escapeHtml(order.phone)}`,
    `<b>Email:</b> ${escapeHtml(order.email || 'не указан')}`,
    `<b>Адрес:</b> ${escapeHtml(order.address)}`,
    order.comment ? `<b>Комментарий:</b> ${escapeHtml(order.comment)}` : '',
  ].filter(Boolean).join('\n');

  const telegramUrl = `https://api.telegram.org/bot${telegramToken}`;
  const sendOriginalPhoto = async (photo: Blob) => {
    const payload = new FormData();
    payload.set('chat_id', telegramChatId);
    payload.set('caption', text);
    payload.set('parse_mode', 'HTML');
    payload.set('document', photo, order.photo_path.split('/').pop() || 'canvas-photo.jpg');

    // sendDocument keeps the original file; sendPhoto would compress it.
    const result = await fetch(`${telegramUrl}/sendDocument`, { method: 'POST', body: payload });
    if (!result.ok) throw new Error(`Telegram sendDocument failed: ${result.status}`);
  };

  try {
    const { data: photo, error: photoError } = await supabase.storage.from('order-photos').download(order.photo_path);
    if (photoError || !photo) throw new Error('Order photo could not be downloaded from storage');
    await sendOriginalPhoto(photo);
  } catch (error) {
    console.error('Telegram notification failed:', error instanceof Error ? error.message : error);
    return response({ error: 'Telegram notification failed' }, 502);
  }

  const { error: updateError } = await supabase.from('orders').update({ telegram_notified_at: new Date().toISOString() }).eq('id', order.id);
  if (updateError) console.error('Could not store notification status:', updateError.message);
  return response({ sent: true });
});
