import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';
import { patientLookupService } from './patientLookupService';

interface PublicBookingDto {
  fullName: string;
  email: string;
  phone: string;
  department: string;
  preferredDate: string;
  preferredTime: string;
  reason?: string;
}

// Map frontend department IDs to actual department names
const departmentMapping: Record<string, string> = {
  general: 'General Medicine',
  cardiology: 'Cardiology',
  orthopedics: 'Orthopedics',
  pediatrics: 'Pediatrics',
  neurology: 'Neurology',
  dermatology: 'Dermatology',
  ophthalmology: 'Ophthalmology',
  ent: 'ENT',
  emergency: 'Emergency',
  surgery: 'Surgery',
  radiology: 'Radiology',
  laboratory: 'Laboratory',
};

// Convert time like "09:00 AM" to "09:00"
function convertTo24Hour(time12h: string): string {
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');

  if (hours === '12') {
    hours = modifier === 'AM' ? '00' : '12';
  } else if (modifier === 'PM') {
    hours = String(parseInt(hours, 10) + 12);
  }

  return `${hours.padStart(2, '0')}:${minutes}`;
}

// Generate confirmation code
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'APT-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}


export class PublicBookingService {
  async createPublicBooking(data: PublicBookingDto) {
    // Get the default hospital (first one in the system)
    const hospital = await prisma.hospital.findFirst({
      where: { isActive: true },
    });

    if (!hospital) {
      throw new AppError('No hospital available for booking');
    }

    // Parse full name into first and last name
    const nameParts = data.fullName.trim().split(' ');
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Find or create patient using the patient lookup service
    const { patient, isExisting, matchedBy } = await patientLookupService.findOrCreatePatient(
      hospital.id,
      {
        email: data.email,
        phone: data.phone,
        firstName,
        lastName,
      },
      'BOOKING'
    );

    // Get department name from mapping
    const departmentName = departmentMapping[data.department] || data.department;

    // Find department
    let department = await prisma.department.findFirst({
      where: {
        hospitalId: hospital.id,
        name: { contains: departmentName, mode: 'insensitive' },
      },
    });

    // If department not found, use General Medicine or first available
    if (!department) {
      department = await prisma.department.findFirst({
        where: { hospitalId: hospital.id },
      });
    }

    if (!department) {
      throw new NotFoundError('No department available');
    }

    // Find an available doctor in the department
    const doctor = await prisma.doctor.findFirst({
      where: {
        departmentId: department.id,
        isAvailable: true,
        user: {
          hospitalId: hospital.id,
          isActive: true,
        },
      },
      include: {
        user: true,
      },
    });

    if (!doctor) {
      throw new NotFoundError(`No doctor available in ${departmentName}`);
    }

    // Parse date and time - normalize to start of day for consistent comparison
    const appointmentDate = new Date(data.preferredDate);
    appointmentDate.setUTCHours(0, 0, 0, 0);
    const startTime = convertTo24Hour(data.preferredTime);

    // Create date range for queries (handles appointments with time in date field)
    const startOfDay = new Date(appointmentDate);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    // Calculate end time using doctor's configured slot duration
    const slotDuration = doctor.slotDuration || 30;
    const [hours, mins] = startTime.split(':').map(Number);
    const endMinutes = hours * 60 + mins + slotDuration;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

    // Check for conflicting appointments
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        doctorId: doctor.id,
        appointmentDate: {
          gte: startOfDay,
          lt: endOfDay,
        },
        startTime: startTime,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
    });

    if (existingAppointment) {
      throw new AppError('This time slot is no longer available. Please choose a different time.');
    }

    // Get token number for the day - use date range for consistent matching
    const todayAppointments = await prisma.appointment.count({
      where: {
        doctorId: doctor.id,
        appointmentDate: {
          gte: startOfDay,
          lt: endOfDay,
        },
        status: { notIn: ['CANCELLED'] },
      },
    });

    // Create the appointment
    const confirmationCode = generateConfirmationCode();

    // Build appointment notes with patient linkage information
    let appointmentNotes = `Confirmation Code: ${confirmationCode}\nBooked online by patient.`;
    if (isExisting) {
      appointmentNotes += `\n[Linked to existing patient record - matched by ${matchedBy}]`;
    } else {
      appointmentNotes += `\n[New patient record created]`;
    }

    const appointment = await prisma.appointment.create({
      data: {
        hospitalId: hospital.id,
        patientId: patient.id,
        doctorId: doctor.id,
        appointmentDate: appointmentDate,
        startTime: startTime,
        endTime: endTime,
        type: 'CONSULTATION',
        reason: data.reason || 'Online booking',
        notes: appointmentNotes,
        tokenNumber: todayAppointments + 1,
        status: 'SCHEDULED',
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            mrn: true,
          },
        },
        doctor: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
            department: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return {
      id: appointment.id,
      confirmationCode,
      tokenNumber: appointment.tokenNumber,
      appointmentDate: appointment.appointmentDate,
      time: data.preferredTime,
      patient: {
        name: `${patient.firstName} ${patient.lastName}`,
        email: patient.email,
        phone: patient.phone,
        mrn: patient.mrn,
        isExisting,
        matchedBy: isExisting ? matchedBy : undefined,
      },
      doctor: {
        name: `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`,
        department: appointment.doctor.department?.name,
      },
      status: appointment.status,
    };
  }

  async getAvailableDepartments() {
    const hospital = await prisma.hospital.findFirst({
      where: { isActive: true },
    });

    if (!hospital) {
      return [];
    }

    const departments = await prisma.department.findMany({
      where: {
        hospitalId: hospital.id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });

    return departments;
  }

  async getDoctorsByDepartment(departmentId: string) {
    const doctors = await prisma.doctor.findMany({
      where: {
        departmentId,
        isAvailable: true,
        user: { isActive: true },
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return doctors.map(d => ({
      id: d.id,
      name: `Dr. ${d.user.firstName} ${d.user.lastName}`,
      specialization: d.specialization,
      qualification: d.qualification,
    }));
  }

  async getAvailableSlots(doctorId: string, date: Date) {
    const doctor = await prisma.doctor.findFirst({
      where: { id: doctorId, isAvailable: true },
      include: { schedules: true },
    });

    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    const dayOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][date.getDay()];
    const schedule = doctor.schedules.find(s => s.dayOfWeek === dayOfWeek && s.isActive);

    // Default slots if no schedule found
    const defaultSlots = [
      '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
      '11:00 AM', '11:30 AM', '02:00 PM', '02:30 PM',
      '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
    ];

    // Get booked appointments for the date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookedAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
      select: { startTime: true },
    });

    const bookedTimes = new Set(bookedAppointments.map(a => a.startTime));

    // Return available slots
    return defaultSlots.map(slot => {
      const time24 = convertTo24Hour(slot);
      return {
        time: slot,
        time24,
        isAvailable: !bookedTimes.has(time24),
      };
    });
  }

  async getBookingByCode(confirmationCode: string) {
    const appointment = await prisma.appointment.findFirst({
      where: {
        notes: { contains: confirmationCode },
      },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        doctor: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
            department: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundError('Booking not found');
    }

    return {
      id: appointment.id,
      confirmationCode,
      appointmentDate: appointment.appointmentDate,
      time: appointment.startTime,
      status: appointment.status,
      tokenNumber: appointment.tokenNumber,
      patient: {
        name: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
        email: appointment.patient.email,
        phone: appointment.patient.phone,
      },
      doctor: {
        name: `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`,
        department: appointment.doctor.department?.name,
      },
    };
  }
}

export const publicBookingService = new PublicBookingService();
