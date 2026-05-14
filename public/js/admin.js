/**
 * admin.js — Admin Panel
 * Depends on: components.js, api.js
 */

let currentAdminId    = null;
let highlightedOrderId = null;
const searchTimers    = {};

/* ─── Auth check ─────────────────────────────────────────── */

async function checkAdminAuth() {
  try {
    const data = await window.apiFetch('/api/me');
    if (data.success && data.user.role === 'admin') {
      currentAdminId = data.user._id;
      document.getElementById('adminGreeting').innerText = `Hello, ${data.user.name}`;
      loadAdminData();
    } else {
      window.location.href = '/login.html';
    }
  } catch {
    window.location.href = '/login.html';
  } finally {
    window.hideLoader();
  }
}

/* ─── Load all dashboard data ────────────────────────────── */

async function loadAdminData() {
  try {
    // Stats
    const statsData = await window.apiFetch('/api/admin/stats');
    if (statsData.success) {
      const s = statsData.stats;
      document.getElementById('stat-totalOrders').innerText  = s.totalOrders;
      document.getElementById('stat-pendingOrders').innerText = s.pendingOrders;
      document.getElementById('stat-activeOrders').innerText = s.activeOrders;
      document.getElementById('stat-totalUsers').innerText   = s.totalUsers;
    }

    // Orders (main tab + recent dashboard cards)
    loadAdminOrders(1);
    loadRecentOrders();

    // Users & messages
    loadAdminUsers(1);
    loadAdminMessages(1);
  } catch (err) {
    console.error('Admin data load failed:', err);
  }
}

/* ─── Recent orders (dashboard tab) ─────────────────────── */

async function loadRecentOrders() {
  const data = await window.apiFetch('/api/admin/orders?limit=5');
  if (!data.orders) return;

  const tbody = document.querySelector('#recentOrdersTable tbody');
  tbody.innerHTML = data.orders.map(order => `
    <tr>
      <td>
        <div class="user-cell">
          <span class="user-name">${order.user?.name || 'Unknown'}</span>
          <span class="user-email">${order.user?.email || '-'}</span>
        </div>
      </td>
      <td>${order.orderId || '-'}</td>
      <td>${order.shipmentName}</td>
      <td><span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span></td>
      <td><button class="dashboard-action-btn" onclick="goToOrder('${order._id}')">Update</button></td>
    </tr>`).join('');
}

/* ─── Tab switching ──────────────────────────────────────── */

