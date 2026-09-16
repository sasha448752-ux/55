const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
const code = source.slice(source.indexOf('const addToCart = async'), source.indexOf("document.querySelector('.add-to-cart').addEventListener"));
for (const scenario of ['valid', 'missing', 'loading', 'too-small', 'zero-price']) {
  test(`cart quality: ${scenario}`, async () => {
    const file = {};
    const context = {
      cartReady: Promise.resolve(), checkoutSubmitting: false,
      input: { files: scenario === 'missing' ? [] : [file] },
      readyPhotoFile: scenario === 'loading' ? null : file,
      size: { disabled: scenario === 'too-small' },
      availablePhotoSizes: ['60 × 40 см'], sizeLabel: { textContent: '60 × 40 см' },
      price: { textContent: scenario === 'zero-price' ? '—' : '1990' },
      priceNumber: text => Number(text) || 0,
      cartPhotoUrls: new Set(), preview: { src: 'blob:test' }, cart: [],
      cropPosition: { x: 50, y: 50 }, activePhotoEffect: 'none',
      alert() {}, renderCart() {}, async persistCart() {},
    };
    vm.createContext(context);
    const added = await vm.runInContext(code + '\naddToCart()', context);
    assert.equal(added, scenario === 'valid');
    assert.equal(context.cart.length, scenario === 'valid' ? 1 : 0);
  });
}
