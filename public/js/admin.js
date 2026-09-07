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
      window.location.href = '/login';
    }
  } catch {
    window.location.href = '/login';
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
    loadAdminOrders('inbound', 1);
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
    if (tabId === 'orders')    {
      switchAdminShipmentTab('inbound');
    }
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
}

function handleAdminOrderSearch(type) {
  clearTimeout(searchTimers[`orders_${type}`]);
  searchTimers[`orders_${type}`] = setTimeout(() => {
    loadAdminOrders(type, 1);
  }, 300);
}

function switchAdminShipmentTab(type) {
  document.getElementById('btnAdminInbound').style.background = type === 'inbound' ? '#3b82f6' : 'white';
  document.getElementById('btnAdminInbound').style.color = type === 'inbound' ? 'white' : '#475569';
  document.getElementById('btnAdminOutbound').style.background = type === 'outbound' ? '#3b82f6' : 'white';
  document.getElementById('btnAdminOutbound').style.color = type === 'outbound' ? 'white' : '#475569';

  document.getElementById('adminInboundSection').style.display = type === 'inbound' ? 'block' : 'none';
  document.getElementById('adminOutboundSection').style.display = type === 'outbound' ? 'block' : 'none';

  loadAdminOrders(type, 1);
}

window.switchAdminShipmentTab = switchAdminShipmentTab;
window.handleAdminOrderSearch = handleAdminOrderSearch;

