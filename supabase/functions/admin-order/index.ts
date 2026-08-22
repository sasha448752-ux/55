import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigins = new Set(['https://canvaso.ru', 'https://www.canvaso.ru', 'http://canvaso.ru', 'http://www.canvaso.ru', 'https://sasha448752-ux.github.io']);
const corsHeaders = (origin: string) => ({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' });
const json = (body: unknown, origin: string, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });
const getServiceRoleKey = () => {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  return keys ? JSON.parse(keys).default : undefined;
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async request => {
  const origin = request.headers.get('origin') || '';
  if (!allowedOrigins.has(origin)) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, origin, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = getServiceRoleKey();
  if (!url || !anonKey || !serviceKey) return json({ error: 'Сервис заказов временно недоступен.' }, origin, 503);

  const authorization = request.headers.get('Authorization') || '';
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Требуется вход администратора.' }, origin, 401);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: administrator } = await admin.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!administrator) return json({ error: 'Недостаточно прав.' }, origin, 403);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: 'Некорректный запрос.' }, origin, 400); }
  if (body.action !== 'delete') return json({ error: 'Неизвестное действие.' }, origin, 400);
  const orderId = String(body.orderId || '').trim();
  if (!uuidPattern.test(orderId)) return json({ error: 'Некорректный номер заказа.' }, origin, 400);

  const { data: order, error: orderError } = await admin.from('orders').select('id,status,photo_path').eq('id', orderId).maybeSingle();
  if (orderError || !order) return json({ error: 'Заказ не найден.' }, origin, 404);
  if (order.status !== 'done') return json({ error: 'Удалять можно только завершённые заказы.' }, origin, 409);

  if (order.photo_path) {
    const { error: photoError } = await admin.storage.from('order-photos').remove([order.photo_path]);
    if (photoError) return json({ error: 'Не удалось удалить фотографию заказа.' }, origin, 502);
  }
  const { error: deleteError } = await admin.from('orders').delete().eq('id', order.id);
  if (deleteError) return json({ error: 'Не удалось удалить заказ.' }, origin, 502);
  return json({ deleted: true }, origin);
});
