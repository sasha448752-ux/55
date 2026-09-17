const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../account.js'), 'utf8');
const code = source.slice(source.indexOf('let accountLoadVersion'), source.indexOf("if (!supabaseClient) setMessage"));
test('late order response cannot replace orders of a newer account', async () => {
  const pending = [];
  const ordersList = { innerHTML: '', querySelectorAll: () => [] };
  const profile = { elements: { full_name: {}, phone: {}, email: {} } };
  const context = {
    ordersList, authPanel: {}, customerPanel: {}, window: {},
    document: { querySelector: selector => selector === '#profile-form' ? profile : {} },
    supabaseClient: { from() { return { select() { return this; }, eq() { return this; }, order() { return new Promise(resolve => pending.push(resolve)); } }; } },
    renderOrder: order => order.id, loadOrderPreview() {},
  };
  vm.createContext(context); vm.runInContext(code, context);
  const first = vm.runInContext("showAccount({id:'a'})", context);
  const second = vm.runInContext("showAccount({id:'b'})", context);
  pending[1]({ data: [{id: 'new-user-order'}] }); await second;
  pending[0]({ data: [{id: 'old-user-order'}] }); await first;
  assert.equal(ordersList.innerHTML, 'new-user-order');
  const third = vm.runInContext("showAccount({id:'c'})", context);
  vm.runInContext('++accountLoadVersion;', context);
  ordersList.innerHTML = '';
  pending[2]({ data: [{id: 'signed-out-order'}] }); await third;
  assert.equal(ordersList.innerHTML, '');
});

for (const failure of ['rejected', 'null-data']) {
  test(`order loading reports ${failure} without leaving a loading indicator`, async () => {
    const ordersList = { innerHTML: '' };
    const profile = { elements: { full_name: {}, phone: {}, email: {} } };
    const context = {
      ordersList, authPanel: {}, customerPanel: {}, window: {},
      document: { querySelector: selector => selector === '#profile-form' ? profile : {} },
      supabaseClient: { from() { return {
        select() { return this; }, eq() { return this; },
        order() { return failure === 'rejected' ? Promise.reject(new Error('offline')) : Promise.resolve({data:null}); }
      }; } }
    };
    vm.createContext(context); vm.runInContext(code, context);
    await vm.runInContext("showAccount({id:'a'})", context);
    assert.match(ordersList.innerHTML, /Не удалось загрузить заказы/);
    assert.doesNotMatch(ordersList.innerHTML, /пока нет заказов|Загружаем/);
  });
}
