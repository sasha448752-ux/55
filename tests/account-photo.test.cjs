const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../account.js'), 'utf8');
const code = source.slice(source.indexOf('const loadOrderPreview'), source.indexOf('let accountLoadVersion'));
for (const mode of ['network', 'denied', 'detached', 'success', 'image-error']) {
  test(`photo preview: ${mode}`, async () => {
    const classes = new Set(['is-loading']);
    const frame = { isConnected: true, textContent: '', classList: { remove: x => classes.delete(x), add: x => classes.add(x) }, replaceChildren(image) { this.image = image; } };
    const context = {
      document: { querySelector: () => frame }, Image: class {},
      supabaseClient: { storage: { from: () => ({ async createSignedUrl() {
        if (mode === 'network') throw new Error('offline');
        if (mode === 'denied') return { error: new Error('denied') };
        if (mode === 'detached') frame.isConnected = false;
        return { data: { signedUrl: 'https://example.test/private-photo' } };
      } }) } }
    };
    vm.createContext(context); vm.runInContext(code, context);
    await vm.runInContext("loadOrderPreview({id:'test-order',photo_path:'photo'}, 0)", context);
    if (mode === 'image-error') frame.image.onerror();
    if (['network', 'denied', 'image-error'].includes(mode)) {
      assert.equal(frame.textContent, 'Фото пока недоступно');
      assert.equal(classes.has('is-loading'), false);
    } else if (mode === 'detached') assert.equal(frame.image, undefined);
    else { assert.match(frame.image.src, /^https:/); frame.image.onload(); assert.equal(classes.has('is-loading'), false); }
  });
}
