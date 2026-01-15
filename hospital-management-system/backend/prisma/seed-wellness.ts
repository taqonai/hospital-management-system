import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedWellnessData() {
  console.log('🏃 Seeding wellness data...\n');

  // Find the patient portal user (try kamil@taqon.ai first, then patient@test.com)
  let patientUser = await prisma.user.findFirst({
    where: { email: 'kamil@taqon.ai' },
    include: { patient: true },
  });

  if (!patientUser) {
    patientUser = await prisma.user.findFirst({
      where: { email: 'patient@test.com' },
      include: { patient: true },
    });
  }

  if (!patientUser?.patient) {
    console.error('❌ No patient user found. Run the main seed first.');
    return;
  }

  const patientId = patientUser.patient.id;
  console.log(`Found patient: ${patientUser.firstName} ${patientUser.lastName} (${patientUser.email})\n`);

  // ============================================================
  // 1. HEALTH DEVICE CONNECTION
  // ============================================================
  console.log('📱 Creating Health Device Connection...');
  await prisma.healthDeviceConnection.upsert({
    where: { patientId_provider: { patientId, provider: 'MANUAL' } },
    update: { lastSyncAt: new Date() },
    create: {
      patientId,
      provider: 'MANUAL',
      isActive: true,
      lastSyncAt: new Date(),
      syncFrequency: 60,
    },
  });
  console.log('  ✓ Manual entry device connected');

  // ============================================================
  // 2. HEALTH METRICS (last 7 days)
  // ============================================================
  console.log('\n📊 Creating Health Metrics...');
  const today = new Date();

  // Clear existing metrics for clean demo
  await prisma.healthMetric.deleteMany({ where: { patientId } });

  const metricsData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(8, 0, 0, 0);

    // Steps (varying daily)
    metricsData.push({
      patientId,
      metricType: 'STEPS' as const,
      value: 6000 + Math.floor(Math.random() * 6000),
      unit: 'steps',
      source: 'MANUAL' as const,
      recordedAt: date,
    });

    // Heart rate (morning)
    metricsData.push({
      patientId,
      metricType: 'HEART_RATE' as const,
      value: 65 + Math.floor(Math.random() * 15),
      unit: 'bpm',
      source: 'MANUAL' as const,
      recordedAt: date,
    });

    // Sleep duration (hours)
    metricsData.push({
      patientId,
      metricType: 'SLEEP_DURATION' as const,
      value: 6 + Math.random() * 2,
      unit: 'hours',
      source: 'MANUAL' as const,
      recordedAt: date,
    });

    // Water intake
    metricsData.push({
      patientId,
      metricType: 'WATER_INTAKE' as const,
      value: 1.5 + Math.random() * 1.5,
      unit: 'liters',
      source: 'MANUAL' as const,
      recordedAt: date,
    });

    // Calories burned
    metricsData.push({
      patientId,
      metricType: 'CALORIES_BURNED' as const,
      value: 1800 + Math.floor(Math.random() * 600),
      unit: 'kcal',
      source: 'MANUAL' as const,
      recordedAt: date,
    });
  }

  // Today's weight and blood pressure
  metricsData.push({
    patientId,
    metricType: 'WEIGHT' as const,
    value: 72.5,
    unit: 'kg',
    source: 'MANUAL' as const,
    recordedAt: today,
  });

  metricsData.push({
    patientId,
    metricType: 'BLOOD_PRESSURE_SYSTOLIC' as const,
    value: 118,
    unit: 'mmHg',
    source: 'MANUAL' as const,
    recordedAt: today,
  });

  metricsData.push({
    patientId,
    metricType: 'BLOOD_PRESSURE_DIASTOLIC' as const,
    value: 76,
    unit: 'mmHg',
    source: 'MANUAL' as const,
    recordedAt: today,
  });

  await prisma.healthMetric.createMany({ data: metricsData });
  console.log(`  ✓ Created ${metricsData.length} health metrics`);

  // ============================================================
  // 3. FITNESS ACTIVITIES (last 7 days)
  // ============================================================
  console.log('\n🏋️ Creating Fitness Activities...');
  await prisma.fitnessActivity.deleteMany({ where: { patientId } });

  const activitiesData = [
    {
      patientId,
      activityType: 'RUNNING' as const,
      name: 'Morning Run',
      durationMinutes: 35,
      intensity: 'MODERATE' as const,
      caloriesBurned: 350,
      distanceKm: 4.5,
      steps: 5500,
      avgHeartRate: 145,
      source: 'MANUAL' as const,
      startTime: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
      moodBefore: 3,
      moodAfter: 5,
      notes: 'Great morning run in the park',
    },
    {
      patientId,
      activityType: 'YOGA' as const,
      name: 'Yoga Session',
      durationMinutes: 45,
      intensity: 'LIGHT' as const,
      caloriesBurned: 150,
      avgHeartRate: 95,
      source: 'MANUAL' as const,
      startTime: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
      moodBefore: 3,
      moodAfter: 4,
      notes: 'Relaxing yoga flow',
    },
    {
      patientId,
      activityType: 'CYCLING' as const,
      name: 'Evening Bike Ride',
      durationMinutes: 50,
      intensity: 'VIGOROUS' as const,
      caloriesBurned: 480,
      distanceKm: 15.2,
      avgHeartRate: 155,
      maxHeartRate: 172,
      source: 'MANUAL' as const,
      startTime: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
      moodBefore: 4,
      moodAfter: 5,
      notes: 'Challenging hill route',
    },
    {
      patientId,
      activityType: 'WEIGHT_TRAINING' as const,
      name: 'Gym Session',
      durationMinutes: 60,
      intensity: 'MODERATE' as const,
      caloriesBurned: 280,
      sets: 15,
      reps: 12,
      source: 'MANUAL' as const,
      startTime: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
      moodBefore: 3,
      moodAfter: 4,
      notes: 'Upper body focus day',
    },
    {
      patientId,
      activityType: 'SWIMMING' as const,
      name: 'Pool Laps',
      durationMinutes: 40,
      intensity: 'MODERATE' as const,
      caloriesBurned: 320,
      distanceKm: 1.2,
      avgHeartRate: 130,
      source: 'MANUAL' as const,
      startTime: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000),
      moodBefore: 4,
      moodAfter: 5,
      notes: 'Refreshing swim session',
    },
  ];

  for (const activity of activitiesData) {
    await prisma.fitnessActivity.create({ data: activity });
  }
  console.log(`  ✓ Created ${activitiesData.length} fitness activities`);

  // ============================================================
  // 4. FITNESS GOALS
  // ============================================================
  console.log('\n🎯 Creating Fitness Goals...');
  await prisma.fitnessGoal.deleteMany({ where: { patientId } });

  const fitnessGoalsData = [
    {
      patientId,
      goalType: 'STEPS_DAILY' as const,
      targetValue: 10000,
      currentValue: 7500,
      unit: 'steps',
      frequency: 'DAILY' as const,
      startDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
    {
      patientId,
      goalType: 'WORKOUT_SESSIONS' as const,
      targetValue: 4,
      currentValue: 3,
      unit: 'sessions',
      frequency: 'WEEKLY' as const,
      startDate: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
    {
      patientId,
      goalType: 'CALORIES_BURNED' as const,
      targetValue: 500,
      currentValue: 420,
      unit: 'kcal',
      frequency: 'DAILY' as const,
      startDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
  ];

  for (const goal of fitnessGoalsData) {
    await prisma.fitnessGoal.create({ data: goal });
  }
  console.log(`  ✓ Created ${fitnessGoalsData.length} fitness goals`);

  // ============================================================
  // 5. NUTRITION LOGS (last 3 days)
  // ============================================================
  console.log('\n🍎 Creating Nutrition Logs...');
  await prisma.nutritionLog.deleteMany({ where: { patientId } });

  const nutritionLogsData = [
    // Today
    {
      patientId,
      mealType: 'BREAKFAST' as const,
      mealName: 'Oatmeal with Berries',
      calories: 350,
      protein: 12,
      carbohydrates: 55,
      fat: 8,
      fiber: 6,
      loggedAt: new Date(today.setHours(8, 0, 0, 0)),
      healthScore: 85,
    },
    {
      patientId,
      mealType: 'LUNCH' as const,
      mealName: 'Grilled Chicken Salad',
      calories: 520,
      protein: 42,
      carbohydrates: 25,
      fat: 28,
      fiber: 8,
      loggedAt: new Date(today.setHours(12, 30, 0, 0)),
      healthScore: 90,
    },
    {
      patientId,
      mealType: 'DINNER' as const,
      mealName: 'Salmon with Vegetables',
      calories: 580,
      protein: 38,
      carbohydrates: 35,
      fat: 32,
      fiber: 10,
      loggedAt: new Date(today.setHours(19, 0, 0, 0)),
      healthScore: 92,
    },
    {
      patientId,
      mealType: 'SNACK' as const,
      mealName: 'Greek Yogurt',
      calories: 150,
      protein: 15,
      carbohydrates: 12,
      fat: 5,
      loggedAt: new Date(today.setHours(15, 30, 0, 0)),
      healthScore: 80,
    },
    // Yesterday
    {
      patientId,
      mealType: 'BREAKFAST' as const,
      mealName: 'Eggs and Toast',
      calories: 420,
      protein: 20,
      carbohydrates: 38,
      fat: 22,
      fiber: 3,
      loggedAt: new Date(new Date().setDate(today.getDate() - 1)),
      healthScore: 75,
    },
    {
      patientId,
      mealType: 'LUNCH' as const,
      mealName: 'Turkey Sandwich',
      calories: 480,
      protein: 28,
      carbohydrates: 45,
      fat: 18,
      fiber: 5,
      loggedAt: new Date(new Date().setDate(today.getDate() - 1)),
      healthScore: 78,
    },
    {
      patientId,
      mealType: 'DINNER' as const,
      mealName: 'Pasta with Meat Sauce',
      calories: 650,
      protein: 30,
      carbohydrates: 75,
      fat: 25,
      fiber: 6,
      loggedAt: new Date(new Date().setDate(today.getDate() - 1)),
      healthScore: 70,
    },
  ];

  for (const log of nutritionLogsData) {
    await prisma.nutritionLog.create({ data: log });
  }
  console.log(`  ✓ Created ${nutritionLogsData.length} nutrition logs`);

  // ============================================================
  // 6. NUTRITION PLAN
  // ============================================================
  console.log('\n📋 Creating Nutrition Plan...');
  await prisma.nutritionPlan.deleteMany({ where: { patientId } });

  await prisma.nutritionPlan.create({
    data: {
      patientId,
      name: 'Balanced Maintenance Plan',
      description: 'A balanced nutrition plan focused on maintaining current weight while optimizing energy levels.',
      goal: 'MAINTAIN_WEIGHT',
      targetCalories: 2000,
      targetProtein: 100,
      targetCarbs: 250,
      targetFat: 65,
      targetFiber: 30,
      targetWater: 2.5,
      dietaryRestrictions: [],
      allergies: [],
      preferences: ['high-protein', 'whole-foods'],
      isActive: true,
      startDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
    },
  });
  console.log('  ✓ Created nutrition plan');

  // ============================================================
  // 7. WELLNESS GOALS
  // ============================================================
  console.log('\n🌟 Creating Wellness Goals...');
  await prisma.wellnessGoal.deleteMany({ where: { patientId } });

  const wellnessGoalsData = [
    {
      patientId,
      category: 'PHYSICAL_FITNESS' as const,
      title: 'Exercise 4 times per week',
      description: 'Maintain consistent workout routine',
      targetValue: 4,
      currentValue: 3,
      unit: 'sessions/week',
      priority: 1,
      startDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE' as const,
    },
    {
      patientId,
      category: 'SLEEP' as const,
      title: 'Get 7+ hours of sleep',
      description: 'Improve sleep quality and duration',
      targetValue: 7,
      currentValue: 6.5,
      unit: 'hours/night',
      priority: 2,
      startDate: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE' as const,
    },
    {
      patientId,
      category: 'STRESS_MANAGEMENT' as const,
      title: 'Daily meditation',
      description: 'Practice mindfulness meditation daily',
      targetValue: 15,
      currentValue: 10,
      unit: 'minutes/day',
      priority: 3,
      startDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE' as const,
    },
    {
      patientId,
      category: 'HYDRATION' as const,
      title: 'Drink 2.5L water daily',
      description: 'Stay properly hydrated throughout the day',
      targetValue: 2.5,
      currentValue: 2.0,
      unit: 'liters/day',
      priority: 2,
      startDate: new Date(today.getTime() - 21 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE' as const,
    },
  ];

  for (const goal of wellnessGoalsData) {
    await prisma.wellnessGoal.create({ data: goal });
  }
  console.log(`  ✓ Created ${wellnessGoalsData.length} wellness goals`);

  // ============================================================
  // 8. WELLNESS ASSESSMENT
  // ============================================================
  console.log('\n📈 Creating Wellness Assessment...');
  await prisma.wellnessAssessment.deleteMany({ where: { patientId } });

  await prisma.wellnessAssessment.create({
    data: {
      patientId,
      assessmentType: 'COMPREHENSIVE',
      overallScore: 78,
      categoryScores: {
        physical: 82,
        mental: 75,
        nutrition: 80,
        sleep: 72,
        stress: 70,
        social: 85,
        purpose: 78,
        environment: 80,
      },
      strengths: [
        'Consistent exercise routine',
        'Good social connections',
        'Balanced nutrition habits',
      ],
      areasToImprove: [
        'Sleep quality needs improvement',
        'Stress management techniques',
        'Hydration consistency',
      ],
      recommendations: [
        {
          category: 'sleep',
          title: 'Establish a consistent bedtime routine',
          description: 'Try to go to bed and wake up at the same time every day, even on weekends.',
          priority: 'high',
        },
        {
          category: 'stress',
          title: 'Practice daily mindfulness',
          description: 'Start with 10 minutes of meditation each morning to reduce stress levels.',
          priority: 'medium',
        },
        {
          category: 'hydration',
          title: 'Set water intake reminders',
          description: 'Use phone reminders or a water bottle with time markers to track intake.',
          priority: 'medium',
        },
      ],
      actionPlan: {
        week1: ['Start sleep tracking', 'Download meditation app'],
        week2: ['Implement bedtime routine', 'Begin 10-min daily meditation'],
        week3: ['Evaluate sleep improvements', 'Increase meditation to 15 min'],
        week4: ['Review progress', 'Adjust goals as needed'],
      },
      assessedAt: new Date(),
      validUntil: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  console.log('  ✓ Created wellness assessment');

  console.log('\n✅ Wellness data seeded successfully!');
  console.log('-------------------------------------------');
  console.log(`Patient: ${patientUser.firstName} ${patientUser.lastName}`);
  console.log(`Email: ${patientUser.email}`);
  console.log('-------------------------------------------');
}

seedWellnessData()
  .catch((e) => {
    console.error('Error seeding wellness data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
