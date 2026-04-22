/**
 * api.js — Shared HTTP helpers for Mingle Fulfilment
 * All pages import this via components.js loading order.
 */

/**
 * Generic fetch wrapper.
 * Returns { success, data } — never throws; catches network errors.
 * @param {string} url
 * @param {RequestInit} [options]
 */
window.apiFetch = async function (url, options = {}) {
  try {
    const res = await fetch(url, options);
    const data = await res.json();
    return data;
  } catch {
    return { success: false, message: 'Network error. Please try again.' };
  }
};

/** POST JSON helper */
window.apiPost = function (url, body) {
  return window.apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
};

/** PUT JSON helper */
window.apiPut = function (url, body) {
  return window.apiFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
};

/** DELETE helper */
window.apiDelete = function (url) {
  return window.apiFetch(url, { method: 'DELETE' });
};

/**
 * Disable a button, show a spinner + label, then restore on completion.
 * Returns a restore function.
 * @param {HTMLButtonElement} btn
 * @param {string} loadingLabel
 */
window.setBtnLoading = function (btn, loadingLabel = 'Loading...') {
  const original = btn.innerHTML;
  btn.innerHTML = `<span class="btn-loader"></span> ${loadingLabel}`;
  btn.disabled = true;
  return () => {
    btn.innerHTML = original;
    btn.disabled = false;
  };
};
