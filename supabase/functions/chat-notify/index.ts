import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigins = new Set(['https://canvaso.ru', 'https://www.canvaso.ru', 'http://canvaso.ru', 'http://www.canvaso.ru', 'https://sasha448752-ux.github.io']);
const corsHeaders = (origin: string) => ({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' });
const json = (body: unknown, origin: string, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });
const getServiceRoleKey = () => { const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if (legacy) return legacy; const keys = Deno.env.get('SUPABASE_SECRET_KEYS'); return keys ? JSON.parse(keys).default : undefined; };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const normalize = (value: unknown, maxLength: number) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
type RateLimit = { requests: number; resetAt: number };
const limits = new Map<string, RateLimit>();
const isRateLimited = (clientKey: string) => {
  const now = Date.now(); for (const [key, value] of limits) if (value.resetAt <= now) limits.delete(key);
  const current = limits.get(clientKey);
  if (!current || current.resetAt <= now) { limits.set(clientKey, { requests: 1, resetAt: now + 15 * 60 * 1000 }); return false; }
  current.requests += 1; return current.requests > 8;
};
const broadcast = async (url: string, key: string, token: string, message: Record<string, unknown>) => {
  const result = await fetch(`${url}/realtime/v1/api/broadcast`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ topic: `canvaso:chat:${token}`, event: 'message', payload: message }] }) });
  if (!result.ok) console.error('Realtime broadcast failed:', result.status);
};

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  if (!allowedOrigins.has(origin)) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, origin, 405);
  const clientKey = (request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown').split(',')[0].trim();
  if (isRateLimited(clientKey)) return json({ error: 'Слишком много сообщений. Попробуйте через 15 минут.' }, origin, 429);
  const url = Deno.env.get('SUPABASE_URL'); const serviceKey = getServiceRoleKey();
  if (!url || !serviceKey) return json({ error: 'Чат временно недоступен.' }, origin, 503);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return json({ error: 'Некорректный запрос.' }, origin, 400); }
  if (normalize(body.website, 100)) return json({ sent: true }, origin);
  const visitorToken = normalize(body.conversationToken, 50);
  if (!uuidPattern.test(visitorToken)) return json({ error: 'Не удалось открыть диалог. Обновите страницу.' }, origin, 400);
  if (body.action === 'history') {
    const { data: conversation } = await admin.from('chat_conversations').select('id').eq('visitor_token', visitorToken).maybeSingle();
    if (!conversation) return json({ messages: [] }, origin);
    const { data: messages, error } = await admin.from('chat_messages').select('id,sender,body,created_at').eq('conversation_id', conversation.id).order('created_at', { ascending: true }).limit(100);
    return error ? json({ error: 'Не удалось загрузить сообщения.' }, origin, 502) : json({ messages: messages || [] }, origin);
  }
  const name = normalize(body.name, 80) || null; const contact = normalize(body.contact, 160) || null; const text = normalize(body.message, 2000);
  if (!text) return json({ error: 'Напишите сообщение.' }, origin, 400);
  const { error: insertConversationError } = await admin.from('chat_conversations').upsert({ visitor_token: visitorToken, visitor_name: name, visitor_contact: contact }, { onConflict: 'visitor_token', ignoreDuplicates: true });
  if (insertConversationError) return json({ error: 'Не удалось открыть диалог.' }, origin, 502);
  const { data: conversation, error: conversationError } = await admin.from('chat_conversations').select('id').eq('visitor_token', visitorToken).single();
  if (conversationError || !conversation) return json({ error: 'Не удалось открыть диалог.' }, origin, 502);
  const { data: message, error: messageError } = await admin.from('chat_messages').insert({ conversation_id: conversation.id, sender: 'visitor', body: text }).select('id,sender,body,created_at').single();
  if (messageError || !message) return json({ error: 'Не удалось сохранить сообщение.' }, origin, 502);
  await admin.from('chat_conversations').update({ last_message: text, last_sender: 'visitor', last_message_at: message.created_at, updated_at: message.created_at, visitor_name: name, visitor_contact: contact }).eq('id', conversation.id);
  await broadcast(url, serviceKey, visitorToken, message);
  const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN'); const telegramChatId = Deno.env.get('TELEGRAM_CHAT_ID');
  if (telegramToken && telegramChatId) {
    const sentAt = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date());
    const telegramText = ['💬 Новое сообщение CANVASO', `Время: ${sentAt} (МСК)`, `Имя: ${name || 'Не указано'}`, `Контакт: ${contact || 'Не указан'}`, '', text].join('\n');
    const telegram = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: telegramChatId, text: telegramText, disable_web_page_preview: true }) });
    if (!telegram.ok) console.error('Telegram chat notification failed:', telegram.status);
  }
  return json({ sent: true, message, conversationToken: visitorToken }, origin);
});
