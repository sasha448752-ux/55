const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
const code = source.slice(source.indexOf('const cartReady ='), source.indexOf('const addToCart ='));
async function restore(load) {
  let rendered = 0, warned = 0;
  const context = {
    window: { CanvasCartStore: { load } }, Blob,
    URL: { createObjectURL: () => 'blob:new-page' },
    cartPhotoUrls: new Set(), cart: [], prices: { '60 × 40 см': '1 990 ₽' },
    priceNumber: value => Number(value.replace(/\D/g, '')),
    renderCart() { rendered++; }, warnCartStorage() { warned++; },
  };
  await vm.runInNewContext(code + '\ncartReady;', context);
  return { ...context, rendered, warned };
}
test('page restore recreates photo URL and preserves crop, effect and size with current price', async () => {
  const file = new Blob(['photo-bytes'], { type: 'image/png' });
  const result = await restore(async () => [{ file, size: '60 × 40 см', crop: { x: 23, y: 78 }, photoEffect: 'warm', price: 1, image: 'blob:expired' }]);
  const [item] = result.cart;
  assert.equal(await item.file.text(), 'photo-bytes');
  assert.equal(item.image, 'blob:new-page');
  assert.equal(item.crop.x, 23);
  assert.equal(item.crop.y, 78);
  assert.equal(item.photoEffect, 'warm');
  assert.equal(item.size, '60 × 40 см');
  assert.equal(item.price, 1990);
  assert.equal(result.rendered, 1);
  assert.equal(result.warned, 0);
});
test('page restore skips missing photos and unavailable sizes', async () => {
  const result = await restore(async () => [
    { file: null, size: '60 × 40 см' },
    { file: new Blob([]), size: '60 × 40 см' },
    { file: new Blob(['photo']), size: 'unknown' },
  ]);
  assert.equal(result.cart.length, 0);
  assert.equal(result.rendered, 1);
});
test('page restore warns on storage failure without blocking startup', async () => {
  const result = await restore(async () => { throw new Error('Storage unavailable'); });
  assert.equal(result.warned, 1);
  assert.equal(result.cart.length, 0);
});
