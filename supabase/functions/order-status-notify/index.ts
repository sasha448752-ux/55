import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigin = 'https://sasha448752-ux.github.io';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const statusNames: Record<string, string> = {
  new: 'Новый', in_progress: 'В работе', shipped: 'Отправлен', done: 'Готов', cancelled: 'Отменён',
};
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[character] as string));
const getServiceRoleKey = () => {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  return secretKeys ? JSON.parse(secretKeys).default : undefined;
};

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);
  if (request.headers.get('origin') !== allowedOrigin) return response({ error: 'Forbidden' }, 403);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = getServiceRoleKey();
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return response({ error: 'Notification service is unavailable' }, 503);

  const authHeader = request.headers.get('Authorization') || '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return response({ error: 'Unauthorized' }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: administrator } = await adminClient.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!administrator) return response({ error: 'Forbidden' }, 403);

  let orderId = '';
  try { ({ orderId = '' } = await request.json()); } catch { return response({ error: 'Invalid request' }, 400); }
  if (!/^[0-9a-f-]{36}$/i.test(String(orderId))) return response({ error: 'Invalid order id' }, 400);

  const { data: order, error: orderError } = await adminClient.from('orders')
    .select('id,full_name,email,canvas_size,status,status_email_sent_for')
    .eq('id', orderId)
    .single();
  if (orderError || !order) return response({ error: 'Order not found' }, 404);
  if (!order.email) return response({ skipped: 'no_email' });
  if (order.status_email_sent_for === order.status) return response({ skipped: 'already_sent' });
  if (!resendKey || !from) return response({ error: 'Email notifications are not configured' }, 503);

  const status = statusNames[order.status] || order.status;
  const orderNumber = order.id.slice(0, 8);
  const body = {
    from,
    to: [order.email],
    subject: `CANVASO: заказ №${orderNumber} — ${status}`,
    html: `<main style="font-family:Arial,sans-serif;color:#201f1d;line-height:1.5"><h2>Ваш заказ обновлён</h2><p>Здравствуйте, ${escapeHtml(order.full_name)}!</p><p>Статус заказа <b>№${escapeHtml(orderNumber)}</b>: <b>${escapeHtml(status)}</b>.</p><p>Фотохолст: ${escapeHtml(order.canvas_size)}.</p><p>Посмотреть заказ можно в <a href="https://sasha448752-ux.github.io/55/account.html">личном кабинете CANVASO</a>.</p></main>`,
  };
  const mail = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'canvaso-order-notifications/1.0',
      'Idempotency-Key': `canvaso-${order.id}-${order.status}`,
    },
    body: JSON.stringify(body),
  });
  if (!mail.ok) {
    console.error('Email provider error', mail.status);
    return response({ error: 'Email delivery failed' }, 502);
  }
  const { error: updateError } = await adminClient.from('orders').update({
    status_email_sent_for: order.status,
    status_email_sent_at: new Date().toISOString(),
  }).eq('id', order.id);
  if (updateError) console.error('Could not save email delivery status', updateError.message);
  return response({ sent: true });
});
