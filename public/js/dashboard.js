/**
 * dashboard.js — Customer Portal
 * Depends on: components.js, api.js
 */

let currentOrdersPage = 1;
let orderSearchTimer  = null;

/* ─── Auth check ─────────────────────────────────────────── */

async function checkAuth() {
  try {
    const res  = await fetch('/api/me');
    const data = await res.json();
    window.hideLoader();

    if (data.success) {
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
      const values   = document.querySelectorAll('.stat-value');
      const subtexts = document.querySelectorAll('.stat-subtext');

      values[0].innerText   = activeOrders;
      subtexts[0].innerText = activeOrders === 0 ? 'No active orders' : `${activeOrders} orders in progress`;
      values[1].innerText   = pendingInvoices;
      values[2].innerText   = totalOrders;
      subtexts[2].innerText = totalOrders === 1 ? '1 lifetime order' : `${totalOrders} lifetime orders`;
    }

    loadMyOrders(page);
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
  }
}

/* ─── Tab switching ──────────────────────────────────────── */

function switchTab(tabId) {
  window.showLoader();
  setTimeout(() => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pill').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('primary'));

    const activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.add('active');

    const activeMenuItem = Array.from(document.querySelectorAll('.tab-pill'))
      .find(item => item.getAttribute('onclick')?.includes(`'${tabId}'`));
    if (activeMenuItem) activeMenuItem.classList.add('active');

    if (tabId === 'submit-fba') {
      const fbaBtn = Array.from(document.querySelectorAll('.action-btn')).find(b => b.innerText.includes('FBA'));
      if (fbaBtn) fbaBtn.classList.add('primary');
    } else if (tabId === 'submit-fbm') {
      const fbmBtn = Array.from(document.querySelectorAll('.action-btn')).find(b => b.innerText.includes('FBM'));
      if (fbmBtn) fbmBtn.classList.add('primary');
    }

    if (tabId === 'my-orders') loadMyOrders(1);
    window.hideLoader();
  }, 300);
}

/* ─── Orders: search debounce ────────────────────────────── */

function handleOrderSearch() {
  clearTimeout(orderSearchTimer);
  orderSearchTimer = setTimeout(() => loadMyOrders(1), 300);
}

/* ─── Orders: load & render table ───────────────────────── */

