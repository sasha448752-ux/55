const allowedOrigins = new Set([
  'https://canvaso.ru',
  'https://www.canvaso.ru',
  'http://canvaso.ru',
  'http://www.canvaso.ru',
  'https://sasha448752-ux.github.io',
]);

const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});
const json = (body: unknown, origin: string, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
});

type RateLimit = { requests: number; resetAt: number };
const limits = new Map<string, RateLimit>();
const rateLimitWindowMs = 15 * 60 * 1000;
const maxRequestsPerWindow = 5;
const normalize = (value: unknown, maxLength: number) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength);

const isRateLimited = (clientKey: string) => {
  const now = Date.now();
  for (const [key, value] of limits) if (value.resetAt <= now) limits.delete(key);
  const current = limits.get(clientKey);
  if (!current || current.resetAt <= now) {
    limits.set(clientKey, { requests: 1, resetAt: now + rateLimitWindowMs });
    return false;
  }
  current.requests += 1;
  return current.requests > maxRequestsPerWindow;
};

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  if (!allowedOrigins.has(origin)) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, origin, 405);

  const clientKey = (request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown').split(',')[0].trim();
  if (isRateLimited(clientKey)) return json({ error: 'Слишком много сообщений. Попробуйте через 15 минут.' }, origin, 429);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: 'Некорректный запрос.' }, origin, 400); }
  if (normalize(body.website, 100)) return json({ sent: true }, origin);

  const name = normalize(body.name, 80) || 'Не указано';
  const contact = normalize(body.contact, 160) || 'Не указан';
  const message = normalize(body.message, 2000);
  if (!message) return json({ error: 'Напишите сообщение.' }, origin, 400);

  const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const telegramChatId = Deno.env.get('TELEGRAM_CHAT_ID');
  if (!telegramToken || !telegramChatId) return json({ error: 'Чат временно не настроен.' }, origin, 503);

  const sentAt = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date());
  const telegramMessage = [
    '💬 Новое сообщение с сайта CANVASO',
    `Время: ${sentAt} (МСК)`,
    `Имя: ${name}`,
    `Контакт: ${contact}`,
    '',
    message,
  ].join('\n');

  try {
    const telegram = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramChatId, text: telegramMessage, disable_web_page_preview: true }),
    });
    if (!telegram.ok) throw new Error(`Telegram API returned ${telegram.status}`);
  } catch (error) {
    console.error('Chat notification error:', error instanceof Error ? error.message : error);
    return json({ error: 'Не удалось передать сообщение. Попробуйте позже.' }, origin, 502);
  }
  return json({ sent: true }, origin);
});
