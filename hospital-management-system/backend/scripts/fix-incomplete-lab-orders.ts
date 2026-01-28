/**
 * Script to fix lab orders where all tests are completed but order status is not COMPLETED
 *
 * This script:
 * 1. Finds all orders where status != COMPLETED
 * 2. Checks if all tests have results and status = COMPLETED
 * 3. Updates order status to COMPLETED with completedAt timestamp
 *
 * Run with: npx ts-node scripts/fix-incomplete-lab-orders.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixIncompleteLabOrders() {
  console.log('🔍 Scanning for incomplete lab orders...\n');

  try {
    // Get all non-completed, non-cancelled orders
    const orders = await prisma.labOrder.findMany({
      where: {
        status: {
          notIn: ['COMPLETED', 'CANCELLED']
        }
      },
      include: {
        tests: true,
        patient: {
          select: {
            firstName: true,
            lastName: true,
            mrn: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📋 Found ${orders.length} non-completed orders to check\n`);

    let fixedCount = 0;
    const ordersToFix: any[] = [];

    for (const order of orders) {
      // Skip if no tests
      if (order.tests.length === 0) {
        continue;
      }

      // Check if ALL tests are completed and have results
      const allTestsCompleted = order.tests.every(test =>
        test.status === 'COMPLETED' && (test.result || test.resultValue)
      );

      if (allTestsCompleted) {
        ordersToFix.push({
          id: order.id,
          orderNumber: order.orderNumber,
          currentStatus: order.status,
          patient: `${order.patient.firstName} ${order.patient.lastName}`,
          testCount: order.tests.length
        });
      }
    }

    if (ordersToFix.length === 0) {
      console.log('✅ No orders need fixing. All orders are in correct state.\n');
      return;
    }

    console.log(`⚠️  Found ${ordersToFix.length} orders that need to be marked as COMPLETED:\n`);

    ordersToFix.forEach((order, idx) => {
      console.log(`${idx + 1}. ${order.orderNumber} (${order.patient})`);
      console.log(`   Current Status: ${order.currentStatus}`);
      console.log(`   Tests Completed: ${order.testCount}/${order.testCount}`);
      console.log('');
    });

    console.log('🔧 Fixing orders...\n');

    // Update all orders to COMPLETED
    for (const orderInfo of ordersToFix) {
      await prisma.labOrder.update({
        where: { id: orderInfo.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

      console.log(`✅ Fixed: ${orderInfo.orderNumber} (${orderInfo.currentStatus} → COMPLETED)`);
      fixedCount++;
    }

    console.log(`\n✨ Successfully fixed ${fixedCount} lab orders!\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixIncompleteLabOrders()
  .then(() => {
    console.log('🎉 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
