import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { Prisma } from '@prisma/client';

// ==================== EMPLOYEE MANAGEMENT ====================

export class HRService {
  // Get all employees with filters
  async getEmployees(params: {
    hospitalId: string;
    search?: string;
    department?: string;
    employeeType?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { hospitalId, search, department, employeeType, status, page = 1, limit = 20 } = params;

    const where: Prisma.EmployeeWhereInput = {
      hospitalId,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { employeeCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(department && { departmentId: department }),
      ...(employeeType && { employeeType: employeeType as any }),
      ...(status && { employmentStatus: status as any }),
    };

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          shift: true,
          documents: { select: { id: true, documentType: true, isVerified: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.employee.count({ where }),
    ]);

    return {
      employees,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get employee by ID
  async getEmployeeById(id: string) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        shift: true,
        documents: true,
        leaveBalances: { include: { leaveType: true } },
        attendance: { take: 30, orderBy: { date: 'desc' } },
        performanceReviews: { take: 5, orderBy: { reviewDate: 'desc' } },
        trainings: { take: 10, orderBy: { startDate: 'desc' } },
      },
    });

    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    return employee;
  }

  // Create new employee
  async createEmployee(data: any) {
    // Generate employee code
    const hospital = await prisma.hospital.findUnique({ where: { id: data.hospitalId } });
    if (!hospital) throw new NotFoundError('Hospital not found');

    const count = await prisma.employee.count({ where: { hospitalId: data.hospitalId } });
    const employeeCode = `${hospital.code}-EMP${String(count + 1).padStart(5, '0')}`;

    const employee = await prisma.employee.create({
      data: {
        ...data,
        employeeCode,
      },
      include: { shift: true },
    });

    // Create initial leave balances for the current year
    await this.initializeLeaveBalances(employee.id, data.hospitalId);

    return employee;
  }

  // Update employee
  async updateEmployee(id: string, data: any) {
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundError('Employee not found');

    return prisma.employee.update({
      where: { id },
      data,
      include: { shift: true },
    });
  }

  // Initialize leave balances for new employee
  async initializeLeaveBalances(employeeId: string, hospitalId: string) {
    const leaveTypes = await prisma.leaveType.findMany({
      where: { hospitalId, isActive: true },
    });

    const currentYear = new Date().getFullYear();

    for (const leaveType of leaveTypes) {
      await prisma.leaveBalance.create({
        data: {
          employeeId,
          leaveTypeId: leaveType.id,
          year: currentYear,
          entitled: leaveType.defaultDays,
          balance: leaveType.defaultDays,
        },
      });
    }
  }

  // ==================== ATTENDANCE ====================

  // Record check-in
  async checkIn(employeeId: string, data: { location?: string; ipAddress?: string }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already checked in
    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (existing?.checkIn) {
      throw new AppError('Already checked in today');
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { shift: true },
    });

    if (!employee) throw new NotFoundError('Employee not found');

    const now = new Date();
    let lateMinutes = 0;

    // Calculate late minutes based on shift
    if (employee.shift) {
      const [shiftHour, shiftMin] = employee.shift.startTime.split(':').map(Number);
      const shiftStart = new Date(today);
      shiftStart.setHours(shiftHour, shiftMin, 0, 0);

      if (now > shiftStart) {
        lateMinutes = Math.round((now.getTime() - shiftStart.getTime()) / 60000);
      }
    }

    if (existing) {
      return prisma.attendance.update({
        where: { id: existing.id },
        data: {
          checkIn: now,
          checkInLocation: data.location,
          ipAddress: data.ipAddress,
          status: lateMinutes > 15 ? 'LATE' : 'PRESENT',
          lateMinutes,
        },
      });
    }

