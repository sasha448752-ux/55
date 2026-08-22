const input = document.querySelector('#photo-input');
const preview = document.querySelector('#preview-image');
const canvas = document.querySelector('.canvas-preview');
const size = document.querySelector('#size');
const price = document.querySelector('#price');
const sizeLabel = document.querySelector('#size-label');
const prices = {'20 × 20 см':'990 ₽','30 × 20 см':'1 190 ₽','20 × 30 см':'1 190 ₽','30 × 30 см':'1 390 ₽','40 × 30 см':'1 490 ₽','30 × 40 см':'1 490 ₽','40 × 40 см':'1 690 ₽','50 × 40 см':'1 790 ₽','40 × 50 см':'1 790 ₽','50 × 50 см':'2 290 ₽','60 × 40 см':'1 990 ₽','40 × 60 см':'1 990 ₽','60 × 45 см':'2 190 ₽','45 × 60 см':'2 190 ₽','60 × 60 см':'2 990 ₽','70 × 50 см':'2 590 ₽','50 × 70 см':'2 590 ₽','70 × 70 см':'3 890 ₽','80 × 60 см':'3 190 ₽','60 × 80 см':'3 190 ₽','80 × 80 см':'4 890 ₽','90 × 60 см':'3 590 ₽','60 × 90 см':'3 590 ₽','100 × 70 см':'4 690 ₽','70 × 100 см':'4 690 ₽','100 × 100 см':'6 490 ₽','120 × 80 см':'5 990 ₽','80 × 120 см':'5 990 ₽','140 × 100 см':'7 490 ₽','100 × 140 см':'7 490 ₽'};
const getDimensions = value => value.match(/\d+/g).slice(0, 2).map(Number);
const priceByDimensions = {'20x20':'990 ₽','30x20':'1 190 ₽','20x30':'1 190 ₽','30x30':'1 390 ₽','40x30':'1 490 ₽','30x40':'1 490 ₽','40x40':'1 690 ₽','50x40':'1 790 ₽','40x50':'1 790 ₽','50x50':'2 290 ₽','60x40':'1 990 ₽','40x60':'1 990 ₽','60x45':'2 190 ₽','45x60':'2 190 ₽','60x60':'2 990 ₽','70x50':'2 590 ₽','50x70':'2 590 ₽','70x70':'3 890 ₽','80x60':'3 190 ₽','60x80':'3 190 ₽','80x80':'4 890 ₽','90x60':'3 590 ₽','60x90':'3 590 ₽','100x70':'4 690 ₽','70x100':'4 690 ₽','100x100':'6 490 ₽','120x80':'5 990 ₽','80x120':'5 990 ₽','140x100':'7 490 ₽','100x140':'7 490 ₽'};
const priceFor = value => priceByDimensions[`${getDimensions(value).join('x')}`] || '—';
const setCanvasFormat = value => {
  const [width, height] = getDimensions(value);
  canvas.style.setProperty('--canvas-ratio', `${width} / ${height}`);
  const format = width === height ? 'square' : width > height ? 'landscape' : 'portrait';
  document.querySelectorAll('.orientation button').forEach(button => button.classList.toggle('active', button.dataset.orientation === format));
};
const sizeHint = document.querySelector('#size-hint');
const photoEffects = {
  none: 'none',
  black_white: 'grayscale(1)',
  warm: 'sepia(.28) saturate(1.16) brightness(1.04)',
  vintage: 'sepia(.42) saturate(.78) contrast(.9) brightness(1.06)',
  contrast: 'contrast(1.18) saturate(1.12)',
};
let activePhotoEffect = 'none';
const applyPhotoEffect = () => { preview.style.filter = photoEffects[activePhotoEffect] || 'none'; };
const createPrintFile = (file, effect, canvasSize, crop) => {
  if (!file) return Promise.reject(new Error('Не удалось прочитать фотографию.'));
  return new Promise((resolve, reject) => {
    const source = new Image();
    const sourceUrl = URL.createObjectURL(file);
    const dispose = () => URL.revokeObjectURL(sourceUrl);
    source.onload = () => {
      const [canvasWidth, canvasHeight] = getDimensions(canvasSize);
      const targetRatio = canvasWidth / canvasHeight;
      const sourceRatio = source.naturalWidth / source.naturalHeight;
      let cropWidth = source.naturalWidth;
      let cropHeight = source.naturalHeight;
      let cropX = 0;
      let cropY = 0;
      const positionX = clampCrop(crop?.x ?? 50) / 100;
      const positionY = clampCrop(crop?.y ?? 50) / 100;
      if (sourceRatio > targetRatio) {
        cropWidth = source.naturalHeight * targetRatio;
        cropX = (source.naturalWidth - cropWidth) * positionX;
      } else if (sourceRatio < targetRatio) {
        cropHeight = source.naturalWidth / targetRatio;
        cropY = (source.naturalHeight - cropHeight) * positionY;
      }
      const printCanvas = document.createElement('canvas');
      // Keep every source pixel in the selected print area. No resizing and
      // no JPEG recompression are used.
      printCanvas.width = Math.round(cropWidth);
      printCanvas.height = Math.round(cropHeight);
      const context = printCanvas.getContext('2d', { alpha: false });
      if (!context) { dispose(); reject(new Error('Не удалось подготовить фотографию.')); return; }
      context.filter = photoEffects[effect] || 'none';
      context.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, printCanvas.width, printCanvas.height);
      dispose();
      // PNG is lossless: only the requested visual effect changes the pixels.
      printCanvas.toBlob(blob => {
        if (!blob) { reject(new Error('Не удалось применить эффект.')); return; }
        const name = `${file.name.replace(/\.[^.]+$/, '') || 'canvaso-photo'}-canvaso.png`;
        resolve(new File([blob], name, { type: 'image/png', lastModified: file.lastModified }));
      }, 'image/png');
    };
    source.onerror = () => { dispose(); reject(new Error('Не удалось прочитать фотографию.')); };
    source.src = sourceUrl;
  });
};
const allSizes = [...size.options]
  .map(option => option.value)
  .sort((first, second) => {
    const [firstWidth, firstHeight] = getDimensions(first);
    const [secondWidth, secondHeight] = getDimensions(second);
    // Keep the menu easy to scan: small canvases first, then larger ones.
    return firstWidth * firstHeight - secondWidth * secondHeight
      || Math.max(firstWidth, firstHeight) - Math.max(secondWidth, secondHeight)
      || firstWidth - secondWidth;
  });
