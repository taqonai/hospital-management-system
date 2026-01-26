import { Router, Response } from 'express';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';

// Import all procurement services
import * as supplierService from '../services/procurementSupplierService';
import * as prService from '../services/procurementPRService';
import * as poService from '../services/procurementPOService';
import * as grnService from '../services/procurementGRNService';
import * as invoiceService from '../services/procurementInvoiceService';
import * as returnService from '../services/procurementReturnService';
import * as analyticsService from '../services/procurementAnalyticsService';

const router = Router();

// All procurement routes require authentication
router.use(authenticate);

// Roles with procurement access (read/view)
const PROCUREMENT_ROLES = [
  'SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF'
] as const;

// Admin roles (create/edit/delete/approve everything)
const ADMIN_ROLES = ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER'] as const;

// Procurement staff roles (limited write access: create PRs, GRNs, invoices, returns)
const PROCUREMENT_STAFF_ROLES = ['PROCUREMENT_STAFF'] as const;

// ==================== Suppliers ====================

// List suppliers
router.get(
  '/suppliers',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await supplierService.listSuppliers(req.user!.hospitalId, {
      search: req.query.search as string,
      category: req.query.category as any,
      status: req.query.status as any,
      classification: req.query.classification as any,
      isBlacklisted: req.query.isBlacklisted === 'true' ? true : req.query.isBlacklisted === 'false' ? false : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    sendSuccess(res, result);
  })
);

// Create supplier
router.post(
  '/suppliers',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const supplier = await supplierService.createSupplier(req.user!.hospitalId, req.body);
    sendCreated(res, supplier, 'Supplier created successfully');
  })
);

// Get supplier details
router.get(
  '/suppliers/:id',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const supplier = await supplierService.getSupplierById(req.user!.hospitalId, req.params.id);
    sendSuccess(res, supplier);
  })
);

// Update supplier
router.put(
  '/suppliers/:id',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const supplier = await supplierService.updateSupplier(req.user!.hospitalId, req.params.id, req.body);
    sendSuccess(res, supplier, 'Supplier updated successfully');
  })
);

// Deactivate supplier
router.delete(
  '/suppliers/:id',
  authorizeWithPermission('procurement:delete', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const supplier = await supplierService.deactivateSupplier(req.user!.hospitalId, req.params.id);
    sendSuccess(res, supplier, 'Supplier deactivated');
  })
);

// Supplier performance scorecard
router.get(
  '/suppliers/:id/performance',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const performance = await supplierService.getSupplierPerformance(req.user!.hospitalId, req.params.id);
    sendSuccess(res, performance);
  })
);

// Upload supplier document
router.post(
  '/suppliers/:id/documents',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const doc = await supplierService.addDocument(req.params.id, req.body);
    sendCreated(res, doc, 'Document uploaded successfully');
  })
);

// Blacklist supplier
router.post(
  '/suppliers/:id/blacklist',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const supplier = await supplierService.blacklistSupplier(
      req.user!.hospitalId,
      req.params.id,
      req.body.reason
    );
    sendSuccess(res, supplier, 'Supplier blacklisted');
  })
);

// Unblacklist supplier
router.post(
  '/suppliers/:id/unblacklist',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const supplier = await supplierService.unblacklistSupplier(req.user!.hospitalId, req.params.id);
    sendSuccess(res, supplier, 'Supplier unblacklisted');
  })
);

// Add supplier contact
router.post(
  '/suppliers/:id/contacts',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contact = await supplierService.addContact(req.params.id, req.body);
    sendCreated(res, contact, 'Contact added');
  })
);

// Update supplier performance scores
router.put(
  '/suppliers/:id/scores',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const supplier = await supplierService.updatePerformanceScores(
      req.user!.hospitalId,
      req.params.id,
      req.body
    );
    sendSuccess(res, supplier, 'Scores updated');
  })
);

// Expiring documents
router.get(
  '/suppliers-documents/expiring',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const days = req.query.days ? Number(req.query.days) : 30;
    const docs = await supplierService.getExpiringDocuments(req.user!.hospitalId, days);
    sendSuccess(res, docs);
  })
);

// ==================== Purchase Requisitions ====================

// List PRs
router.get(
  '/requisitions',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await prService.listPRs(req.user!.hospitalId, {
      status: req.query.status as any,
      departmentId: req.query.departmentId as string,
      urgency: req.query.urgency as any,
      requestedById: req.query.requestedById as string,
      search: req.query.search as string,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    sendSuccess(res, result);
  })
);

