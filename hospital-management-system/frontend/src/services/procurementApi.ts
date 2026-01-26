import { api } from './api';

// ==================== Procurement API Service ====================

// --- Suppliers ---
export const procurementApi = {
  // Suppliers
  getSuppliers: (params?: any) => api.get('/procurement/suppliers', { params }),
  getSupplierById: (id: string) => api.get(`/procurement/suppliers/${id}`),
  createSupplier: (data: any) => api.post('/procurement/suppliers', data),
  updateSupplier: (id: string, data: any) => api.put(`/procurement/suppliers/${id}`, data),
  deleteSupplier: (id: string) => api.delete(`/procurement/suppliers/${id}`),
  getSupplierPerformance: (id: string) => api.get(`/procurement/suppliers/${id}/performance`),

  // Purchase Requisitions
  getRequisitions: (params?: any) => api.get('/procurement/requisitions', { params }),
  getRequisitionById: (id: string) => api.get(`/procurement/requisitions/${id}`),
  createRequisition: (data: any) => api.post('/procurement/requisitions', data),
  updateRequisition: (id: string, data: any) => api.put(`/procurement/requisitions/${id}`, data),
  approveRequisition: (id: string, data?: any) => api.post(`/procurement/requisitions/${id}/approve`, data),
  rejectRequisition: (id: string, data?: any) => api.post(`/procurement/requisitions/${id}/reject`, data),
  cancelRequisition: (id: string) => api.post(`/procurement/requisitions/${id}/cancel`),

  // Purchase Orders
  getPurchaseOrders: (params?: any) => api.get('/procurement/purchase-orders', { params }),
  getPurchaseOrderById: (id: string) => api.get(`/procurement/purchase-orders/${id}`),
  createPurchaseOrder: (data: any) => api.post('/procurement/purchase-orders', data),
  updatePurchaseOrder: (id: string, data: any) => api.put(`/procurement/purchase-orders/${id}`, data),
  approvePurchaseOrder: (id: string, data?: any) => api.post(`/procurement/purchase-orders/${id}/approve`, data),
  cancelPurchaseOrder: (id: string, reason?: string) => api.post(`/procurement/purchase-orders/${id}/cancel`, { reason }),
  sendPurchaseOrder: (id: string) => api.post(`/procurement/purchase-orders/${id}/send`),

  // Goods Receipt Notes (GRNs)
  getGoodsReceipts: (params?: any) => api.get('/procurement/goods-receipts', { params }),
  getGoodsReceiptById: (id: string) => api.get(`/procurement/goods-receipts/${id}`),
  createGoodsReceipt: (data: any) => api.post('/procurement/goods-receipts', data),
  approveGoodsReceipt: (id: string) => api.post(`/procurement/goods-receipts/${id}/approve`),
  rejectGoodsReceipt: (id: string, reason?: string) => api.post(`/procurement/goods-receipts/${id}/reject`, { reason }),

  // Invoices
  getInvoices: (params?: any) => api.get('/procurement/invoices', { params }),
  getInvoiceById: (id: string) => api.get(`/procurement/invoices/${id}`),
  createInvoice: (data: any) => api.post('/procurement/invoices', data),
  updateInvoice: (id: string, data: any) => api.put(`/procurement/invoices/${id}`, data),
  approveInvoice: (id: string) => api.post(`/procurement/invoices/${id}/approve`),
  matchInvoice: (id: string) => api.post(`/procurement/invoices/${id}/match`),
  getThreeWayMatch: (id: string) => api.get(`/procurement/invoices/${id}/three-way-match`),

  // Returns
  getReturns: (params?: any) => api.get('/procurement/returns', { params }),
  createReturn: (data: any) => api.post('/procurement/returns', data),

  // Analytics / Dashboard
  getDashboardStats: () => api.get('/procurement/analytics/dashboard'),
  getRecentPOs: (limit?: number) => api.get('/procurement/analytics/recent-pos', { params: { limit } }),
  getPendingApprovals: () => api.get('/procurement/analytics/pending'),
  getSpendByCategory: () => api.get('/procurement/analytics/spend', { params: { groupBy: 'category' } }),
  getLowStockAlerts: () => api.get('/procurement/analytics/low-stock'),
  getAnalytics: (params?: any) => api.get('/procurement/analytics/spend', { params }),
  getPOStatusBreakdown: () => api.get('/procurement/analytics/po-status-breakdown'),
  getRecentGRNs: (limit?: number) => api.get('/procurement/analytics/recent-grns', { params: { limit } }),
  getMyPRs: (limit?: number) => api.get('/procurement/analytics/my-prs', { params: { limit } }),
  getSupplierPerformanceReport: (limit?: number) => api.get('/procurement/analytics/supplier-performance', { params: { limit } }),
};

export default procurementApi;
