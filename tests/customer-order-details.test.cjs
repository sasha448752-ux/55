const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.events = {}; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute() {}
  addEventListener(key, fn) { this.events[key] = fn; }
}
const all = el => [el, ...el.children.flatMap(all)];
async function fixture(fail = false) {
  const calls = [], window = {}, details = new Element('details');
  const client = { from(table) {
    const call = { table }; calls.push(call);
    const chain = { select() { return chain; }, eq(k,v) { call[k] = v; return chain; }, order() { return chain; }, limit() { return chain; }, maybeSingle() { return chain; }, then(resolve,reject) {
      return Promise.resolve(fail ? { error: {} } : { data: table === 'order_delivery' ? { carrier: '<img onerror=bad>', tracking_number: 'TRACK-1' } : [] }).then(resolve,reject);
    } }; return chain;
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../customer-order-details.js'), 'utf8'), { window, document: { createElement: tag => new Element(tag) } });
  window.CanvasCustomerOrderDetails.attach(details, client, 'own-order');
  const button = all(details).find(el => el.tag === 'button'); await button.onclick();
  return { details, calls, button };
}
test('customer reads only delivery/history filtered by order, renders text safely', async () => {
  const { details, calls } = await fixture();
  assert.deepEqual(calls.map(c => c.table), ['order_delivery','order_status_history']);
  assert.ok(calls.every(c => c.order_id === 'own-order'));
  assert.ok(all(details).some(el => el.textContent?.includes('TRACK-1')));
  assert.equal(all(details).filter(el => el.tag === 'img').length, 0);
});
test('customer can retry errors without false empty-state success', async () => {
  const { details, button } = await fixture(true);
  assert.equal(button.disabled, false);
  assert.ok(all(details).some(el => el.textContent?.includes('Не удалось обновить')));
});