const printDpi = 120;
const formatFor = (width, height) => width === height ? 'square' : width > height ? 'landscape' : 'portrait';
const requiredPixels = centimeters => Math.ceil(centimeters / 2.54 * printDpi);
const minimumCropRetention = .75;
const orientationNames = { landscape: 'горизонтальном', portrait: 'вертикальном', square: 'квадратном' };
let availablePhotoSizes = allSizes;
const showSizesForOrientation = (orientation, preferredValue) => {
  const values = availablePhotoSizes.filter(value => {
    const [width, height] = getDimensions(value);
    return formatFor(width, height) === orientation;
  });
  if (!values.length) return;
  size.replaceChildren(...values.map(value => new Option(value, value)));
  size.disabled = false;
  size.value = values.includes(preferredValue) ? preferredValue : values[0];
  if (activeImageSize) {
    sizeHint.textContent = `В ${orientationNames[orientation]} направлении: ${values.length}. Показаны размеры без сильной обрезки; кадр можно сместить перетаскиванием.`;
  }
  size.dispatchEvent(new Event('change'));
};
let activePhotoUrl = null;
let activeImageSize = null;
let cropPosition = { x: 50, y: 50 };
let cropDrag = null;
const cropControls = document.querySelector('#crop-controls');
const resetCropButton = document.querySelector('#reset-crop');
const clampCrop = value => Math.max(0, Math.min(100, value));
const applyCrop = () => {
  preview.style.objectPosition = `${cropPosition.x}% ${cropPosition.y}%`;
};
const resetCrop = () => {
  if (cropDrag && canvas.hasPointerCapture?.(cropDrag.id)) canvas.releasePointerCapture(cropDrag.id);
  cropDrag = null;
  canvas.classList.remove('crop-dragging');
  cropPosition = { x: 50, y: 50 };
  applyCrop();
  canvas.focus({ preventScroll: true });
};
const cropOverflow = () => {
  if (!activeImageSize) return { x: 0, y: 0 };
  const rect = preview.getBoundingClientRect();
  const scale = Math.max(rect.width / activeImageSize.width, rect.height / activeImageSize.height);
  return {
    x: Math.max(0, activeImageSize.width * scale - rect.width),
    y: Math.max(0, activeImageSize.height * scale - rect.height),
  };
};
canvas.addEventListener('pointerdown', event => {
  if (!activeImageSize || (event.pointerType === 'mouse' && event.button !== 0)) return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  cropDrag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, cropX: cropPosition.x, cropY: cropPosition.y };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('crop-dragging');
});
canvas.addEventListener('pointermove', event => {
  if (!cropDrag || cropDrag.id !== event.pointerId) return;
  const overflow = cropOverflow();
  if (overflow.x) cropPosition.x = clampCrop(cropDrag.cropX - ((event.clientX - cropDrag.startX) / overflow.x) * 100);
  if (overflow.y) cropPosition.y = clampCrop(cropDrag.cropY - ((event.clientY - cropDrag.startY) / overflow.y) * 100);
  applyCrop();
});
const stopCropDrag = event => {
  if (!cropDrag || cropDrag.id !== event.pointerId) return;
  cropDrag = null;
  canvas.classList.remove('crop-dragging');
};
canvas.addEventListener('pointerup', stopCropDrag);
canvas.addEventListener('pointercancel', stopCropDrag);
canvas.addEventListener('lostpointercapture', event => {
  if (cropDrag?.id === event.pointerId) {
    cropDrag = null;
    canvas.classList.remove('crop-dragging');
  }
});
canvas.addEventListener('keydown', event => {
  if (!activeImageSize) return;
  const step = event.shiftKey ? 10 : 3;
  if (event.key === 'ArrowLeft') cropPosition.x = clampCrop(cropPosition.x + step);
  else if (event.key === 'ArrowRight') cropPosition.x = clampCrop(cropPosition.x - step);
  else if (event.key === 'ArrowUp') cropPosition.y = clampCrop(cropPosition.y + step);
  else if (event.key === 'ArrowDown') cropPosition.y = clampCrop(cropPosition.y - step);
  else return;
  event.preventDefault();
  applyCrop();
});
resetCropButton.addEventListener('click', resetCrop);
const showAvailableSizes = (imageWidth, imageHeight) => {
  const sourceRatio = imageWidth / imageHeight;
  const available = allSizes.filter(value => {
    const [width, height] = getDimensions(value);
    const canvasRatio = width / height;
    const retainedPart = Math.min(sourceRatio / canvasRatio, canvasRatio / sourceRatio);
    // The preview uses `object-fit: cover`: a customer may choose another
    // aspect ratio and move the crop, but the source must never be enlarged
    // or lose more than a quarter of the photo in one direction.
    return retainedPart >= minimumCropRetention
      && Math.max(requiredPixels(width) / imageWidth, requiredPixels(height) / imageHeight) <= 1;
  });
  availablePhotoSizes = available;
  const availableFormats = new Set(available.map(value => {
    const [width, height] = getDimensions(value);
    return formatFor(width, height);
  }));
  document.querySelectorAll('.orientation button').forEach(button => {
    const isAvailable = availableFormats.has(button.dataset.orientation);
    button.hidden = !isAvailable;
    button.disabled = !isAvailable;
  });
  if (!available.length) {
    size.disabled = true;
    sizeHint.textContent = 'Для печати хорошего качества нужен файл большего разрешения.';
    price.textContent = '—';
    return;
  }
  const recommended = available
    .map(value => {
      const [width, height] = getDimensions(value);
      return {
        value,
        // First choose the closest natural proportion of the source photo.
        ratioDistance: Math.abs(Math.log((width / height) / sourceRatio)),
        // For equivalent proportions, offer a familiar medium-sized canvas.
        sizeDistance: Math.abs(Math.max(width, height) - 60),
      };
    })
    .sort((a, b) => a.ratioDistance - b.ratioDistance || a.sizeDistance - b.sizeDistance)[0];
  // Do not inherit a format selected for the previous upload. Start with
  // the closest orientation and keep its menu separate from other formats.
  const [recommendedWidth, recommendedHeight] = getDimensions(recommended.value);
  showSizesForOrientation(formatFor(recommendedWidth, recommendedHeight), recommended.value);
};
const loadPhoto = file => {
  if (!file) return;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { alert('Поддерживаются JPG, PNG и WEBP.'); return; }
  if (file.size > 10 * 1024 * 1024) { alert('Размер фотографии не должен превышать 10 МБ.'); return; }
  if (activePhotoUrl && !cartPhotoUrls.has(activePhotoUrl)) URL.revokeObjectURL(activePhotoUrl);
  const photoUrl = URL.createObjectURL(file);
  activePhotoUrl = photoUrl;
  resetCrop();
  preview.src = photoUrl;
  const image = new Image();
  image.onload = () => {
    activeImageSize = { width: image.naturalWidth, height: image.naturalHeight };
    canvas.classList.add('crop-enabled');
    cropControls.hidden = false;
    showAvailableSizes(image.naturalWidth, image.naturalHeight);
  };
  image.src = photoUrl;
};
input.addEventListener('change', event => loadPhoto(event.target.files[0]));
const uploadZone = document.querySelector('#upload-zone');
['dragenter','dragover'].forEach(type => uploadZone.addEventListener(type, event => { event.preventDefault(); uploadZone.classList.add('dragging'); }));
['dragleave','drop'].forEach(type => uploadZone.addEventListener(type, event => { event.preventDefault(); uploadZone.classList.remove('dragging'); }));
uploadZone.addEventListener('drop', event => { const file = event.dataTransfer.files[0]; if (!file) return; const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; loadPhoto(file); });
size.addEventListener('change', e => { sizeLabel.textContent=e.target.value; price.textContent=priceFor(e.target.value); setCanvasFormat(e.target.value); });
document.querySelectorAll('.orientation button').forEach(button => button.addEventListener('click', () => {
  showSizesForOrientation(button.dataset.orientation);
}));
setCanvasFormat(size.value);
document.querySelector('.change-size').addEventListener('click', () => {
  size.scrollIntoView({behavior:'smooth', block:'center'});
  size.focus({preventScroll:true});
  if (typeof size.showPicker === 'function') size.showPicker();
  else size.click();
});
document.querySelectorAll('.effect-toggle button').forEach(button => button.addEventListener('click', () => {
  document.querySelector('.effect-toggle .active')?.classList.remove('active');
  button.classList.add('active');
  activePhotoEffect = button.dataset.effect || 'none';
  applyPhotoEffect();
}));
const inspirationBefore = document.querySelector('.inspiration-photo.before');
const inspirationAfter = document.querySelector('.inspiration-photo.after');
const inspirationExamples = [
  {diptych:'assets/gallery/autumn-couple-canvas.png'},
  {diptych:'assets/gallery/family-beach-canvas.png'}
];
let inspirationIndex = 0;
const setInspirationImage = (element, source, size = 'cover', position = 'center') => {
  element.style.setProperty('--inspiration-image', `url("${source}")`);
  element.style.setProperty('--inspiration-size', size);
  element.style.setProperty('--inspiration-position', position);
};
const setInspirationExample = index => {
  inspirationIndex = (index + inspirationExamples.length) % inspirationExamples.length;
  const example = inspirationExamples[inspirationIndex];
  if (example.diptych) {
    // The source is a two-panel image. Each panel keeps its original square ratio.
    setInspirationImage(inspirationBefore, example.diptych, '200% 100%', 'left center');
    setInspirationImage(inspirationAfter, example.diptych, '200% 100%', 'right center');
  } else {
    setInspirationImage(inspirationBefore, example.before);
    setInspirationImage(inspirationAfter, example.after);
  }
};
setInspirationExample(inspirationIndex);
document.querySelector('.inspiration-prev').addEventListener('click', () => setInspirationExample(inspirationIndex - 1));
document.querySelector('.inspiration-next').addEventListener('click', () => setInspirationExample(inspirationIndex + 1));
const drawer = document.querySelector('#cart-drawer');
const backdrop = document.querySelector('#cart-backdrop');
const cartItems = document.querySelector('#cart-items');
const cartEmpty = document.querySelector('#cart-empty');
const cartFooter = document.querySelector('#cart-footer');
const cartCount = document.querySelector('.cart-icon b');
const openCart = () => { drawer.classList.add('open'); backdrop.classList.add('open'); drawer.setAttribute('aria-hidden','false'); };
const closeCart = () => { drawer.classList.remove('open'); backdrop.classList.remove('open'); drawer.setAttribute('aria-hidden','true'); };
const cart = [];
const cartPhotoUrls = new Set();
const priceNumber = value => Number(value.replace(/\D/g, '')) || 0;
const formatPrice = value => `${value.toLocaleString('ru-RU')} ₽`;
const renderCart = () => {
  cartItems.replaceChildren();
  cart.forEach((item, index) => {
    const product = document.createElement('article');
    product.className = 'cart-product';
    const image = document.createElement('img');
    image.src = item.image;
    image.style.objectPosition = `${item.crop?.x ?? 50}% ${item.crop?.y ?? 50}%`;
    image.style.filter = photoEffects[item.photoEffect] || 'none';
    image.alt = `Фотохолст ${item.size} в корзине`;
    const info = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = `Фотохолст ${item.size}`;
    const note = document.createElement('small');
    note.textContent = 'Готов к размещению на стене';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-cart';
    remove.textContent = 'Удалить';
    remove.addEventListener('click', () => {
      const [removed] = cart.splice(index, 1);
      if (!cart.some(cartItem => cartItem.image === removed.image) && removed.image !== activePhotoUrl) {
        URL.revokeObjectURL(removed.image);
        cartPhotoUrls.delete(removed.image);
      }
      renderCart();
    });
    const itemPrice = document.createElement('strong');
    itemPrice.textContent = item.priceText;
    info.append(title, note, remove);
    product.append(image, info, itemPrice);
    cartItems.append(product);
  });
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  cartEmpty.hidden = cart.length !== 0;
  cartFooter.hidden = cart.length === 0;
  document.querySelector('#cart-total').textContent = formatPrice(total);
  cartCount.textContent = String(cart.length);
};
const addToCart = () => {
  const file = input.files[0];
  if (!file) return;
  cartPhotoUrls.add(preview.src);
  cart.push({ image: preview.src, file, size: sizeLabel.textContent, priceText: price.textContent, price: priceNumber(price.textContent), crop: { ...cropPosition }, photoEffect: activePhotoEffect });
  renderCart();
};
document.querySelector('.add-to-cart').addEventListener('click', () => { addToCart(); const toast=document.querySelector('#toast'); toast.classList.add('visible'); setTimeout(() => toast.classList.remove('visible'), 2600); openCart(); });
document.querySelector('.cart-icon').addEventListener('click', openCart);
document.querySelector('.close-cart').addEventListener('click', closeCart);
backdrop.addEventListener('click', closeCart);
const checkoutModal = document.querySelector('#checkout-modal');
const checkoutStatus = document.querySelector('#checkout-status');
const deliveryAddress = document.querySelector('#delivery-address');
const addressSuggestions = document.querySelector('#address-suggestions');
let addressLookupTimer;
let latestAddressLookup = 0;
const hideAddressSuggestions = () => {
  addressSuggestions.replaceChildren();
  addressSuggestions.hidden = true;
  deliveryAddress.setAttribute('aria-expanded', 'false');
};
const showAddressSuggestions = suggestions => {
  hideAddressSuggestions();
  if (!suggestions.length) return;
  suggestions.forEach(({ value }) => {
    if (!value) return;
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'address-suggestion';
    option.setAttribute('role', 'option');
    option.textContent = value;
    option.addEventListener('mousedown', event => {
      event.preventDefault();
      deliveryAddress.value = value;
      hideAddressSuggestions();
      deliveryAddress.focus();
    });
    addressSuggestions.append(option);
  });
  if (addressSuggestions.children.length) {
    addressSuggestions.hidden = false;
    deliveryAddress.setAttribute('aria-expanded', 'true');
  }
};
const loadAddressSuggestions = async () => {
  const query = deliveryAddress.value.trim();
  if (query.length < 3 || !window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    hideAddressSuggestions();
    return;
  }
  const requestId = ++latestAddressLookup;
  try {
    const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    const { data, error } = await client.functions.invoke('address-suggest', { body: { query } });
    if (requestId !== latestAddressLookup || error) return;
    showAddressSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
  } catch {
    if (requestId === latestAddressLookup) hideAddressSuggestions();
  }
};
deliveryAddress.addEventListener('input', () => {
  window.clearTimeout(addressLookupTimer);
  addressLookupTimer = window.setTimeout(loadAddressSuggestions, 320);
});
deliveryAddress.addEventListener('blur', () => window.setTimeout(hideAddressSuggestions, 160));
deliveryAddress.addEventListener('keydown', event => {
  if (event.key === 'Escape') hideAddressSuggestions();
});
const openCheckout = () => { document.querySelector('#checkout-size').textContent=`${cart.length} шт.`; document.querySelector('#checkout-price').textContent=document.querySelector('#cart-total').textContent; checkoutStatus.textContent=''; checkoutModal.classList.add('open'); checkoutModal.setAttribute('aria-hidden','false'); };
const closeCheckout = () => { hideAddressSuggestions(); checkoutModal.classList.remove('open'); checkoutModal.setAttribute('aria-hidden','true'); };
document.querySelector('.checkout').addEventListener('click', openCheckout);
document.querySelector('.close-checkout').addEventListener('click', closeCheckout);
checkoutModal.addEventListener('click', event => { if(event.target === checkoutModal) closeCheckout(); });
document.querySelector('#checkout-form').addEventListener('submit', async event => {
  event.preventDefault();
  const configured = window.SUPABASE_URL && !window.SUPABASE_URL.startsWith('YOUR_') && window.SUPABASE_ANON_KEY && !window.SUPABASE_ANON_KEY.startsWith('YOUR_');
  if(!configured){ checkoutStatus.textContent='Приём заказов ещё не настроен. Обратитесь к менеджеру.'; return; }
  if(!cart.length){ checkoutStatus.textContent='Добавьте хотя бы один холст в корзину.'; return; }
  if(cart.some(item => !item.file)){ checkoutStatus.textContent='Загрузите фотографию для каждого холста.'; return; }
  const submit = event.currentTarget.querySelector('[type="submit"]'); submit.disabled=true; checkoutStatus.textContent='Отправляем заказ…';
  if (!window.supabase) { checkoutStatus.textContent='Сервис заказов временно недоступен. Попробуйте позже.'; submit.disabled=false; return; }
  const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  // getSession reads the already stored session and does not pause checkout for
  // a separate Auth network request. Database RLS still validates ownership.
  const {data:{session}} = await supabaseClient.auth.getSession();
  const user = session?.user || null;
  const form = new FormData(event.currentTarget);
  const customerEmail = String(form.get('email') || user?.email || '').trim().toLowerCase();
  if (!customerEmail) { checkoutStatus.textContent='Укажите email для подтверждения заказа и создания личного кабинета.'; submit.disabled=false; return; }
  const guestOrderClaims = [];
  const telegramOrderIds = [];
  for (const item of cart) {
    const orderId = crypto.randomUUID();
    const accountClaimToken = user ? null : crypto.randomUUID();
    let printFile;
    try {
      checkoutStatus.textContent = 'Готовим выбранную область холста…';
      printFile = await createPrintFile(item.file, item.photoEffect || 'none', item.size, item.crop);
    } catch (printError) {
      checkoutStatus.textContent = printError instanceof Error ? printError.message : 'Не удалось подготовить фотографию.';
      submit.disabled = false;
      return;
    }
    if (printFile.size > 50 * 1024 * 1024) {
      checkoutStatus.textContent = 'Выбранная область холста получилась больше 50 МБ. Выберите файл меньшего размера.';
      submit.disabled = false;
      return;
    }
    const safeName = printFile.name.toLowerCase().replace(/[^a-z0-9._-]/g,'-');
    const photoPath = `${orderId}/${safeName}`;
    const {error:uploadError} = await supabaseClient.storage.from('order-photos').upload(photoPath,printFile,{contentType:printFile.type,upsert:false});
    if(uploadError){ checkoutStatus.textContent=uploadError.message; submit.disabled=false; return; }
    const order = {id:orderId,customer_id:user?.id||null,full_name:form.get('full_name'),phone:form.get('phone'),email:customerEmail,address:form.get('address'),comment:form.get('comment')||null,canvas_size:item.size,price_kop:item.price*100,photo_path:photoPath,crop_position:item.crop||{x:50,y:50},photo_effect:item.photoEffect||'none',account_claim_token:accountClaimToken};
    const {error:orderError} = await supabaseClient.from('orders').insert(order);
    if(orderError){ checkoutStatus.textContent=orderError.message; submit.disabled=false; return; }
    if (accountClaimToken) guestOrderClaims.push({ orderId, claimToken: accountClaimToken });
    telegramOrderIds.push(orderId);
  }
  // The order is safely stored. Telegram and email must not make the customer
  // wait for a large photo to be downloaded and delivered.
  void Promise.all(telegramOrderIds.map(async orderId => {
    try {
      const { error } = await supabaseClient.functions.invoke('telegram-order-notify', { body: { orderId } });
      if (error) console.warn('Telegram notification was not sent:', error.message);
    } catch (telegramError) {
      console.warn('Telegram notification was not sent:', telegramError);
    }
  }));
  let accountMessage = '';
  if (guestOrderClaims.length) {
    accountMessage = ' Заказ будет привязан к личному кабинету; письмо придёт, если нужно настроить доступ.';
    // Account invitation is supplementary: it must not block an already saved
    // order when email delivery or a serverless function is temporarily slow.
    void (async () => {
      try {
        const { error } = await supabaseClient.functions.invoke('create-customer-account', {
        body: { email: customerEmail, fullName: form.get('full_name'), orders: guestOrderClaims },
      });
        if (error) console.warn('Customer account invitation was not sent:', error.message);
      } catch (accountError) {
        console.warn('Customer account invitation was not sent:', accountError);
      }
    })();
  }
  checkoutStatus.textContent=`Заказ принят! Мы свяжемся с вами для подтверждения.${accountMessage}`; checkoutStatus.classList.add('success'); cart.length=0; renderCart(); event.currentTarget.reset(); setTimeout(()=>{closeCheckout();closeCart();},4200);
});
document.querySelector('.menu-toggle').addEventListener('click', () => { const nav=document.querySelector('.site-header nav'); nav.classList.toggle('open'); });

