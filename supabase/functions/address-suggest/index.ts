const allowedOrigin = 'https://sasha448752-ux.github.io';

const headers = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  Vary: 'Origin',
};

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async request => {
  const origin = request.headers.get('origin');
  if (origin !== allowedOrigin) return respond({ error: 'Forbidden' }, 403);
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);

  const token = Deno.env.get('DADATA_API_KEY');
  if (!token) {
    console.error('DaData API key is not configured.');
    return respond({ error: 'Address suggestions are temporarily unavailable' }, 503);
  }

  let query = '';
  try {
    ({ query = '' } = await request.json());
  } catch {
    return respond({ error: 'Invalid request body' }, 400);
  }
  if (typeof query !== 'string' || query.trim().length < 3 || query.length > 300) {
    return respond({ error: 'Invalid address query' }, 400);
  }

  try {
    const apiResponse = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
      method: 'POST',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: query.trim(), count: 5, locations: [{ country: 'Россия' }] }),
    });
    if (!apiResponse.ok) {
      console.error('DaData returned status', apiResponse.status);
      return respond({ error: 'Address suggestions are temporarily unavailable' }, 502);
    }
    const data = await apiResponse.json();
    const suggestions = Array.isArray(data?.suggestions)
      ? data.suggestions.map((item: { value?: unknown }) => ({ value: String(item?.value ?? '').slice(0, 300) })).filter((item: { value: string }) => item.value)
      : [];
    return respond({ suggestions });
  } catch (error) {
    console.error('DaData request failed', error instanceof Error ? error.message : 'Unknown error');
    return respond({ error: 'Address suggestions are temporarily unavailable' }, 502);
  }
});
