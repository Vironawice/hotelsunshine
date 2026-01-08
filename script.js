// 1. Data: Menu Items (Fetched from server)
let menuData = [];

let currentCategory = 'All';
let cart = [];

// 2. Render Menu
const menuContainer = document.getElementById('menu-container');

function renderMenu() {
    const searchTerm = document.getElementById('search-bar').value.toLowerCase();
    const filtered = menuData.filter(item => {
        const matchesCategory = currentCategory === 'All' || item.category === currentCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchTerm);
        return matchesCategory && matchesSearch;
    });

    menuContainer.innerHTML = filtered.map(item => `
        <div class="menu-item">
            ${item.image ? 
                `<img src="${item.image}" alt="${item.name}" class="item-img">` : 
                `<div class="item-img"><span>${item.name}</span></div>`
            }
            <div class="item-details">
                <div class="item-name">${item.name}</div>
                <div class="item-desc">${item.desc}</div>
                <div class="item-price">₦${item.price.toLocaleString()}</div>
                <button class="add-btn" onclick="addToCart(${item.id})">Add to Order</button>
            </div>
        </div>
    `).join('');
}

// 3. Cart Logic
function addToCart(id) {
    const item = menuData.find(i => i.id === id);
    const existingItem = cart.find(i => i.id === id);

    if (existingItem) {
        existingItem.qty++;
    } else {
        cart.push({ ...item, qty: 1 });
    }
    updateCartUI();
}

function removeFromCart(id) {
    const index = cart.findIndex(i => i.id === id);
    if (index > -1) {
        if (cart[index].qty > 1) {
            cart[index].qty--;
        } else {
            cart.splice(index, 1);
        }
    }
    updateCartUI();
}

function updateCartUI() {
    const cartItemsContainer = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p style="text-align:center; color:#888; margin-top:20px;">Your cart is empty.</p>';
        totalEl.innerText = '₦0.00';
        return;
    }

    let total = 0;
    cartItemsContainer.innerHTML = cart.map(item => {
        total += item.price * item.qty;
        return `
            <div class="cart-item">
                <div>
                    <strong>${item.name}</strong><br>
                    <small>₦${item.price.toLocaleString()}</small>
                </div>
                <div class="cart-controls">
                    <button onclick="removeFromCart(${item.id})">-</button>
                    <span style="margin: 0 10px;">${item.qty}</span>
                    <button onclick="addToCart(${item.id})">+</button>
                </div>
            </div>
        `;
    }).join('');

    totalEl.innerText = '₦' + total.toLocaleString();
}

// 4. Receipt Logic
async function generateReceipt() {
    if (cart.length === 0) {
        alert("Please add items to your order first.");
        return;
    }

    const modal = document.getElementById('receipt-modal');
    const receiptBody = document.getElementById('receipt-body');
    const dateEl = document.getElementById('receipt-date');
    const orderIdEl = document.getElementById('order-id');
    const totalEl = document.getElementById('receipt-total-amount');

    // Generate Details
    const now = new Date();
    const orderId = Math.floor(1000 + Math.random() * 9000);

    // Send order to server
    try {
        await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: orderId,
                items: cart,
                total: cart.reduce((sum, item) => sum + (item.price * item.qty), 0),
                createdAt: now.toISOString()
            })
        });
    } catch (e) {
        console.error("Failed to save order", e);
        alert("Note: Order could not be saved to server, but here is your receipt.");
    }

    dateEl.innerText = now.toLocaleString('en-NG');
    orderIdEl.innerText = '#' + orderId;

    let total = 0;
    receiptBody.innerHTML = cart.map(item => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;
        return `
            <div class="receipt-row">
                <span>${item.qty}x ${item.name}</span>
                <span>₦${itemTotal.toLocaleString()}</span>
            </div>
        `;
    }).join('');

    totalEl.innerText = '₦' + total.toLocaleString();
    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('receipt-modal').style.display = 'none';
    // Optional: Clear cart after order
    cart = [];
    updateCartUI();
}

// Mobile Cart Toggle
function toggleCart() {
    document.getElementById('cart-panel').classList.toggle('open');
}

function renderCategories() {
    const categories = ['All', ...new Set(menuData.map(i => i.category || 'Others'))];
    const container = document.getElementById('category-filters');
    
    container.innerHTML = categories.map(cat => 
        `<button class="filter-btn ${cat === 'All' ? 'active' : ''}" onclick="filterMenu('${cat}')">${cat}</button>`
    ).join('');
}

window.filterMenu = (category) => {
    currentCategory = category;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText === category);
    });
    renderMenu();
};

// Initialize
async function initMenu() {
    try {
        const response = await fetch('/api/menu');
        menuData = await response.json();
        renderCategories();
        document.getElementById('search-bar').addEventListener('input', () => renderMenu());
        renderMenu();
    } catch (error) {
        console.error('Error loading menu:', error);
        menuContainer.innerHTML = '<p style="text-align:center; padding:20px;">Failed to load menu.</p>';
    }
}

initMenu();