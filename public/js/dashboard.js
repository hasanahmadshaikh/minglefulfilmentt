/**
 * dashboard.js — Customer Portal
 * Depends on: components.js, api.js
 */

let currentOrdersPage = 1;
let orderSearchTimer = null;

/* ─── Auth check ─────────────────────────────────────────── */

async function checkAuth() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (data.success) {
      window.hideLoader();
      const userName = data.user.name || 'User';
      document.getElementById('welcomeGreeting').innerText = `Welcome back, ${userName}`;
      
      const headerUserName = document.getElementById('headerUserName');
      if (headerUserName) headerUserName.innerText = userName;

      const avatarInitials = document.getElementById('userAvatarInitials');
      if (avatarInitials) {
        const parts = userName.trim().split(/\s+/);
        avatarInitials.innerText = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
      }

      const sitename = window.ENV?.SITENAME || 'ABC WAREHOUSE';
      const sidebarBrand = document.getElementById('sidebarBrandTitle');
      if (sidebarBrand) sidebarBrand.innerText = sitename;

      const helpEmail = document.getElementById('portalHelpEmail');
      if (helpEmail) {
        const domainUpper = sitename.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const domainLower = sitename.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        helpEmail.href = `mailto:info@${domainLower}.com`;
        helpEmail.innerText = `info@${domainUpper}.com`;
      }

      // Populate Account Form
      ['businessName', 'contactName', 'businessEmail', 'phoneNumber', 'businessWebsite'].forEach(field => {
        const input = document.getElementById(`acc_${field}`);
        if (input) input.value = data.user[field] || '';
      });

      loadDashboardData();
    } else {
      window.location.href = '/login';
    }
  } catch {
    window.location.href = '/login';
  }
}

function toggleUserDropdown() {
  const menu = document.getElementById('userDropdownMenu');
  if (menu) menu.classList.toggle('show');
}

window.addEventListener('click', (e) => {
  const chip = document.getElementById('userProfileChip');
  const menu = document.getElementById('userDropdownMenu');
  if (menu && chip && !chip.contains(e.target)) {
    menu.classList.remove('show');
  }
});

/* ─── Dashboard Stats + initial orders load ─────────────── */

async function loadDashboardData(page = 1) {
  try {
    const statsData = await window.apiFetch('/api/stats');
    if (statsData.success) {
      const { activeInbound, pendingArrival, received, inspection, activeOutbound } = statsData.stats;

      const statActiveInbound = document.getElementById('stat-active-inbound');
      if (statActiveInbound) statActiveInbound.innerText = activeInbound;

      const statPendingArrival = document.getElementById('count-pending-arrival');
      if (statPendingArrival) statPendingArrival.innerText = pendingArrival;

      const statReceived = document.getElementById('count-received');
      if (statReceived) statReceived.innerText = received;

      const statInspection = document.getElementById('count-inspection');
      if (statInspection) statInspection.innerText = inspection;

      const statActiveOutbound = document.getElementById('stat-active-outbound');
      if (statActiveOutbound) statActiveOutbound.innerText = activeOutbound;
    }

    // Load alerts for Awaiting Shipping Labels
    const alertsData = await window.apiFetch('/api/orders?status=Awaiting+Shipping+Labels&type=outbound');
    const alertDiv = document.getElementById('dashboardAlerts');
    if (alertDiv) {
      if (alertsData.success && alertsData.orders && alertsData.orders.length > 0) {
        alertDiv.style.display = 'block';
        alertDiv.innerHTML = `
          <div style="background: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="flex-shrink:0;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <div>
                <strong style="color: #991b1b; font-size: 14px;">Action Required</strong>
                <p style="color: #7f1d1d; font-size: 13px; margin: 4px 0 0 0;">You have shipments that require shipping labels to proceed. Please click the button below to view them.</p>
              </div>
            </div>
            <button class="portal-btn-sm" style="background:#3b82f6; color:white; border-color:#2563eb; flex-shrink: 0;" onclick="switchTab('outbound-shipments')">View Outbound Shipments</button>
          </div>
        `;
      } else {
        alertDiv.style.display = 'none';
        alertDiv.innerHTML = '';
      }
    }
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
    window.hideLoader();
  }
}

/* ─── Tab switching ──────────────────────────────────────── */

