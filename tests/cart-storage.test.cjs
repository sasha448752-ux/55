const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../cart-storage.js'), 'utf8');
// Transaction-level fake: shared durable state survives new script instances.
function storage() {
  let value;
  return { open() {
    const request = {};
    queueMicrotask(() => {
      request.result = { transaction() {
        const tx = {};
        tx.objectStore = () => ({
          get() {
            const req = { result: structuredClone(value) };
            queueMicrotask(() => tx.oncomplete()); return req;
          },
          put(next) {
            const req = {};
            queueMicrotask(() => { value = structuredClone(next); tx.oncomplete(); });
            return req;
          },
        });
        return tx;
      } };
      request.onsuccess();
    });
    return request;
  } };
}
function page(indexedDB) {
  const context = { window: {}, indexedDB };
  vm.runInNewContext(source, context);
  return context.window.CanvasCartStore;
}
test('photo bytes and crop survive a new page instance; blob URL is not stored', async () => {
  const db = storage();
  await page(db).save([{ file: new Blob(['original-photo']), image: 'blob:expired', size: '20 × 20 см', price: 990, crop: { x: 30, y: 70 }, photoEffect: 'warm' }]);
  const [item] = await page(db).load();
  assert.equal(await item.file.text(), 'original-photo');
  assert.equal(item.crop.x, 30);
  assert.equal(item.photoEffect, 'warm');
  assert.equal(item.image, undefined);
});
test('queued delete and checkout clear do not resurrect earlier items', async () => {
  const db = storage(); const store = page(db);
  await Promise.all([store.save([{ file: new Blob(['x']), crop: {} }]), store.save([])]);
  assert.equal((await page(db).load()).length, 0);
});
test('unavailable storage rejects so UI can warn instead of silently losing photos', async () => {
  const store = page({ open() { throw new Error('Storage disabled'); } });
  await assert.rejects(store.load(), /Storage disabled/);
  await assert.rejects(store.save([]), /Storage disabled/);
});
