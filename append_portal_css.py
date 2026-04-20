import os

portal_css = """

/* ================= Customer Portal (Dashboard) ================= */
.portal-body {
  background-color: #f8fafc;
  min-height: 100vh;
}

.portal-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
}

/* Header */
.portal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
}

.portal-title-section h1 {
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 4px;
}

.portal-title-section p {
  color: #64748b;
  font-size: 16px;
}

.logout-outline-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 8px;
  color: #475569;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
}

.logout-outline-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

/* Tabs Navigation */
.portal-tabs {
  display: flex;
  gap: 8px;
  padding: 6px;
  background: #f1f5f9;
  border-radius: 12px;
  margin-bottom: 30px;
  width: fit-content;
  overflow-x: auto;
  scrollbar-width: none; /* Hide scrollbar for Firefox */
}

.portal-tabs::-webkit-scrollbar {
  display: none; /* Hide scrollbar for Chrome/Safari */
}

.tab-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #64748b;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.tab-pill.active {
  background: #0094FF;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 148, 255, 0.25);
}

.tab-pill:hover:not(.active) {
  background: #e2e8f0;
}

.tab-pill svg {
  width: 18px;
  height: 18px;
}

/* Content Sections */
.tab-content {
  display: none;
}

.tab-content.active {
  display: block;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Stats Cards Grid */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 30px;
}

.portal-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.stat-label {
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
}

.stat-icon-bg {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon-bg.blue { background: #eff6ff; color: #0094FF; }
.stat-icon-bg.indigo { background: #eef2ff; color: #6366f1; }
.stat-icon-bg.teal { background: #f0fdfa; color: #0d9488; }

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 4px;
}

.stat-subtext {
  font-size: 14px;
  color: #64748b;
}

/* Quick Actions */
.quick-actions-card {
  padding: 30px;
}

.section-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 8px;
}

.section-header p {
  color: #64748b;
  font-size: 14px;
  margin-bottom: 24px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #e2e8f0;
}

.action-btn.primary {
  background: #0094FF;
  color: white;
  border-color: #0094FF;
  box-shadow: 0 4px 12px rgba(0, 148, 255, 0.2);
}

.action-btn.secondary {
  background: white;
  color: #0f172a;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.08);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 40px;
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  color: #cbd5e1;
  margin-bottom: 24px;
}

.empty-state h4 {
  font-size: 20px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 8px;
}

.empty-state p {
  color: #64748b;
  font-size: 15px;
}

/* Form Styles */
.form-card-header {
  margin-bottom: 24px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.form-full {
  grid-column: span 2;
}

.portal-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 8px;
}

.portal-input, .portal-textarea {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 15px;
  background: #f8fafc;
  transition: all 0.2s;
}

.portal-input:focus, .portal-textarea:focus {
  outline: none;
  border-color: #0094FF;
  background: white;
  box-shadow: 0 0 0 4px rgba(0, 148, 255, 0.1);
}

.upload-zone {
  border: 2px dashed #e2e8f0;
  border-radius: 12px;
  padding: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: #f8fafc;
}

.upload-zone:hover {
  border-color: #0094FF;
  background: white;
}

.upload-icon {
  width: 40px;
  height: 40px;
  color: #94a3b8;
}

.upload-text {
  font-size: 14px;
  color: #64748b;
  text-align: center;
}

.upload-text b { color: #334155; }

.submit-full-btn {
  width: 100%;
  background: #0094FF;
  color: white;
  padding: 16px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 10px;
}

.submit-full-btn:hover {
  background: #007acc;
  box-shadow: 0 4px 12px rgba(0, 148, 255, 0.3);
}

/* Responsive */
@media (max-width: 992px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .stats-row { grid-template-columns: 1fr; }
  .form-grid { grid-template-columns: 1fr; }
  .form-full { grid-column: span 1; }
  .portal-tabs { width: 100%; }
}
"""

with open('public/css/style.css', 'a', encoding='utf-8') as f:
    f.write(portal_css)

print("Portal styles added to style.css")
