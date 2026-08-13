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
document.querySelector('.add-to-cart').addEventListener('click', () => { document.querySelector('.cart-icon b').textContent='1'; const toast=document.querySelector('#toast'); toast.classList.add('visible'); setTimeout(() => toast.classList.remove('visible'), 2600); });
document.querySelector('.menu-toggle').addEventListener('click', () => { const nav=document.querySelector('.site-header nav'); nav.classList.toggle('open'); });

// Third review card from the reference layout. It does not alter any images.
const reviews = document.querySelector('.review-list');
if (reviews && reviews.children.length === 2) {
  const review = document.createElement('article');
  review.innerHTML = '<div class="stars">★★★★★</div><p>«Качество печати отличное! Цвета насыщенные, холст выглядит супер.»</p><footer><span class="avatar a1"></span><b>Ирина<small>Казань</small></b></footer>';
  reviews.appendChild(review);
}
