import { Router, Response, NextFunction } from 'express';
import { authenticate, authorize, authorizeWithPermission } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';
import {
  crmLeadService,
  crmCommunicationService,
  crmTemplateService,
  crmTaskService,
  crmCampaignService,
  crmSurveyService,
  crmTagService,
  crmActivityService,
  crmSettingsService,
  crmReportsService,
} from '../services/crmService';

const router = Router();

// All CRM routes require authentication
router.use(authenticate);
router.use(authorizeWithPermission('crm:read', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'RECEPTIONIST', 'MARKETING']));

// ==================== LEADS ====================

// Get lead statistics
router.get('/leads/stats', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const stats = await crmLeadService.getStats(hospitalId, req.query);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// Get all leads
router.get('/leads', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const result = await crmLeadService.findAll(hospitalId, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// Create new lead
router.post('/leads', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const userId = req.user!.userId;
    const lead = await crmLeadService.create(hospitalId, userId, req.body);
    res.status(201).json({ success: true, data: lead });
  } catch (error) {
    next(error);
  }
});

// Get lead by ID
router.get('/leads/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const lead = await crmLeadService.findById(hospitalId, req.params.id);
    res.json({ success: true, data: lead });
  } catch (error) {
    next(error);
  }
});

// Update lead
router.put('/leads/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const userId = req.user!.userId;
    const lead = await crmLeadService.update(hospitalId, userId, req.params.id, req.body);
    res.json({ success: true, data: lead });
  } catch (error) {
    next(error);
  }
});

// Delete lead (Admin only)
router.delete('/leads/:id', authorizeWithPermission('crm:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const result = await crmLeadService.delete(hospitalId, req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// Update lead status
router.patch('/leads/:id/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const userId = req.user!.userId;
    const { status, reason } = req.body;
    const lead = await crmLeadService.updateStatus(hospitalId, userId, req.params.id, status, reason);
    res.json({ success: true, data: lead });
  } catch (error) {
    next(error);
  }
});

// Assign lead
router.patch('/leads/:id/assign', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const userId = req.user!.userId;
    const { assignedToId } = req.body;
    const lead = await crmLeadService.assignLead(hospitalId, userId, req.params.id, assignedToId);
    res.json({ success: true, data: lead });
  } catch (error) {
    next(error);
  }
});

// Convert lead to patient
router.post('/leads/:id/convert', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const userId = req.user!.userId;
    const result = await crmLeadService.convertToPatient(hospitalId, userId, req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Get lead timeline
router.get('/leads/:id/timeline', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const timeline = await crmLeadService.getTimeline(hospitalId, req.params.id);
    res.json({ success: true, data: timeline });
  } catch (error) {
    next(error);
  }
});

// ==================== COMMUNICATIONS ====================

// Get communications
router.get('/communications', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const result = await crmCommunicationService.findAll(hospitalId, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// Log communication
router.post('/communications', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const userId = req.user!.userId;
    const communication = await crmCommunicationService.create(hospitalId, userId, req.body);
    res.status(201).json({ success: true, data: communication });
  } catch (error) {
    next(error);
  }
});

// Get communication stats
router.get('/communications/stats', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const stats = await crmCommunicationService.getStats(hospitalId);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// ==================== TEMPLATES ====================

// Get templates
router.get('/templates', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const templates = await crmTemplateService.findAll(hospitalId, req.query);
    res.json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
});

// Create template
router.post('/templates', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const userId = req.user!.userId;
    const template = await crmTemplateService.create(hospitalId, userId, req.body);
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
});

// Update template
router.put('/templates/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const template = await crmTemplateService.update(hospitalId, req.params.id, req.body);
    res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
});