// Support messages are delivered by Edge Functions. A locally stored random
// conversation token lets a visitor see only their own dialog in real time.
const chatLaunch = document.querySelector('#chat-launch');
const chatModal = document.querySelector('#chat-modal');
const chatForm = document.querySelector('#chat-form');
const chatStatus = document.querySelector('#chat-status');
const chatTranscript = document.querySelector('.chat-transcript');
const chatStorageKey = 'canvaso-chat-conversation';
let chatClient;
let chatChannel;
let chatLoaded = false;
const storedConversationToken = () => localStorage.getItem(chatStorageKey);
const conversationToken = () => {
  let token = storedConversationToken();
  if (!token) { token = crypto.randomUUID(); localStorage.setItem(chatStorageKey, token); }
  return token;
};
const renderChatMessage = message => {
  if (!message?.id || chatTranscript.querySelector(`[data-message-id="${message.id}"]`)) return;
  const bubble = document.createElement('p');
  bubble.className = `chat-bubble ${message.sender === 'admin' ? 'from-admin' : 'from-visitor'}`;
  bubble.dataset.messageId = message.id;
  bubble.textContent = message.body;
  chatTranscript.append(bubble);
  chatTranscript.scrollTop = chatTranscript.scrollHeight;
};
const openChatConnection = async () => {
  if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return;
  chatClient ||= window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  const token = conversationToken();
  if (!chatChannel) {
    chatChannel = chatClient.channel(`canvaso:chat:${token}`)
      .on('broadcast', { event: 'message' }, payload => {
        const message = payload.payload;
        renderChatMessage(message);
        if (message?.sender === 'admin') {
          showChat(false);
          chatStatus.textContent = 'Новое сообщение от оператора.';
          chatStatus.classList.add('success');
        }
      })
      .subscribe();
  }
  if (!chatLoaded) {
    const { data, error } = await chatClient.functions.invoke('chat-notify', { body: { action: 'history', conversationToken: token } });
    if (!error && Array.isArray(data?.messages)) {
      chatTranscript.replaceChildren();
      data.messages.forEach(renderChatMessage);
      if (!data.messages.length) chatTranscript.innerHTML = '<p class="chat-greeting">Здравствуйте! Напишите ваш вопрос — сообщение сразу поступит менеджеру.</p>';
      chatLoaded = true;
    }
  }
};
const showChat = (focusInput = false) => {
  chatStatus.textContent = '';
  chatStatus.classList.remove('success');
  chatModal.classList.add('open');
  chatModal.setAttribute('aria-hidden', 'false');
  void openChatConnection();
  if (focusInput) window.setTimeout(() => chatForm.elements.message.focus(), 50);
};
const openChat = () => showChat(true);
const closeChat = () => {
  chatModal.classList.remove('open');
  chatModal.setAttribute('aria-hidden', 'true');
  chatLaunch.focus();
};
chatLaunch.addEventListener('click', openChat);
chatModal.querySelector('.close-chat').addEventListener('click', closeChat);
chatModal.addEventListener('click', event => { if (event.target === chatModal) closeChat(); });
if (storedConversationToken()) void openChatConnection();
chatForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    chatStatus.textContent = 'Чат временно недоступен. Попробуйте позже.';
    return;
  }
  const submit = chatForm.querySelector('[type="submit"]');
  const form = new FormData(chatForm);
  submit.disabled = true;
  chatStatus.classList.remove('success');
  chatStatus.textContent = 'Отправляем сообщение…';
  try {
    await openChatConnection();
    const { data, error } = await chatClient.functions.invoke('chat-notify', {
      body: {
        action: 'send', conversationToken: conversationToken(),
        name: String(form.get('name') || ''),
        contact: String(form.get('contact') || ''),
        message: String(form.get('message') || ''),
        website: String(form.get('website') || ''),
      },
    });
    if (error || !data?.sent) throw new Error(data?.error || error?.message || 'Не удалось отправить сообщение.');
    renderChatMessage(data.message);
    chatStatus.textContent = 'Сообщение отправлено.';
    chatStatus.classList.add('success');
    chatForm.reset();
  } catch (error) {
    chatStatus.textContent = error instanceof Error ? error.message : 'Не удалось отправить сообщение. Попробуйте позже.';
  } finally {
    submit.disabled = false;
  }
});

