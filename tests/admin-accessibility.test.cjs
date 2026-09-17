const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
test('admin login and message inputs have persistent associated labels', () => {
  for (const id of ['admin-email', 'admin-password', 'admin-message-input']) {
    assert.match(html, new RegExp('<label[^>]*for="' + id + '"[^>]*>[^<]+</label>'));
    assert.match(html, new RegExp('<(?:input|textarea)[^>]*id="' + id + '"'));
  }
  assert.match(html, /id="login-error" role="alert"/);
  assert.match(html, /autocomplete="current-password"/);
});
test('admin keyboard focus covers form fields and details', () => {
  const css = fs.readFileSync(path.join(__dirname, '../admin-dashboard.css'), 'utf8');
  for (const tag of ['input', 'select', 'textarea', 'summary']) assert.ok(css.includes(tag + ':focus-visible'));
});