async function loadMyOrders(page = 1) {
  window.showLoader();
  try {
    const status = document.getElementById('orderStatusFilter').value;
    const search = document.getElementById('orderSearchInput').value;
    const data   = await window.apiFetch(`/api/orders?page=${page}&limit=10&status=${status}&search=${encodeURIComponent(search)}`);

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
    const fileLinks = buildFileLinks(order.attachments, order.filesLink);
    const statusColor = order.status === 'Pending' ? '#f59e0b' : '#10b981';
    return `
      <tr class="portal-table-row">
        <td class="portal-table-cell">${new Date(order.createdAt).toLocaleDateString()}</td>
        <td class="portal-table-cell portal-table-cell--bold">${order.productName}</td>
        <td class="portal-table-cell"><span class="order-type-badge">${order.type}</span></td>
        <td class="portal-table-cell">${order.quantity}</td>
        <td class="portal-table-cell">${fileLinks}</td>
        <td class="portal-table-cell"><span class="order-status-text" style="color:${statusColor}">${order.status}</span></td>
      </tr>`;
  }).join('');

  return `
    <div class="portal-table-wrapper">
      <table class="portal-table">
        <thead>
          <tr class="portal-table-head">
            <th class="portal-table-th">Date</th>
            <th class="portal-table-th">Product</th>
            <th class="portal-table-th">Type</th>
            <th class="portal-table-th">Units</th>
            <th class="portal-table-th">Files</th>
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
      const fullName    = file.split('/').pop();
      const dashIdx     = fullName.indexOf('-');
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

async function submitOrder(type, event) {
  event.preventDefault();
  if (!window.validateForm(`${type}Form`)) return;

  const form    = event.target;
  const btn     = form.querySelector('button[type="submit"]');
  const restore = window.setBtnLoading(btn, 'Submitting...');

  const formData = new FormData();
  formData.append('type',        type.toUpperCase());
  formData.append('productName', document.getElementById(`${type}_productName`).value);
  formData.append('quantity',    document.getElementById(`${type}_quantity`).value);
  formData.append('bundles',     document.getElementById(`${type}_bundles`).value);
  formData.append('filesLink',   document.getElementById(`${type}_filesLink`).value);
  formData.append('notes',       document.getElementById(`${type}_notes`).value);

  const fileInput = document.getElementById(`${type}_attachments`);
  if (fileInput.files.length > 0) {
    for (let i = 0; i < fileInput.files.length; i++) {
      formData.append('attachments', fileInput.files[i]);
    }
  }

  try {
    const res  = await fetch('/api/orders', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
      window.showToast(data.message, 'success');
      form.reset();
      loadDashboardData();
      if (await window.showConfirm('Order Submitted', 'Your order was received! Would you like to view your order history now?')) {
        switchTab('my-orders');
      }
    } else {
      window.showToast(data.message || 'Submission failed', 'error');
    }
  } catch {
    window.showToast('Server error. Please try again later.', 'error');
  } finally {
    restore();
  }
}

/* ─── File upload zone ───────────────────────────────────── */

function setupFileInput(type) {
  const input = document.getElementById(`${type}_attachments`);
  const list  = document.getElementById(`${type}_fileList`);
  const zone  = document.getElementById(`${type}_uploadZone`);
  let currentFiles = [];

  zone.addEventListener('click', () => input.click());

  input.addEventListener('change', e => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    const maxSize = 5 * 1024 * 1024;

    Array.from(e.target.files).forEach(file => {
      if (!allowed.includes(file.type)) {
        window.showToast(`"${file.name}" is not a supported type.`, 'error');
        return;
      }
      if (file.size > maxSize) {
        window.showToast(`"${file.name}" exceeds the 5 MB limit.`, 'error');
        return;
      }
      if (!currentFiles.some(f => f.name === file.name && f.size === file.size)) {
        currentFiles.push(file);
      }
    });

    renderFileList();
  });

  function renderFileList() {
    const dt = new DataTransfer();
    currentFiles.forEach(f => dt.items.add(f));
    input.files = dt.files;

    if (currentFiles.length > 0) {
      list.innerHTML = `<div class="file-list-heading">Selected files (${currentFiles.length}):</div>`;
      currentFiles.forEach((file, idx) => {
        const item = document.createElement('div');
        item.className = 'file-list-item';
        item.innerHTML = `
          <span class="file-list-name">${file.name}</span>
          <button type="button" class="file-remove-btn" onclick="window.removeFile('${type}', ${idx})">&times;</button>`;
        list.appendChild(item);
      });
      zone.style.borderColor = '#0094FF';
      zone.style.background  = '#f0f9ff';
    } else {
      list.innerHTML         = '';
      zone.style.borderColor = '#e2e8f0';
      zone.style.background  = '#f8fafc';
    }
  }

  if (!window.fileManagers) window.fileManagers = {};
  window.fileManagers[type] = { remove: idx => { currentFiles.splice(idx, 1); renderFileList(); } };
  window.removeFile = (t, idx) => window.fileManagers[t]?.remove(idx);

  input.closest('form').addEventListener('reset', () => { currentFiles = []; renderFileList(); });
}

/* ─── Account settings ───────────────────────────────────── */

async function saveAccountDetails(event) {
  event.preventDefault();
  const btn     = event.target.querySelector('button[type="submit"]');
  const restore = window.setBtnLoading(btn, 'Saving...');

  const updateData = {
    businessName:    document.getElementById('acc_businessName').value,
    contactName:     document.getElementById('acc_contactName').value,
    businessEmail:   document.getElementById('acc_businessEmail').value,
    phoneNumber:     document.getElementById('acc_phoneNumber').value,
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
  if (data.success) {
    window.location.href = '/login.html';
  } else {
    window.location.href = '/login.html';
  }
}

/* ─── Boot ───────────────────────────────────────────────── */

window.addEventListener('DOMContentLoaded', () => {
  window.showLoader();

  // Form submissions
  document.getElementById('fbaForm').onsubmit = e => submitOrder('fba', e);
  document.getElementById('fbmForm').onsubmit = e => submitOrder('fbm', e);

  // File upload zones
  setupFileInput('fba');
  setupFileInput('fbm');

  // Account form
  window.saveAccountDetails = saveAccountDetails;

  // Auth check
  checkAuth();
});
