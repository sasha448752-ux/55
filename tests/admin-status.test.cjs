const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../admin.js'), 'utf8');
const code = source.slice(source.indexOf("    select.addEventListener('change'"), source.indexOf("    deleteButton.addEventListener('click'"));
for (const scenario of ['success', 'conflict', 'network', 'notification']) {
  test(`status update: ${scenario}`, async () => {
    let callback, notifications = 0; const filters = [];
    const query = { update() { return this; }, eq(k,v) { filters.push([k,v]); return this; }, select() { return this; }, async maybeSingle() {
      if (scenario === 'network') throw new Error('network');
      return { data: scenario === 'conflict' ? null : { id: 'one', status: 'shipped' } };
    } };
    const context = {
      select: { value: 'shipped', disabled: false, addEventListener(name,fn) { callback = fn; } },
      message: { classList: { remove() {} } }, order: { id: 'one', status: 'new' },
      client: { from: () => query }, element: { dataset: {}, dispatchEvent() {} }, Event: class {},
      filterOrders() {}, orderSelect: {}, deleteButton: {}, selectCheckbox: {}, selectedOrderIds: new Set(), updateBulkOrderActions() {},
      async sendStatusNotification() { notifications++; if (scenario === 'notification') throw new Error('mail'); },
    };
    vm.runInNewContext(code, context); await callback();
    assert.equal(context.select.disabled, false);
    assert.deepEqual(filters, [['id', 'one'], ['status', 'new']]);
    assert.equal(context.order.status, ['success','notification'].includes(scenario) ? 'shipped' : 'new');
    assert.equal(notifications, ['success','notification'].includes(scenario) ? 1 : 0);
    if (scenario === 'notification') assert.match(context.message.textContent, /Статус сохранён/);
  });
}
