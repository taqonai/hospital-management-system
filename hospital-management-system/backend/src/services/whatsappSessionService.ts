import { PrismaClient } from '@prisma/client';
import { WhatsAppSessionData, ConversationStep } from '../types/whatsapp';

const prisma = new PrismaClient();

export class WhatsAppSessionService {
  /**
   * Get or create a WhatsApp session for a phone number
   */
  async getOrCreateSession(phoneNumber: string): Promise<WhatsAppSessionData> {
    // Clean phone number (remove 'whatsapp:' prefix if present)
    const cleanPhone = phoneNumber.replace('whatsapp:', '');

    // Check for existing non-expired session
    const existingSession = await prisma.whatsAppSession.findFirst({
      where: {
        phoneNumber: cleanPhone,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        lastMessageAt: 'desc'
      }
    });

    if (existingSession) {
      // Return existing session data
      return existingSession.conversationState as unknown as WhatsAppSessionData;
    }

    // Create new session
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour expiry

    const initialSessionData: WhatsAppSessionData = {
      phoneNumber: cleanPhone,
      currentStep: ConversationStep.GREETING,
      collectedData: {},
      lastMessageTimestamp: Date.now()
    };

    await prisma.whatsAppSession.create({
      data: {
        phoneNumber: cleanPhone,
        conversationState: initialSessionData as any,
        lastMessageAt: new Date(),
        expiresAt
      }
    });

    return initialSessionData;
  }

  /**
   * Update session state and collected data
   */
  async updateSessionState(
    phoneNumber: string,
    currentStep: ConversationStep,
    collectedData: Partial<WhatsAppSessionData['collectedData']>,
    additionalData?: Partial<WhatsAppSessionData>
  ): Promise<void> {
    const cleanPhone = phoneNumber.replace('whatsapp:', '');

    // Get current session
    const session = await prisma.whatsAppSession.findFirst({
      where: {
        phoneNumber: cleanPhone,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        lastMessageAt: 'desc'
      }
    });

    if (!session) {
      throw new Error('Session not found or expired');
    }

    const currentState = session.conversationState as unknown as WhatsAppSessionData;

    // Merge collected data
    const updatedSessionData: WhatsAppSessionData = {
      ...currentState,
      ...additionalData,
      currentStep,
      collectedData: {
        ...currentState.collectedData,
        ...collectedData
      },
      lastMessageTimestamp: Date.now()
    };

    // Update in database
    await prisma.whatsAppSession.update({
      where: {
        id: session.id
      },
      data: {
        conversationState: updatedSessionData as any,
        lastMessageAt: new Date(),
        hospitalId: updatedSessionData.hospitalId || session.hospitalId,
        patientId: updatedSessionData.patientId || session.patientId
      }
    });
  }

  /**
   * Get current session context
   */
  async getSessionContext(phoneNumber: string): Promise<WhatsAppSessionData | null> {
    const cleanPhone = phoneNumber.replace('whatsapp:', '');

    const session = await prisma.whatsAppSession.findFirst({
      where: {
        phoneNumber: cleanPhone,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        lastMessageAt: 'desc'
      }
    });

    if (!session) {
      return null;
    }

    return session.conversationState as unknown as WhatsAppSessionData;
  }

  /**
   * Clear/end session
   */
  async clearSession(phoneNumber: string): Promise<void> {
    const cleanPhone = phoneNumber.replace('whatsapp:', '');

    await prisma.whatsAppSession.deleteMany({
      where: {
        phoneNumber: cleanPhone
      }
    });
  }

  /**
   * Clean expired sessions (should be run as a cron job)
   */
  async cleanExpiredSessions(): Promise<number> {
    const result = await prisma.whatsAppSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    return result.count;
  }

  /**
   * Link session to patient after registration/login
   */
  async linkPatient(phoneNumber: string, patientId: string): Promise<void> {
    const cleanPhone = phoneNumber.replace('whatsapp:', '');

    const session = await prisma.whatsAppSession.findFirst({
      where: {
        phoneNumber: cleanPhone,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        lastMessageAt: 'desc'
      }
    });

    if (session) {
      await prisma.whatsAppSession.update({
        where: {
          id: session.id
        },
        data: {
          patientId
        }
      });
    }
  }
}

export default new WhatsAppSessionService();
