const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.events = {}; this.value = ''; this.textContent = ''; }
  append(...nodes) { this.children.push(...nodes); }
  prepend(...nodes) { this.children.unshift(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute() {}
  addEventListener(name, handler) { this.events[name] = handler; }
  find(tag) { return this.children.flatMap(child => [ ...(child.tag === tag ? [child] : []), ...child.find(tag)]); }
}
async function setup(respond = () => null, cryptoOverride) {
  const calls = []; let ids = 0;
  const client = { from(table) {
    const call = { table, operation: 'select', filters: [] };
    const chain = {
      select() { return chain; }, order() { return chain; }, limit() { return chain; },
      eq(key, value) { call.filters.push([key, value]); return chain; },
      insert(data) { call.operation = 'insert'; call.data = { ...data }; return chain; },
      upsert(data) { call.operation = 'upsert'; call.data = { ...data }; return chain; },
      single() { return chain; }, maybeSingle() { return chain; },
      then(resolve, reject) {
        calls.push(call);
        const fallback = call.operation === 'select' ? (table === 'order_delivery' ? {} : []) : { order_id: 'order-1' };
        return Promise.resolve(respond(call) || { data: fallback, error: null }).then(resolve, reject);
      },
    }; return chain;
  } };
  const window = {}, host = new Element('article');
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../admin-order-details.js'), 'utf8'), {
    window, document: { createElement: tag => new Element(tag) }, crypto: cryptoOverride || { randomUUID: () => `note-${++ids}` },
  });
  window.CanvasOrderDetails.attach(host, client, 'order-1');
  const details = host.children[0]; details.open = true; details.events.toggle();
  await new Promise(resolve => setImmediate(resolve));
  return { host, calls, forms: host.find('form'), inputs: host.find('input'), text: host.find('textarea')[0] };
}
const submit = form => form.onsubmit({ preventDefault() {} });
test('note ID works without secure-context randomUUID and remains UUID v4', async () => {
  const s = await setup(() => null, { getRandomValues: bytes => { bytes.fill(171); return bytes; } });
  s.text.value = 'test'; await submit(s.forms[1]);
  assert.match(s.calls.find(c => c.operation === 'insert').data.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
test('admin loads details before orders and includes stylesheet; customer page does not load notes', () => {
  const html = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
  assert.ok(html.indexOf('admin-order-details.js') < html.indexOf('src="admin.js'));
  assert.match(html, /admin-order-details\.css/);
  const admin = fs.readFileSync(path.join(__dirname, '../admin.js'), 'utf8');
  assert.match(admin, /CanvasOrderDetails\.attach\(element, client, order\.id\)/);
  assert.match(admin, /dispatchEvent\(new Event\('order-status-saved'\)\)/);
  const account = fs.readFileSync(path.join(__dirname, '../account.html'), 'utf8');
  assert.doesNotMatch(account, /admin-order-details/);
});
test('note saving and history refresh preserve unsaved delivery fields', async () => {
  const s = await setup(); s.inputs[0].value = 'unsaved carrier'; s.text.value = '<img src=x onerror=alert(1)>';
  await submit(s.forms[1]);
  assert.equal(s.inputs[0].value, 'unsaved carrier');
  assert.equal(s.host.find('input')[0], s.inputs[0]);
  assert.equal(s.text.value, '');
  assert.match(s.host.find('li')[0].textContent, /<img/);
  assert.equal(s.host.find('img').length, 0);
  s.text.value = 'draft note'; s.host.events['order-status-saved']();
  await s.host.find('button').find(b => b.textContent === 'Обновить историю').onclick();
  assert.equal(s.text.value, 'draft note');
  assert.equal(s.host.find('input')[0].value, 'unsaved carrier');
});
test('failed delivery save retains input and re-enables submit', async () => {
  const s = await setup(call => call.operation === 'upsert' ? { error: { code: 'network' } } : null);
  s.inputs[1].value = 'TRACK'; await submit(s.forms[0]);
  assert.equal(s.inputs[1].value, 'TRACK');
  assert.equal(s.forms[0].find('button')[0].disabled, false);
});
test('lost note response retry keeps ID and checks duplicate ownership', async () => {
  let count = 0;
  const s = await setup(call => {
    if (call.operation === 'insert') return { error: { code: ++count === 1 ? 'network' : '23505' } };
    if (call.filters.some(([key]) => key === 'id')) return { data: { id: 'note-1', body: 'hello' } };
    return null;
  });
  s.text.value = 'hello'; await submit(s.forms[1]); assert.equal(s.text.value, 'hello');
  await submit(s.forms[1]); assert.equal(s.text.value, '');
  const inserts = s.calls.filter(c => c.operation === 'insert');
  assert.equal(inserts[0].data.id, inserts[1].data.id);
  assert.ok(s.calls.some(c => c.filters.some(([k,v]) => k === 'id' && v === 'note-1') && c.filters.some(([k,v]) => k === 'order_id' && v === 'order-1')));
});