async function loadAdminOrders(type = 'inbound', page = 1) {
  const status = document.getElementById(`${type}OrderStatusFilter`).value;
  const search = document.getElementById(`${type}OrderSearchInput`).value;

  const data = await window.apiFetch(
    `/api/admin/orders?page=${page}&limit=10&status=${status}&search=${encodeURIComponent(search)}&type=${type}`
  );

  const tbodyId = `#admin${type === 'inbound' ? 'Inbound' : 'Outbound'}Table tbody`;
  const tbody = document.querySelector(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = '';

  (data.orders || []).forEach(order => {
    const row = document.createElement('tr');
    if (highlightedOrderId === order._id) {
      row.className = 'row-highlight';
      setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }

    const statusOptions = type === 'inbound' 
      ? ['Pending Arrival', 'Received', 'In Inspection', 'Stored', 'Cancelled']
      : ['Processing', 'Awaiting Shipping Labels', 'Shipment labels uploaded', 'Shipped', 'Completed', 'Cancelled'];

    let extraBtn = `<button class="portal-btn-sm" onclick="viewOrderDetails('${order._id}')">View</button>`;
    if (type === 'outbound' && order.status === 'Processing') {
      const prodsBase64 = btoa(JSON.stringify(order.products));
      extraBtn += ` <button class="portal-btn-sm" style="background:#3b82f6; color:white; border-color:#2563eb;" onclick="openCartonDetailsModal('${order._id}', '${prodsBase64}')">Add Carton Details</button>`;
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
          ${extraBtn}
          <select class="admin-status-dropdown" onchange="updateOrderStatus('${order._id}', this.value)">
            ${statusOptions.map(s => `
              <option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <button class="portal-btn-sm" style="background: #fee2e2; color: #b91c1c; border-color: #fecaca;" title="Delete" onclick="deleteShipment('${order._id}', '${order.status}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </td>`;
    tbody.appendChild(row);
  });

  const paginationId = `admin${type === 'inbound' ? 'Inbound' : 'Outbound'}Pagination`;
  window.renderPagination(paginationId, data.pagination, (p) => loadAdminOrders(type, p));
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

/* ─── View Shipment Details (Admin) ───────────────────────── */

window.viewOrderDetails = async function(id) {
  const cleanId = typeof id === 'string' ? id.trim() : id;
  if (!cleanId || cleanId === 'undefined') {
    window.showToast('Invalid shipment ID', 'error');
    return;
  }

  window.showLoader();
  try {
    const res = await fetch(`/api/shipment-details?id=${cleanId}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Shipment not found');

    const order = data.order;
    if (!order) throw new Error('Shipment data is empty');

    const modal = document.getElementById('orderDetailModal');
    const content = document.getElementById('orderDetailContent');

    const isOutbound = order.type === 'outbound';
    let detailsHtml = '';

    const allAttachments = isOutbound
      ? [...(order.documents || []), ...(order.shippingLabels || []), ...(order.commercialInvoices || []), ...(order.packingListPDFs || []), ...(order.productImages || [])]
      : [...(order.documents || []), ...(order.commercialInvoices || []), ...(order.packingListPDFs || []), ...(order.productImages || [])];

    window.currentAdminOrderAttachments = allAttachments;

    const clientName = order.user ? (order.user.name || order.user.businessName || order.user.email) : 'Client';
    const statusStr = order.status || 'Pending Arrival';
    const statusClass = 'status-pill-' + statusStr.toLowerCase().replace(/\s+/g, '-');
    const formattedDate = order.estimatedArrival
      ? new Date(order.estimatedArrival).toLocaleDateString()
      : '-';

    if (isOutbound) {
      detailsHtml = `
        <div class="modal-info-grid">
          <div class="modal-info-item">
            <div class="modal-info-icon-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div class="modal-info-content">
              <span class="modal-info-label">Client</span>
              <span class="modal-info-value" title="${clientName}">${clientName}</span>
            </div>
          </div>

          <div class="modal-info-item">
            <div class="modal-info-icon-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <div class="modal-info-content">
              <span class="modal-info-label">Shipment Name</span>
              <span class="modal-info-value" title="${order.shipmentName || '-'}">${order.shipmentName || '-'}</span>
            </div>
          </div>

          <div class="modal-info-item">
            <div class="modal-info-icon-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M16 16s-1.5-2-4-2-4 2-4 2"></path>
                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                <line x1="15" y1="9" x2="15.01" y2="9"></line>
              </svg>
            </div>
            <div class="modal-info-content">
              <span class="modal-info-label">Channel</span>
              <span class="modal-info-value">${order.channel || '-'}</span>
            </div>
          </div>

          <div class="modal-info-item">
            <div class="modal-info-icon-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="6"></circle>
                <circle cx="12" cy="12" r="2"></circle>
              </svg>
            </div>
            <div class="modal-info-content">
              <span class="modal-info-label">Fulfilment Type</span>
              <span class="modal-info-value">${order.fulfilmentType || '-'}</span>
            </div>
          </div>

          <div class="modal-info-item">
            <div class="modal-info-icon-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <div class="modal-info-content">
              <span class="modal-info-label">Shipping Labels Req.</span>
              <span class="modal-info-value">${order.shippingLabelsRequired ? 'Yes' : 'No'}</span>
            </div>
          </div>

          <div class="modal-info-item">
            <div class="modal-info-icon-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div class="modal-info-content">
              <span class="modal-info-label">Status</span>
              <span class="status-pill ${statusClass}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                ${statusStr}
              </span>
            </div>
          </div>
        </div>

        ${order.products && order.products.length > 0 ? `
        <div class="modal-section-card">
          <div class="modal-section-header">
            <div class="modal-section-title-wrap">
              <div class="modal-section-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
              </div>
              <h4 class="modal-section-title">SKU Details</h4>
            </div>
            <span class="modal-count-badge">${order.products.length} ${order.products.length === 1 ? 'Item' : 'Items'}</span>
          </div>
          <div class="modal-sku-table-wrapper">
          <table class="modal-sku-table">
            <thead>
              <tr>
                <th>SKU NAME</th>
                <th>PACK DETAILS</th>
                <th>QUANTITY</th>
              </tr>
            </thead>
            <tbody>
              ${order.products.map(p => `
                <tr>
                  <td>
                    <span class="modal-sku-cell-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      </svg>
                      ${p.productName || p.sku || '-'}
                    </span>
                  </td>
                  <td>
                    <span class="modal-sku-cell-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      </svg>
                      ${p.packDetails || 'Units'}
                    </span>
                  </td>
                  <td class="modal-sku-qty"># ${p.quantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          </div>
        </div>` : ''}

        <div class="modal-section-card">
          <div class="modal-section-header">
            <div class="modal-section-title-wrap">
              <div class="modal-section-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              </div>
              <h4 class="modal-section-title">Attachments</h4>
            </div>
            ${allAttachments.length > 0 ? `
              <button class="btn-download-all" onclick="downloadAllAdminFiles(window.currentAdminOrderAttachments)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download All
              </button>
            ` : ''}
          </div>
          <div class="modal-attachments-body">
            ${renderFilePills(allAttachments)}
          </div>
        </div>

        <div class="modal-section-card">
          <div class="modal-section-header">
            <div class="modal-section-title-wrap">
              <div class="modal-section-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              </div>
              <h4 class="modal-section-title">Notes / Prep Instructions</h4>
            </div>
          </div>
          <div class="modal-notes-body">
            ${(order.prepInstructions || order.notes) ? `
              ${order.prepInstructions ? `<p style="margin-bottom:8px;"><strong>Prep Instructions:</strong> ${order.prepInstructions}</p>` : ''}
              ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
            ` : '<div class="modal-notes-empty">-<br>No additional notes available for this shipment.</div>'}
          </div>
        </div>
      `;
    } else {
      // Inbound layout
      detailsHtml = `
        <div class="modal-info-grid">
          <div class="modal-info-item">
            <div class="modal-info-icon-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <div class="modal-info-content">
              <span class="modal-info-label">Shipment Name</span>
              <span class="modal-info-value" title="${order.shipmentName || '-'}">${order.shipmentName || '-'}</span>
            </div>
          </div>

          <div class="modal-info-item">
            <div class="modal-info-icon-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div class="modal-info-content">
              <span class="modal-info-label">Supplier / Vendor Name</span>
              <span class="modal-info-value" title="${order.supplierName || '-'}">${order.supplierName || '-'}</span>
            </div>
          </div>

          <div class="modal-info-item">
            <div class="modal-info-icon-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="6"></circle>
                <circle cx="12" cy="12" r="2"></circle>
              </svg>
            </div>
            <div class="modal-info-content">
              <span class="modal-info-label">Tracking Number</span>
              <span class="modal-info-value" title="${order.trackingNumber || '-'}">${order.trackingNumber || '-'}</span>
            </div>
          </div>

          <div class="modal-info-item">
            <div class="modal-info-icon-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
            </div>
            <div class="modal-info-content">
              <span class="modal-info-label">Carrier</span>
              <span class="modal-info-value" title="${order.carrier || '-'}">${order.carrier || '-'}</span>
            </div>
          </div>

          <div class="modal-info-item">
            <div class="modal-info-icon-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <div class="modal-info-content">
              <span class="modal-info-label">Estimated Arrival Date</span>
              <span class="modal-info-value">${formattedDate}</span>
            </div>
          </div>

          <div class="modal-info-item">
            <div class="modal-info-icon-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div class="modal-info-content">
              <span class="modal-info-label">Status</span>
              <span class="status-pill ${statusClass}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                ${statusStr}
              </span>
            </div>
          </div>
        </div>

        ${order.products && order.products.length > 0 ? `
        <div class="modal-section-card">
          <div class="modal-section-header">
            <div class="modal-section-title-wrap">
              <div class="modal-section-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
              </div>
              <h4 class="modal-section-title">SKU Details</h4>
            </div>
            <span class="modal-count-badge">${order.products.length} ${order.products.length === 1 ? 'Item' : 'Items'}</span>
          </div>
          <div class="modal-sku-table-wrapper">
          <table class="modal-sku-table">
            <thead>
              <tr>
                <th>SKU NAME</th>
                <th>PACK DETAILS</th>
                <th>QUANTITY</th>
              </tr>
            </thead>
            <tbody>
              ${order.products.map(p => `
                <tr>
                  <td>
                    <span class="modal-sku-cell-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      </svg>
                      ${p.productName || p.sku || '-'}
                    </span>
                  </td>
                  <td>
                    <span class="modal-sku-cell-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      </svg>
                      ${p.packDetails || 'Units'}
                    </span>
                  </td>
                  <td class="modal-sku-qty"># ${p.quantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          </div>
        </div>` : ''}

        <div class="modal-section-card">
          <div class="modal-section-header">
            <div class="modal-section-title-wrap">
              <div class="modal-section-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              </div>
              <h4 class="modal-section-title">Attachments</h4>
            </div>
            ${allAttachments.length > 0 ? `
              <button class="btn-download-all" onclick="downloadAllAdminFiles(window.currentAdminOrderAttachments)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download All
              </button>
            ` : ''}
          </div>
          <div class="modal-attachments-body">
            ${renderFilePills(allAttachments)}
          </div>
        </div>

        <div class="modal-section-card">
          <div class="modal-section-header">
            <div class="modal-section-title-wrap">
              <div class="modal-section-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              </div>
              <h4 class="modal-section-title">Notes</h4>
            </div>
          </div>
          <div class="modal-notes-body">
            ${order.notes ? `<p>${order.notes}</p>` : '<div class="modal-notes-empty">-<br>No additional notes available for this shipment.</div>'}
          </div>
        </div>
      `;
    }

    content.innerHTML = detailsHtml;
    modal.style.display = 'flex';
  } catch (err) {
    console.error('View Details Error:', err);
    window.showToast(`Details Error: ${err.message}`, 'error');
  } finally {
    window.hideLoader();
  }
};

function renderFilePills(files) {
  if (!files || files.length === 0) {
    return '<span style="color: #94a3b8; font-size: 13px; font-style: italic; padding: 10px 0;">No attachments available</span>';
  }

  return files.map(file => {
    const rawName = file.split('/').pop();
    const dashIdx = rawName.indexOf('-');
    const displayName = dashIdx > -1 ? rawName.slice(dashIdx + 1) : rawName;
    const fileType = getFileTypeFromName(displayName);

    const ext = displayName.split('.').pop().toUpperCase();
    const sizeDisplay = (ext === 'PDF' || ext === 'DOCX') ? '1.8 MB' : '2.4 MB';

    return `
      <div class="modal-attachment-card" onclick="openFileViewer('${encodeURIComponent(displayName)}', '${encodeURIComponent(rawName)}', '${fileType}')" title="Preview / Download ${displayName}">
        <div class="attachment-card-left">
          <div class="attachment-file-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </div>
          <div class="attachment-details">
            <span class="attachment-name" title="${displayName}">${displayName}</span>
            <span class="attachment-size">${sizeDisplay}</span>
          </div>
        </div>
        <button type="button" class="attachment-download-btn" onclick="event.stopPropagation(); triggerAdminDownload('${encodeURIComponent(rawName)}');" title="Download">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
      </div>
    `;
  }).join('');
}

function triggerAdminDownload(filename) {
  const a = document.createElement('a');
  a.href = `/api/download/${filename}`;
  a.setAttribute('download', '');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function downloadAllAdminFiles(files) {
  if (!files || files.length === 0) return;

  const filenames = files.map(file => {
    let name = file.split('/').pop();
    try { name = decodeURIComponent(name); } catch (e) {}
    return name;
  });

  try {
    const response = await fetch('/api/download-zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: filenames })
    });

    if (!response.ok) throw new Error('Could not create ZIP file');

    const downloadUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'shipment-attachments.zip';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    window.showToast(error.message, 'error');
  }
}

window.triggerAdminDownload = triggerAdminDownload;
window.downloadAllAdminFiles = downloadAllAdminFiles;

window.closeOrderDetailModal = function() {
  const modal = document.getElementById('orderDetailModal');
  if (modal) modal.style.display = 'none';
};

// Helper to detect file type from extension
function getFileTypeFromName(filename) {
  if (!filename) return 'unknown';
  const ext = filename.toLowerCase().split('.').pop();
  
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
  const pdfExts = ['pdf'];
  
  if (imageExts.includes(ext)) return 'image';
  if (pdfExts.includes(ext)) return 'pdf';
  return 'file';
}

window.openFileViewer = function(name, url, type) {
  const modal = document.getElementById('fileViewerModal');
  const title = document.getElementById('modalFileName');
  const content = document.getElementById('fileViewerContent');

  let cleanDisplayName = name;
  try {
    cleanDisplayName = decodeURIComponent(name);
  } catch (e) {}

  title.innerText = cleanDisplayName;
  content.innerHTML = '';

  // Detect type from filename if not provided or is generic 'file'
  if (!type || type === 'file') {
    type = getFileTypeFromName(cleanDisplayName);
  }

  let requestedName = url.split('/').pop();
  try {
    requestedName = decodeURIComponent(requestedName);
  } catch (e) {}

  const previewUrl = `/api/file/${encodeURIComponent(requestedName)}?inline=1`;
  const downloadUrl = `/api/download/${encodeURIComponent(requestedName)}`;

  if (type.includes('image')) {
    content.innerHTML = `<img src="${previewUrl}" style="max-width: 100%; max-height: 65vh; border-radius: 12px; object-fit: contain; box-shadow: 0 4px 16px rgba(0,0,0,0.08);" alt="${cleanDisplayName}" onerror="this.parentElement.innerHTML='<div style=\\'text-align:center; padding: 40px; color:#64748b;\\'><p style=\\'margin-bottom:12px; font-weight:500;\\'>Unable to display image preview directly.</p><a href=\\'${downloadUrl}\\' download=\\'${cleanDisplayName}\\' class=\\'modal-close-full-btn\\' style=\\'display:inline-flex; width:auto; padding: 0 24px; text-decoration:none;\\'>Download Image</a></div>'">`;
  } else if (type.includes('pdf')) {
    content.innerHTML = `<div style="width: 100%; height: 68vh; display: flex; flex-direction: column; gap: 12px;">
      <iframe src="${previewUrl}#toolbar=1" style="flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; width: 100%;" onerror="alert('Failed to open PDF. Try downloading it instead.')"></iframe>
      <div style="text-align: right;">
        <a href="${downloadUrl}" download="${cleanDisplayName}" class="btn-download-all" style="text-decoration:none; padding: 8px 16px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Download PDF
        </a>
      </div>
    </div>`;
  } else {
    content.innerHTML = `<div style="text-align:center; padding: 40px; color:#64748b;">
      <div style="font-size: 40px; margin-bottom: 12px;">📄</div>
      <p style="margin-bottom: 16px; font-size: 14px; font-weight: 500;">Preview is not supported for this file format.</p>
      <a href="${downloadUrl}" download="${cleanDisplayName}" class="modal-close-full-btn" style="display: inline-flex; width: auto; padding: 0 24px; text-decoration:none;">
        Download File
      </a>
    </div>`;
  }

  modal.style.display = 'flex';
};

window.closeFileViewer = function() {
  document.getElementById('fileViewerModal').style.display = 'none';
};

window.getFileTypeFromName = getFileTypeFromName;

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

/* ─── Carton Details Modal ───────────────────────────────── */

window.openCartonDetailsModal = function(orderId, prodsBase64) {
  document.getElementById('cd_orderId').value = orderId;
  const products = JSON.parse(atob(prodsBase64));
  
  let html = `<p style="margin-bottom: 10px; font-size: 14px; color: #64748b;">Enter carton dimensions/details for each SKU to update inventory and proceed.</p>`;
  
  products.forEach((p, i) => {
    html += `
      <div style="margin-bottom: 15px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="font-weight: 600; margin-bottom: 8px; color: #0f172a;">${p.productName} (SKU: ${p.sku || '-'}) - Qty: ${p.quantity}</div>
        <input type="hidden" name="cd_sku_${i}" value="${p.sku || ''}">
        <label class="portal-label">Carton Details</label>
        <input type="text" name="cd_val_${i}" class="portal-input" placeholder="e.g. 12x12x12, 5lbs" required>
      </div>
    `;
  });
  html += `<input type="hidden" id="cd_count" value="${products.length}">`;
  
  document.getElementById('cartonDetailsContent').innerHTML = html;
  document.getElementById('cartonDetailsModal').style.display = 'flex';
};

window.closeCartonDetailsModal = function() {
  document.getElementById('cartonDetailsModal').style.display = 'none';
  document.getElementById('cartonDetailsForm').reset();
};

window.submitCartonDetails = async function(event) {
  event.preventDefault();
  const orderId = document.getElementById('cd_orderId').value;
  const count = parseInt(document.getElementById('cd_count').value);
  
  const cartonDetailsList = [];
  for (let i = 0; i < count; i++) {
    const sku = document.querySelector(`input[name="cd_sku_${i}"]`).value;
    const cartonDetails = document.querySelector(`input[name="cd_val_${i}"]`).value;
    cartonDetailsList.push({ sku, cartonDetails });
  }

  const btn = event.target.querySelector('button[type="submit"]');
  const restore = window.setBtnLoading(btn, 'Saving...');

  try {
    const data = await window.apiPut(`/api/admin/orders/${orderId}/carton-details`, { cartonDetailsList });
    if (data.success) {
      window.showToast('Carton details saved successfully');
      window.closeCartonDetailsModal();
      loadAdminOrders('outbound', 1);
    } else {
      window.showToast(data.message || 'Error saving carton details', 'error');
    }
  } catch (error) {
    console.error(error);
    window.showToast('Server error', 'error');
  } finally {
    restore();
  }
};

/* ─── Logout ─────────────────────────────────────────────── */

async function handleAdminLogout() {
  const res = await fetch('/api/logout', { method: 'POST' });
  if ((await res.json()).success) {
    window.location.href = '/login?logout=success';
  }
}

/* ─── Boot ───────────────────────────────────────────────── */

window.addEventListener('DOMContentLoaded', () => {
  window.showLoader();
  checkAdminAuth();
});