// Create PR (Staff can create, Manager can create)
router.post(
  '/requisitions',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF', 'PHARMACIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const pr = await prService.createPR(req.user!.hospitalId, req.user!.userId, req.body);
    sendCreated(res, pr, 'Purchase requisition created');
  })
);

// Get PR details
router.get(
  '/requisitions/pending-approvals',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await prService.getPendingApprovals(req.user!.hospitalId, req.user!.userId);
    sendSuccess(res, result);
  })
);

router.get(
  '/requisitions/:id',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const pr = await prService.getPRById(req.user!.hospitalId, req.params.id);
    sendSuccess(res, pr);
  })
);

// Update PR (draft only - Staff and Manager can edit)
router.put(
  '/requisitions/:id',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF', 'PHARMACIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const pr = await prService.updatePR(req.user!.hospitalId, req.params.id, req.body);
    sendSuccess(res, pr, 'Requisition updated');
  })
);

// Submit PR for approval (Staff and Manager can submit)
router.post(
  '/requisitions/:id/submit',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF', 'PHARMACIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const pr = await prService.submitPR(req.user!.hospitalId, req.params.id, req.user!.userId);
    sendSuccess(res, pr, 'Requisition submitted for approval');
  })
);

// Approve PR (Only Manager and Admins can approve, NOT Staff)
router.post(
  '/requisitions/:id/approve',
  authorizeWithPermission('procurement:approve', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const pr = await prService.approvePR(
      req.user!.hospitalId,
      req.params.id,
      req.user!.userId,
      req.body.comments
    );
    sendSuccess(res, pr, 'Requisition approved');
  })
);

// Reject PR
router.post(
  '/requisitions/:id/reject',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.body.reason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }
    const pr = await prService.rejectPR(
      req.user!.hospitalId,
      req.params.id,
      req.user!.userId,
      req.body.reason
    );
    sendSuccess(res, pr, 'Requisition rejected');
  })
);

// Cancel PR (Staff and Manager can cancel)
router.post(
  '/requisitions/:id/cancel',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF', 'PHARMACIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const pr = await prService.cancelPR(req.user!.hospitalId, req.params.id);
    sendSuccess(res, pr, 'Requisition cancelled');
  })
);

// ==================== Purchase Orders ====================

// List POs
router.get(
  '/purchase-orders',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await poService.listPOs(req.user!.hospitalId, {
      status: req.query.status as any,
      supplierId: req.query.supplierId as string,
      type: req.query.type as any,
      search: req.query.search as string,
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    sendSuccess(res, result);
  })
);

// Create PO (Only Manager, Admins, and Pharmacist can create - NOT Staff)
router.post(
  '/purchase-orders',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER', 'PHARMACIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const po = await poService.createPO(req.user!.hospitalId, req.user!.userId, req.body);
    sendCreated(res, po, 'Purchase order created');
  })
);

// Get PO details
router.get(
  '/purchase-orders/:id',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const po = await poService.getPOById(req.user!.hospitalId, req.params.id);
    sendSuccess(res, po);
  })
);

// Update PO (draft only - Only Manager, Admins, and Pharmacist can edit - NOT Staff)
router.put(
  '/purchase-orders/:id',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER', 'PHARMACIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const po = await poService.updatePO(req.user!.hospitalId, req.params.id, req.body);
    sendSuccess(res, po, 'Purchase order updated');
  })
);

// Submit PO for approval (Only Manager, Admins, and Pharmacist - NOT Staff)
router.post(
  '/purchase-orders/:id/submit',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER', 'PHARMACIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const po = await poService.submitPO(req.user!.hospitalId, req.params.id);
    sendSuccess(res, po, 'Purchase order submitted for approval');
  })
);

// Approve PO (Only Manager and Admins - NOT Staff)
router.post(
  '/purchase-orders/:id/approve',
  authorizeWithPermission('procurement:approve', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const po = await poService.approvePO(
      req.user!.hospitalId,
      req.params.id,
      req.user!.userId,
      req.body.comments
    );
    sendSuccess(res, po, 'Purchase order approved');
  })
);