function switchAdminTab(tabId) {
  window.showLoader();
  setTimeout(() => {
    document.querySelectorAll('.admin-tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));

    const activeTab  = document.getElementById(tabId);
    if (activeTab) activeTab.classList.add('active');

    const activeMenu = Array.from(document.querySelectorAll('.menu-item'))
      .find(item => item.getAttribute('onclick')?.includes(`'${tabId}'`));
    if (activeMenu) activeMenu.classList.add('active');

    const titles = {
      dashboard: { t: 'Admin Dashboard',   s: 'Overview of your fulfilment business' },
      orders:    { t: 'Order Management',  s: 'Monitor and update platform-wide orders' },
      users:     { t: 'User Management',   s: 'View and manage registered clients and team members' },
      messages:  { t: 'Customer Messages', s: 'View submissions from the contact form' },
      inventory: { t: 'Inventory Management', s: 'Manage product stock levels for clients' },
      settings:  { t: 'Settings',          s: 'Configure platform parameters' }
    };

    if (titles[tabId]) {
      document.getElementById('tabTitle').innerText    = titles[tabId].t;
      document.getElementById('tabSubtitle').innerText = titles[tabId].s;
    }

    if (tabId !== 'orders') highlightedOrderId = null;

    if (tabId === 'dashboard') loadAdminData();
    if (tabId === 'orders')    loadAdminOrders(1);
    if (tabId === 'users')     loadAdminUsers(1);
    if (tabId === 'messages')  loadAdminMessages(1);
    if (tabId === 'inventory') initAdminInventory();

    window.hideLoader();
  }, 300);
}

/* ─── Search debounce (shared across tabs) ───────────────── */

function handleSearch(tab) {
  clearTimeout(searchTimers[tab]);
  searchTimers[tab] = setTimeout(() => {
    if (tab === 'orders')   loadAdminOrders(1);
    if (tab === 'users')    loadAdminUsers(1);
    if (tab === 'messages') loadAdminMessages(1);
  }, 300);
}

/* ─── Orders (admin) ─────────────────────────────────────── */

function goToOrder(orderId) {
  highlightedOrderId = orderId;
  switchAdminTab('orders');
  loadAdminOrders(1);
}

async function loadAdminOrders(page = 1) {
  const status = document.getElementById('orderStatusFilter').value;
  const search = document.getElementById('orderSearchInput').value;

  const data = await window.apiFetch(
    `/api/admin/orders?page=${page}&limit=10&status=${status}&search=${encodeURIComponent(search)}`
  );

  const tbody = document.querySelector('#allOrdersTable tbody');
  tbody.innerHTML = '';

  (data.orders || []).forEach(order => {
    const row = document.createElement('tr');
    if (highlightedOrderId === order._id) {
      row.className = 'row-highlight';
      setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
    row.innerHTML = `
      <td>${new Date(order.createdAt).toLocaleDateString()}</td>
      <td>
        <div class="user-cell">
          <span class="user-name">${order.user?.name || 'Unknown'}</span>
          <span class="user-email">${order.user?.businessName || 'Regular User'}</span>
        </div>
      </td>
      <td><strong>${order.orderId || '-'}</strong></td>
      <td>${order.shipmentName}</td>
      <td>${order.trackingNumber}</td>
      <td><span class="status-badge status-${order.status.toLowerCase().replace(/\s/g, '-')}">${order.status}</span></td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <select class="admin-status-dropdown" onchange="updateOrderStatus('${order._id}', this.value)">
            ${['Pending Arrival','Received','In Inspection','Stored','Processing','Shipped','Completed','Cancelled'].map(s => `
              <option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <button class="portal-btn-sm" style="background: #fee2e2; color: #b91c1c; border-color: #fecaca;" onclick="deleteShipment('${order._id}', '${order.status}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </td>`;
    tbody.appendChild(row);
  });

  window.renderPagination('ordersPagination', data.pagination, 'loadAdminOrders');
}

/* ─── Inventory (admin) ──────────────────────────────────── */

async function initAdminInventory() {
  const data = await window.apiFetch('/api/admin/users?role=user');
  const select = document.getElementById('inventoryUserFilter');
  if (!select) return;

  select.innerHTML = '<option value="">Select Client to Manage</option>' + 
    (data.users || []).map(u => `<option value="${u._id}">${u.name} (${u.businessName || u.email})</option>`).join('');
  
  loadAdminInventory();
}

async function loadAdminInventory() {
  const userId = document.getElementById('inventoryUserFilter').value;
  const controls = document.getElementById('inventoryControls');
  
  if (userId) {
    controls.style.display = 'block';
  } else {
    controls.style.display = 'none';
  }

  const url = userId ? `/api/admin/inventory?userId=${userId}` : '/api/admin/inventory';
  const data = await window.apiFetch(url);
  const tbody = document.querySelector('#adminInventoryTable tbody');
  if (!tbody || !data.success) return;

  if (data.inventory.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No inventory found</td></tr>';
    return;
  }

  tbody.innerHTML = data.inventory.map(item => `
    <tr>
      <td>${item.user?.name || 'Unknown'}</td>
      <td><strong>${item.productName}</strong></td>
      <td>${item.sku || '-'}</td>
      <td>${item.quantity}</td>
      <td>${new Date(item.updatedAt).toLocaleDateString()}</td>
      <td>
        <button class="portal-btn-sm" style="background: #fee2e2; color: #b91c1c; border-color: #fecaca;" onclick="deleteInventoryItem('${item._id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function handleInventorySubmit(event) {
  event.preventDefault();
  const userId = document.getElementById('inventoryUserFilter').value;
  const productName = document.getElementById('inv_productName').value;
  const sku = document.getElementById('inv_sku').value;
  const quantity = document.getElementById('inv_quantity').value;

  if (!userId) return window.showToast('Select a user first', 'error');

  const data = await window.apiPost('/api/admin/inventory', { userId, productName, sku, quantity });
  if (data.success) {
    window.showToast(data.message, 'success');
    document.getElementById('inventoryForm').reset();
    loadAdminInventory();
  } else {
    window.showToast(data.message, 'error');
  }
}

async function deleteInventoryItem(id) {
  if (!await window.showConfirm('Delete Item?', 'Are you sure you want to remove this product from inventory?')) return;
  const data = await window.apiDelete(`/api/admin/inventory/${id}`);
  if (data.success) {
    window.showToast(data.message, 'success');
    loadAdminInventory();
  }
}

async function updateOrderStatus(orderId, newStatus) {
  const data = await window.apiPut(`/api/admin/orders/${orderId}/status`, { status: newStatus });
  if (data.success) {
    window.showToast('Shipment status updated', 'success');
    loadAdminData();
  } else {
    window.showToast(data.message || 'Failed to update status', 'error');
  }
}

async function deleteShipment(shipmentId, status) {
  const restricted = ['Processing', 'Shipped', 'Completed'];
  if (restricted.includes(status)) {
    window.showToast(`Shipments in "${status}" status cannot be deleted for safety.`, 'error');
    return;
  }

  if (!await window.showConfirm('Delete Shipment?', 'Are you sure you want to delete this shipment? This action cannot be undone.')) return;

  const data = await window.apiDelete(`/api/admin/orders/${shipmentId}`);
  if (data.success) {
    window.showToast(data.message, 'success');
    loadAdminData();
  } else {
    window.showToast(data.message || 'Delete failed', 'error');
  }
}

/* ─── Users (admin) ──────────────────────────────────────── */

async function loadAdminUsers(page = 1) {
  try {
    const role   = document.getElementById('roleFilter').value;
    const search = document.getElementById('userSearchInput').value;
    const data   = await window.apiFetch(
      `/api/admin/users?role=${role}&page=${page}&limit=10&search=${encodeURIComponent(search)}`
    );

    const tbody = document.querySelector('#allUsersTable tbody');
    tbody.innerHTML = (data.users || []).map(u => {
      const isSelf = u._id === currentAdminId;
      return `
        <tr>
          <td><strong>${u.name}</strong></td>
          <td>${u.email}</td>
          <td><span class="role-badge role-${u.role}">${u.role}</span></td>
          <td>${u.businessName || '-'}</td>
          <td>${new Date(u.createdAt).toLocaleDateString()}</td>
          <td>
            <div class="admin-action-btns">
              <button class="admin-table-btn details" onclick="handleViewUserDetails('${u._id}')">Details</button>
              <button class="admin-table-btn delete" ${isSelf ? 'disabled' : ''}
                onclick="handleDeleteUser('${u._id}', '${u.name.replace(/'/g, "\\'")}')">Delete</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    window.renderPagination('usersPagination', data.pagination, 'loadAdminUsers');
  } catch {
    window.showToast('Failed to load users', 'error');
  }
}

async function handleDeleteUser(userId, userName) {
  if (!await window.showConfirm('Delete User', `Are you sure you want to delete ${userName}? This cannot be undone.`)) return;
  const data = await window.apiDelete(`/api/admin/users/${userId}`);
  if (data.success) {
    window.showToast(data.message, 'success');
    loadAdminUsers();
  } else {
    window.showToast(data.message, 'error');
  }
}

async function handleViewUserDetails(userId) {
  try {
    const data = await window.apiFetch(`/api/admin/users?role=all`);
    const user = (data.users || []).find(u => u._id === userId);
    if (!user) return window.showToast('User not found', 'error');

    document.getElementById('userDetailsContent').innerHTML = `
      <div class="user-details-grid">
        <div class="detail-item"><label>Full Name</label><span>${user.name}</span></div>
        <div class="detail-item"><label>Email</label><span>${user.email}</span></div>
        <div class="detail-item"><label>Business Name</label><span>${user.businessName || 'N/A'}</span></div>
        <div class="detail-item"><label>Role</label><span>${user.role}</span></div>
        <div class="detail-item"><label>Phone</label><span>${user.phone || 'N/A'}</span></div>
        <div class="detail-item"><label>Member Since</label><span>${new Date(user.createdAt).toLocaleDateString()}</span></div>
      </div>`;

    document.getElementById('userDetailsModal').style.display = 'flex';
  } catch {
    window.showToast('Failed to load user details', 'error');
  }
}

function closeUserDetailsModal() {
  document.getElementById('userDetailsModal').style.display = 'none';
}

/* ─── Messages (admin) ───────────────────────────────────── */

async function loadAdminMessages(page = 1) {
  try {
    const search = document.getElementById('messageSearchInput').value;
    const data   = await window.apiFetch(
      `/api/admin/messages?page=${page}&limit=10&search=${encodeURIComponent(search)}`
    );

    const tbody = document.querySelector('#messagesTable tbody');

    if (!data.messages || data.messages.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-empty-cell">No messages yet</td></tr>';
      return;
    }

    tbody.innerHTML = data.messages.map(msg => `
      <tr>
        <td class="table-nowrap">${new Date(msg.createdAt).toLocaleDateString()}</td>
        <td>
          <div class="user-cell">
            <span class="user-name">${msg.name}</span>
            <span class="user-email">${msg.email}</span>
          </div>
        </td>
        <td><strong>${msg.subject || 'No Subject'}</strong></td>
        <td class="table-msg-cell">${msg.message}</td>
      </tr>`).join('');

    window.renderPagination('messagesPagination', data.pagination, 'loadAdminMessages');
  } catch {
    console.error('Failed to load messages');
  }
}

/* ─── Create admin ───────────────────────────────────────── */

async function handleCreateAdmin(event) {
  event.preventDefault();
  if (!window.validateForm('createAdminForm')) return;

  const name     = document.getElementById('adminName').value;
  const email    = document.getElementById('adminEmail').value;
  const password = document.getElementById('adminPassword').value;

  const btn     = document.getElementById('createAdminBtn');
  const restore = window.setBtnLoading(btn, 'Creating...');

  const data = await window.apiPost('/api/admin/create-admin', { name, email, password });

  if (data.success) {
    window.showToast(data.message, 'success');
    document.getElementById('createAdminForm').reset();
    loadAdminUsers();
  } else {
    window.showToast(data.message || 'Failed to create admin', 'error');
  }

  restore();
}

/* ─── Logout ─────────────────────────────────────────────── */

async function handleAdminLogout() {
  const res = await fetch('/api/logout', { method: 'POST' });
  if ((await res.json()).success) {
    window.location.href = '/login.html?logout=success';
  }
}

/* ─── Boot ───────────────────────────────────────────────── */

window.addEventListener('DOMContentLoaded', () => {
  window.showLoader();
  checkAdminAuth();
});
