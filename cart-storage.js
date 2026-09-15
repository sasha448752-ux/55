// IndexedDB stores original photo Blobs; blob: URLs cannot survive a reload.
window.CanvasCartStore = (() => {
  let database;
  let pending = Promise.resolve();
  const open = () => database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('canvaso-cart', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('cart');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Cart storage blocked'));
  });
  const transaction = async (mode, value) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cart', mode);
      const store = tx.objectStore('cart');
      const request = mode === 'readonly' ? store.get('items') : store.put(value, 'items');
      tx.oncomplete = () => resolve(mode === 'readonly' ? request.result || [] : undefined);
      tx.onabort = () => reject(tx.error || new Error('Cart storage aborted'));
      tx.onerror = () => reject(tx.error);
    });
  };
  return {
    load: () => transaction('readonly'),
    save(items) {
      const snapshot = items.map(({ file, size, price, priceText, crop, photoEffect }) =>
        ({ file, size, price, priceText, crop: { ...crop }, photoEffect }));
      pending = pending.catch(() => {}).then(() => transaction('readwrite', snapshot));
      return pending;
    },
  };
})();