function switchTab(tabId) {
  // Reset order form if leaving submit-order
  const currentlyOnSubmitOrder = document.getElementById('submit-order').classList.contains('active');
  if (currentlyOnSubmitOrder && tabId !== 'submit-order') {
    cancelShipmentForm();
  }

  window.showLoader();
  setTimeout(() => {
    document.querySelectorAll('.admin-tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('primary'));

    const activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.add('active');

    const activeMenuItem = Array.from(document.querySelectorAll('.menu-item'))
      .find(item => item.getAttribute('onclick')?.includes(`'${tabId}'`));
    if (activeMenuItem) activeMenuItem.classList.add('active');

    if (tabId === 'submit-order') {
      const orderBtn = Array.from(document.querySelectorAll('.action-btn')).find(b => b.innerText.includes('Order'));
      if (orderBtn) orderBtn.classList.add('primary');
    }

    if (tabId === 'inbound-shipments') loadInboundShipments(1);
    if (tabId === 'outbound-shipments') loadOutboundShipments(1);
    if (tabId === 'inventory') loadInventory(1);

    window.hideLoader();
  }, 300);
}

/* ─── Inventory Logic ────────────────────────────────────── */

async function loadInventory(page = 1) {
  try {
    const data = await window.apiFetch(`/api/inventory?page=${page}&limit=10`);
    const tbody = document.querySelector('#inventoryTable tbody');
    const pagin = document.getElementById('inventoryPagination');
    if (!tbody || !data.success) return;

    if (data.inventory.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:40px;">No inventory found</td></tr>';
      if (pagin) pagin.innerHTML = '';
      return;
    }

    tbody.innerHTML = data.inventory.map(item => `
      <tr>
        <td><strong>${item.productName}</strong></td>
        <td style="font-weight: 600; color: #0f172a;">${item.quantity}</td>
        <td>${new Date(item.updatedAt).toLocaleDateString()}</td>
      </tr>
    `).join('');

    renderPagination(pagin, data.pagination, loadInventory);
  } catch (err) {
    console.error('Failed to load inventory:', err);
  }
}

/* ─── Shipments: search & load ────────────────────────────── */

let shipmentSearchTimer;
function handleShipmentSearch(type) {
  clearTimeout(shipmentSearchTimer);
  shipmentSearchTimer = setTimeout(() => {
    if (type === 'inbound') loadInboundShipments(1);
    else loadOutboundShipments(1);
  }, 300);
}

async function loadInboundShipments(page = 1) {
  const status = document.getElementById('inboundStatusFilter').value;
  const search = document.getElementById('inboundSearch').value;

  const data = await window.apiFetch(`/api/orders?page=${page}&limit=10&status=${status}&search=${encodeURIComponent(search)}&type=inbound`);
  const tbody = document.querySelector('#inboundTable tbody');
  const pagin = document.getElementById('inboundPagination');

  if (!data.success) return;

  if (data.orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state-container">
            <svg class="empty-state-icon" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            </svg>
            <h4>No shipments yet</h4>
            <p>Submit your first order to get started</p>
          </div>
        </td>
      </tr>`;
    pagin.innerHTML = '';
    return;
  }

  tbody.innerHTML = data.orders.map(o => `
    <tr>
      <td><strong>${o.orderId}</strong></td>
      <td>${new Date(o.createdAt).toLocaleDateString()}</td>
      <td>${o.shipmentName || '-'}</td>
      <td>${o.trackingNumber || '-'}</td>
      <td>${o.carrier || '-'}</td>
      <td><span class="status-badge status-${o.status.toLowerCase().replace(/\s/g, '-')}">${o.status}</span></td>
      <td><button class="portal-btn-sm" onclick="viewOrderDetails('${o._id}')">View</button></td>
    </tr>
  `).join('');

  renderPagination(pagin, data.pagination, loadInboundShipments);
}

async function loadOutboundShipments(page = 1) {
  const status = document.getElementById('outboundStatusFilter').value;
  const search = document.getElementById('outboundSearch').value;

  const data = await window.apiFetch(`/api/orders?page=${page}&limit=10&status=${status}&search=${encodeURIComponent(search)}&type=outbound`);
  const tbody = document.querySelector('#outboundTable tbody');
  const pagin = document.getElementById('outboundPagination');

  if (!data.success) return;

  if (data.orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state-container">
            <svg class="empty-state-icon" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            </svg>
            <h4>No shipments yet</h4>
            <p>Submit your first order to get started</p>
          </div>
        </td>
      </tr>`;
    pagin.innerHTML = '';
    return;
  }

  tbody.innerHTML = data.orders.map(o => {
    let actionBtn = `<button class="portal-btn-sm" onclick="viewOrderDetails('${o._id}')">View</button>`;
    const isAlertRow = o.status === 'Awaiting Shipping Labels';
    if (isAlertRow) {
      actionBtn += ` <button class="portal-btn-sm" style="background:#3b82f6; color:white; border-color:#2563eb;" onclick="openShippingLabelsModal('${o._id}')">Upload Labels</button>`;
    }
    const rowClass = isAlertRow ? 'class="awaiting-labels-row"' : '';
    const alertMessage = isAlertRow ? '<div class="row-alert-msg"><span class="alert-pulse"></span> Action Required: Please upload shipping labels.</div>' : '';

    return `
    <tr ${rowClass}>
      <td><strong>${o.orderId}</strong></td>
      <td>${new Date(o.createdAt).toLocaleDateString()}</td>
      <td>
        ${o.channel || '-'}
        ${alertMessage}
      </td>
      <td>${o.fulfilmentType || '-'}</td>
      <td><span class="status-badge status-${o.status.toLowerCase().replace(/\s/g, '-')}">${o.status}</span></td>
      <td>${actionBtn}</td>
    </tr>
  `}).join('');

  renderPagination(pagin, data.pagination, loadOutboundShipments);
}

function renderPagination(container, meta, loadFunc) {
  container.innerHTML = '';
  if (meta.totalPages <= 1) return;

  for (let i = 1; i <= meta.totalPages; i++) {
    const btn = document.createElement('button');
    btn.className = `pagination-btn ${meta.currentPage === i ? 'active' : ''}`;
    btn.innerText = i;
    btn.onclick = () => loadFunc(i);
    container.appendChild(btn);
  }
}

/* ─── Form Type Toggling ─────────────────────────────────── */

function selectShipmentTypeBox(type) {
  document.getElementById('shipmentType').value = type;

  document.querySelectorAll('.shipment-type-box').forEach(box => {
    box.classList.remove('active');
    box.style.borderColor = 'transparent';
  });

  const activeBox = type === 'inbound' ? document.getElementById('boxInbound') : document.getElementById('boxOutbound');
  activeBox.classList.add('active');
  activeBox.style.borderColor = '#3b82f6';

  document.getElementById('shipmentTypeSelection').style.display = 'none';
  document.getElementById('orderFormBody').style.display = 'block';

  toggleShipmentFields(type);
}

function cancelShipmentForm() {
  document.getElementById('orderFormBody').style.display = 'none';
  document.getElementById('shipmentTypeSelection').style.display = 'block';
  document.getElementById('orderForm').reset();
  document.getElementById('inboundSkuBody').innerHTML = '';
  document.getElementById('outboundSkuBody').innerHTML = '';
  document.getElementById('documentsList').innerHTML = '';
  if (fileManagers['documents']) fileManagers['documents'].reset();
}

function toggleShipmentFields(type) {
  const inboundFields = document.getElementById('inboundProductDetails');
  const outboundChannel = document.getElementById('outboundChannelContainer');
  const outboundFulfilment = document.getElementById('outboundFulfilmentTypeContainer');
  const outboundProducts = document.getElementById('outboundProductDetails');
  const prepInstructions = document.getElementById('prepInstructionsContainer');

  const commonFields = [
    { container: 'shipmentNameContainer', input: 'shipmentName' },
    { container: 'vendorNameContainer', input: 'supplierName' },
    { container: 'trackingNumberContainer', input: 'trackingNumber' },
    { container: 'carrierContainer', input: 'carrier' },
    { container: 'estimatedArrivalContainer', input: 'estimatedArrival' },
    { container: 'notesContainer', input: 'notes' }
  ];

  if (type === 'outbound') {
    inboundFields.style.display = 'none';
    outboundChannel.style.display = 'block';
    outboundFulfilment.style.display = 'block';
    outboundProducts.style.display = 'block';
    prepInstructions.style.display = 'block';

    commonFields.forEach(f => {
      const containerEl = document.getElementById(f.container);
      const inputEl = document.getElementById(f.input);
      if (containerEl) containerEl.style.display = 'none';
      if (inputEl) {
        inputEl.required = false;
        inputEl.value = '';
      }
    });

    loadInventoryForOutbound();
  } else {
    inboundFields.style.display = 'block';
    outboundChannel.style.display = 'none';
    outboundFulfilment.style.display = 'none';
    outboundProducts.style.display = 'none';
    prepInstructions.style.display = 'none';

    commonFields.forEach(f => {
      const containerEl = document.getElementById(f.container);
      const inputEl = document.getElementById(f.input);
      if (containerEl) containerEl.style.display = 'block';
      if (inputEl && f.input !== 'notes') inputEl.required = true;
    });
  }
}

function handleChannelChange() {
  const channel = document.getElementById('channel').value;
  const ft = document.getElementById('fulfilmentType');
  ft.innerHTML = '<option value="">Select Fulfilment Type</option>';

  if (channel === 'Amazon') {
    ft.innerHTML += '<option value="FBA">FBA</option><option value="FBM">FBM</option>';
  } else if (channel === 'Walmart') {
    ft.innerHTML += '<option value="WFS">WFS</option><option value="SF">SF</option>';
  } else if (channel) {
    ft.innerHTML += '<option value="SF">SF</option>';
  }
  evaluateNoShippingLabelsRequired();
}

function evaluateNoShippingLabelsRequired() {
  const fulfilmentType = document.getElementById('fulfilmentType').value;
  const cb = document.getElementById('noShippingLabelsRequired');

  let shouldDisable = false;

  if (fulfilmentType === 'FBA' || fulfilmentType === 'SF') {
    shouldDisable = true;
  }

  const skuSelects = document.querySelectorAll('#outboundSkuBody .sku-name-input');
  skuSelects.forEach(select => {
    if (select.selectedIndex >= 0) {
      const opt = select.options[select.selectedIndex];
      if (opt && opt.value) {
        const carton = opt.getAttribute('data-carton');
        if (!carton || carton.trim() === '') {
          shouldDisable = true;
        }
      }
    }
  });

  if (shouldDisable) {
    cb.disabled = true;
    cb.checked = false;
  } else {
    cb.disabled = false;
  }
}

function addInboundSkuRow() {
  const tbody = document.getElementById('inboundSkuBody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="portal-input sku-name-input" placeholder="e.g. Laptop" style="margin:0; padding:6px 10px;" required></td>
    <td><input type="number" class="portal-input sku-qty-input" placeholder="0" min="1" style="margin:0; padding:6px 10px;" required></td>
    <td>
      <select class="portal-input sku-pack-input" style="margin:0; padding:6px 10px;" required>
        <option value="" disabled selected>Select</option>
        <option value="Cases">Cases</option>
        <option value="Units">Units</option>
      </select>
    </td>
    <td>
      <button type="button" class="portal-btn-sm" style="background:#fee2e2; color:#b91c1c; border-color:#fecaca;" onclick="this.closest('tr').remove()">Remove</button>
    </td>
  `;
  tbody.appendChild(tr);
}

let inventoryDataForOutbound = [];
async function loadInventoryForOutbound() {
  try {
    const data = await window.apiFetch('/api/inventory');
    if (data.success) {
      inventoryDataForOutbound = data.inventory;
    }
  } catch (err) {
    console.error('Failed to load inventory for outbound:', err);
  }
}

function addOutboundSkuRow() {
  const tbody = document.getElementById('outboundSkuBody');
  const tr = document.createElement('tr');

  const options = inventoryDataForOutbound.map(item =>
    `<option value="${item.sku}" data-qty="${item.quantity}" data-carton="${item.cartonDetails || ''}">${item.productName} (SKU: ${item.sku || '-'})</option>`
  ).join('');

  tr.innerHTML = `
    <td>
      <select class="portal-input sku-name-input" style="margin:0; padding:6px 10px;" onchange="handleOutboundSkuChange(this)" required>
        <option value="" disabled selected>Select SKU</option>
        ${options}
      </select>
    </td>
    <td>
      <div style="display:flex; align-items:center; gap:8px;">
        <input type="number" class="portal-input sku-qty-input" placeholder="0" min="1" style="margin:0; padding:6px 10px; width:80px;" oninput="validateQtyInput(this)" required>
        <span class="qty-available" style="font-size:12px; color:#64748b;"></span>
      </div>
    </td>
    <td>
      <select class="portal-input sku-pack-input" style="margin:0; padding:6px 10px;" required>
        <option value="" disabled selected>Select</option>
        <option value="Cases">Cases</option>
        <option value="Units">Units</option>
      </select>
    </td>
    <td>
      <button type="button" class="portal-btn-sm" style="background:#fee2e2; color:#b91c1c; border-color:#fecaca;" onclick="this.closest('tr').remove(); evaluateNoShippingLabelsRequired();">Remove</button>
    </td>
  `;
  tbody.appendChild(tr);
  evaluateNoShippingLabelsRequired();
}

function handleOutboundSkuChange(selectElement) {
  if (selectElement.selectedIndex < 0) return;
  const selectedOption = selectElement.options[selectElement.selectedIndex];
  if (!selectedOption.value) return;

  const qty = selectedOption.getAttribute('data-qty');
  const row = selectElement.closest('tr');

  const qtyInput = row.querySelector('.sku-qty-input');
  qtyInput.max = qty;
  row.querySelector('.qty-available').innerText = `Available: ${qty}`;

  evaluateNoShippingLabelsRequired();
}

/* ─── Orders: load & render table ───────────────────────── */

async function loadMyOrders(page = 1) {
  window.showLoader();
  try {
    const status = document.getElementById('orderStatusFilter').value;
    const search = document.getElementById('orderSearchInput').value;
    const data = await window.apiFetch(`/api/orders?page=${page}&limit=10&status=${status}&search=${encodeURIComponent(search)}`);

    const tableContainer = document.getElementById('ordersTableContainer');

    if (!data.success || data.orders.length === 0) {
      tableContainer.innerHTML = `
        <div class="empty-state" style="padding:40px;">
          <svg class="empty-icon" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          </svg>
          <h4>No Orders Found</h4>
          <p>Try adjusting your filters or search query.</p>
        </div>`;
      return;
    }

    tableContainer.innerHTML = buildOrdersTable(data.orders);

    const pagDiv = document.createElement('div');
    pagDiv.id = 'pagination-container';
    pagDiv.className = 'admin-pagination';
    tableContainer.appendChild(pagDiv);
    window.renderPagination('pagination-container', data.pagination, 'loadMyOrders');

  } catch (err) {
    console.error('Failed to load orders:', err);
  } finally {
    window.hideLoader();
  }
}

/** Builds the orders HTML table string */
function buildOrdersTable(orders) {
  const rows = orders.map(order => {
    const statusColor = order.status === 'Pending' ? '#f59e0b' : '#10b981';
    return `
      <tr class="portal-table-row">
        <td class="portal-table-cell">${new Date(order.createdAt).toLocaleDateString()}</td>
        <td class="portal-table-cell portal-table-cell--bold">${order.orderId || '-'}</td>
        <td class="portal-table-cell">${order.shipmentName}</td>
        <td class="portal-table-cell">${order.trackingNumber}</td>
        <td class="portal-table-cell"><span class="order-status-text" style="color:${statusColor}">${order.status}</span></td>
      </tr>`;
  }).join('');

  return `
    <div class="portal-table-wrapper">
      <table class="portal-table">
        <thead>
          <tr class="portal-table-head">
            <th class="portal-table-th">Date</th>
            <th class="portal-table-th">Order ID</th>
            <th class="portal-table-th">Shipment</th>
            <th class="portal-table-th">Tracking</th>
            <th class="portal-table-th">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/** Renders file attachment links for an order row */
function buildFileLinks(attachments, filesLink) {
  const links = [];

  if (attachments && attachments.length > 0) {
    attachments.forEach(file => {
      const fullName = file.split('/').pop();
      const dashIdx = fullName.indexOf('-');
      const displayName = dashIdx > -1 ? fullName.slice(dashIdx + 1) : fullName;
      const fileType = getFileTypeFromName(displayName);
      const isPreviewable = fileType === 'image' || fileType === 'pdf';
      
      if (isPreviewable) {
        links.push(`<a href="javascript:void(0)" onclick="openFileViewer('${encodeURIComponent(displayName)}', '${encodeURIComponent(fullName)}', '${fileType}')" class="portal-file-link" style="cursor: pointer;">${displayName}</a>`);
      } else {
        links.push(`<a href="/api/download/${encodeURIComponent(fullName)}" class="portal-file-link" download="${encodeURIComponent(displayName)}">${displayName}</a>`);
      }
    });
  }

  if (filesLink) {
    links.push(`<a href="${filesLink}" target="_blank" class="portal-file-link">📎 Link</a>`);
  }

  return links.length > 0 ? links.join('') : '-';
}

/* ─── Order submission ───────────────────────────────────── */

async function handleOrderSubmit(event) {
  event.preventDefault();
  if (!window.validateForm('orderForm')) return;

  const form = event.target;
  const btn = form.querySelector('button[type="submit"]');
  const restore = window.setBtnLoading(btn, 'Submitting...');

  const formData = new FormData();

  // Inbound vs Outbound logic
  const type = document.getElementById('shipmentType').value;
  formData.append('type', type);

  // Common Fields
  const commonFields = [
    'shipmentName', 'supplierName', 'trackingNumber', 'carrier',
    'estimatedArrival', 'notes'
  ];
  commonFields.forEach(f => {
    const el = document.getElementById(f);
    if (el) formData.append(f, el.value);
  });

  if (type === 'outbound') {
    const channel = document.getElementById('channel').value;
    const fulfilmentType = document.getElementById('fulfilmentType').value;
    const prepInstructions = document.getElementById('prepInstructions').value;
    const shippingLabelsRequired = document.getElementById('noShippingLabelsRequired').checked ? 'false' : 'true';

    if (!channel || !fulfilmentType) {
      window.showToast('Please select channel and fulfilment type', 'error');
      restore();
      return;
    }

    formData.append('channel', channel);
    formData.append('fulfilmentType', fulfilmentType);
    formData.append('prepInstructions', prepInstructions);
    formData.append('shippingLabelsRequired', shippingLabelsRequired);

    const skuRows = document.querySelectorAll('#outboundSkuBody tr');
    const outboundProducts = [];
    let qtyExceeded = false;
    skuRows.forEach(row => {
      const select = row.querySelector('.sku-name-input');
      const opt = select.options[select.selectedIndex];
      const sku = opt ? opt.value : '';
      const name = opt ? opt.text.split(' (SKU')[0] : '';
      const qtyInput = row.querySelector('.sku-qty-input');
      const qty = parseInt(qtyInput.value) || 0;
      const pack = row.querySelector('.sku-pack-input').value;

      const availableQty = parseInt(opt ? opt.getAttribute('data-qty') : 0) || 0;
      if (qty > availableQty) {
        qtyExceeded = true;
        qtyInput.classList.add('error');
        let errEl = qtyInput.parentNode.querySelector('.error-msg');
        if (!errEl) {
          errEl = document.createElement('span');
          errEl.className = 'error-msg';
          qtyInput.parentNode.appendChild(errEl);
        }
        //errEl.innerText = `Max available: ${availableQty}`;
      }

      if (sku && qty > 0 && pack) {
        outboundProducts.push({
          productName: name,
          sku: sku,
          quantity: qty,
          packDetails: pack
        });
      }
    });

    if (qtyExceeded) {
      window.showToast('Quantity cannot be greater than available quantity', 'error');
      restore();
      return;
    }

    if (outboundProducts.length === 0) {
      window.showToast('Please select at least one SKU with valid details to ship out', 'error');
      restore();
      return;
    }
    formData.append('products', JSON.stringify(outboundProducts));
  } else {
    // Inbound Logic
    const skuRows = document.querySelectorAll('#inboundSkuBody tr');
    const inboundProducts = [];
    skuRows.forEach(row => {
      const name = row.querySelector('.sku-name-input').value;
      const qty = parseInt(row.querySelector('.sku-qty-input').value) || 0;
      const pack = row.querySelector('.sku-pack-input').value;
      if (name && qty > 0 && pack) {
        inboundProducts.push({
          productName: name,
          sku: name,
          quantity: qty,
          packDetails: pack
        });
      }
    });

    if (inboundProducts.length === 0) {
      window.showToast('Please add at least one SKU with valid details', 'error');
      restore();
      return;
    }
    formData.append('products', JSON.stringify(inboundProducts));
  }

  // Unified Documents Uploader
  if (fileManagers['documents']) {
    const docFiles = fileManagers['documents'].getFiles();
    if (docFiles.length > 4) {
      window.showToast('Maximum 4 files allowed for Document Uploader', 'error');
      restore();
      return;
    }
    docFiles.forEach(f => formData.append('documents', f));
  }

  try {
    const res = await fetch('/api/orders', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      window.showToast(data.message, 'success');
      form.reset();
      // Clear all file managers
      Object.values(fileManagers).forEach(fm => fm.reset());
      const skuBody = document.getElementById('inboundSkuBody');
      if (skuBody) skuBody.innerHTML = '';

      loadInboundShipments(); // Refresh Inbound list
      loadOutboundShipments(); // Refresh Outbound list
      showSubmissionSuccessModal(data.order);
    } else {
      window.showToast(data.message || 'Submission failed', 'error');
    }
  } catch (err) {
    console.error('Submission error:', err);
    window.showToast('Server error. Please try again later.', 'error');
  } finally {
    if (typeof restore === 'function') restore();
  }
}

function showSubmissionSuccessModal(order) {
  const isOutbound = order.type === 'outbound';
  const buttonText = isOutbound ? 'View Outbound' : 'View Inbound';
  const redirectTab = isOutbound ? 'outbound-shipments' : 'inbound-shipments';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-popup success-modal">
      <div class="success-icon" style="text-align:center; margin-bottom: 20px;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      </div>
      <h3 style="text-align:center; margin-bottom: 12px;">Thank You!</h3>
      <p style="text-align:center; color: #64748b; margin-bottom: 24px;">Your shipment <strong>${order.orderId}</strong> has been submitted successfully.</p>
      <div class="modal-actions" style="display: flex; gap: 12px; justify-content: center;">
        <button class="modal-btn cancel" id="successCreateNew" style="flex:1;">Create Another</button>
        <button class="modal-btn confirm" id="successViewShipment" style="flex:1;">${buttonText}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#successCreateNew').onclick = () => {
    overlay.remove();
    switchTab('submit-order');
  };
  overlay.querySelector('#successViewShipment').onclick = () => {
    overlay.remove();
    switchTab(redirectTab);
  };
}

async function viewOrderDetails(id) {
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
    
    window.currentOrderAttachments = allAttachments;

    const statusStr = order.status || 'Pending Arrival';
    const statusClass = 'status-pill-' + statusStr.toLowerCase().replace(/\s+/g, '-');

    if (isOutbound) {
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
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
            </div>
            <div class="modal-info-content">
              <span class="modal-info-label">Carrier / Tracking</span>
              <span class="modal-info-value">${order.carrier || order.trackingNumber || '-'}</span>
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
              <button class="btn-download-all" onclick="downloadAllFiles(window.currentOrderAttachments)">
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
              ${order.prepInstructions ? `<p style="margin-bottom: 8px;"><strong>Prep Instructions:</strong> ${order.prepInstructions}</p>` : ''}
              ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
            ` : '<div class="modal-notes-empty">-<br>No additional notes available for this shipment.</div>'}
          </div>
        </div>
      `;
    } else {
      // Inbound Shipment Detail (exact layout from reference image)
      const formattedDate = order.estimatedArrival
        ? new Date(order.estimatedArrival).toLocaleDateString()
        : '-';

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
              <button class="btn-download-all" onclick="downloadAllFiles(window.currentOrderAttachments)">
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
}

function renderFilePills(files) {
  if (!files || files.length === 0) {
    return '<span style="color: #94a3b8; font-size: 13px; font-style: italic; padding: 10px 0;">No attachments available</span>';
  }

  return files.map(file => {
    const rawName = file.split('/').pop();
    const dashIdx = rawName.indexOf('-');
    // Show clean display name
    const displayName = dashIdx > -1 ? rawName.slice(dashIdx + 1) : rawName;
    const fileType = getFileTypeFromName(displayName);

    // Approximate size badge for professional look
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
        <button type="button" class="attachment-download-btn" onclick="event.stopPropagation(); triggerDownload('${encodeURIComponent(rawName)}');" title="Download">
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

function triggerDownload(filename) {
  const a = document.createElement('a');
  a.href = `/api/download/${filename}`;
  a.setAttribute('download', '');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function closeOrderDetailModal() {
  const modal = document.getElementById('orderDetailModal');
  if (modal) modal.style.display = 'none';
}

/* ─── File upload zone ───────────────────────────────────── */

/* ─── File Management ────────────────────────────────────── */

const fileManagers = {};

function initFileManager(inputId, listId, zoneId, allowedTypes = [], maxSize = 5 * 1024 * 1024) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  const zone = document.getElementById(zoneId);
  let files = [];

  if (!input || !list || !zone) return;

  zone.onclick = () => input.click();

  input.onchange = (e) => {
    const newFiles = Array.from(e.target.files);
    newFiles.forEach(file => {
      // Basic type validation
      const isTypeAllowed = allowedTypes.length === 0 || allowedTypes.some(type => {
        if (type.startsWith('.')) return file.name.toLowerCase().endsWith(type.toLowerCase());
        if (type.includes('*')) return file.type.match(new RegExp(type.replace('*', '.*')));
        return file.type === type;
      });

      if (!isTypeAllowed) {
        window.showToast(`"${file.name}" is not a supported file type.`, 'error');
        return;
      }
      if (file.size > maxSize) {
        window.showToast(`"${file.name}" exceeds the 5MB limit.`, 'error');
        return;
      }
      // Avoid duplicates
      if (!files.some(f => f.name === file.name && f.size === file.size)) {
        files.push(file);
      }
    });
    render();
    input.value = ''; // Reset input to allow re-selection of same file
  };

  function render() {
    list.innerHTML = '';
    if (files.length > 0) {
      const header = document.createElement('div');
      header.className = 'file-list-heading';
      header.innerText = `Selected Files (${files.length}):`;
      list.appendChild(header);

      files.forEach((file, idx) => {
        const item = document.createElement('div');
        item.className = 'file-list-item';

        const fileUrl = URL.createObjectURL(file);

        // Thumbnail/Preview Icon
        const previewWrap = document.createElement('div');
        previewWrap.className = 'file-preview-wrap';
        if (file.type.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = fileUrl;
          img.className = 'file-preview-img';
          img.title = 'Click to view';
          img.onclick = () => openFileViewer(file.name, fileUrl, 'image');
          previewWrap.appendChild(img);
        } else {
          previewWrap.innerHTML = '<div class="file-preview-icon">📄</div>';
        }

        // Name (Clickable)
        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-list-name';
        nameSpan.innerText = file.name;
        nameSpan.onclick = () => {
          if (file.type.startsWith('image/')) {
            openFileViewer(file.name, fileUrl, 'image');
          } else {
            const a = document.createElement('a');
            a.href = fileUrl;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        };

        // Remove Button
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'file-remove-btn';
        removeBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>`;
        removeBtn.onclick = () => fileManagers[inputId].remove(idx);

        item.appendChild(previewWrap);
        item.appendChild(nameSpan);
        item.appendChild(removeBtn);
        list.appendChild(item);
      });
    }

    // Update the actual input.files
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    input.files = dt.files;
  }

  fileManagers[inputId] = {
    getFiles: () => files,
    remove: (idx) => {
      files.splice(idx, 1);
      render();
    },
    reset: () => {
      files = [];
      render();
    }
  };
}

/* ─── File Viewer Modal ──────────────────────────────────── */

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

function openFileViewer(name, url, type) {
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
      <iframe src="${previewUrl}#toolbar=1" style="flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; width: 100%;" onerror="alert('Failed to preview PDF. Downloading file...')"></iframe>
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
}

function closeFileViewer() {
  document.getElementById('fileViewerModal').style.display = 'none';
}

/* ─── Account settings ───────────────────────────────────── */

async function saveAccountDetails(event) {
  event.preventDefault();
  const btn = event.target.querySelector('button[type="submit"]');
  const restore = window.setBtnLoading(btn, 'Saving...');

  const updateData = {
    businessName: document.getElementById('acc_businessName').value,
    contactName: document.getElementById('acc_contactName').value,
    businessEmail: document.getElementById('acc_businessEmail').value,
    phoneNumber: document.getElementById('acc_phoneNumber').value,
    businessWebsite: document.getElementById('acc_businessWebsite').value
  };

  const data = await window.apiPut('/api/me', updateData);

  if (data.success) {
    window.showToast(data.message, 'success');
  } else {
    window.showToast(data.message || 'Update failed', 'error');
  }

  restore();
}

/* ─── Logout ─────────────────────────────────────────────── */

async function handleLogout() {
  if (!await window.showConfirm('Log Out?', 'Are you sure you want to log out?')) return;
  const data = await window.apiPost('/api/logout', {});
  window.location.href = '/login?logout=success';
}

function goToSubmitShipment(type) {
  switchTab('submit-order');
  selectShipmentTypeBox(type);
}

function validateQtyInput(inputEl) {
  const row = inputEl.closest('tr');
  const select = row.querySelector('.sku-name-input');
  if (select.selectedIndex < 0) return;
  const opt = select.options[select.selectedIndex];
  if (!opt || !opt.value) return;

  const availableQty = parseInt(opt.getAttribute('data-qty')) || 0;
  const val = parseInt(inputEl.value) || 0;

  // Clear previous errors
  inputEl.classList.remove('error');
  const errEl = inputEl.parentNode.querySelector('.error-msg');
  if (errEl) errEl.remove();

  if (val > availableQty) {
    inputEl.classList.add('error');
    const msg = document.createElement('span');
    msg.className = 'error-msg';
    //msg.innerText = `Max: ${availableQty}`;
    inputEl.parentNode.appendChild(msg);
  }
}

async function downloadAllFiles(files) {
  if (!files || files.length === 0) return;

  // Collect clean filenames
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

/* ─── Boot ───────────────────────────────────────────────── */

window.addEventListener('DOMContentLoaded', () => {
  window.showLoader();

  // Form submissions
  const orderForm = document.getElementById('orderForm');
  if (orderForm) orderForm.onsubmit = handleOrderSubmit;

  // File Managers
  initFileManager('documents', 'documentsList', 'documentsZone', ['image/*', 'application/pdf', '.xls', '.xlsx']);
  initFileManager('shippingLabels', 'shippingLabelsList', 'shippingLabelsZone', ['image/*', 'application/pdf', '.xls', '.xlsx']);

  // Set min date for estimatedArrival to today
  const dateInput = document.getElementById('estimatedArrival');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
  }

  // Shipment change globally
  window.selectShipmentTypeBox = selectShipmentTypeBox;
  window.toggleShipmentFields = toggleShipmentFields;
  window.addInboundSkuRow = addInboundSkuRow;
  window.goToSubmitShipment = goToSubmitShipment;
  window.validateQtyInput = validateQtyInput;
  window.downloadAllFiles = downloadAllFiles;
  window.triggerDownload = triggerDownload;
  window.getFileTypeFromName = getFileTypeFromName;
  window.openFileViewer = openFileViewer;

  // Also add initial empty row for Inbound SKUs if table is present
  if (document.getElementById('inboundSkuBody')) {
    addInboundSkuRow();
  }

  // Account form
  window.saveAccountDetails = saveAccountDetails;

  // Shipping Labels
  window.openShippingLabelsModal = function (orderId) {
    document.getElementById('sl_orderId').value = orderId;
    document.getElementById('uploadShippingLabelsModal').style.display = 'flex';
  };

  window.closeShippingLabelsModal = function () {
    document.getElementById('uploadShippingLabelsModal').style.display = 'none';
    document.getElementById('shippingLabelsForm').reset();
    if (fileManagers['shippingLabels']) fileManagers['shippingLabels'].reset();
  };

  window.handleShippingLabelsSubmit = async function (event) {
    event.preventDefault();
    const orderId = document.getElementById('sl_orderId').value;
    const btn = event.target.querySelector('button[type="submit"]');
    const restore = window.setBtnLoading(btn, 'Uploading...');

    const formData = new FormData();
    if (fileManagers['shippingLabels']) {
      fileManagers['shippingLabels'].getFiles().forEach(f => formData.append('shippingLabels', f));
    }

    try {
      const res = await fetch(`/api/orders/${orderId}/shipping-labels`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        window.showToast('Shipping labels uploaded successfully');
        window.closeShippingLabelsModal();
        loadOutboundShipments(1);
      } else {
        window.showToast(data.message || 'Upload failed', 'error');
      }
    } catch (err) {
      console.error('Upload error:', err);
      window.showToast('Server error', 'error');
    } finally {
      restore();
    }
  };

  // Auth check
  checkAuth();
});
