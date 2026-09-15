const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
test('server draft covers exactly all 30 displayed formats at the same price', () => {
  const source = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
  const literal = source.match(/const prices = (\{[^;]+\});/)[1];
  const prices = vm.runInNewContext(`(${literal})`);
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/price-guard.draft.sql'), 'utf8');
  const rows = [...sql.matchAll(/\('([^']+)', (\d+)\)/g)];
  assert.equal(rows.length, 30);
  assert.equal(new Set(rows.map(row => row[1])).size, 30);
  assert.deepEqual(Object.fromEntries(rows.map(row => [row[1], Number(row[2])])),
    Object.fromEntries(Object.entries(prices).map(([size, price]) => [size, Number(price.replace(/\D/g, '')) * 100])));
});
