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
  const ta = document.getElementById('menu-json');
  ta.value = 'Loading...';
  try{
    currentMenuData = await fetchMenu();
    ta.value = JSON.stringify(currentMenuData, null, 2);
    renderMenuTable(currentMenuData);
    populateItemSelect(currentMenuData);
    populateCategoryList(currentMenuData);
    populateAdminCategoryFilter(currentMenuData);
  }catch(e){ ta.value = 'Error loading menu: ' + e.message; }
  
  // Load custom sound setting
  try {
    const res = await fetch('/api/settings/sound');
    const data = await res.json();
    if (data.url) notificationSoundUrl = data.url;
  } catch (e) { console.error('Failed to load sound setting'); }
}

document.getElementById('save').addEventListener('click', async ()=>{
  if(!confirm('Are you sure you want to save changes to the menu JSON?')) return;
  const ta = document.getElementById('menu-json');
  const status = document.getElementById('status');
  try{
    const parsed = JSON.parse(ta.value);
    const res = await fetch('/api/menu', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(parsed) });
    if(!res.ok){ const e = await res.json(); status.textContent = 'Save failed: ' + (e.error||res.status); status.style.color='red'; return; }
    status.textContent = 'Saved'; status.style.color='green';
  }catch(e){ status.textContent = 'Invalid JSON: ' + e.message; status.style.color='red'; }
});

document.getElementById('reload').addEventListener('click', load);

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
  html += '<tr style="background:#eee; text-align:left;"><th style="padding:10px; border:1px solid #ddd;">Image</th><th style="padding:10px; border:1px solid #ddd;">Name</th><th style="padding:10px; border:1px solid #ddd;">Price</th><th style="padding:10px; border:1px solid #ddd;">Category</th><th style="padding:10px; border:1px solid #ddd;">Action</th></tr>';
  
  paginatedItems.forEach((item) => {
      const index = currentMenuData.findIndex(i => i.id === item.id);
      html += `<tr draggable="true" data-index="${index}" style="cursor: move; transition: background 0.2s;">
          <td style="padding:10px; border:1px solid #ddd;">${item.image ? `
            <div style="position:relative; display:inline-block;">
                <img src="${item.image}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;">
                <button onclick="deleteItemImage(${item.id})" style="position:absolute;top:-5px;right:-5px;background:red;color:white;border:none;border-radius:50%;width:18px;height:18px;font-size:12px;cursor:pointer;line-height:1;">&times;</button>
            </div>
          ` : ''}</td>
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

window.deleteItemImage = async (id) => {
  if(!confirm('Delete this image?')) return;
  try {
    const res = await fetch('/api/delete-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if(res.ok) load();
    else alert('Failed to delete image');
  } catch(e) { console.error(e); }
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

document.getElementById('upload-sound-btn').addEventListener('click', async () => {
  const fileInput = document.getElementById('sound-input');
  if (!fileInput.files[0]) return alert('Please select an audio file.');

  const formData = new FormData();
  formData.append('sound', fileInput.files[0]);

  try {
    const res = await fetch('/api/upload-sound', { method: 'POST', body: formData });
    if (res.ok) {
      const data = await res.json();
      notificationSoundUrl = data.url;
      alert('Sound uploaded successfully!');
      fileInput.value = '';
    } else { alert('Upload failed.'); }
  } catch (e) { alert('Error: ' + e.message); }
});

document.getElementById('logout').addEventListener('click', () => {
  sessionStorage.removeItem('authToken');
  localStorage.removeItem('authToken');
  window.location.href = '/login.html';
});

// Load both on start
load();