const input = document.querySelector('#photo-input');
const preview = document.querySelector('#preview-image');
const canvas = document.querySelector('.canvas-preview');
const size = document.querySelector('#size');
const price = document.querySelector('#price');
const sizeLabel = document.querySelector('#size-label');
const prices = {'30 × 20 см':'1 190 ₽','20 × 30 см':'1 190 ₽','40 × 30 см':'1 490 ₽','30 × 40 см':'1 490 ₽','40 × 40 см':'1 690 ₽','50 × 40 см':'1 790 ₽','40 × 50 см':'1 790 ₽','60 × 40 см':'1 990 ₽','40 × 60 см':'1 990 ₽','60 × 45 см':'2 190 ₽','45 × 60 см':'2 190 ₽','70 × 50 см':'2 590 ₽','50 × 70 см':'2 590 ₽','80 × 60 см':'3 190 ₽','60 × 80 см':'3 190 ₽','90 × 60 см':'3 590 ₽','60 × 90 см':'3 590 ₽','100 × 70 см':'4 690 ₽','70 × 100 см':'4 690 ₽','120 × 80 см':'5 990 ₽','80 × 120 см':'5 990 ₽','140 × 100 см':'7 490 ₽','100 × 140 см':'7 490 ₽'};
const getDimensions = value => value.match(/\d+/g).slice(0, 2).map(Number);
const priceByDimensions = {'30x20':'1 190 ₽','20x30':'1 190 ₽','40x30':'1 490 ₽','30x40':'1 490 ₽','40x40':'1 690 ₽','50x40':'1 790 ₽','40x50':'1 790 ₽','60x40':'1 990 ₽','40x60':'1 990 ₽','60x45':'2 190 ₽','45x60':'2 190 ₽','70x50':'2 590 ₽','50x70':'2 590 ₽','80x60':'3 190 ₽','60x80':'3 190 ₽','90x60':'3 590 ₽','60x90':'3 590 ₽','100x70':'4 690 ₽','70x100':'4 690 ₽','120x80':'5 990 ₽','80x120':'5 990 ₽','140x100':'7 490 ₽','100x140':'7 490 ₽'};
const priceFor = value => priceByDimensions[`${getDimensions(value).join('x')}`] || '—';
const setCanvasFormat = value => {
  const [width, height] = getDimensions(value);
  canvas.style.setProperty('--canvas-ratio', `${width} / ${height}`);
  const format = width === height ? 'square' : width > height ? 'landscape' : 'portrait';
  document.querySelectorAll('.orientation button').forEach(button => button.classList.toggle('active', button.dataset.orientation === format));
};
const sizeHint = document.querySelector('#size-hint');
const allSizes = [...size.options].map(option => option.value);
const printDpi = 120;
const formatFor = (width, height) => width === height ? 'square' : width > height ? 'landscape' : 'portrait';
const requiredPixels = centimeters => Math.ceil(centimeters / 2.54 * printDpi);
let activePhotoUrl = null;
let activeImageSize = null;
let cropPosition = { x: 50, y: 50 };
const cropControls = document.querySelector('#crop-controls');
const resetCropButton = document.querySelector('#reset-crop');
const clampCrop = value => Math.max(0, Math.min(100, value));
const applyCrop = () => {
  preview.style.objectPosition = `${cropPosition.x}% ${cropPosition.y}%`;
};
const resetCrop = () => {
  cropPosition = { x: 50, y: 50 };
  applyCrop();
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
let cropDrag = null;
canvas.addEventListener('pointerdown', event => {
  if (!activeImageSize || (event.pointerType === 'mouse' && event.button !== 0)) return;
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
  const available = allSizes.filter(value => {
    const [width, height] = getDimensions(value);
    // The preview uses `object-fit: cover`: a customer may choose another
    // aspect ratio and move the crop, but the source must never be enlarged
    // beyond its available pixels for the selected canvas size.
    return Math.max(requiredPixels(width) / imageWidth, requiredPixels(height) / imageHeight) <= 1;
  });
  size.replaceChildren(...available.map(value => new Option(value, value)));
  if (!available.length) {
    size.disabled = true;
    sizeHint.textContent = 'Для печати хорошего качества нужен файл большего разрешения.';
    price.textContent = '—';
    return;
  }
  size.disabled = false;
  const sourceRatio = imageWidth / imageHeight;
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
  // Do not inherit a format selected for the previous upload: a portrait
  // photo should start with a portrait format, while every compatible size
  // remains available in the list for cropping.
  size.value = recommended.value;
  sizeHint.textContent = `Доступно форматов: ${available.length}. Подобран размер для фото ${imageWidth} × ${imageHeight} px; другой формат можно выбрать и кадрировать перетаскиванием.`;
  size.dispatchEvent(new Event('change'));
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
  const option = [...size.options].find(item => {
    const [width, height] = getDimensions(item.value);
    return button.dataset.orientation === 'square' ? width === height : button.dataset.orientation === 'portrait' ? height > width : width > height;
  });
  if (option) { size.value = option.value; size.dispatchEvent(new Event('change')); }
}));
setCanvasFormat(size.value);
const frame = document.querySelector('#frame');
const effect = document.querySelector('#effect');
frame?.addEventListener('change', () => { canvas.classList.toggle('frame-light', frame.value === 'light'); canvas.classList.toggle('frame-dark', frame.value === 'dark'); });
effect?.addEventListener('change', () => { canvas.classList.toggle('warm', effect.value === 'warm'); preview.style.filter = effect.value === 'gray' ? 'grayscale(1)' : effect.value === 'warm' ? 'sepia(.25) saturate(1.15)' : 'none'; });
document.querySelector('.change-size').addEventListener('click', () => {
  size.scrollIntoView({behavior:'smooth', block:'center'});
  size.focus({preventScroll:true});
  if (typeof size.showPicker === 'function') size.showPicker();
  else size.click();
});
document.querySelectorAll('.toggle button').forEach(button => button.addEventListener('click', () => { document.querySelector('.toggle .active').classList.remove('active'); button.classList.add('active'); preview.style.filter=button.dataset.filter==='gray'?'grayscale(1)':'none'; }));
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
  cart.push({ image: preview.src, file, size: sizeLabel.textContent, priceText: price.textContent, price: priceNumber(price.textContent), crop: { ...cropPosition } });
  renderCart();
};
document.querySelector('.add-to-cart').addEventListener('click', () => { addToCart(); const toast=document.querySelector('#toast'); toast.classList.add('visible'); setTimeout(() => toast.classList.remove('visible'), 2600); openCart(); });
document.querySelector('.cart-icon').addEventListener('click', openCart);
document.querySelector('.close-cart').addEventListener('click', closeCart);
backdrop.addEventListener('click', closeCart);
const checkoutModal = document.querySelector('#checkout-modal');
const checkoutStatus = document.querySelector('#checkout-status');
const openCheckout = () => { document.querySelector('#checkout-size').textContent=`${cart.length} шт.`; document.querySelector('#checkout-price').textContent=document.querySelector('#cart-total').textContent; checkoutStatus.textContent=''; checkoutModal.classList.add('open'); checkoutModal.setAttribute('aria-hidden','false'); };
const closeCheckout = () => { checkoutModal.classList.remove('open'); checkoutModal.setAttribute('aria-hidden','true'); };
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
  const {data:{user}} = await supabaseClient.auth.getUser();
  const form = new FormData(event.currentTarget);
  for (const item of cart) {
    const orderId = crypto.randomUUID();
    const safeName = item.file.name.toLowerCase().replace(/[^a-z0-9._-]/g,'-');
    const photoPath = `${orderId}/${safeName}`;
    const {error:uploadError} = await supabaseClient.storage.from('order-photos').upload(photoPath,item.file,{contentType:item.file.type,upsert:false});
    if(uploadError){ checkoutStatus.textContent=uploadError.message; submit.disabled=false; return; }
    const order = {id:orderId,customer_id:user?.id||null,full_name:form.get('full_name'),phone:form.get('phone'),email:form.get('email')||user?.email||null,address:form.get('address'),comment:form.get('comment')||null,canvas_size:item.size,price_kop:item.price*100,photo_path:photoPath,crop_position:item.crop||{x:50,y:50}};
    const {error:orderError} = await supabaseClient.from('orders').insert(order);
    if(orderError){ checkoutStatus.textContent=orderError.message; submit.disabled=false; return; }
    try {
      const { error: telegramError } = await supabaseClient.functions.invoke('telegram-order-notify', { body: { orderId } });
      if (telegramError) console.warn('Telegram notification was not sent:', telegramError.message);
    } catch (telegramError) {
      console.warn('Telegram notification was not sent:', telegramError);
    }
  }
  checkoutStatus.textContent='Заказ принят! Мы свяжемся с вами для подтверждения.'; checkoutStatus.classList.add('success'); cart.length=0; renderCart(); event.currentTarget.reset(); setTimeout(()=>{closeCheckout();closeCart();},2400);
});
document.querySelector('.menu-toggle').addEventListener('click', () => { const nav=document.querySelector('.site-header nav'); nav.classList.toggle('open'); });

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