// Delete template
router.delete('/templates/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const result = await crmTemplateService.delete(hospitalId, req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// Preview template
router.post('/templates/:id/preview', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const result = await crmTemplateService.preview(hospitalId, req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ==================== TASKS ====================

// Get my tasks
router.get('/tasks/my', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const userId = req.user!.userId;
    const tasks = await crmTaskService.getMyTasks(hospitalId, userId);
    res.json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
});

// Get overdue tasks
router.get('/tasks/overdue', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const tasks = await crmTaskService.getOverdueTasks(hospitalId);
    res.json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
});

// Get all tasks
router.get('/tasks', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const result = await crmTaskService.findAll(hospitalId, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// Create task
router.post('/tasks', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const userId = req.user!.userId;
    const task = await crmTaskService.create(hospitalId, userId, req.body);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// Update task
router.put('/tasks/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const task = await crmTaskService.update(hospitalId, req.params.id, req.body);
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// Update task status
router.patch('/tasks/:id/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const userId = req.user!.userId;
    const { status, outcome } = req.body;
    const task = await crmTaskService.updateStatus(hospitalId, userId, req.params.id, status, outcome);
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// ==================== ACTIVITIES ====================

// Get activities
router.get('/activities', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const result = await crmActivityService.findAll(hospitalId, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// Log activity
router.post('/activities', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const userId = req.user!.userId;
    const activity = await crmActivityService.create(hospitalId, userId, req.body);
    res.status(201).json({ success: true, data: activity });
  } catch (error) {
    next(error);
  }
});

// ==================== CAMPAIGNS ====================

// Get campaigns
router.get('/campaigns', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const campaigns = await crmCampaignService.findAll(hospitalId, req.query);
    res.json({ success: true, data: campaigns });
  } catch (error) {
    next(error);
  }
});

// Create campaign
router.post('/campaigns', authorizeWithPermission('crm:campaigns', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MARKETING']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const userId = req.user!.userId;
    const campaign = await crmCampaignService.create(hospitalId, userId, req.body);
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
});

// Get campaign by ID
router.get('/campaigns/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const campaign = await crmCampaignService.findById(hospitalId, req.params.id);
    res.json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
});

// Update campaign
router.put('/campaigns/:id', authorizeWithPermission('crm:campaigns', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MARKETING']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const campaign = await crmCampaignService.update(hospitalId, req.params.id, req.body);
    res.json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
});

// Launch campaign
router.post('/campaigns/:id/launch', authorizeWithPermission('crm:campaigns', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MARKETING']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const campaign = await crmCampaignService.launch(hospitalId, req.params.id);
    res.json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
});

// Pause campaign
router.patch('/campaigns/:id/pause', authorizeWithPermission('crm:campaigns', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MARKETING']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const campaign = await crmCampaignService.pause(hospitalId, req.params.id);
    res.json({ success: true, data: campaign });
  } catch (error) {
    next(error);
  }
});

// Get campaign analytics
router.get('/campaigns/:id/analytics', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const analytics = await crmCampaignService.getAnalytics(hospitalId, req.params.id);
    res.json({ success: true, data: analytics });
  } catch (error) {
    next(error);
  }
});

// ==================== SURVEYS ====================

// Get surveys
router.get('/surveys', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const surveys = await crmSurveyService.findAll(hospitalId, req.query);
    res.json({ success: true, data: surveys });
  } catch (error) {
    next(error);
  }
});

// Create survey
router.post('/surveys', authorizeWithPermission('crm:surveys', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MARKETING']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const userId = req.user!.userId;
    const survey = await crmSurveyService.create(hospitalId, userId, req.body);
    res.status(201).json({ success: true, data: survey });
  } catch (error) {
    next(error);
  }
});

// Get survey by ID
router.get('/surveys/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const survey = await crmSurveyService.findById(hospitalId, req.params.id);
    res.json({ success: true, data: survey });
  } catch (error) {
    next(error);
  }
});

// Update survey
router.put('/surveys/:id', authorizeWithPermission('crm:surveys', ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MARKETING']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const survey = await crmSurveyService.update(hospitalId, req.params.id, req.body);
    res.json({ success: true, data: survey });
  } catch (error) {
    next(error);
  }
});

// Get survey responses
router.get('/surveys/:id/responses', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const result = await crmSurveyService.getResponses(hospitalId, req.params.id, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// Submit survey response
router.post('/surveys/:id/responses', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const response = await crmSurveyService.submitResponse(req.params.id, req.body);
    res.status(201).json({ success: true, data: response });
  } catch (error) {
    next(error);
  }
});

// Get survey analytics
router.get('/surveys/:id/analytics', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const analytics = await crmSurveyService.getAnalytics(hospitalId, req.params.id);
    res.json({ success: true, data: analytics });
  } catch (error) {
    next(error);
  }
});

// ==================== TAGS ====================

// Get tags
router.get('/tags', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const tags = await crmTagService.findAll(hospitalId);
    res.json({ success: true, data: tags });
  } catch (error) {
    next(error);
  }
});

// Create tag
router.post('/tags', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const tag = await crmTagService.create(hospitalId, req.body);
    res.status(201).json({ success: true, data: tag });
  } catch (error) {
    next(error);
  }
});

// Update tag
router.put('/tags/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const tag = await crmTagService.update(hospitalId, req.params.id, req.body);
    res.json({ success: true, data: tag });
  } catch (error) {
    next(error);
  }
});

// Delete tag
router.delete('/tags/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const result = await crmTagService.delete(hospitalId, req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// ==================== REPORTS ====================

// Get dashboard
router.get('/reports/dashboard', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const dashboard = await crmReportsService.getDashboard(hospitalId, req.query);
    res.json({ success: true, data: dashboard });
  } catch (error) {
    next(error);
  }
});

// Get lead conversion report
router.get('/reports/lead-conversion', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const report = await crmReportsService.getLeadConversionReport(hospitalId, req.query);
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
});

// Get staff performance report
router.get('/reports/staff-performance', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const report = await crmReportsService.getStaffPerformance(hospitalId, req.query);
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
});

// ==================== SETTINGS ====================

// Get settings
router.get('/settings', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const settings = await crmSettingsService.get(hospitalId);
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

// Update settings
router.put('/settings', authorizeWithPermission('crm:write', ['SUPER_ADMIN', 'HOSPITAL_ADMIN']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hospitalId = req.user!.hospitalId;
    const settings = await crmSettingsService.update(hospitalId, req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

export default router;
