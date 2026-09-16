const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../admin-dashboard.js'), 'utf8');
const refreshCode = source.slice(source.indexOf('  const refresh ='), source.indexOf('  new MutationObserver'));
function summary(rows, text = '') {
  const fields = {};
  const node = () => ({ setAttribute() {}, append() {}, replaceChildren(...children) { this.children = children; } });
  const document = {
    querySelectorAll: () => rows,
    querySelector: key => fields[key] ||= { ...node(), textContent: key === '#orders' ? text : '' },
    createElement: node,
  };
  vm.runInNewContext(refreshCode + '\nrefresh();', { document });
  return fields;
}
test('dashboard distinguishes failed loading from an empty order list', () => {
  assert.equal(summary([], 'Ошибка загрузки')['#metric-total'].textContent, '—');
  assert.equal(summary([], 'Заказов пока нет.')['#metric-total'].textContent, 0);
});
test('dashboard counts loaded statuses and prices, including filtered rows', () => {
  const fields = summary([
    { dataset: { status: 'new', price: '199000' } },
    { dataset: { status: 'in_progress', price: '100000' }, hidden: true },
  ]);
  assert.equal(fields['#metric-total'].textContent, 2);
  assert.equal(fields['#metric-new'].textContent, 1);
  assert.equal(fields['#metric-progress'].textContent, 1);
  assert.equal(fields['#metric-value'].textContent.replace(/\s/g, ''), '2990₽');
  assert.equal(fields['#status-distribution'].children.length, 5);
});
test('navigation shows the selected workspace and marks the active item', () => {
  const content = { dataset: {} }, heading = {}, overview = {};
  const fields = { '#orders-column': {}, '.admin-chats': {} };
  const buttons = ['overview', 'orders', 'chats'].map(view => ({
    dataset: { view }, classList: { toggle() {} },
    setAttribute(key, value) { this[key] = value; }, removeAttribute(key) { delete this[key]; },
  }));
  const code = source.slice(source.indexOf('  const titles ='), source.indexOf("  sidebar.querySelectorAll('button').forEach(button => button.onclick"));
  const context = { content, heading, overview, sidebar: { querySelectorAll: () => buttons }, document: { querySelector: key => fields[key] } };
  vm.runInNewContext(code + "\nnavigate('chats');", context);
  assert.equal(fields['#orders-column'].hidden, true);
  assert.equal(fields['.admin-chats'].hidden, false);
  assert.equal(buttons[2]['aria-current'], 'page');
  vm.runInNewContext("navigate('orders');", context);
  assert.equal(fields['#orders-column'].hidden, false);
  assert.equal(fields['.admin-chats'].hidden, true);
  assert.equal(buttons[2]['aria-current'], undefined);
  assert.equal(overview.hidden, true);
});
