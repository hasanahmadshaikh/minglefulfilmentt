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
      document.getElementById('welcomeGreeting').innerText = `Welcome back, ${data.user.name}`;

      // Populate Account Form
      ['businessName', 'contactName', 'businessEmail', 'phoneNumber', 'businessWebsite'].forEach(field => {
        const input = document.getElementById(`acc_${field}`);
        if (input) input.value = data.user[field] || '';
      });

      loadDashboardData();
    } else {
      window.location.href = '/login.html';
    }
  } catch {
    window.location.href = '/login.html';
  }
}

/* ─── Dashboard Stats + initial orders load ─────────────── */

async function loadDashboardData(page = 1) {
  try {
    const statsData = await window.apiFetch('/api/stats');
    if (statsData.success) {
      const { totalOrders, activeOrders, pendingInvoices } = statsData.stats;
      const values = document.querySelectorAll('.stat-value');
      const subtexts = document.querySelectorAll('.stat-subtext');

      values[0].innerText = activeOrders;
      subtexts[0].innerText = activeOrders === 0 ? 'No active orders' : `${activeOrders} orders in progress`;
      values[1].innerText = pendingInvoices;
      values[2].innerText = totalOrders;
      subtexts[2].innerText = totalOrders === 1 ? '1 lifetime order' : `${totalOrders} lifetime orders`;
    }

    loadRecentShipments();
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
    window.hideLoader();
  }
}

