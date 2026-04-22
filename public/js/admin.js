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
      <td>${order.productName}</td>
      <td><span class="order-type-badge">${order.type}</span></td>
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
  const type   = document.getElementById('orderTypeFilter').value;
  const search = document.getElementById('orderSearchInput').value;

  const data = await window.apiFetch(
    `/api/admin/orders?page=${page}&limit=10&status=${status}&type=${type}&search=${encodeURIComponent(search)}`
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
      <td><strong>${order.productName}</strong><br><small>${order.notes?.substring(0, 30) || 'No notes'}...</small></td>
      <td>${order.type}</td>
      <td>${order.quantity}</td>
      <td><span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span></td>
      <td>
        <select class="admin-status-dropdown" onchange="updateOrderStatus('${order._id}', this.value)">
          ${['Pending','Processing','Shipped','Completed','Cancelled'].map(s => `
            <option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>`;
    tbody.appendChild(row);
  });

  window.renderPagination('ordersPagination', data.pagination, 'loadAdminOrders');
}

async function updateOrderStatus(orderId, newStatus) {
  const data = await window.apiPut(`/api/admin/orders/${orderId}/status`, { status: newStatus });
  if (data.success) {
    window.showToast(data.message, 'success');
    loadAdminData();
  } else {
    window.showToast('Failed to update status', 'error');
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
