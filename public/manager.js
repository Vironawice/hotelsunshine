if (!sessionStorage.getItem('authToken') && !localStorage.getItem('authToken')) {
  window.location.href = '/login.html';
}

async function fetchMenu(){
  const res = await fetch('/api/menu');
  if(!res.ok) throw new Error('failed to fetch');
  return await res.json();
}

let currentMenuData = [];
let editingItemId = null;
let currentPage = 1;
const itemsPerPage = 5;
let lastOrderId = null;
let notificationSoundUrl = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

async function load(){
  try{
    currentMenuData = await fetchMenu();
    renderMenuTable(currentMenuData);
    populateItemSelect(currentMenuData);
    populateCategoryList(currentMenuData);
    populateAdminCategoryFilter(currentMenuData);
  }catch(e){ console.error('Error loading menu: ' + e.message); }
  
  // Load custom sound setting
  try {
    const res = await fetch('/api/settings/sound');
    const data = await res.json();
    if (data.url) notificationSoundUrl = data.url;
  } catch (e) { console.error('Failed to load sound setting'); }
}

/* Visual Menu List Logic */
function renderMenuTable(menu) {
  const container = document.getElementById('menu-table-container');
  if(!container) return;
  const filterCat = document.getElementById('admin-category-filter')?.value || 'All';
  const searchTerm = document.getElementById('admin-search-bar')?.value.toLowerCase() || '';
  
  const filteredItems = menu.filter(item => {
    const matchesCat = filterCat === 'All' || (item.category || 'Others') === filterCat;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm);
    return matchesCat && matchesSearch;
  });
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  
  if (currentPage > totalPages) currentPage = totalPages || 1;
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  let html = '<table id="menu-table" style="width:100%; border-collapse: collapse; background: white;">';
  html += '<tr style="background:#eee; text-align:left;"><th style="padding:10px; border:1px solid #ddd;">Name</th><th style="padding:10px; border:1px solid #ddd;">Price</th><th style="padding:10px; border:1px solid #ddd;">Category</th><th style="padding:10px; border:1px solid #ddd;">Action</th></tr>';
  
  paginatedItems.forEach((item) => {
      const index = currentMenuData.findIndex(i => i.id === item.id);
      html += `<tr draggable="true" data-index="${index}" style="cursor: move; transition: background 0.2s;">
          <td style="padding:10px; border:1px solid #ddd;">${item.name}</td>
          <td style="padding:10px; border:1px solid #ddd;">₦${item.price}</td>
          <td style="padding:10px; border:1px solid #ddd;">${item.category || '-'}</td>
          <td style="padding:10px; border:1px solid #ddd;">
              <button onclick="editMenuItem(${item.id})" style="background:#2196F3; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer; margin-right:5px;">Edit</button>
              <button onclick="deleteMenuItem(${item.id})" style="background:#f44336; color:white; border:none; padding:5px 10px; border-radius:3px; cursor:pointer;">Delete</button>
          </td>
      </tr>`;
  });
  html += '</table>';

  if (totalPages > 1) {
    html += `<div style="margin-top: 15px; display: flex; justify-content: center; align-items: center; gap: 15px;">
      <button onclick="changePage(-1)" ${currentPage === 1 ? 'disabled' : ''} style="padding: 5px 15px; cursor: pointer;">&laquo; Prev</button>
      <span>Page <strong>${currentPage}</strong> of ${totalPages}</span>
      <button onclick="changePage(1)" ${currentPage === totalPages ? 'disabled' : ''} style="padding: 5px 15px; cursor: pointer;">Next &raquo;</button>
    </div>`;
  }

  container.innerHTML = html;

  const table = document.getElementById('menu-table');
  let draggedItem = null;

  table.addEventListener('dragstart', (e) => {
    draggedItem = e.target;
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
  });

  table.addEventListener('dragend', (e) => {
    e.target.style.opacity = '1';
    draggedItem = null;
  });

  table.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  table.addEventListener('drop', async (e) => {
    e.preventDefault();
    const target = e.target.closest('tr');
    if (target && target !== draggedItem && target.hasAttribute('data-index')) {
        const fromIndex = parseInt(draggedItem.getAttribute('data-index'));
        const toIndex = parseInt(target.getAttribute('data-index'));
        
        const itemToMove = currentMenuData[fromIndex];
        currentMenuData.splice(fromIndex, 1);
        currentMenuData.splice(toIndex, 0, itemToMove);
        
        renderMenuTable(currentMenuData);
        try {
            await saveMenuData(currentMenuData);
        } catch (err) {
            alert('Failed to save new order');
            load();
        }
    }
  });
}