    return prisma.attendance.create({
      data: {
        employeeId,
        date: today,
        checkIn: now,
        checkInLocation: data.location,
        ipAddress: data.ipAddress,
        status: lateMinutes > 15 ? 'LATE' : 'PRESENT',
        lateMinutes,
      },
    });
  }

  // Record check-out
  async checkOut(employeeId: string, data: { location?: string }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (!attendance) {
      throw new AppError('Please check in first');
    }

    if (attendance.checkOut) {
      throw new AppError('Already checked out today');
    }

    const now = new Date();
    const workingHours = attendance.checkIn
      ? (now.getTime() - attendance.checkIn.getTime()) / (1000 * 60 * 60)
      : 0;

    // Calculate overtime (assuming 8 hours standard)
    const overtime = Math.max(0, workingHours - 8);

    return prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: now,
        checkOutLocation: data.location,
        workingHours: Math.round(workingHours * 100) / 100,
        overtime: Math.round(overtime * 100) / 100,
      },
    });
  }

  // Get attendance records
  async getAttendance(params: {
    hospitalId: string;
    employeeId?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { hospitalId, employeeId, startDate, endDate, status, page = 1, limit = 50 } = params;

    const where: Prisma.AttendanceWhereInput = {
      employee: { hospitalId },
      ...(employeeId && { employeeId }),
      ...(status && { status: status as any }),
      ...(startDate && endDate && {
        date: { gte: startDate, lte: endDate },
      }),
    };

    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: true },
          },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.attendance.count({ where }),
    ]);

    return {
      records,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Get attendance summary for a month
  async getAttendanceSummary(employeeId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const attendance = await prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
      },
    });

    const summary = {
      totalDays: endDate.getDate(),
      present: attendance.filter(a => a.status === 'PRESENT').length,
      absent: attendance.filter(a => a.status === 'ABSENT').length,
      late: attendance.filter(a => a.status === 'LATE').length,
      halfDay: attendance.filter(a => a.status === 'HALF_DAY').length,
      onLeave: attendance.filter(a => a.status === 'ON_LEAVE').length,
      weekOff: attendance.filter(a => a.status === 'WEEK_OFF').length,
      holiday: attendance.filter(a => a.status === 'HOLIDAY').length,
      totalWorkingHours: attendance.reduce((sum, a) => sum + (Number(a.workingHours) || 0), 0),
      totalOvertime: attendance.reduce((sum, a) => sum + (Number(a.overtime) || 0), 0),
    };

    return { summary, records: attendance };
  }

  // ==================== LEAVE MANAGEMENT ====================

  // Get leave types
  async getLeaveTypes(hospitalId: string) {
    return prisma.leaveType.findMany({
      where: { hospitalId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // Create leave type
  async createLeaveType(data: any) {
    return prisma.leaveType.create({ data });
  }

  // Apply for leave
  async applyLeave(data: {
    employeeId: string;
    leaveTypeId: string;
    startDate: Date;
    endDate: Date;
    reason: string;
    isEmergency?: boolean;
    attachmentUrl?: string;
    contactNumber?: string;
    handoverTo?: string;
    handoverNotes?: string;
  }) {
    // Calculate days
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Check leave balance
    const currentYear = new Date().getFullYear();
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: data.employeeId,
          leaveTypeId: data.leaveTypeId,
          year: currentYear,
        },
      },
    });

    if (!balance || Number(balance.balance) < days) {
      throw new AppError('Insufficient leave balance');
    }

    // Create leave request
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
        startDate: start,
        endDate: end,
        days,
        reason: data.reason,
        isEmergency: data.isEmergency || false,
        attachmentUrl: data.attachmentUrl,
        contactNumber: data.contactNumber,
        handoverTo: data.handoverTo,
        handoverNotes: data.handoverNotes,
      },
      include: { leaveType: true, employee: true },
    });

    // Update pending balance
    await prisma.leaveBalance.update({
      where: { id: balance.id },
      data: { pending: { increment: days } },
    });

    return leaveRequest;
  }

  // Approve/Reject leave
  async processLeaveRequest(
    requestId: string,
    action: 'APPROVE' | 'REJECT',
    processedBy: string,
    rejectionReason?: string
  ) {
    const request = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundError('Leave request not found');
    if (request.status !== 'PENDING') {
      throw new AppError('Leave request already processed');
    }

    const currentYear = new Date().getFullYear();

    if (action === 'APPROVE') {
      // Update leave balance
      await prisma.leaveBalance.update({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year: currentYear,
          },
        },
        data: {
          taken: { increment: Number(request.days) },
          pending: { decrement: Number(request.days) },
          balance: { decrement: Number(request.days) },
        },
      });

      // Create attendance records for leave days
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateOnly = new Date(d);
        dateOnly.setHours(0, 0, 0, 0);

        await prisma.attendance.upsert({
          where: { employeeId_date: { employeeId: request.employeeId, date: dateOnly } },
          create: {
            employeeId: request.employeeId,
            date: dateOnly,
            status: 'ON_LEAVE',
            remarks: `Leave: ${request.reason}`,
          },
          update: {
            status: 'ON_LEAVE',
            remarks: `Leave: ${request.reason}`,
          },
        });
      }

      return prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedBy: processedBy,
          approvedAt: new Date(),
        },
        include: { leaveType: true, employee: true },
      });
    } else {
      // Reject - restore pending balance
      await prisma.leaveBalance.update({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year: currentYear,
          },
        },
        data: {
          pending: { decrement: Number(request.days) },
        },
      });

      return prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          approvedBy: processedBy,
          approvedAt: new Date(),
          rejectionReason,
        },
        include: { leaveType: true, employee: true },
      });
    }
  }

  // Get leave requests
  async getLeaveRequests(params: {
    hospitalId: string;
    employeeId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { hospitalId, employeeId, status, page = 1, limit = 20 } = params;

    const where: Prisma.LeaveRequestWhereInput = {
      employee: { hospitalId },
      ...(employeeId && { employeeId }),
      ...(status && { status: status as any }),
    };

    const [requests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
          leaveType: true,
        },
        orderBy: { appliedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return {
      requests,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Get employee leave balances
  async getLeaveBalances(employeeId: string, year?: number) {
    const targetYear = year || new Date().getFullYear();

    return prisma.leaveBalance.findMany({
      where: { employeeId, year: targetYear },
      include: { leaveType: true },
    });
  }

  // ==================== PAYROLL ====================

  // Generate payroll for a month
  async generatePayroll(hospitalId: string, month: number, year: number) {
    const employees = await prisma.employee.findMany({
      where: { hospitalId, employmentStatus: 'ACTIVE' },
    });

    const payrolls = [];

    for (const employee of employees) {
      // Check if payroll already exists
      const existing = await prisma.payroll.findUnique({
        where: { employeeId_month_year: { employeeId: employee.id, month, year } },
      });

      if (existing) continue;

      // Get attendance summary
      const attendance = await this.getAttendanceSummary(employee.id, month, year);

      // Calculate payroll
      const totalWorkingDays = attendance.summary.totalDays - 4; // Assuming 4 week-offs
      const daysWorked = attendance.summary.present + attendance.summary.late;
      const lopDays = totalWorkingDays - daysWorked - attendance.summary.onLeave;

      const basicSalary = Number(employee.basicSalary);
      const perDaySalary = basicSalary / totalWorkingDays;
      const lopDeduction = lopDays > 0 ? perDaySalary * lopDays : 0;

      // Standard calculations (can be customized)
      const hra = basicSalary * 0.4;
      const conveyance = 1600;
      const medicalAllowance = 1250;
      const specialAllowance = basicSalary * 0.1;
      const overtime = attendance.summary.totalOvertime * (perDaySalary / 8) * 1.5;

      const grossEarnings = basicSalary + hra + conveyance + medicalAllowance + specialAllowance + overtime;

      // Deductions
      const pfEmployee = basicSalary * 0.12;
      const pfEmployer = basicSalary * 0.12;
      const esi = grossEarnings <= 21000 ? grossEarnings * 0.0075 : 0;
      const professionalTax = 200;
      const tds = grossEarnings > 50000 ? (grossEarnings - 50000) * 0.1 : 0;

      const totalDeductions = pfEmployee + esi + professionalTax + tds + lopDeduction;
      const netSalary = grossEarnings - totalDeductions;

      const payroll = await prisma.payroll.create({
        data: {
          employeeId: employee.id,
          month,
          year,
          basicSalary,
          hra,
          conveyance,
          medicalAllowance,
          specialAllowance,
          overtime,
          grossEarnings,
          pfEmployee,
          pfEmployer,
          esi,
          professionalTax,
          tds,
          totalDeductions,
          netSalary,
          totalWorkingDays,
          daysWorked,
          leavesTaken: attendance.summary.onLeave,
          lopDays: lopDays > 0 ? lopDays : 0,
        },
      });

      payrolls.push(payroll);
    }

    return payrolls;
  }

  // Get payroll records
  async getPayrolls(params: {
    hospitalId: string;
    month?: number;
    year?: number;
    employeeId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { hospitalId, month, year, employeeId, status, page = 1, limit = 20 } = params;

    const where: Prisma.PayrollWhereInput = {
      employee: { hospitalId },
      ...(month && { month }),
      ...(year && { year }),
      ...(employeeId && { employeeId }),
      ...(status && { status: status as any }),
    };

    const [payrolls, total] = await Promise.all([
      prisma.payroll.findMany({
        where,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: true } },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payroll.count({ where }),
    ]);

    return {
      payrolls,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Process payroll (approve/pay)
  async processPayroll(id: string, action: 'APPROVE' | 'PAY', processedBy: string, data?: any) {
    const payroll = await prisma.payroll.findUnique({ where: { id } });
    if (!payroll) throw new NotFoundError('Payroll not found');

    if (action === 'APPROVE') {
      return prisma.payroll.update({
        where: { id },
        data: {
          status: 'APPROVED',
          processedBy,
          processedAt: new Date(),
        },
      });
    } else {
      return prisma.payroll.update({
        where: { id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          paymentMode: data?.paymentMode,
          transactionId: data?.transactionId,
        },
      });
    }
  }

  // ==================== SHIFTS ====================

  // Get shifts
  async getShifts(hospitalId: string) {
    return prisma.shift.findMany({
      where: { hospitalId, isActive: true },
      include: { _count: { select: { employees: true } } },
    });
  }

  // Create shift
  async createShift(data: any) {
    return prisma.shift.create({ data });
  }

  // Update shift
  async updateShift(id: string, data: any) {
    return prisma.shift.update({ where: { id }, data });
  }

  // Assign shift to employee
  async assignShift(employeeId: string, shiftId: string) {
    return prisma.employee.update({
      where: { id: employeeId },
      data: { shiftId },
    });
  }

  // ==================== HR DASHBOARD ====================

  async getDashboardStats(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalEmployees,
      activeEmployees,
      todayPresent,
      todayAbsent,
      pendingLeaves,
      thisMonthJoining,
      thisMonthResignation,
    ] = await Promise.all([
      prisma.employee.count({ where: { hospitalId } }),
      prisma.employee.count({ where: { hospitalId, employmentStatus: 'ACTIVE' } }),
      prisma.attendance.count({
        where: {
          employee: { hospitalId },
          date: today,
          status: { in: ['PRESENT', 'LATE'] },
        },
      }),
      prisma.attendance.count({
        where: {
          employee: { hospitalId },
          date: today,
          status: 'ABSENT',
        },
      }),
      prisma.leaveRequest.count({
        where: {
          employee: { hospitalId },
          status: 'PENDING',
        },
      }),
      prisma.employee.count({
        where: {
          hospitalId,
          joiningDate: {
            gte: new Date(today.getFullYear(), today.getMonth(), 1),
          },
        },
      }),
      prisma.employee.count({
        where: {
          hospitalId,
          resignationDate: {
            gte: new Date(today.getFullYear(), today.getMonth(), 1),
          },
        },
      }),
    ]);

    // Department wise count
    const departmentWise = await prisma.employee.groupBy({
      by: ['departmentId'],
      where: { hospitalId, employmentStatus: 'ACTIVE' },
      _count: true,
    });

    // Employee type distribution
    const typeDistribution = await prisma.employee.groupBy({
      by: ['employeeType'],
      where: { hospitalId, employmentStatus: 'ACTIVE' },
      _count: true,
    });

    return {
      totalEmployees,
      activeEmployees,
      todayPresent,
      todayAbsent,
      pendingLeaves,
      thisMonthJoining,
      thisMonthResignation,
      attendanceRate: activeEmployees > 0 ? ((todayPresent / activeEmployees) * 100).toFixed(1) : 0,
      departmentWise,
      typeDistribution,
    };
  }
}

export const hrService = new HRService();
