import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  // This endpoint creates authentication invitations, so it accepts calls only
  // from the published CANVASO storefront rather than every website.
  'Access-Control-Allow-Origin': 'https://sasha448752-ux.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const accountRedirectUrl = 'https://sasha448752-ux.github.io/55/set-password.html';

const serviceRoleKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || (() => {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  return keys ? JSON.parse(keys).default : undefined;
})();

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = serviceRoleKey();
  if (!supabaseUrl || !serviceKey) return response({ error: 'Account service is not configured' }, 503);

  let input: { email?: unknown; fullName?: unknown; orders?: unknown };
  try { input = await request.json(); } catch { return response({ error: 'Invalid request body' }, 400); }
  const email = String(input.email || '').trim().toLowerCase();
  const fullName = String(input.fullName || '').trim().slice(0, 120);
  const claims = Array.isArray(input.orders) ? input.orders : [];
  if (!emailPattern.test(email) || !fullName || claims.length < 1 || claims.length > 10) return response({ error: 'Invalid request' }, 400);
  const normalizedClaims = claims.map(item => ({
    orderId: String((item as Record<string, unknown>)?.orderId || ''),
    claimToken: String((item as Record<string, unknown>)?.claimToken || ''),
  }));
  if (new Set(normalizedClaims.map(item => item.orderId)).size !== normalizedClaims.length || normalizedClaims.some(item => !uuid.test(item.orderId) || !uuid.test(item.claimToken))) {
    return response({ error: 'Invalid order claim' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const orderIds = normalizedClaims.map(item => item.orderId);
  const { data: orders, error: orderError } = await admin.from('orders')
    .select('id,email,customer_id,account_claim_token')
    .in('id', orderIds);
  const validClaims = orders && orders.length === normalizedClaims.length && orders.every(order => {
    const claim = normalizedClaims.find(item => item.orderId === order.id);
    return claim && order.customer_id === null && order.account_claim_token === claim.claimToken && String(order.email || '').toLowerCase() === email;
  });
  if (orderError || !validClaims) return response({ error: 'Order claim not found' }, 404);

  const { data: invitation, error: invitationError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: accountRedirectUrl,
  });
  let customerId = invitation.user?.id;
  let invited = Boolean(customerId && !invitationError);
  if (!customerId) {
    // The email may already have an account. The order claim was validated
    // above, so it is safe to attach only those matching orders to that user.
    const { data: userPage, error: userError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existingUser = userPage?.users.find(user => String(user.email || '').toLowerCase() === email);
    if (userError || !existingUser) return response({ invited: false }, 200);
    customerId = existingUser.id;
    invited = false;
  }
  const { error: updateError } = await admin.from('orders')
    .update({ customer_id: customerId, account_claim_token: null })
    .in('id', orderIds)
    .is('customer_id', null);
  if (updateError) return response({ error: 'Could not attach orders' }, 500);
  return response({ invited });
});
