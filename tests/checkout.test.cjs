const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
const handler = source.slice(source.indexOf("document.querySelector('#checkout-form').addEventListener('submit'"), source.indexOf("document.querySelector('.menu-toggle')"));

function setup({ failPhoto = 0, failSession = false, pause = false, failInsert = false } = {}) {
  let submitHandler, photoCount = 0, release, nextId = 0;
  const batches = [];
  const calls = [];
  const button = { disabled: false };
  const form = { querySelector: () => button, reset: () => calls.push('reset') };
  const cart = [1, 2].map(n => ({ file: n, size: '20x20', price: 990 }));
  const context = {
    cart, checkoutSubmitting: false, checkoutAttempts: new WeakMap(),
    document: { querySelector: () => ({ addEventListener: (_, fn) => { submitHandler = fn; } }) },
    FormData: class { get(key) { return key === 'email' ? 'test@example.test' : 'Test'; } },
    checkoutStatus: { textContent: '', classList: { add() {}, remove() {} } },
    createConversationToken: () => `id-${++nextId}`,
    createPrintFile: async () => {
      calls.push('prepare');
      if (++photoCount === failPhoto) throw new Error('Invalid photo');
      return { name: 'photo.jpg', type: 'image/jpeg', size: 100 };
    },
    renderCart() {}, async persistCart() {}, closeCheckout() {}, closeCart() {}, setTimeout() {}, console,
    window: { SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'test', supabase: { createClient: () => ({
      auth: { getSession: async () => {
        if (pause) await new Promise(resolve => { release = resolve; });
        if (failSession) throw new Error('Network failure');
        return { data: { session: null } };
      } },
      storage: { from: () => ({ upload: async () => { calls.push('upload'); return {}; } }) },
      from: () => ({ insert: async rows => {
        calls.push('insert'); batches.push(JSON.parse(JSON.stringify(rows)));
        if (failInsert) return { error: { code: '23505', message: 'duplicate key' } };
        return {};
      } }),
      functions: { invoke: async () => ({}) },
    }) } },
  };
  vm.runInNewContext(handler, context);
  return { context, calls, button, batches, submit: () => {
    const event = { preventDefault() {}, currentTarget: form };
    const result = submitHandler(event);
    event.currentTarget = null; // Browser Event.currentTarget expires after dispatch.
    return result;
  }, release: () => release() };
}

test('prepares all photos before any upload, completes and resets the form', async () => {
  const h = setup(); await h.submit();
  assert.deepEqual(h.calls, ['prepare', 'prepare', 'upload', 'upload', 'insert', 'reset']);
  assert.equal(h.batches[0].length, 2);
  assert.equal(h.context.cart.length, 0);
  assert.equal(h.button.disabled, false);
});
test('bad second photo creates no remote order and preserves the cart', async () => {
  const h = setup({ failPhoto: 2 }); await h.submit();
  assert.deepEqual(h.calls, ['prepare', 'prepare']);
  assert.equal(h.context.cart.length, 2);
  assert.equal(h.button.disabled, false);
});
test('network failure releases submit lock', async () => {
  const h = setup({ failSession: true }); await h.submit();
  assert.equal(h.context.checkoutSubmitting, false);
  assert.equal(h.button.disabled, false);
  assert.equal(h.context.cart.length, 2);
});
test('a second submission while awaiting session is ignored', async () => {
  const h = setup({ pause: true }); const first = h.submit();
  await h.submit(); assert.equal(h.calls.length, 0);
  h.release(); await first;
  assert.equal(h.calls.filter(c => c === 'insert').length, 1);
});
test('retry keeps IDs and claim tokens and does not reupload confirmed files', async () => {
  const h = setup({ failInsert: true });
  await h.submit(); await h.submit();
  assert.deepEqual(h.batches[0], h.batches[1]);
  assert.equal(h.calls.filter(c => c === 'upload').length, 2);
  assert.equal(h.context.cart.length, 2);
  assert.ok(h.context.checkoutStatus.textContent.includes('возможно, уже принят'));
  assert.ok(!h.calls.includes('reset'));
});
