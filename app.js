/* app.js — static-first frontend (works without backend)
   The menu is defined below so you can preview without a server.
   When backend is available, the fetch-based version can be re-enabled. */

const state = { menu: [], cart: [] };

function fmt(n){ return '$' + n.toFixed(2); }

function renderMenu(){
  const el = document.getElementById('menu');
  el.innerHTML = '<h2>Menu</h2>';
  state.menu.forEach(item => {
    const row = document.createElement('div');
    row.className = 'menu-item';
    const isSoldOut = item.soldOut;
    row.innerHTML = `<div class="mi-left"><strong>${item.name}</strong> ${isSoldOut ? '<span style="color:red;font-size:0.8em">(Sold Out)</span>' : ''}<div class="mi-type">${item.category || item.type}</div></div><div class="mi-right">${fmt(item.price)}</div>`;
    const actions = document.createElement('div');
    actions.className = 'mi-actions';
    if (!isSoldOut) {
      const add = document.createElement('button');
      add.textContent = 'Add';
      add.onclick = () => addToCart(item);
      actions.appendChild(add);
    }
    row.appendChild(actions);
    el.appendChild(row);
  });
}

function addToCart(item){
  const found = state.cart.find(c => c.id === item.id);
  if(found) found.qty += 1; else state.cart.push({ ...item, qty: 1 });
  renderCart();
}

function changeQty(id, delta){
  const it = state.cart.find(c=>c.id===id);
  if(!it) return;
  it.qty += delta;
  if(it.qty <= 0) state.cart = state.cart.filter(c=>c.id!==id);
  renderCart();
}

function renderCart(){
  const container = document.getElementById('cart-items');
  container.innerHTML = '';
  if(state.cart.length === 0){ container.textContent = 'Cart is empty'; document.getElementById('cart-total').textContent = 'Total: $0.00'; return; }
  let total = 0;
  state.cart.forEach(ci => {
    total += ci.price * ci.qty;
    const row = document.createElement('div');
    row.className = 'cart-row';
    row.innerHTML = `<div class="cr-left">${ci.name} <small>x${ci.qty}</small></div><div class="cr-right">${fmt(ci.price * ci.qty)}</div>`;
    const controls = document.createElement('div');
    controls.className = 'cr-controls';
    const minus = document.createElement('button'); minus.textContent='-'; minus.onclick = ()=>changeQty(ci.id, -1);
    const plus = document.createElement('button'); plus.textContent='+'; plus.onclick = ()=>changeQty(ci.id, 1);
    controls.appendChild(minus); controls.appendChild(plus);
    row.appendChild(controls);
    container.appendChild(row);
  });
  document.getElementById('cart-total').textContent = 'Total: ' + fmt(total);
}

document.getElementById('checkout-btn').addEventListener('click', ()=>{
  if(state.cart.length === 0){ alert('Cart is empty'); return; }
  const name = prompt('Your name (required)');
  if(!name) { alert('Name required'); return; }
  // For static preview, show a simple summary and simulate redirect to payment
  const total = state.cart.reduce((s,i)=>s + i.price * i.qty, 0);
  const summary = `Thank you, ${name}!\nOrder total: ${fmt(total)}\nYou will be redirected to payment.`;
  alert(summary);
  // simulate payment page
  const orderData = encodeURIComponent(JSON.stringify({ customer: { name }, items: state.cart, total }));
  window.location.href = '/payment.html#' + orderData;
});

async function init() {
  try {
    let res = await fetch('/api/menu');
    if(!res.ok) res = await fetch('menu.json');
    if(res.ok) state.menu = await res.json();
  } catch(e) {
    console.error("Could not load menu.json", e);
  }
  renderMenu();
  renderCart();
}

init();
