const input = document.querySelector('#photo-input');
const preview = document.querySelector('#preview-image');
const canvas = document.querySelector('.canvas-preview');
const size = document.querySelector('#size');
const price = document.querySelector('#price');
const sizeLabel = document.querySelector('#size-label');
const prices = {'30 × 20 см':'1 190 ₽','40 × 30 см':'1 490 ₽','40 × 40 см':'1 690 ₽','50 × 40 см':'1 790 ₽','60 × 40 см':'1 990 ₽','60 × 45 см':'2 190 ₽','70 × 50 см':'2 590 ₽','80 × 60 см':'3 190 ₽','90 × 60 см':'3 590 ₽','100 × 70 см':'4 690 ₽','120 × 80 см':'5 990 ₽','140 × 100 см':'7 490 ₽'};
input.addEventListener('change', e => { const file=e.target.files[0]; if(file) preview.src=URL.createObjectURL(file); });
size.addEventListener('change', e => { sizeLabel.textContent=e.target.value; price.textContent=prices[e.target.value]; });
document.querySelectorAll('.orientation button').forEach(button => button.addEventListener('click', () => { document.querySelector('.orientation .active').classList.remove('active'); button.classList.add('active'); canvas.classList.remove('portrait','square'); if(button.dataset.orientation !== 'landscape') canvas.classList.add(button.dataset.orientation); }));
document.querySelectorAll('.toggle button').forEach(button => button.addEventListener('click', () => { document.querySelector('.toggle .active').classList.remove('active'); button.classList.add('active'); preview.style.filter=button.dataset.filter==='gray'?'grayscale(1)':'none'; }));
const drawer = document.querySelector('#cart-drawer');
const backdrop = document.querySelector('#cart-backdrop');
const cartProduct = document.querySelector('#cart-product');
const cartEmpty = document.querySelector('#cart-empty');
const cartFooter = document.querySelector('#cart-footer');
const cartCount = document.querySelector('.cart-icon b');
const openCart = () => { drawer.classList.add('open'); backdrop.classList.add('open'); drawer.setAttribute('aria-hidden','false'); };
const closeCart = () => { drawer.classList.remove('open'); backdrop.classList.remove('open'); drawer.setAttribute('aria-hidden','true'); };
const addToCart = () => { const currentPrice = price.textContent; document.querySelector('#cart-size').textContent = sizeLabel.textContent; document.querySelector('#cart-price').textContent = currentPrice; document.querySelector('#cart-total').textContent = currentPrice; document.querySelector('#cart-image').src = preview.src; cartProduct.hidden=false; cartFooter.hidden=false; cartEmpty.hidden=true; cartCount.textContent='1'; };
document.querySelector('.add-to-cart').addEventListener('click', () => { addToCart(); const toast=document.querySelector('#toast'); toast.classList.add('visible'); setTimeout(() => toast.classList.remove('visible'), 2600); openCart(); });
document.querySelector('.cart-icon').addEventListener('click', openCart);
document.querySelector('.close-cart').addEventListener('click', closeCart);
backdrop.addEventListener('click', closeCart);
document.querySelector('.remove-cart').addEventListener('click', () => { cartProduct.hidden=true; cartFooter.hidden=true; cartEmpty.hidden=false; cartCount.textContent='0'; });
const checkoutModal = document.querySelector('#checkout-modal');
const checkoutStatus = document.querySelector('#checkout-status');
const openCheckout = () => { document.querySelector('#checkout-size').textContent=sizeLabel.textContent; document.querySelector('#checkout-price').textContent=price.textContent; checkoutStatus.textContent=''; checkoutModal.classList.add('open'); checkoutModal.setAttribute('aria-hidden','false'); };
const closeCheckout = () => { checkoutModal.classList.remove('open'); checkoutModal.setAttribute('aria-hidden','true'); };
document.querySelector('.checkout').addEventListener('click', openCheckout);
document.querySelector('.close-checkout').addEventListener('click', closeCheckout);
checkoutModal.addEventListener('click', event => { if(event.target === checkoutModal) closeCheckout(); });
document.querySelector('#checkout-form').addEventListener('submit', async event => {
  event.preventDefault();
  const configured = window.SUPABASE_URL && !window.SUPABASE_URL.startsWith('YOUR_') && window.SUPABASE_ANON_KEY && !window.SUPABASE_ANON_KEY.startsWith('YOUR_');
  if(!configured){ checkoutStatus.textContent='Приём заказов ещё не настроен. Обратитесь к менеджеру.'; return; }
  const file = input.files[0];
  if(!file){ checkoutStatus.textContent='Загрузите фотографию перед оформлением.'; return; }
  if(file.size > 10 * 1024 * 1024){ checkoutStatus.textContent='Размер фотографии не должен превышать 10 МБ.'; return; }
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){ checkoutStatus.textContent='Поддерживаются JPG, PNG и WEBP.'; return; }
  const submit = event.currentTarget.querySelector('[type="submit"]'); submit.disabled=true; checkoutStatus.textContent='Отправляем заказ…';
  const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  const orderId = crypto.randomUUID(), safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g,'-');
  const photoPath = `${orderId}/${safeName}`;
  const {error:uploadError} = await supabaseClient.storage.from('order-photos').upload(photoPath,file,{contentType:file.type,upsert:false});
  if(uploadError){ checkoutStatus.textContent=uploadError.message; submit.disabled=false; return; }
  const form = new FormData(event.currentTarget);
  const order = {id:orderId,full_name:form.get('full_name'),phone:form.get('phone'),email:form.get('email')||null,address:form.get('address'),comment:form.get('comment')||null,canvas_size:sizeLabel.textContent,price_kop:Number(price.textContent.replace(/\D/g,''))*100,photo_path:photoPath};
  const {error:orderError} = await supabaseClient.from('orders').insert(order);
  if(orderError){ checkoutStatus.textContent=orderError.message; submit.disabled=false; return; }
  checkoutStatus.textContent='Заказ принят! Мы свяжемся с вами для подтверждения.'; checkoutStatus.classList.add('success'); cartProduct.hidden=true; cartFooter.hidden=true; cartEmpty.hidden=false; cartCount.textContent='0'; event.currentTarget.reset(); setTimeout(()=>{closeCheckout();closeCart();},2400);
});
document.querySelector('.menu-toggle').addEventListener('click', () => { const nav=document.querySelector('.site-header nav'); nav.classList.toggle('open'); });

// Third review card from the reference layout. It does not alter any images.
const reviews = document.querySelector('.review-list');
if (reviews && reviews.children.length === 2) {
  const review = document.createElement('article');
  review.innerHTML = '<div class="stars">★★★★★</div><p>«Качество печати отличное! Цвета насыщенные, холст выглядит супер.»</p><footer><span class="avatar a1"></span><b>Ирина<small>Казань</small></b></footer>';
  reviews.appendChild(review);
}