// Keep the catalogue section easy to reach without leaving `#catalog` in
// the public URL. Old shared links with that hash still scroll correctly.
const catalogSection = document.querySelector('#catalog');
const cleanCatalogUrl = () => {
  history.replaceState(null, '', `${location.pathname}${location.search}`);
};
document.querySelectorAll('a[href="#catalog"]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    catalogSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    cleanCatalogUrl();
  });
});
if (location.hash === '#catalog') {
  window.requestAnimationFrame(() => {
    catalogSection?.scrollIntoView({ block: 'start' });
    cleanCatalogUrl();
  });
}

// Third review card from the reference layout. It does not alter any images.
const reviews = document.querySelector('.review-list');
if (reviews && reviews.children.length === 2) {
  const review = document.createElement('article');
  review.innerHTML = '<div class="stars">★★★★★</div><p>«Качество печати отличное! Цвета насыщенные, холст выглядит супер.»</p><footer><span class="avatar a1"></span><b>Ирина<small>Казань</small></b></footer>';
  reviews.appendChild(review);
}

// One more card makes the review carousel useful on both desktop and mobile.
if (reviews && reviews.children.length === 3) {
  const review = document.createElement('article');
  review.innerHTML = '<div class="stars">★★★★★</div><p>«Заказ приехал быстро, а результат превзошёл все ожидания.»</p><footer><span class="avatar a2"></span><b>Ольга<small>Екатеринбург</small></b></footer>';
  reviews.appendChild(review);
}

