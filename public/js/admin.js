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

    if (isOutbound) {
      detailsHtml = `
        <div class="detail-card-grid">
          <div class="detail-card-item">
            <span class="detail-card-label">Client</span>
            <span class="detail-card-value">${order.user ? order.user.name + ' (' + (order.user.businessName || order.user.email) + ')' : '-'}</span>
          </div>
          <div class="detail-card-item">
            <span class="detail-card-label">Shipment Name</span>
            <span class="detail-card-value">${order.shipmentName || '-'}</span>
          </div>
          <div class="detail-card-item">
            <span class="detail-card-label">Status</span>
            <div><span class="status-badge status-${(order.status || 'Pending').toLowerCase().replace(/\s/g, '-')}">${order.status || 'Pending'}</span></div>
          </div>
          <div class="detail-card-item">
            <span class="detail-card-label">Channel</span>
            <span class="detail-card-value">${order.channel || '-'}</span>
          </div>
          <div class="detail-card-item">
            <span class="detail-card-label">Fulfilment Type</span>
            <span class="detail-card-value">${order.fulfilmentType || '-'}</span>
          </div>
          <div class="detail-card-item">
            <span class="detail-card-label">Shipping Labels Required</span>
            <span class="detail-card-value">${order.shippingLabelsRequired ? 'Yes' : 'No'}</span>
          </div>

          ${order.products && order.products.length > 0 ? `
          <div class="detail-card-full">
            <span class="detail-card-label">Selected Products</span>
            <div style="margin-top:12px;">
              <table class="portal-table" style="background: white; border-radius: 8px;">
                <thead>
                  <tr>
                    <th style="padding: 10px; font-size: 12px; text-align: left;">Product</th>
                    <th style="padding: 10px; font-size: 12px; text-align: left;">SKU</th>
                    <th style="padding: 10px; font-size: 12px; text-align: right;">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  ${order.products.map(p => `
                    <tr>
                      <td style="padding: 10px; font-size: 13px; border-top: 1px solid #f1f5f9;">${p.productName}</td>
                      <td style="padding: 10px; font-size: 13px; border-top: 1px solid #f1f5f9;">${p.sku || '-'}</td>
                      <td style="padding: 10px; font-size: 13px; border-top: 1px solid #f1f5f9; text-align: right; font-weight: 600;">${p.quantity}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>` : ''}

          <div class="detail-card-full">
            <span class="detail-card-label">Prep Instructions</span>
            <p style="margin-top:8px; color:#475569; font-size: 14px; line-height: 1.5;">${order.prepInstructions || '-'}</p>
          </div>

          <div class="detail-card-full">
            <span class="detail-card-label">Shipping Labels</span>
            <div class="detail-card-files">
              ${renderFilePills([...(order.documents || []), ...(order.shippingLabels || [])])}
            </div>
          </div>
        </div>
      `;
    } else {
      detailsHtml = `
        <div class="detail-card-grid">
          <div class="detail-card-item">
            <span class="detail-card-label">Client</span>
            <span class="detail-card-value">${order.user ? order.user.name + ' (' + (order.user.businessName || order.user.email) + ')' : '-'}</span>
          </div>
          <div class="detail-card-item">
            <span class="detail-card-label">Shipment Name</span>
            <span class="detail-card-value">${order.shipmentName || '-'}</span>
          </div>
          <div class="detail-card-item">
            <span class="detail-card-label">Vendor Name</span>
            <span class="detail-card-value">${order.supplierName || '-'}</span>
          </div>
          <div class="detail-card-item">
            <span class="detail-card-label">Tracking Number</span>
            <span class="detail-card-value">${order.trackingNumber || '-'}</span>
          </div>
          <div class="detail-card-item">
            <span class="detail-card-label">Carrier</span>
            <span class="detail-card-value">${order.carrier || '-'}</span>
          </div>
          <div class="detail-card-item">
            <span class="detail-card-label">Estimated Arrival Date</span>
            <span class="detail-card-value">${order.estimatedArrival ? new Date(order.estimatedArrival).toLocaleDateString() : '-'}</span>
          </div>
          <div class="detail-card-item">
            <span class="detail-card-label">Status</span>
            <div><span class="status-badge status-${(order.status || 'Pending').toLowerCase().replace(/\s/g, '-')}">${order.status || 'Pending'}</span></div>
          </div>

          <div class="detail-card-full">
            <span class="detail-card-label">SKU List</span>
            <p style="margin-top:8px; color:#475569; font-size: 14px; line-height: 1.5;">${order.skuList || '-'}</p>
          </div>
          
          <div class="detail-card-full">
            <span class="detail-card-label">Product Quantities</span>
            <p style="margin-top:8px; color:#475569; font-size: 14px; line-height: 1.5;">${order.productQuantities || '-'}</p>
          </div>

          <div class="detail-card-full">
            <span class="detail-card-label">Packing Details</span>
            <p style="margin-top:8px; color:#475569; font-size: 14px; line-height: 1.5;">${order.packingDetails || '-'}</p>
          </div>

          <div class="detail-card-full">
            <span class="detail-card-label">Notes</span>
            <p style="margin-top:8px; color:#475569; font-size: 14px; line-height: 1.5;">${order.notes || '-'}</p>
          </div>

          ${order.googleDriveDocs ? `
          <div class="detail-card-full">
            <span class="detail-card-label">Google Drive Link</span>
            <div style="margin-top:8px;">
              <a href="${order.googleDriveDocs}" target="_blank" class="portal-file-link" style="word-break: break-all;">${order.googleDriveDocs}</a>
            </div>
          </div>` : ''}

          <div class="detail-card-full">
            <span class="detail-card-label">Product Attachments</span>
            <div class="detail-card-files">
              ${renderFilePills(order.productImages)}
            </div>
          </div>

          <div class="detail-card-full">
            <span class="detail-card-label">Commercial Invoices</span>
            <div class="detail-card-files">
              ${renderFilePills(order.commercialInvoices)}
            </div>
          </div>

          <div class="detail-card-full">
            <span class="detail-card-label">Packing List PDFs</span>
            <div class="detail-card-files">
              ${renderFilePills(order.packingListPDFs)}
            </div>
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
  if (!files || files.length === 0) return '<span style="color: #94a3b8; font-size: 13px; font-style: italic;">No files attached</span>';
  return `<div class="file-pill-list">
    ${files.map(file => {
      const fileName = file.split('/').pop();
      const fileType = getFileTypeFromName(fileName);
      const isPreviewable = fileType === 'image' || fileType === 'pdf';
      
      if (isPreviewable) {
        return `<a href="javascript:void(0)" onclick="openFileViewer('${fileName}', '${file}', '${fileType}')" class="file-pill" title="Click to preview or download: ${fileName}" style="cursor: pointer;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fileName}</span>
        </a>`;
      } else {
        return `<a href="/api/file/${encodeURIComponent(fileName)}" download="${fileName}" class="file-pill" title="Download: ${fileName}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fileName}</span>
        </a>`;
      }
    }).join('')}
  </div>`;
}

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

  title.innerText = name;
  content.innerHTML = '';

  // Detect type from filename if not provided or is generic 'file'
  if (!type || type === 'file') {
    type = getFileTypeFromName(name);
  }

  if (type.includes('image')) {
    const imageUrl = url.startsWith('/uploads') ? url : `/uploads/${url}`;
    content.innerHTML = `<img src="${imageUrl}" style="max-width: 100%; max-height: 70vh; border-radius: 8px; object-fit: contain;" alt="${name}" onerror="this.parentElement.innerHTML='<div class=empty-state><p>Failed to load image.</p><a href=\\'${imageUrl}\\' download=\\'${name}\\' class=\\'portal-file-link\\'>Download File</a></div>'">`;
  } else if (type.includes('pdf')) {
    // Extract filename from URL
    const filename = url.split('/').pop();
    const pdfUrl = url.startsWith('/api/download') ? url : `/api/download/${filename}`;
    content.innerHTML = `<div style="width: 100%; height: 70vh; display: flex; flex-direction: column;">
      <iframe src="${pdfUrl}#toolbar=0&navpanes=0" style="flex: 1; border: none; border-radius: 4px;" onerror="alert('Failed to open PDF. Try downloading it instead.')"></iframe>
      <div style="margin-top: 10px; text-align: center;">
        <a href="${pdfUrl}" download="${filename}" class="portal-btn-sm" style="display: inline-block; margin: 5px;">Download PDF</a>
      </div>
    </div>`;
  } else {
    const downloadUrl = url.startsWith('/api/download') ? url : `/api/download/${url.split('/').pop()}`;
    content.innerHTML = `<div class="empty-state">
      <p>Preview not available for this file type.</p>
      <a href="${downloadUrl}" download="${name}" class="portal-btn-sm" style="display: inline-block; margin-top: 10px;">Download File</a>
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
    window.location.href = '/login.html?logout=success';
  }
}

/* ─── Boot ───────────────────────────────────────────────── */

window.addEventListener('DOMContentLoaded', () => {
  window.showLoader();
  checkAdminAuth();
});
