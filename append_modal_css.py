import os

css_append = """
/* ================= Custom Popups ================= */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease-out;
}

.modal-popup {
  background: white;
  width: 90%;
  max-width: 400px;
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  text-align: center;
  transform: scale(0.95);
  animation: modalScaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes modalScaleUp {
  to { transform: scale(1); }
}

.modal-popup h3 {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 12px;
}

.modal-popup p {
  font-size: 15px;
  color: #64748b;
  line-height: 1.6;
  margin-bottom: 24px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.modal-btn {
  flex: 1;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.modal-btn.confirm {
  background: #0094FF;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 148, 255, 0.2);
}

.modal-btn.confirm:hover {
  background: #007acc;
  transform: translateY(-2px);
}

.modal-btn.cancel {
  background: #f1f5f9;
  color: #475569;
}

.modal-btn.cancel:hover {
  background: #e2e8f0;
}
"""

with open('public/css/style.css', 'a', encoding='utf-8') as f:
    f.write(css_append)

print("CSS Appended!")
