import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_STORAGE_KEY = '@hms_offline_queue';

// Types of actions that can be queued
export type QueuedActionType =
  | 'CANCEL_APPOINTMENT'
  | 'RESCHEDULE_APPOINTMENT'
  | 'REQUEST_REFILL'
  | 'UPDATE_PROFILE'
  | 'UPDATE_MEDICAL_HISTORY'
  | 'ADD_ALLERGY'
  | 'UPDATE_ALLERGY'
  | 'DELETE_ALLERGY'
  | 'UPDATE_NOTIFICATION_PREFERENCES'
  | 'UPDATE_COMMUNICATION_PREFERENCES';

export interface QueuedAction {
  id: string;
  type: QueuedActionType;
  payload: Record<string, any>;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
}

export interface QueueProcessResult {
  success: boolean;
  action: QueuedAction;
  error?: string;
}

// Action handlers - these will be set by the API client
type ActionHandler = (payload: Record<string, any>) => Promise<void>;
const actionHandlers: Map<QueuedActionType, ActionHandler> = new Map();

class OfflineActionQueue {
  private isProcessing = false;
  private processingPromise: Promise<void> | null = null;

  /**
   * Register a handler for a specific action type
   */
  registerHandler(type: QueuedActionType, handler: ActionHandler): void {
    actionHandlers.set(type, handler);
  }

  /**
   * Add an action to the queue
   */
  async enqueue(
    type: QueuedActionType,
    payload: Record<string, any>,
    maxRetries: number = 3
  ): Promise<string> {
    const action: QueuedAction = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries,
    };

    const queue = await this.getQueue();
    queue.push(action);
    await this.saveQueue(queue);

    // Try to process immediately if online
    this.tryProcessQueue();

    return action.id;
  }

  /**
   * Get all queued actions
   */
  async getQueue(): Promise<QueuedAction[]> {
    try {
      const queueStr = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      return queueStr ? JSON.parse(queueStr) : [];
    } catch (error) {
      console.error('Failed to get offline queue:', error);
      return [];
    }
  }

  /**
   * Save queue to storage
   */
  private async saveQueue(queue: QueuedAction[]): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  /**
   * Remove an action from the queue
   */
  async remove(actionId: string): Promise<void> {
    const queue = await this.getQueue();
    const filteredQueue = queue.filter((a) => a.id !== actionId);
    await this.saveQueue(filteredQueue);
  }

  /**
   * Clear all queued actions
   */
  async clearQueue(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
  }

  /**
   * Get pending action count
   */
  async getPendingCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  }

  /**
   * Check if there are pending actions
   */
  async hasPendingActions(): Promise<boolean> {
    const count = await this.getPendingCount();
    return count > 0;
  }

  /**
   * Try to process the queue if online
   */
  async tryProcessQueue(): Promise<void> {
    // Check if already processing
    if (this.isProcessing) {
      return this.processingPromise || Promise.resolve();
    }

    // Check network status
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || netInfo.isInternetReachable === false) {
      return;
    }

    this.processingPromise = this.processQueue();
    return this.processingPromise;
  }

  /**
   * Process all queued actions
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const queue = await this.getQueue();

      if (queue.length === 0) {
        return;
      }

      const results: QueueProcessResult[] = [];

      for (const action of queue) {
        const result = await this.processAction(action);
        results.push(result);

        if (result.success) {
          await this.remove(action.id);
        } else {
          // Update retry count
          action.retryCount++;
          action.lastError = result.error;

          if (action.retryCount >= action.maxRetries) {
            // Max retries reached, remove from queue
            await this.remove(action.id);
            console.warn(
              `Action ${action.id} (${action.type}) failed after ${action.maxRetries} retries:`,
              result.error
            );
          } else {
            // Update action in queue
            const currentQueue = await this.getQueue();
            const index = currentQueue.findIndex((a) => a.id === action.id);
            if (index !== -1) {
              currentQueue[index] = action;
              await this.saveQueue(currentQueue);
            }
          }
        }
      }

      // Notify listeners of results
      this.notifyProcessComplete(results);
    } finally {
      this.isProcessing = false;
      this.processingPromise = null;
    }
  }

  /**
   * Process a single action
   */
  private async processAction(action: QueuedAction): Promise<QueueProcessResult> {
    const handler = actionHandlers.get(action.type);

    if (!handler) {
      return {
        success: false,
        action,
        error: `No handler registered for action type: ${action.type}`,
      };
    }

    try {
      await handler(action.payload);
      return { success: true, action };
    } catch (error) {
      return {
        success: false,
        action,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Listeners for queue processing completion
   */
  private processCompleteListeners: ((results: QueueProcessResult[]) => void)[] = [];

  onProcessComplete(listener: (results: QueueProcessResult[]) => void): () => void {
    this.processCompleteListeners.push(listener);
    return () => {
      this.processCompleteListeners = this.processCompleteListeners.filter(
        (l) => l !== listener
      );
    };
  }

  private notifyProcessComplete(results: QueueProcessResult[]): void {
    this.processCompleteListeners.forEach((listener) => {
      try {
        listener(results);
      } catch (error) {
        console.error('Error in process complete listener:', error);
      }
    });
  }

  /**
   * Get human-readable action description
   */
  getActionDescription(action: QueuedAction): string {
    switch (action.type) {
      case 'CANCEL_APPOINTMENT':
        return 'Cancel appointment';
      case 'RESCHEDULE_APPOINTMENT':
        return 'Reschedule appointment';
      case 'REQUEST_REFILL':
        return 'Request prescription refill';
      case 'UPDATE_PROFILE':
        return 'Update profile';
      case 'UPDATE_MEDICAL_HISTORY':
        return 'Update medical history';
      case 'ADD_ALLERGY':
        return 'Add allergy';
      case 'UPDATE_ALLERGY':
        return 'Update allergy';
      case 'DELETE_ALLERGY':
        return 'Delete allergy';
      case 'UPDATE_NOTIFICATION_PREFERENCES':
        return 'Update notification preferences';
      case 'UPDATE_COMMUNICATION_PREFERENCES':
        return 'Update communication preferences';
      default:
        return 'Unknown action';
    }
  }
}

export const offlineActionQueue = new OfflineActionQueue();
export default offlineActionQueue;
