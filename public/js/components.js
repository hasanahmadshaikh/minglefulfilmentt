class AppHeader extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <header class="header">
        <div class="container nav">
          <div class="logo">
            <img src="./svg/orderBox.svg" alt="Mingle Fulfilment Logo" />
            <span>Mingle Fulfilment</span>
          </div>
          <nav>
            <ul class="nav-links">
              <li><a href="./index.html">Home</a></li>
              <li><a href="./about.html">About</a></li>
              <li><a href="./services.html">Services</a></li>
              <li><a href="./pricing.html">Pricing</a></li>
              <li><a href="./contact.html">Contact</a></li>
              <li><a href="./login.html">Login</a></li>
            </ul>
          </nav>
          <a id="openModal" class="btn-primary" href="./getQuote.html">Get a Quote</a>
        </div>
      </header>
    `;
    const menuToggle = document.createElement('div');
    menuToggle.classList.add('menu-toggle');
    menuToggle.innerHTML = '&#9776;';
    this.querySelector('.nav').appendChild(menuToggle);

    const navLinks = this.querySelector('.nav-links');
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('show');
    });
  }
}

class AppFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <footer class="footer">
        <div class="container footer-content">
          <div class="footer-section">
            <h3>Mingle Fulfilment</h3>
            <p>Reliable FBA & FBM Prep and Fulfilment Services based in Alexandria, VA</p>
          </div>
          <div class="footer-section">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="./index.html">Home</a></li>
              <li><a href="./about.html">About</a></li>
              <li><a href="./services.html">Services</a></li>
              <li><a href="./pricing.html">Pricing</a></li>
              <li><a href="./contact.html">Contact</a></li>
              <li><a href="./login.html">Login</a></li>
            </ul>
          </div>
          <div class="footer-section">
            <h4>Contact</h4>
            <p>info@minglefulfilment.com</p>
            <p>Alexandria, VA</p>
            <p>+15712374794</p>
          </div>
        </div>
        <br/>
        <div class="footer-bottom">
          <p>© 2026 Mingle Fulfilment LLC. All rights reserved.</p>
        </div>
      </footer>
    `;
  }
}

customElements.define('app-header', AppHeader);
customElements.define('app-footer', AppFooter);

window.showToast = function (message, type = 'success') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success'
    ? `<svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
    : `<svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;

  toast.innerHTML = `${icon}<span>${message}</span>`;
  toastContainer.appendChild(toast);

  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.remove();
  }, 10000);
};

window.showConfirm = function (title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal-popup">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="modal-actions">
          <button class="modal-btn cancel" id="modalCancel">Cancel</button>
          <button class="modal-btn confirm" id="modalConfirm">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cleanup = (value) => {
      overlay.remove();
      resolve(value);
    };

    overlay.querySelector('#modalConfirm').onclick = () => cleanup(true);
    overlay.querySelector('#modalCancel').onclick = () => cleanup(false);
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
  });
};

window.showAlert = function (title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal-popup">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="modal-actions">
          <button class="modal-btn confirm" id="modalOk" style="flex: 0 0 120px;">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cleanup = () => {
      overlay.remove();
      resolve();
    };

    overlay.querySelector('#modalOk').onclick = cleanup;
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(); };
  });
};


/* Global Button Loading Helper */
window.setBtnLoading = function (btn, loadingText) {
  if (!btn) return () => {};
  const originalHtml = btn.innerHTML;
  const originalDisabled = btn.disabled;

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-sm"></span> ${loadingText}`;

  return function restore() {
    btn.innerHTML = originalHtml;
    btn.disabled = originalDisabled;
  };
};

window.renderPagination = function (containerId, pagination, loadFuncName) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { totalPages, currentPage } = pagination;
  if (!totalPages || totalPages < 1) {
    container.innerHTML = '';
    return;
  }

  // Ensure we have the string name if a function was passed
  const funcName = typeof loadFuncName === 'function' ? loadFuncName.name : loadFuncName;

  let html = `<div class="pagination-container">`;
  html += `<button class="pag-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="${funcName}(${currentPage - 1})">Previous</button>`;

  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="pag-btn ${i === currentPage ? 'active' : ''}" onclick="${funcName}(${i})">${i}</button>`;
  }

  html += `<button class="pag-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="${funcName}(${currentPage + 1})">Next</button>`;
  html += `</div>`;
  container.innerHTML = html;
};

/* Global Loader Helpers */
window.showLoader = function () {
  if (document.getElementById('global-loader')) return;
  const loader = document.createElement('div');
  loader.id = 'global-loader';
  loader.innerHTML = '<div class="spinner"></div>';
  document.body.appendChild(loader);
};

window.hideLoader = function () {
  const loader = document.getElementById('global-loader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 200);
  }
};

/* Modern Form Validation Logic */
window.validateForm = function (formId) {
  const form = document.getElementById(formId);
  if (!form) return true;

  // Clear previous errors
  form.querySelectorAll('.error-msg').forEach(msg => msg.remove());
  form.querySelectorAll('.error').forEach(input => input.classList.remove('error'));

  let isValid = true;
  const inputs = form.querySelectorAll('[required]');

  inputs.forEach(input => {
    // Skip validation for elements that are hidden
    if (input.offsetParent === null) {
      return;
    }

    // Helper to clear error state
    const clearError = () => {
      input.classList.remove('error');
      const errorMsg = input.parentNode.querySelector('.error-msg');
      if (errorMsg) errorMsg.remove();
    };

    if (!input.value.trim()) {
      isValid = false;
      input.classList.add('error');

      // Remove any existing msg before adding new one
      const existingMsg = input.parentNode.querySelector('.error-msg');
      if (existingMsg) existingMsg.remove();

      const errorMsg = document.createElement('span');
      errorMsg.className = 'error-msg';
      errorMsg.innerText = 'Please fill out this field.';
      input.parentNode.appendChild(errorMsg);

      // Add dynamic clearing when user types
      input.oninput = () => {
        if (input.value.trim()) {
          clearError();
        }
      };
    } else {
      clearError();
    }
  });

  return isValid;
};
