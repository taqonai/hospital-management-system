import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sendCreated, sendSuccess } from '../utils/response';
import { publicBookingService } from '../services/publicBookingService';
import { aiBookingService } from '../services/aiBookingService';

const router = Router();

// Public appointment booking (no authentication required)
router.post(
  '/book-appointment',
  asyncHandler(async (req: Request, res: Response) => {
    const booking = await publicBookingService.createPublicBooking(req.body);
    sendCreated(res, booking, 'Appointment booked successfully! You will receive a confirmation email shortly.');
  })
);

// Get available departments for booking
router.get(
  '/departments',
  asyncHandler(async (req: Request, res: Response) => {
    const departments = await publicBookingService.getAvailableDepartments();
    sendSuccess(res, departments);
  })
);

// Get available doctors by department
router.get(
  '/doctors/:departmentId',
  asyncHandler(async (req: Request, res: Response) => {
    const doctors = await publicBookingService.getDoctorsByDepartment(req.params.departmentId);
    sendSuccess(res, doctors);
  })
);

// Get available time slots for a doctor on a specific date
router.get(
  '/slots/:doctorId/:date',
  asyncHandler(async (req: Request, res: Response) => {
    const { doctorId, date } = req.params;
    const slots = await publicBookingService.getAvailableSlots(doctorId, new Date(date));
    sendSuccess(res, slots);
  })
);

// Verify booking by confirmation code
router.get(
  '/booking/:confirmationCode',
  asyncHandler(async (req: Request, res: Response) => {
    const booking = await publicBookingService.getBookingByCode(req.params.confirmationCode);
    sendSuccess(res, booking);
  })
);

// AI-powered booking assistant chat
router.post(
  '/ai/chat',
  asyncHandler(async (req: Request, res: Response) => {
    const { message, context } = req.body;
    const response = await aiBookingService.generateBookingResponse(message, context || {});
    sendSuccess(res, response);
  })
);

// Parse natural language booking intent
router.post(
  '/ai/parse-intent',
  asyncHandler(async (req: Request, res: Response) => {
    const { text } = req.body;
    const intent = await aiBookingService.parseBookingIntent(text);
    sendSuccess(res, intent);
  })
);

// Analyze symptoms and suggest department
router.post(
  '/ai/analyze-symptoms',
  asyncHandler(async (req: Request, res: Response) => {
    const { symptoms } = req.body;
    const analysis = await aiBookingService.analyzeSymptoms(symptoms);
    sendSuccess(res, analysis);
  })
);

// Get departments with AI keywords
router.get(
  '/ai/departments',
  asyncHandler(async (req: Request, res: Response) => {
    const departments = await aiBookingService.getDepartmentsWithDescriptions();
    sendSuccess(res, departments);
  })
);

export default router;
