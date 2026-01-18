import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAmadData() {
  console.log("🧬 Seeding A'mad Precision Health Platform data...\n");

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
  const hospitalId = patientUser.hospitalId;
  console.log(`Found patient: ${patientUser.firstName} ${patientUser.lastName} (${patientUser.email})\n`);

  const today = new Date();

  // ============================================================
  // 1. DAILY HEALTH SCORES (last 7 days)
  // ============================================================
  console.log('📊 Creating Daily Health Scores...');

  // Clear existing scores for clean demo
  await prisma.dailyHealthScore.deleteMany({ where: { patientId } });

  const healthScoresData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    // Generate realistic scores with some variation
    const baseScore = 65 + Math.floor(Math.random() * 20); // 65-85 range
    const sleep = Math.min(100, Math.max(0, baseScore + Math.floor(Math.random() * 20) - 10));
    const activity = Math.min(100, Math.max(0, baseScore + Math.floor(Math.random() * 20) - 10));
    const nutrition = Math.min(100, Math.max(0, baseScore + Math.floor(Math.random() * 15) - 5));
    const recovery = Math.min(100, Math.max(0, baseScore + Math.floor(Math.random() * 25) - 12));
    const compliance = Math.min(100, Math.max(0, baseScore + Math.floor(Math.random() * 10)));
    const overall = Math.round((sleep + activity + nutrition + recovery + compliance) / 5);

    // Determine trend based on day
    let trend: 'IMPROVING' | 'STABLE' | 'DECLINING' | 'INSUFFICIENT_DATA';
    if (i >= 5) {
      trend = 'INSUFFICIENT_DATA';
    } else if (i >= 3) {
      trend = 'STABLE';
    } else {
      trend = 'IMPROVING';
    }

    // Generate insights based on scores
    const insights: string[] = [];
    if (sleep < 70) insights.push('Your sleep quality could use some improvement. Try maintaining a consistent bedtime.');
    if (sleep >= 80) insights.push('Great sleep quality! Keep up the good sleep habits.');
    if (activity < 65) insights.push('Consider adding more physical activity to your routine.');
    if (activity >= 80) insights.push('Excellent activity levels! You\'re meeting your fitness goals.');
    if (nutrition < 70) insights.push('Focus on adding more vegetables and whole grains to your meals.');
    if (recovery >= 75) insights.push('Your recovery metrics show good stress management.');
    if (compliance >= 80) insights.push('You\'re doing great at following your health recommendations!');

    healthScoresData.push({
      patientId,
      hospitalId,
      date,
      overall,
      sleep,
      activity,
      nutrition,
      recovery,
      compliance,
      trend,
      insights,
      dataQuality: 0.75 + Math.random() * 0.2, // 0.75-0.95
    });
  }

  for (const score of healthScoresData) {
    await prisma.dailyHealthScore.create({ data: score });
  }
  console.log(`  ✓ Created ${healthScoresData.length} daily health scores`);

  // ============================================================
  // 2. RECOMMENDATIONS
  // ============================================================
  console.log('\n💡 Creating Recommendations...');

  // Clear existing recommendations for clean demo
  await prisma.recommendation.deleteMany({ where: { patientId } });

  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + 30); // Valid for 30 days

  const recommendationsData = [
    {
      patientId,
      hospitalId,
      category: 'GENOMIC' as const,
      priority: 'HIGH' as const,
      title: 'Reduce Caffeine Intake',
      description: 'Based on your CYP1A2 gene variant (slow caffeine metabolizer), you process caffeine more slowly than average. This can affect sleep quality and increase anxiety.',
      reasoning: [
        'Your genetic profile shows CYP1A2 AC genotype (slow metabolizer)',
        'Caffeine can stay in your system 2-3x longer than fast metabolizers',
        'This may be contributing to your lower sleep scores',
      ],
      dataSources: ['GenomicProfile: CYP1A2 rs762551'],
      actionItems: [
        'Limit coffee to 1-2 cups before noon',
        'Avoid caffeine after 2 PM',
        'Consider switching to green tea for afternoon energy',
      ],
      validUntil,
      status: 'ACTIVE' as const,
    },
    {
      patientId,
      hospitalId,
      category: 'NUTRITION' as const,
      priority: 'MEDIUM' as const,
      title: 'Increase Omega-3 Fatty Acids',
      description: 'Your inflammatory markers and genetic profile suggest you would benefit from increased omega-3 intake for cardiovascular and cognitive health.',
      reasoning: [
        'APOE gene variant indicates higher cardiovascular risk',
        'Omega-3s help reduce inflammation markers',
        'Supports brain health and cognitive function',
      ],
      dataSources: ['GenomicProfile: APOE', 'NutritionLogs: Low fish intake'],
      actionItems: [
        'Eat fatty fish (salmon, mackerel) 2-3 times per week',
        'Add flaxseeds or chia seeds to breakfast',
        'Consider an omega-3 supplement (consult doctor first)',
      ],
      validUntil,
      status: 'ACTIVE' as const,
    },
    {
      patientId,
      hospitalId,
      category: 'ACTIVITY' as const,
      priority: 'MEDIUM' as const,
      title: 'Add HIIT Training',
      description: 'Your fitness data shows steady cardio work. Adding high-intensity interval training could improve your metabolic health and save time.',
      reasoning: [
        'Your ACE gene variant responds well to HIIT',
        'Current activity is mostly moderate intensity',
        'HIIT can improve insulin sensitivity more effectively',
      ],
      dataSources: ['GenomicProfile: ACE I/D', 'FitnessActivities: Cardio log'],
      actionItems: [
        'Try 2 HIIT sessions per week (20-30 minutes each)',
        'Start with 30 seconds high intensity, 60 seconds rest',
        'Track heart rate to ensure proper intensity zones',
      ],
      validUntil,
      status: 'ACTIVE' as const,
    },
    {
      patientId,
      hospitalId,
      category: 'SLEEP' as const,
      priority: 'HIGH' as const,
      title: 'Improve Sleep Consistency',
      description: 'Your sleep data shows inconsistent bedtimes and wake times. A regular sleep schedule can significantly improve sleep quality and daytime energy.',
      reasoning: [
        'Sleep timing varies by 2+ hours on weekends',
        'Average sleep duration is below recommended 7-9 hours',
        'This may be affecting your recovery scores',
      ],
      dataSources: ['HealthMetrics: Sleep duration', 'DailyHealthScore: Recovery trend'],
      actionItems: [
        'Set a consistent bedtime alarm',
        'Avoid screens 1 hour before bed',
        'Keep bedroom temperature between 65-68°F (18-20°C)',
        'Try to wake at the same time, even on weekends',
      ],
      validUntil,
      status: 'ACTIVE' as const,
    },
    {
      patientId,
      hospitalId,
      category: 'SUPPLEMENT' as const,
      priority: 'LOW' as const,
      title: 'Consider Vitamin D Supplementation',
      description: 'Your genetic profile and regional factors suggest you may benefit from vitamin D supplementation, especially during winter months.',
      reasoning: [
        'VDR gene variant affects vitamin D metabolism',
        'Limited sun exposure in daily routine',
        'Many people in this region are vitamin D deficient',
      ],
      dataSources: ['GenomicProfile: VDR', 'Location: Indoor lifestyle'],
      actionItems: [
        'Get a vitamin D blood test to confirm levels',
        'If deficient, consider 1000-2000 IU daily supplement',
        'Try to get 15-20 minutes of midday sun when possible',
      ],
      validUntil,
      status: 'ACTIVE' as const,
    },
    {
      patientId,
      hospitalId,
      category: 'GENOMIC' as const,
      priority: 'MEDIUM' as const,
      title: 'Increase Folate-Rich Foods',
      description: 'Your MTHFR gene variant means you process folate less efficiently. Getting more natural folate from food can support methylation and overall health.',
      reasoning: [
        'MTHFR C677T variant detected (reduced enzyme activity)',
        'Methylation is important for DNA repair and detoxification',
        'Natural folate is better absorbed than synthetic folic acid',
      ],
      dataSources: ['GenomicProfile: MTHFR rs1801133'],
      actionItems: [
        'Eat more leafy greens (spinach, kale, arugula)',
        'Include legumes (lentils, chickpeas) in meals',
        'Consider methylfolate instead of folic acid if supplementing',
      ],
      validUntil,
      status: 'ACTIVE' as const,
    },
    {
      patientId,
      hospitalId,
      category: 'LIFESTYLE' as const,
      priority: 'LOW' as const,
      title: 'Practice Stress Management',
      description: 'Your HRV trends and recovery scores suggest chronic stress. Regular stress management practices can improve overall health outcomes.',
      reasoning: [
        'HRV has been declining over past 2 weeks',
        'Recovery scores consistently below 75',
        'Stress affects sleep quality and immune function',
      ],
      dataSources: ['HealthMetrics: HRV', 'DailyHealthScore: Recovery'],
      actionItems: [
        'Try 10 minutes of daily meditation or deep breathing',
        'Take short walking breaks during work',
        'Consider a weekly yoga or tai chi session',
      ],
      validUntil,
      status: 'ACTIVE' as const,
    },
  ];

  for (const rec of recommendationsData) {
    await prisma.recommendation.create({ data: rec });
  }
  console.log(`  ✓ Created ${recommendationsData.length} recommendations`);

  console.log("\n✅ A'mad data seeded successfully!");
  console.log('-------------------------------------------');
  console.log(`Patient: ${patientUser.firstName} ${patientUser.lastName}`);
  console.log(`Email: ${patientUser.email}`);
  console.log('-------------------------------------------');
  console.log('\nScreens now have sample data:');
  console.log('  • Health Score Screen - 7 days of scores');
  console.log('  • Recommendations Screen - 7 personalized recommendations');
  console.log('  • (Genomic Profile - if you uploaded a file, it\'s already working)');
}

seedAmadData()
  .catch((e) => {
    console.error("Error seeding A'mad data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