async function loadRecentShipments() {
  try {
    const data = await window.apiFetch('/api/orders?page=1&limit=5');
    const tbody = document.querySelector('#recentOrdersTable tbody');
    if (!tbody || !data.success) return;

    if (data.orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">No recent shipments</td></tr>';
      return;
    }

    tbody.innerHTML = data.orders.map(o => `
      <tr>
        <td><strong>${o.orderId}</strong></td>
        <td>${o.shipmentName}</td>
        <td><span class="status-badge status-${o.status.toLowerCase().replace(/\s/g, '-')}">${o.status}</span></td>
        <td><button class="portal-btn-sm" onclick="viewOrderDetails('${o._id}')">View</button></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load recent shipments:', err);
  }
}

/* ─── Tab switching ──────────────────────────────────────── */

function switchTab(tabId) {
  // Reset order form if leaving submit-order
  const currentlyOnSubmitOrder = document.getElementById('submit-order').classList.contains('active');
  if (currentlyOnSubmitOrder && tabId !== 'submit-order') {
    const form = document.getElementById('orderForm');
    if (form) {
      form.reset();
      // Reset dynamic selects and file lists
      const supplierSelect = document.getElementById('supplierName');
      if (supplierSelect) supplierSelect.innerHTML = '<option value="" disabled selected>Select Supplier/Vendor</option>';
      Object.values(fileManagers).forEach(fm => fm.reset());
    }
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
    if (tabId === 'inventory') loadInventory();

    window.hideLoader();
  }, 300);
}

/* ─── Inventory Logic ────────────────────────────────────── */

async function loadInventory() {
  try {
    const data = await window.apiFetch('/api/inventory');
    const tbody = document.querySelector('#inventoryTable tbody');
    if (!tbody || !data.success) return;

    if (data.inventory.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:40px;">No inventory found</td></tr>';
      return;
    }

    tbody.innerHTML = data.inventory.map(item => `
      <tr>
        <td><strong>${item.productName}</strong></td>
        <td>${item.sku || '-'}</td>
        <td style="font-weight: 600; color: #0f172a;">${item.quantity}</td>
        <td>${new Date(item.updatedAt).toLocaleDateString()}</td>
      </tr>
    `).join('');
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

  tbody.innerHTML = data.orders.map(o => `
    <tr>
      <td>${new Date(o.createdAt).toLocaleDateString()}</td>
      <td><strong>${o.orderId}</strong></td>
      <td>${o.shipmentName}</td>
      <td>${o.carrier}</td>
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

  tbody.innerHTML = data.orders.map(o => `
    <tr>
      <td>${new Date(o.createdAt).toLocaleDateString()}</td>
      <td><strong>${o.orderId}</strong></td>
      <td>${o.shipmentName}</td>
      <td>${o.carrier}</td>
      <td><span class="status-badge status-${o.status.toLowerCase().replace(/\s/g, '-')}">${o.status}</span></td>
      <td><button class="portal-btn-sm" onclick="viewOrderDetails('${o._id}')">View</button></td>
    </tr>
  `).join('');

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

/* ─── Shipment Change Logic ──────────────────────────────── */

function handleShipmentChange() {
  const shipment = document.getElementById('shipmentName').value;
  const supplierSelect = document.getElementById('supplierName');

  // Clear existing options except the first one
  supplierSelect.innerHTML = '<option value="" disabled selected>Select Supplier/Vendor</option>';

  let options = [];
  if (shipment === 'Amazon') {
    options = ['FBA', 'FBM'];
  } else if (shipment === 'Walmart') {
    options = ['WFS', 'WSF'];
  } else {
    options = ['SF']; // For eBay, Etsy, Shopify, Other
  }

  options.forEach(opt => {
    const el = document.createElement('option');
    el.value = opt;
    el.textContent = opt;
    supplierSelect.appendChild(el);
  });
}

/* ─── Form Type Toggling ─────────────────────────────────── */

function toggleShipmentFields(type) {
  const inboundFields = document.getElementById('inboundProductDetails');
  const outboundFields = document.getElementById('outboundProductPicker');

  if (type === 'outbound') {
    inboundFields.style.display = 'none';
    outboundFields.style.display = 'block';
    loadProductPicker();
  } else {
    inboundFields.style.display = 'block';
    outboundFields.style.display = 'none';
  }
}

async function loadProductPicker() {
  try {
    const data = await window.apiFetch('/api/inventory');
    const container = document.getElementById('productSelectionList');
    if (!container || !data.success) return;

    if (data.inventory.length === 0) {
      container.innerHTML = '<p style="padding: 20px; color: #94a3b8; font-style: italic;">No products in inventory. Please contact admin to add inventory.</p>';
      return;
    }

    container.innerHTML = data.inventory.map(item => `
      <div class="product-picker-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 8px;">
        <div>
          <div style="font-weight: 600; color: #1e293b;">${item.productName}</div>
          <div style="font-size: 12px; color: #64748b;">SKU: ${item.sku || '-'} | Available: ${item.quantity}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="number" class="portal-input product-qty-input" 
            data-product="${item.productName}" 
            data-sku="${item.sku || ''}" 
            data-available="${item.quantity}"
            min="0" max="${item.quantity}" placeholder="Qty" style="width: 80px; padding: 6px 10px; margin:0;">
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load product picker:', err);
  }
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
      links.push(`<a href="${file}" target="_blank" class="portal-file-link">${displayName}</a>`);
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
  const type = form.querySelector('input[name="shipmentType"]:checked').value;
  formData.append('type', type);

  // Common Fields
  const commonFields = [
    'shipmentName', 'supplierName', 'trackingNumber', 'carrier',
    'estimatedArrival', 'packingDetails', 'notes', 'googleDriveDocs'
  ];
  commonFields.forEach(f => {
    const el = document.getElementById(f);
    if (el) formData.append(f, el.value);
  });

  if (type === 'outbound') {
    const productInputs = document.querySelectorAll('.product-qty-input');
    const selectedProducts = [];
    productInputs.forEach(input => {
      const qty = parseInt(input.value);
      if (qty > 0) {
        selectedProducts.push({
          productName: input.dataset.product,
          sku: input.dataset.sku,
          quantity: qty
        });
      }
    });

    if (selectedProducts.length === 0) {
      window.showToast('Please select at least one product to ship out', 'error');
      restore();
      return;
    }
    formData.append('products', JSON.stringify(selectedProducts));
    
    // For outbound, SKU list and Quantities are derived from selected products
    formData.append('skuList', selectedProducts.map(p => p.sku).join(', '));
    formData.append('productQuantities', selectedProducts.map(p => `${p.productName}: ${p.quantity}`).join(', '));
  } else {
    // Regular Inbound fields
    ['skuList', 'productQuantities'].forEach(f => {
      const el = document.getElementById(f);
      if (el) formData.append(f, el.value);
    });
  }

  // Required Images
  const imgFiles = fileManagers['productImages'].getFiles();
  if (imgFiles.length === 0) {
    window.showToast('Product images are required', 'error');
    restore();
    return;
  }
  imgFiles.forEach(f => formData.append('productImages', f));

  // Optional Files
  fileManagers['commercialInvoices'].getFiles().forEach(f => formData.append('commercialInvoices', f));
  fileManagers['packingListPDFs'].getFiles().forEach(f => formData.append('packingListPDFs', f));

  try {
    const res = await fetch('/api/orders', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      window.showToast(data.message, 'success');
      form.reset();
      // Clear dynamic dropdown
      document.getElementById('supplierName').innerHTML = '<option value="" disabled selected>Select Supplier/Vendor</option>';
      // Clear all file managers
      Object.values(fileManagers).forEach(fm => fm.reset());

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
        <button class="modal-btn confirm" id="successViewShipment" style="flex:1;">View Inbound</button>
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
    switchTab('inbound-shipments');
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

    content.innerHTML = `
      <div class="detail-card-grid">
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

        ${order.type === 'outbound' && order.products && order.products.length > 0 ? `
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

    modal.style.display = 'flex';
  } catch (err) {
    console.error('View Details Error:', err);
    window.showToast(`Details Error: ${err.message}`, 'error');
  } finally {
    window.hideLoader();
  }
}

function renderFilePills(files) {
  if (!files || files.length === 0) return '<span style="color: #94a3b8; font-size: 13px; font-style: italic;">No files attached</span>';
  return `<div class="file-pill-list">
    ${files.map(file => {
      const fileName = file.split('/').pop();
      return `<a href="/uploads/${file}" target="_blank" class="file-pill">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fileName}</span>
      </a>`;
    }).join('')}
  </div>`;
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

function openFileViewer(name, url, type) {
  const modal = document.getElementById('fileViewerModal');
  const title = document.getElementById('modalFileName');
  const content = document.getElementById('fileViewerContent');

  title.innerText = name;
  content.innerHTML = '';

  if (type.includes('image')) {
    content.innerHTML = `<img src="${url}" style="max-width: 100%; max-height: 70vh; border-radius: 8px;">`;
  } else if (type.includes('pdf')) {
    content.innerHTML = `<iframe src="${url}" style="width: 100%; height: 70vh; border: none;"></iframe>`;
  } else {
    content.innerHTML = `<div class="empty-state">
      <p>Preview not available for this file type.</p>
      <a href="${url}" download="${name}" class="portal-file-link">Download File</a>
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
  window.location.href = '/login.html';
}

/* ─── Boot ───────────────────────────────────────────────── */

window.addEventListener('DOMContentLoaded', () => {
  window.showLoader();

  // Form submissions
  const orderForm = document.getElementById('orderForm');
  if (orderForm) orderForm.onsubmit = handleOrderSubmit;

  // File Managers
  initFileManager('productImages', 'productImagesList', 'productImagesZone', ['image/*', 'application/pdf']);
  initFileManager('commercialInvoices', 'commercialInvoicesList', 'commercialInvoicesZone', ['image/*', 'application/pdf', '.xls', '.xlsx']);
  initFileManager('packingListPDFs', 'packingListPDFsList', 'packingListPDFsZone', ['application/pdf']);

  // Set min date for estimatedArrival to today
  const dateInput = document.getElementById('estimatedArrival');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
  }

  // Shipment change globally
  window.handleShipmentChange = handleShipmentChange;
  window.toggleShipmentFields = toggleShipmentFields;

  // Account form
  window.saveAccountDetails = saveAccountDetails;

  // Auth check
  checkAuth();
});