window.changePage = (delta) => {
  currentPage += delta;
  renderMenuTable(currentMenuData);
};

window.editMenuItem = (id) => {
  const item = currentMenuData.find(i => i.id === id);
  if(!item) return;
  
  document.getElementById('new-name').value = item.name;
  document.getElementById('new-price').value = item.price;
  document.getElementById('new-category').value = item.category || '';
  document.getElementById('new-desc').value = item.desc || '';
  
  editingItemId = id;
  document.getElementById('add-item-btn').textContent = 'Update Item';
  document.getElementById('cancel-edit-btn').style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteMenuItem = async (id) => {
  if(!confirm('Are you sure you want to delete this item?')) return;
  const newMenu = currentMenuData.filter(i => i.id !== id);
  await saveMenuData(newMenu);
  load();
};

async function saveMenuData(data) {
  const res = await fetch('/api/menu', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
  if(!res.ok) throw new Error('Failed to save');
}

/* Image Upload Logic */
function populateItemSelect(menu) {
  const sel = document.getElementById('item-select');
  sel.innerHTML = menu.map(item => `<option value="${item.id}">${item.name}</option>`).join('');
}

function populateCategoryList(menu) {
  const categories = [...new Set(menu.map(i => i.category || 'Others'))];
  const dl = document.getElementById('category-list');
  if(dl) dl.innerHTML = categories.map(c => `<option value="${c}">`).join('');
}

function populateAdminCategoryFilter(menu) {
  const sel = document.getElementById('admin-category-filter');
  if(!sel) return;
  const current = sel.value;
  const categories = ['All', ...new Set(menu.map(i => i.category || 'Others'))];
  sel.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
  sel.value = current;
  sel.onchange = () => {
    currentPage = 1;
    renderMenuTable(currentMenuData);
  };
}

document.getElementById('admin-search-bar')?.addEventListener('input', () => {
  currentPage = 1;
  renderMenuTable(currentMenuData);
});

function resetForm() {
  document.getElementById('new-name').value = '';
  document.getElementById('new-price').value = '';
  document.getElementById('new-category').value = '';
  document.getElementById('new-desc').value = '';
  editingItemId = null;
  document.getElementById('add-item-btn').textContent = 'Add Item to List';
  document.getElementById('cancel-edit-btn').style.display = 'none';
}

document.getElementById('add-item-btn').addEventListener('click', async () => {
  const name = document.getElementById('new-name').value.trim();
  const price = parseFloat(document.getElementById('new-price').value);
  const category = document.getElementById('new-category').value.trim();
  const desc = document.getElementById('new-desc').value.trim();

  if (!name || isNaN(price) || !category) return alert('Please enter Name, Price, and Category.');

  try {
    if (editingItemId) {
      const newMenu = currentMenuData.map(i => {
        if (i.id === editingItemId) return { ...i, name, price, desc, category };
        return i;
      });
      await saveMenuData(newMenu);
      alert('Item updated successfully!');
    } else {
      const newId = currentMenuData.length > 0 ? Math.max(...currentMenuData.map(i => i.id)) + 1 : 1;
      const newItem = { id: newId, name, price, desc, category };
      const newMenu = [...currentMenuData, newItem];
      await saveMenuData(newMenu);
      alert('Item added successfully!');
    }
    resetForm();
    load();
  } catch (e) { alert('Error adding item: ' + e.message); }
});

document.getElementById('cancel-edit-btn').addEventListener('click', resetForm);

document.getElementById('upload-btn').addEventListener('click', async () => {
  const id = document.getElementById('item-select').value;
  const fileInput = document.getElementById('image-input');
  
  if (!fileInput.files[0]) return alert('Please select an image file.');

  const formData = new FormData();
  formData.append('image', fileInput.files[0]);
  formData.append('id', id);

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (res.ok) {
      alert('Image uploaded successfully!');
      load(); // Reload menu to show new image path
      fileInput.value = '';
    } else {
      alert('Upload failed.');
    }
  } catch (e) { alert('Error: ' + e.message); }
});

document.getElementById('logout').addEventListener('click', () => {
  sessionStorage.removeItem('authToken');
  localStorage.removeItem('authToken');
  window.location.href = '/login.html';
});

/* Orders Logic */
async function loadOrders() {
  const container = document.getElementById('orders-list');
  container.innerHTML = '<p>Loading orders...</p>';
  
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) throw new Error('Failed to fetch orders');
    const orders = await res.json();

    // Check for new orders and play sound
    if (orders.length > 0) {
      const latestId = orders[0].id;
      if (lastOrderId !== null && latestId !== lastOrderId) {
        new Audio(notificationSoundUrl).play().catch(e => console.log('Audio play failed', e));
      }
      lastOrderId = latestId;
    }

    renderChart(orders);

    if (orders.length === 0) {
      container.innerHTML = '<p>No orders found.</p>';
      return;
    }

    container.innerHTML = orders.map(order => {
      const date = new Date(order.createdAt).toLocaleString();
      const total = typeof order.total === 'number' ? order.total.toFixed(2) : order.total;
      const itemsHtml = (order.items || []).map(i => `<li>${i.name} (x${i.qty})</li>`).join('');
      const status = order.status || 'Pending';
      const isCompleted = status === 'Completed';
      
      return `
        <div class="panel" style="margin-bottom: 15px; border: 1px solid #ddd; padding: 15px; border-radius: 8px; background: #fff;">
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
            <strong>Order #${order.id}</strong>
            <span style="color:#666;">${date}</span>
          </div>
          <div><strong>Customer:</strong> ${order.customer ? order.customer.name : 'Guest'}</div>
          <div><strong>Location:</strong> ${order.location || 'N/A'}</div>
          <div><strong>Status:</strong> <span style="font-weight:bold; color:${isCompleted ? 'green' : 'orange'}">${status}</span></div>
          <div style="margin: 10px 0;"><strong>Items:</strong> <ul style="margin: 5px 0; padding-left: 20px;">${itemsHtml}</ul></div>
          <div style="font-size: 1.1em; font-weight: bold;">Total: $${total}</div>
          ${!isCompleted ? `<button onclick="updateStatus(${order.id}, 'Completed')" style="margin-top:10px; background:#4CAF50; color:white; border:none;">Mark Completed</button>` : ''}
          <button onclick="deleteOrder(${order.id})" style="margin-top:10px; margin-left:10px; background:#f44336; color:white; border:none;">Delete</button>
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = '<p style="color:red">Error loading orders: ' + e.message + '</p>';
  }
}

let chartInstance = null;
function renderChart(orders) {
  const ctx = document.getElementById('sales-chart');
  if (!ctx) return;

  const sales = {};
  orders.forEach(o => {
    // Aggregate sales by date (YYYY-MM-DD)
    if (o.createdAt) {
      const date = o.createdAt.split('T')[0];
      sales[date] = (sales[date] || 0) + (o.total || 0);
    }
  });

  const labels = Object.keys(sales).sort();
  const data = labels.map(date => sales[date]);

  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Total Sales (₦)',
        data: data,
        backgroundColor: '#FF8C00'
      }]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
}

window.updateStatus = async (id, status) => {
  if (!confirm(`Mark order #${id} as ${status}?`)) return;
  try {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) loadOrders();
    else alert('Failed to update order');
  } catch (e) { alert('Error: ' + e.message); }
};

window.deleteOrder = async (id) => {
  if (!confirm(`Are you sure you want to delete order #${id}?`)) return;
  try {
    const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
    if (res.ok) loadOrders();
    else alert('Failed to delete order');
  } catch (e) { alert('Error: ' + e.message); }
};

document.getElementById('export-csv').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) throw new Error('Failed to fetch orders');
    const orders = await res.json();
    
    if (orders.length === 0) return alert('No orders to export');

    const headers = ['Order ID', 'Date', 'Customer', 'Items', 'Total', 'Status'];
    const rows = orders.map(o => {
      const date = new Date(o.createdAt).toLocaleString().replace(',', '');
      const customer = o.customer ? o.customer.name : 'Guest';
      const items = (o.items || []).map(i => `${i.qty}x ${i.name}`).join('; ');
      const total = o.total;
      const status = o.status || 'Pending';
      
      // Escape quotes and wrap in quotes to handle commas
      return [
        o.id,
        `"${date}"`,
        `"${customer.replace(/"/g, '""')}"`,
        `"${items.replace(/"/g, '""')}"`,
        total,
        status
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    alert('Export failed: ' + e.message);
  }
});

document.getElementById('print-sales').addEventListener('click', () => window.print());

document.getElementById('refresh-orders').addEventListener('click', loadOrders);

// Load both on start
load();
loadOrders();

// Poll for new orders every 10 seconds
setInterval(loadOrders, 10000);