import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigins = new Set(['https://canvaso.ru', 'https://www.canvaso.ru', 'http://canvaso.ru', 'http://www.canvaso.ru', 'https://sasha448752-ux.github.io']);
const corsHeaders = (origin: string) => ({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' });
const json = (body: unknown, origin: string, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });
const getServiceRoleKey = () => { const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if (legacy) return legacy; const keys = Deno.env.get('SUPABASE_SECRET_KEYS'); return keys ? JSON.parse(keys).default : undefined; };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const messageText = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 2000);
const broadcast = async (url: string, key: string, token: string, message: Record<string, unknown>) => { const result = await fetch(`${url}/realtime/v1/api/broadcast`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ topic: `canvaso:chat:${token}`, event: 'message', payload: message }] }) }); if (!result.ok) console.error('Realtime broadcast failed:', result.status); };

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  if (!allowedOrigins.has(origin)) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, origin, 405);
  const url = Deno.env.get('SUPABASE_URL'); const anonKey = Deno.env.get('SUPABASE_ANON_KEY'); const serviceKey = getServiceRoleKey();
  if (!url || !anonKey || !serviceKey) return json({ error: 'Чат недоступен.' }, origin, 503);
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: request.headers.get('Authorization') || '' } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user } } = await userClient.auth.getUser(); if (!user) return json({ error: 'Unauthorized' }, origin, 401);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: administrator } = await admin.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle(); if (!administrator) return json({ error: 'Forbidden' }, origin, 403);
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return json({ error: 'Некорректный запрос.' }, origin, 400); }
  if (body.action === 'list') {
    const { data, error } = await admin.from('chat_conversations').select('visitor_token,visitor_name,visitor_contact,last_message,last_sender,last_message_at,created_at').order('last_message_at', { ascending: false }).limit(100);
    return error ? json({ error: 'Не удалось загрузить диалоги.' }, origin, 502) : json({ conversations: data || [] }, origin);
  }
  const visitorToken = String(body.conversationToken || ''); if (!uuidPattern.test(visitorToken)) return json({ error: 'Некорректный диалог.' }, origin, 400);
  const { data: conversation, error: conversationError } = await admin.from('chat_conversations').select('id').eq('visitor_token', visitorToken).single(); if (conversationError || !conversation) return json({ error: 'Диалог не найден.' }, origin, 404);
  if (body.action === 'history') {
    const { data, error } = await admin.from('chat_messages').select('id,sender,body,created_at').eq('conversation_id', conversation.id).order('created_at', { ascending: true }).limit(100);
    return error ? json({ error: 'Не удалось загрузить сообщения.' }, origin, 502) : json({ messages: data || [] }, origin);
  }
  if (body.action !== 'send') return json({ error: 'Неизвестное действие.' }, origin, 400);
  const text = messageText(body.message); if (!text) return json({ error: 'Напишите сообщение.' }, origin, 400);
  const { data: message, error } = await admin.from('chat_messages').insert({ conversation_id: conversation.id, sender: 'admin', body: text }).select('id,sender,body,created_at').single();
  if (error || !message) return json({ error: 'Не удалось отправить сообщение.' }, origin, 502);
  await admin.from('chat_conversations').update({ last_message: text, last_sender: 'admin', last_message_at: message.created_at, updated_at: message.created_at }).eq('id', conversation.id);
  await broadcast(url, serviceKey, visitorToken, message);
  return json({ sent: true, message }, origin);
});