// Send PO to supplier (Only Manager, Admins, and Pharmacist - NOT Staff)
router.post(
  '/purchase-orders/:id/send',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER', 'PHARMACIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const po = await poService.sendPOToSupplier(req.user!.hospitalId, req.params.id);
    sendSuccess(res, po, 'Purchase order sent to supplier');
  })
);

// Cancel PO
router.post(
  '/purchase-orders/:id/cancel',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.body.reason) {
      return res.status(400).json({ success: false, message: 'Cancellation reason is required' });
    }
    const po = await poService.cancelPO(
      req.user!.hospitalId,
      req.params.id,
      req.user!.userId,
      req.body.reason
    );
    sendSuccess(res, po, 'Purchase order cancelled');
  })
);

// Amend PO
router.post(
  '/purchase-orders/:id/amend',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const po = await poService.amendPO(
      req.user!.hospitalId,
      req.params.id,
      req.user!.userId,
      req.body
    );
    sendCreated(res, po, 'Purchase order amended (new version created)');
  })
);

// Generate PO PDF
router.get(
  '/purchase-orders/:id/pdf',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const pdfBuffer = await poService.generatePOPdf(req.user!.hospitalId, req.params.id);

    // Get PO details for filename
    const po = await poService.getPOById(req.user!.hospitalId, req.params.id);
    const filename = `PO-${po.poNumber.replace(/\//g, '-')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  })
);

// ==================== GRN ====================

// List GRNs
router.get(
  '/goods-receipts',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await grnService.listGRNs(req.user!.hospitalId, {
      status: req.query.status as any,
      poId: req.query.poId as string,
      search: req.query.search as string,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    sendSuccess(res, result);
  })
);

// Create GRN (Staff can create, Manager can create)
router.post(
  '/goods-receipts',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF', 'PHARMACIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const grn = await grnService.createGRN(req.user!.hospitalId, req.user!.userId, req.body);
    sendCreated(res, grn, 'Goods receipt note created');
  })
);

// Get GRN details
router.get(
  '/goods-receipts/:id',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const grn = await grnService.getGRNById(req.user!.hospitalId, req.params.id);
    sendSuccess(res, grn);
  })
);

// Update GRN (draft only - Staff and Manager can edit)
router.put(
  '/goods-receipts/:id',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF', 'PHARMACIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const grn = await grnService.updateGRN(req.user!.hospitalId, req.params.id, req.body);
    sendSuccess(res, grn, 'GRN updated');
  })
);

// Approve GRN (triggers inventory update - Only Manager, Admins, and Pharmacist - NOT Staff)
router.post(
  '/goods-receipts/:id/approve',
  authorizeWithPermission('procurement:approve', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER', 'PHARMACIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const grn = await grnService.approveGRN(req.user!.hospitalId, req.params.id);
    sendSuccess(res, grn, 'GRN approved and inventory updated');
  })
);

// Record inspection (Staff and Manager can inspect)
router.post(
  '/goods-receipts/:id/inspect',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF', 'PHARMACIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const grn = await grnService.recordInspection(
      req.user!.hospitalId,
      req.params.id,
      req.user!.userId,
      req.body.inspectionStatus
    );
    sendSuccess(res, grn, 'Inspection recorded');
  })
);

// ==================== Invoices ====================

// List invoices
router.get(
  '/invoices',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await invoiceService.listInvoices(req.user!.hospitalId, {
      supplierId: req.query.supplierId as string,
      matchStatus: req.query.matchStatus as any,
      paymentStatus: req.query.paymentStatus as any,
      search: req.query.search as string,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    sendSuccess(res, result);
  })
);

// Record invoice (Staff can create, Manager can create)
router.post(
  '/invoices',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF', 'PHARMACIST', 'ACCOUNTANT']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const invoice = await invoiceService.createInvoice(req.user!.hospitalId, req.body);
    sendCreated(res, invoice, 'Invoice recorded');
  })
);

// Get invoice details
router.get(
  '/invoices/:id',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const invoice = await invoiceService.getInvoiceById(req.user!.hospitalId, req.params.id);
    sendSuccess(res, invoice);
  })
);

// 3-way match
router.post(
  '/invoices/:id/match',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER', 'ACCOUNTANT']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await invoiceService.performThreeWayMatch(
      req.user!.hospitalId,
      req.params.id,
      req.user!.userId
    );
    sendSuccess(res, result, 'Invoice matching completed');
  })
);

// Approve invoice for payment
router.post(
  '/invoices/:id/approve',
  authorizeWithPermission('procurement:approve', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER', 'ACCOUNTANT']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const invoice = await invoiceService.approveInvoiceForPayment(
      req.user!.hospitalId,
      req.params.id
    );
    sendSuccess(res, invoice, 'Invoice approved for payment');
  })
);

// Get overdue invoices
router.get(
  '/invoices-overdue',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const invoices = await invoiceService.getOverdueInvoices(req.user!.hospitalId);
    sendSuccess(res, invoices);
  })
);

// ==================== Returns ====================

// List returns
router.get(
  '/returns',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await returnService.listReturns(req.user!.hospitalId, {
      status: req.query.status as any,
      supplierId: req.query.supplierId as string,
      search: req.query.search as string,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    sendSuccess(res, result);
  })
);

// Create return (Staff can create, Manager can create)
router.post(
  '/returns',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF', 'PHARMACIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const returnRecord = await returnService.createReturn(
      req.user!.hospitalId,
      req.user!.userId,
      req.body
    );
    sendCreated(res, returnRecord, 'Return created');
  })
);

// Get return details
router.get(
  '/returns/:id',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const returnRecord = await returnService.getReturnById(req.user!.hospitalId, req.params.id);
    sendSuccess(res, returnRecord);
  })
);

// Approve return (Only Manager and Admins - NOT Staff)
router.post(
  '/returns/:id/approve',
  authorizeWithPermission('procurement:approve', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const returnRecord = await returnService.approveReturn(
      req.user!.hospitalId,
      req.params.id,
      req.user!.userId
    );
    sendSuccess(res, returnRecord, 'Return approved');
  })
);

// Mark return as shipped (Staff and Manager can ship)
router.post(
  '/returns/:id/ship',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF', 'PHARMACIST']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const returnRecord = await returnService.markReturnShipped(req.user!.hospitalId, req.params.id);
    sendSuccess(res, returnRecord, 'Return marked as shipped');
  })
);

// Record credit note
router.post(
  '/returns/:id/credit',
  authorizeWithPermission('procurement:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PROCUREMENT_MANAGER', 'ACCOUNTANT']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const returnRecord = await returnService.recordCreditNote(
      req.user!.hospitalId,
      req.params.id,
      req.body
    );
    sendSuccess(res, returnRecord, 'Credit note recorded');
  })
);

// ==================== Analytics / Reports ====================

// Dashboard metrics
router.get(
  '/analytics/dashboard',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const metrics = await analyticsService.getDashboardMetrics(req.user!.hospitalId);
    sendSuccess(res, metrics);
  })
);

// Spend analysis
router.get(
  '/analytics/spend',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await analyticsService.getSpendAnalysis(req.user!.hospitalId, {
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
      groupBy: req.query.groupBy as any,
    });
    sendSuccess(res, result);
  })
);

// Supplier performance report
router.get(
  '/analytics/supplier-performance',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await analyticsService.getSupplierPerformanceReport(req.user!.hospitalId, {
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    sendSuccess(res, result);
  })
);

// All pending items
router.get(
  '/analytics/pending',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await analyticsService.getPendingItems(req.user!.hospitalId);
    sendSuccess(res, result);
  })
);

// PO status breakdown
router.get(
  '/analytics/po-status-breakdown',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await analyticsService.getPOStatusBreakdown(req.user!.hospitalId);
    sendSuccess(res, result);
  })
);

// Recent POs
router.get(
  '/analytics/recent-pos',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const result = await analyticsService.getRecentPOs(req.user!.hospitalId, limit);
    sendSuccess(res, result);
  })
);

// Low stock alerts
router.get(
  '/analytics/low-stock',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const result = await analyticsService.getLowStockAlerts(req.user!.hospitalId, limit);
    sendSuccess(res, result);
  })
);

// My PRs (for staff dashboard)
router.get(
  '/analytics/my-prs',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const result = await analyticsService.getMyPRs(req.user!.hospitalId, req.user!.userId, limit);
    sendSuccess(res, result);
  })
);

// Recent GRNs
router.get(
  '/analytics/recent-grns',
  authorizeWithPermission('procurement:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'PHARMACIST', 'ACCOUNTANT', 'PROCUREMENT_MANAGER', 'PROCUREMENT_STAFF']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const result = await analyticsService.getRecentGRNs(req.user!.hospitalId, limit);
    sendSuccess(res, result);
  })
);

export default router;
