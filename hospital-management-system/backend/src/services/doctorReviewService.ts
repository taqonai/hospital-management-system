import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';

export class DoctorReviewService {
  /**
   * Submit a doctor review for a completed appointment.
   * One review per appointment (appointmentId is unique on DoctorReview).
   */
  async submitReview(params: {
    hospitalId: string;
    patientId: string;
    appointmentId: string;
    rating: number;
    comment?: string;
  }) {
    const { hospitalId, patientId, appointmentId, rating, comment } = params;

    // Validate rating range
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      throw new Error('Rating must be an integer between 1 and 5');
    }

    // Verify the appointment belongs to the patient and is completed
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, patientId, hospitalId },
      select: { id: true, status: true, doctorId: true },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.status !== 'COMPLETED') {
      throw new Error('You can only review completed appointments');
    }

    // Check if already reviewed
    const existing = await prisma.doctorReview.findUnique({
      where: { appointmentId },
    });
    if (existing) {
      throw new Error('You have already reviewed this appointment');
    }

    // Create review and update doctor aggregate in a transaction
    const review = await prisma.$transaction(async (tx) => {
      const newReview = await tx.doctorReview.create({
        data: {
          hospitalId,
          patientId,
          doctorId: appointment.doctorId,
          appointmentId,
          rating,
          comment: comment || null,
        },
        include: {
          patient: { select: { firstName: true, lastName: true } },
        },
      });

      // Recalculate doctor average rating
      const aggregate = await tx.doctorReview.aggregate({
        where: { doctorId: appointment.doctorId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.doctor.update({
        where: { id: appointment.doctorId },
        data: {
          rating: new Decimal(Number(aggregate._avg.rating || 0).toFixed(1)),
          totalReviews: aggregate._count.rating,
        },
      });

      return newReview;
    });

    return review;
  }

  /**
   * Get all reviews for a specific doctor (paginated).
   */
  async getReviewsForDoctor(
    doctorId: string,
    hospitalId: string,
    params: { page?: number; limit?: number } = {}
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.doctorReview.findMany({
        where: { doctorId, hospitalId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          appointment: { select: { appointmentDate: true, type: true } },
        },
      }),
      prisma.doctorReview.count({ where: { doctorId, hospitalId } }),
    ]);

    return { reviews, total };
  }

  /**
   * Check which appointments have already been reviewed by a patient.
   * Returns a set of appointment IDs that have reviews.
   */
  async getReviewedAppointmentIds(patientId: string, hospitalId: string): Promise<string[]> {
    const reviews = await prisma.doctorReview.findMany({
      where: { patientId, hospitalId },
      select: { appointmentId: true },
    });
    return reviews.map((r) => r.appointmentId);
  }
}

export const doctorReviewService = new DoctorReviewService();
