const input = document.querySelector('#photo-input');
const preview = document.querySelector('#preview-image');
const canvas = document.querySelector('.canvas-preview');
const size = document.querySelector('#size');
const price = document.querySelector('#price');
const sizeLabel = document.querySelector('#size-label');
const prices = {'60 × 40 см':'1 990 ₽','40 × 40 см':'1 690 ₽','80 × 60 см':'3 190 ₽','100 × 70 см':'4 690 ₽'};
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
document.querySelector('.checkout').addEventListener('click', () => { alert('Спасибо! Переходим к оформлению заказа.'); });
document.querySelector('.menu-toggle').addEventListener('click', () => { const nav=document.querySelector('.site-header nav'); nav.classList.toggle('open'); });

// Third review card from the reference layout. It does not alter any images.
const reviews = document.querySelector('.review-list');
if (reviews && reviews.children.length === 2) {
  const review = document.createElement('article');
  review.innerHTML = '<div class="stars">★★★★★</div><p>«Качество печати отличное! Цвета насыщенные, холст выглядит супер.»</p><footer><span class="avatar a1"></span><b>Ирина<small>Казань</small></b></footer>';
  reviews.appendChild(review);
}
