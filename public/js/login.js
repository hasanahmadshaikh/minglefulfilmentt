/**
 * login.js — Login, Sign Up, OTP Verification, Forgot/Reset Password
 * Depends on: components.js, api.js
 */

let pendingEmail = '';
let currentFlow = ''; // 'signup' or 'login'
let timerInterval = null;
let timeLeft = 120;

/* ─── Timer ─────────────────────────────────────────────── */

function startTimer() {
  clearInterval(timerInterval);
  timeLeft = 120;

  const timerEl    = document.getElementById('timer');
  const expiryText = document.getElementById('expiry-text');
  const resendBtn  = document.getElementById('resendBtn');

  resendBtn.classList.add('disabled');
  expiryText.style.display = 'inline';
  timerEl.innerText = timeLeft;

  timerInterval = setInterval(() => {
    timeLeft--;
    timerEl.innerText = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      expiryText.style.display = 'none';
      resendBtn.classList.remove('disabled');
    }
  }, 1000);
}

function cancelOTP() {
  clearInterval(timerInterval);
  showTab(currentFlow === 'signup' ? 'signup' : 'login');
}

/* ─── Tab navigation ────────────────────────────────────── */

function showTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.form-section').forEach(f => f.classList.remove('active'));

  const tabNav = document.getElementById('tab-nav');

  if (tabName === 'login') {
    tabNav.style.display = 'flex';
    document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
    document.getElementById('login-form').classList.add('active');
  } else if (tabName === 'signup') {
    tabNav.style.display = 'flex';
    document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
    document.getElementById('signup-form').classList.add('active');
  } else if (tabName === 'otp') {
    tabNav.style.display = 'none';
    document.getElementById('otp-form').classList.add('active');
    startTimer();
  } else if (tabName === 'forgot') {
    tabNav.style.display = 'none';
    document.getElementById('forgot-form').classList.add('active');
  }
}

/* ─── Login ─────────────────────────────────────────────── */

async function handleLoginInitiate(event) {
  event.preventDefault();
  const email    = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  const btn     = document.getElementById('loginSubmitBtn');
  const restore = window.setBtnLoading(btn, 'Verifying...');

  const data = await window.apiPost('/api/login/initiate', { email, password });

  if (data.success) {
    if (data.needsOTP) {
      pendingEmail  = email;
      currentFlow   = 'login';
      window.showToast(data.message, 'success');
      setTimeout(() => showTab('otp'), 500);
    } else {
      window.showToast(data.message, 'success');
      setTimeout(() => {
        window.location.href = data.user.role === 'admin' ? '/admin.html' : '/dashboard.html';
      }, 1000);
    }
  } else {
    window.showToast(data.message || 'Login failed', 'error');
  }

  restore();
}

/* ─── Sign Up ───────────────────────────────────────────── */

async function handleSignupInitiate(event) {
  event.preventDefault();
  const name            = document.getElementById('signupName').value;
  const email           = document.getElementById('signupEmail').value;
  const password        = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('signupConfirmPassword').value;

  if (password !== confirmPassword) {
    window.showToast('Passwords do not match', 'error');
    return;
  }

  const btn     = event.target.querySelector('button[type="submit"]');
  const restore = window.setBtnLoading(btn, 'Processing...');

  const data = await window.apiPost('/api/signup/initiate', { name, email, password, confirmPassword });

  if (data.success) {
    pendingEmail = email;
    currentFlow  = 'signup';
    window.showToast(data.message, 'success');
    setTimeout(() => showTab('otp'), 500);
  } else {
    window.showToast(data.message || 'Signup failed', 'error');
  }

  restore();
}

/* ─── OTP Verify ────────────────────────────────────────── */

async function handleVerify(event) {
  event.preventDefault();
  const otpCode  = document.getElementById('otpCode').value;
  const endpoint = currentFlow === 'signup' ? '/api/signup/verify' : '/api/login/verify';

  const btn     = document.getElementById('verifyBtn');
  const restore = window.setBtnLoading(btn, 'Verifying...');

  const data = await window.apiPost(endpoint, { email: pendingEmail, otp: otpCode });

  if (data.success) {
    clearInterval(timerInterval);
    window.showToast(data.message, 'success');
    setTimeout(() => {
      if (currentFlow === 'signup') {
        showTab('login');
      } else {
        window.location.href = '/dashboard.html';
      }
    }, 1500);
  } else {
    window.showToast(data.message || 'Verification failed', 'error');
  }

  restore();
}

/* ─── Resend OTP ────────────────────────────────────────── */

async function handleResendOTP() {
  if (timeLeft > 0) return;

  const resendBtn = document.getElementById('resendBtn');
  resendBtn.classList.add('disabled');

  const data = await window.apiPost('/api/otp/resend', { email: pendingEmail, type: currentFlow });

  if (data.success) {
    window.showToast(data.message, 'success');
    startTimer();
  } else {
    window.showToast(data.message, 'error');
    resendBtn.classList.remove('disabled');
  }
}

/* ─── Forgot Password ───────────────────────────────────── */

async function handleForgot(event) {
  event.preventDefault();
  const email = document.getElementById('forgotEmail').value;

  const btn     = event.target.querySelector('button[type="submit"]');
  const restore = window.setBtnLoading(btn, 'Sending Link...');

  const data = await window.apiPost('/api/forgot-password', { email });
  window.showToast(data.message, 'info');

  if (data.success) {
    event.target.reset();
    setTimeout(() => showTab('login'), 2000);
  }

  restore();
}

/* ─── Boot ──────────────────────────────────────────────── */

window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('logout') === 'success') {
    window.showToast('You have been successfully logged out', 'success');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
