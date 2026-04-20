import os

css_append = """

/* ================= Toast Notification ================= */
#toast-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toast {
  background: white;
  border-left: 4px solid #3b82f6;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 15px 20px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  color: #333;
  animation: slideIn 0.3s ease forwards, slideOut 0.3s ease forwards 2.7s;
  max-width: 350px;
  word-wrap: break-word;
}

.toast.success {
  border-color: #22c55e;
}
.toast.success .toast-icon {
  color: #22c55e;
}

.toast.error {
  border-color: #ef4444;
}
.toast.error .toast-icon {
  color: #ef4444;
}

@keyframes slideIn {
  from { transform: translateX(120%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(120%); opacity: 0; }
}

/* ================= Button Spinner ================= */
.btn-loader {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 0.8s ease-in-out infinite;
  margin-right: 8px;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
"""

with open('public/css/style.css', 'a', encoding='utf-8') as f:
    f.write(css_append)

print("CSS Appended!")
