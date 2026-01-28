import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import prisma from '../config/database';
import { config } from '../config';
import { JwtPayload } from '../types';
import { AppError, UnauthorizedError, ConflictError, NotFoundError } from '../middleware/errorHandler';
import { UserRole } from '@prisma/client';
import { sendPasswordResetEmail } from './emailService';

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  hospitalId: string;
  role: UserRole;
}

interface LoginData {
  email: string;
  password: string;
  hospitalId?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    hospitalId: string;
    avatar?: string | null;
  };
  tokens: TokenPair;
}

export class AuthService {
  private generateTokens(payload: JwtPayload): TokenPair {
    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });

    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn as any,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: {
        hospitalId_email: {
          hospitalId: data.hospitalId,
          email: data.email,
        },
      },
    });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Verify hospital exists
    const hospital = await prisma.hospital.findUnique({
      where: { id: data.hospitalId },
    });

    if (!hospital) {
      throw new NotFoundError('Hospital not found');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        hospitalId: data.hospitalId,
        role: data.role,
      },
    });

    // Generate tokens
    const tokenPayload: JwtPayload = {
      userId: user.id,
      hospitalId: user.hospitalId,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const tokens = this.generateTokens(tokenPayload);

    // Store session
    await prisma.session.create({
      data: {
        userId: user.id,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        hospitalId: user.hospitalId,
        avatar: user.avatar,
      },
      tokens,
    };
  }

  async login(data: LoginData): Promise<AuthResponse> {
    // Find user
    const whereClause = data.hospitalId
      ? { hospitalId_email: { hospitalId: data.hospitalId, email: data.email } }
      : { email: data.email };

    let user;
    if (data.hospitalId) {
      user = await prisma.user.findUnique({
        where: { hospitalId_email: { hospitalId: data.hospitalId, email: data.email } },
      });
    } else {
      user = await prisma.user.findFirst({
        where: { email: data.email },
      });
    }

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is disabled');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate tokens
    const tokenPayload: JwtPayload = {
      userId: user.id,
      hospitalId: user.hospitalId,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const tokens = this.generateTokens(tokenPayload);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Store session
    await prisma.session.create({
      data: {
        userId: user.id,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        hospitalId: user.hospitalId,
        avatar: user.avatar,
      },
      tokens,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtPayload;

      // Verify session exists
      const session = await prisma.session.findFirst({
        where: {
          refreshToken,
          userId: decoded.userId,
          expiresAt: { gt: new Date() },
        },
      });

      if (!session) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedError('User not found or inactive');
      }

      // Generate new tokens
      const tokenPayload: JwtPayload = {
        userId: user.id,
        hospitalId: user.hospitalId,
        email: user.email,
        role: user.role,
      };

      const tokens = this.generateTokens(tokenPayload);

      // Update session
      await prisma.session.update({
        where: { id: session.id },
        data: {
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return tokens;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Refresh token expired');
      }
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  async logout(userId: string, accessToken: string): Promise<void> {
    await prisma.session.deleteMany({
      where: {
        userId,
        token: accessToken,
      },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { userId },
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Invalidate all sessions
    await this.logoutAll(userId);
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            code: true,
            logo: true,
          },
        },
        doctor: {
          include: {
            department: true,
          },
        },
        nurse: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; phone?: string; avatar?: string }
  ) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        hospitalId: true,
      },
    });

    return user;
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    // Find user by email (across all hospitals)
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim() },
      include: { hospital: true },
    });

    // For security, always return success even if user not found
    if (!user) {
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Store token in database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Send reset email
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    await sendPasswordResetEmail(
      user.email,
      user.firstName,
      resetToken,
      baseUrl,
      30,
      user.hospital.name
    );

    return {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gte: new Date() }, // Token not expired
      },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return {
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.',
    };
  }
}

export const authService = new AuthService();
