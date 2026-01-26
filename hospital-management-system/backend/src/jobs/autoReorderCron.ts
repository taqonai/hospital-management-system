import * as cron from 'node-cron';
import prisma from '../config/database';
import { createPR } from '../services/procurementPRService';

let cronJob: cron.ScheduledTask | null = null;
let lastRunTime: Date | null = null;
let lastRunStatus: 'success' | 'error' | 'idle' = 'idle';
let lastRunMessage: string = '';

/**
 * Check inventory levels and auto-create Purchase Requisitions
 * when stock falls below reorder levels
 */
export const checkAndReorderInventory = async () => {
  console.log('[AUTO_REORDER] Starting inventory reorder check...');
  lastRunTime = new Date();

  try {
    // Get all hospitals
    const hospitals = await prisma.hospital.findMany({
      select: { id: true, name: true, code: true },
    });

    for (const hospital of hospitals) {
      const hospitalId = hospital.id;

      // 1. Check InventoryItem (general inventory) - quantity <= minQuantity
      const lowInventoryItems = await prisma.inventoryItem.findMany({
        where: {
          hospitalId,
          isActive: true,
          quantity: { lte: prisma.inventoryItem.fields.minQuantity },
        },
      });

      // 2. Check HousekeepingInventory - currentStock <= reorderLevel
      const lowHousekeepingItems = await prisma.housekeepingInventory.findMany({
        where: {
          hospitalId,
          isActive: true,
          currentStock: { lte: prisma.housekeepingInventory.fields.reorderLevel },
        },
      });

      // 3. Check DrugInventory - aggregate by drugId and check total quantity
      const lowDrugInventory = await prisma.drugInventory.groupBy({
        by: ['drugId'],
        _sum: { quantity: true },
        having: { quantity: { _sum: { lte: 50 } } }, // Default threshold of 50
      });

      const drugIds = lowDrugInventory.map(item => item.drugId);
      const drugs = await prisma.drug.findMany({
        where: { id: { in: drugIds } },
      });

      // Create PR items list
      const prItems: Array<{
        itemType: 'DRUG' | 'INVENTORY' | 'HOUSEKEEPING_ITEM';
        itemReferenceId: string;
        itemName: string;
        itemCode?: string;
        specification?: string;
        unit: string;
        quantity: number;
        estimatedUnitCost: number;
        preferredSupplier?: string;
        notes?: string;
      }> = [];

      // Add low inventory items
      for (const item of lowInventoryItems) {
        const reorderQty = (item.maxQuantity || item.minQuantity * 3) - item.quantity;
        if (reorderQty > 0) {
          prItems.push({
            itemType: 'INVENTORY',
            itemReferenceId: item.id,
            itemName: item.name,
            itemCode: item.code,
            specification: item.description || undefined,
            unit: item.unit,
            quantity: reorderQty,
            estimatedUnitCost: Number(item.costPrice),
            preferredSupplier: undefined, // supplierId not available on InventoryItem type
            notes: 'Auto-generated from low stock alert',
          });
        }
      }

      // Add low housekeeping items
      for (const item of lowHousekeepingItems) {
        const reorderQty = (item.maxStock || item.reorderLevel * 2) - item.currentStock;
        if (reorderQty > 0) {
          prItems.push({
            itemType: 'HOUSEKEEPING_ITEM',
            itemReferenceId: item.id,
            itemName: item.name,
            itemCode: item.code,
            unit: item.unit,
            quantity: reorderQty,
            estimatedUnitCost: Number(item.costPerUnit),
            preferredSupplier: item.supplierId || undefined,
            notes: 'Auto-generated from low stock alert',
          });
        }
      }

      // Add low drug items
      for (const drug of drugs) {
        const currentStock = lowDrugInventory.find(d => d.drugId === drug.id)?._sum.quantity || 0;
        const reorderQty = 100 - currentStock; // Default reorder to 100 units
        if (reorderQty > 0) {
          prItems.push({
            itemType: 'DRUG',
            itemReferenceId: drug.id,
            itemName: drug.name,
            itemCode: drug.code,
            specification: `${drug.genericName || ''} - ${drug.strength || ''}`.trim(),
            unit: drug.dosageForm || 'Unit',
            quantity: reorderQty,
            estimatedUnitCost: Number(drug.price || 0), // Drug model uses 'price' not 'unitPrice'
            notes: 'Auto-generated from low drug stock alert',
          });
        }
      }

      // If there are items to reorder, create a PR
      if (prItems.length > 0) {
        // Find a default department (Procurement or Admin)
        const department = await prisma.department.findFirst({
          where: {
            hospitalId,
            OR: [
              { name: { contains: 'Procurement', mode: 'insensitive' } },
              { name: { contains: 'Admin', mode: 'insensitive' } },
            ],
          },
        });

        // Find a system user to request on behalf of (e.g., HOSPITAL_ADMIN or first admin)
        const systemUser = await prisma.user.findFirst({
          where: {
            hospitalId,
            role: { in: ['HOSPITAL_ADMIN', 'SUPER_ADMIN'] },
          },
        });

        if (department && systemUser) {
          const pr = await createPR(hospitalId, systemUser.id, {
            departmentId: department.id,
            urgency: 'ROUTINE',
            justification: 'Auto-generated purchase requisition due to low inventory levels',
            notes: `Auto-created by system on ${new Date().toISOString()}. Total items: ${prItems.length}`,
            isAutoGenerated: true,
            items: prItems,
          });

          console.log(`[AUTO_REORDER] Created PR ${pr.prNumber} for ${hospital.name} with ${prItems.length} items`);
        } else {
          console.log(`[AUTO_REORDER] Skipping ${hospital.name}: No department or system user found`);
        }
      } else {
        console.log(`[AUTO_REORDER] No low-stock items found for ${hospital.name}`);
      }
    }

    lastRunStatus = 'success';
    lastRunMessage = `Inventory reorder check completed successfully at ${new Date().toISOString()}`;
    console.log('[AUTO_REORDER] Completed successfully');
  } catch (error: any) {
    lastRunStatus = 'error';
    lastRunMessage = `Error: ${error.message}`;
    console.error('[AUTO_REORDER] Error during reorder check:', error);
  }
};

/**
 * Initialize the auto-reorder cron job
 * Runs every day at 6:00 AM
 */
export const initAutoReorderCron = () => {
  // Run every day at 6:00 AM
  // Format: minute hour day month day-of-week
  cronJob = cron.schedule('0 6 * * *', async () => {
    await checkAndReorderInventory();
  });

  console.log('[AUTO_REORDER] Cron job initialized - runs daily at 6:00 AM');
};

/**
 * Manually trigger the reorder check (for testing/admin endpoints)
 */
export const triggerAutoReorderCheck = async () => {
  await checkAndReorderInventory();
};

/**
 * Get health status of the cron job
 */
export const getAutoReorderCronHealth = () => {
  return {
    isRunning: cronJob !== null,
    lastRunTime,
    lastRunStatus,
    lastRunMessage,
  };
};

/**
 * Stop the cron job
 */
export const stopAutoReorderCron = () => {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('[AUTO_REORDER] Cron job stopped');
  }
};
