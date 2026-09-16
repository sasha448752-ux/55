const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../admin.js'), 'utf8');
const code = source.slice(source.indexOf('function filterOrders()'), source.indexOf("filters.addEventListener('input'"));
test('hidden and unfinished orders are removed from bulk selection', () => {
  const rows = ['visible', 'hidden', 'unfinished'].map((id, i) => ({
    dataset: { orderId: id, search: i === 1 ? 'other' : 'match', status: i === 2 ? 'new' : 'done', date: '2026-09-16', price: '99000' },
    checkbox: { checked: true }, querySelector() { return this.checkbox; },
  }));
  const selectedOrderIds = new Set(rows.map(r => r.dataset.orderId));
  const fields = { '#order-search': { value: 'match' }, '#order-status-filter': { value: '' }, '#order-date-from': { value: '' }, '#order-date-to': { value: '' }, '#order-summary': {} };
  let refreshed = false;
  vm.runInNewContext(code + '\nfilterOrders();', {
    selectedOrderIds, list: { querySelectorAll: () => rows },
    document: { querySelector: selector => fields[selector] },
    updateBulkOrderActions() { refreshed = true; },
  });
  assert.deepEqual([...selectedOrderIds], ['visible']);
  assert.equal(rows[1].checkbox.checked, false);
  assert.equal(rows[2].checkbox.checked, false);
  assert.equal(refreshed, true);
  assert.match(fields['#order-summary'].textContent, /Показано: 2/);
});