const reviewsSection = document.querySelector('.reviews');
const reviewDots = document.querySelector('.reviews .dots');

if (reviewsSection && reviews && reviewDots && reviews.children.length) {
  let reviewIndex = 0;
  let reviewTimer;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const visibleReviews = () => window.matchMedia('(max-width: 800px)').matches ? 1 : 3;
  const reviewSlideCount = () => Math.max(1, reviews.children.length - visibleReviews() + 1);

  const stopReviewAutoplay = () => {
    window.clearInterval(reviewTimer);
    reviewTimer = undefined;
  };

  const startReviewAutoplay = () => {
    stopReviewAutoplay();
    if (!reducedMotion.matches && reviewSlideCount() > 1) {
      reviewTimer = window.setInterval(() => showReview(reviewIndex + 1), 5000);
    }
  };

  const showReview = (index) => {
    const slideCount = reviewSlideCount();
    reviewIndex = (index + slideCount) % slideCount;
    const firstCard = reviews.firstElementChild;
    const gap = Number.parseFloat(window.getComputedStyle(reviews).gap) || 0;
    const cardWidth = firstCard.getBoundingClientRect().width;
    reviews.style.transform = `translateX(-${reviewIndex * (cardWidth + gap)}px)`;

    reviewDots.replaceChildren(...Array.from({ length: slideCount }, (_, dotIndex) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = dotIndex === reviewIndex ? 'active' : '';
      dot.setAttribute('aria-label', `Показать отзывы ${dotIndex + 1}`);
      dot.setAttribute('aria-current', String(dotIndex === reviewIndex));
      dot.addEventListener('click', () => {
        showReview(dotIndex);
        startReviewAutoplay();
      });
      return dot;
    }));
  };

  reviewsSection.addEventListener('mouseenter', stopReviewAutoplay);
  reviewsSection.addEventListener('mouseleave', startReviewAutoplay);
  document.addEventListener('visibilitychange', () => document.hidden ? stopReviewAutoplay() : startReviewAutoplay());
  window.addEventListener('resize', () => showReview(reviewIndex));
  reducedMotion.addEventListener?.('change', () => startReviewAutoplay());

  showReview(0);
  startReviewAutoplay();
}
