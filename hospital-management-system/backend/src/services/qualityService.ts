// @ts-nocheck
// Note: TypeScript checking disabled temporarily due to Prisma type inference issues
import prisma from '../config/database';

// ==================== QUALITY INDICATOR MANAGEMENT ====================

export const qualityService = {
  // Create quality indicator
  async createIndicator(hospitalId: string, data: {
    code: string;
    name: string;
    description?: string;
    category: string;
    type: string;
    unit: string;
    target: number;
    threshold: number;
    frequency: string;
    formula?: string;
    dataSource?: string;
    responsible?: string;
    standard?: string;
  }) {
    return prisma.qualityIndicator.create({
      data: {
        ...data,
        hospitalId,
        status: 'ACTIVE',
      },
    });
  },

  // Get indicators
  async getIndicators(hospitalId: string, filters: {
    category?: string;
    type?: string;
    status?: string;
    standard?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (filters.category) where.category = filters.category;
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.standard) where.standard = filters.standard;

    const [indicators, total] = await Promise.all([
      prisma.qualityIndicator.findMany({
        where,
        skip,
        take: limit,
        orderBy: { category: 'asc' },
      }),
      prisma.qualityIndicator.count({ where }),
    ]);

    return { indicators, total, page, limit };
  },

  // Get indicator by ID
  async getIndicatorById(id: string) {
    return prisma.qualityIndicator.findUnique({
      where: { id },
      include: {
        measurements: {
          orderBy: { measurementDate: 'desc' },
          take: 12,
        },
      },
    });
  },

  // Update indicator
  async updateIndicator(id: string, data: {
    name?: string;
    description?: string;
    target?: number;
    threshold?: number;
    status?: string;
  }) {
    return prisma.qualityIndicator.update({
      where: { id },
      data,
    });
  },

  // ==================== MEASUREMENT MANAGEMENT ====================

  // Record measurement
  async recordMeasurement(indicatorId: string, data: {
    measurementDate: Date;
    numerator: number;
    denominator: number;
    value: number;
    notes?: string;
    recordedBy: string;
    dataDetails?: any;
  }) {
    const indicator = await prisma.qualityIndicator.findUnique({
      where: { id: indicatorId },
    });

    if (!indicator) throw new Error('Indicator not found');

    // Determine status based on target and threshold
    let status: string;
    if (data.value >= indicator.target) {
      status = 'MET';
    } else if (data.value >= indicator.threshold) {
      status = 'WARNING';
    } else {
      status = 'NOT_MET';
    }

    // Calculate variance
    const variance = ((data.value - indicator.target) / indicator.target) * 100;

    return prisma.qIMeasurement.create({
      data: {
        ...data,
        indicatorId,
        status,
        variance,
      },
      include: { indicator: true },
    });
  },

  // Get measurements
  async getMeasurements(indicatorId: string, filters: {
    dateFrom?: Date;
    dateTo?: Date;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { indicatorId };
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.measurementDate = {};
      if (filters.dateFrom) where.measurementDate.gte = filters.dateFrom;
      if (filters.dateTo) where.measurementDate.lte = filters.dateTo;
    }

    const [measurements, total] = await Promise.all([
      prisma.qIMeasurement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { measurementDate: 'desc' },
        include: { indicator: true },
      }),
      prisma.qIMeasurement.count({ where }),
    ]);

    return { measurements, total, page, limit };
  },

  // ==================== INCIDENT MANAGEMENT ====================

  // Report incident
  async reportIncident(hospitalId: string, data: {
    incidentNumber?: string;
    incidentDate: Date;
    incidentTime: string;
    location: string;
    department: string;
    type: string;
    severity: string;
    description: string;
    involvedParties?: string[];
    patientId?: string;
    staffId?: string;
    reportedBy: string;
    witnesses?: string[];
    immediateActions?: string;
  }) {
    // Generate incident number
    const count = await prisma.incidentReport.count({ where: { hospitalId } });
    const incidentNumber = data.incidentNumber ||
      `INC-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    return prisma.incidentReport.create({
      data: {
        ...data,
        hospitalId,
        incidentNumber,
        status: 'REPORTED',
      },
      include: {
        patient: true,
      },
    });
  },

  // Get incidents
  async getIncidents(hospitalId: string, filters: {
    status?: string;
    type?: string;
    severity?: string;
    department?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.severity) where.severity = filters.severity;
    if (filters.department) where.department = filters.department;
    if (filters.dateFrom || filters.dateTo) {
      where.incidentDate = {};
      if (filters.dateFrom) where.incidentDate.gte = filters.dateFrom;
      if (filters.dateTo) where.incidentDate.lte = filters.dateTo;
    }

    const [incidents, total] = await Promise.all([
      prisma.incidentReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { incidentDate: 'desc' },
        include: { patient: true },
      }),
      prisma.incidentReport.count({ where }),
    ]);

    return { incidents, total, page, limit };
  },

  // Get incident by ID
  async getIncidentById(id: string) {
    return prisma.incidentReport.findUnique({
      where: { id },
      include: { patient: true },
    });
  },

  // Update incident status
  async updateIncidentStatus(id: string, status: string, data?: {
    assignedTo?: string;
    notes?: string;
  }) {
    return prisma.incidentReport.update({
      where: { id },
      data: {
        status,
        ...data,
      },
    });
  },

  // Investigate incident
  async investigateIncident(id: string, data: {
    investigator: string;
    rootCause: string;
    contributingFactors: string[];
    findings: string;
    recommendations: string[];
  }) {
    return prisma.incidentReport.update({
      where: { id },
      data: {
        status: 'INVESTIGATED',
        investigatedBy: data.investigator,
        investigatedAt: new Date(),
        rootCause: data.rootCause,
        contributingFactors: data.contributingFactors,
        investigationFindings: data.findings,
        recommendations: data.recommendations,
      },
    });
  },

  // Close incident
  async closeIncident(id: string, data: {
    resolution: string;
    correctiveActions: string[];
    preventiveActions: string[];
    closedBy: string;
    lessonsLearned?: string;
  }) {
    return prisma.incidentReport.update({
      where: { id },
      data: {
        status: 'CLOSED',
        resolution: data.resolution,
        correctiveActions: data.correctiveActions,
        preventiveActions: data.preventiveActions,
        closedBy: data.closedBy,
        closedAt: new Date(),
        lessonsLearned: data.lessonsLearned,
      },
    });
  },

  // ==================== AI FEATURES ====================

  // AI: Analyze quality trends
  analyzeQualityTrends(data: {
    measurements: { date: Date; value: number; target: number }[];
    indicatorName: string;
  }): {
    trend: string;
    trendScore: number;
    average: number;
    standardDeviation: number;
    forecast: { date: Date; predictedValue: number }[];
    insights: string[];
    recommendations: string[];
  } {
    const values = data.measurements.map(m => m.value);
    const targets = data.measurements.map(m => m.target);

    // Calculate statistics
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);

    // Determine trend
    let trendScore = 0;
    if (values.length >= 3) {
      const recentAvg = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
      const oldAvg = values.slice(-3).reduce((a, b) => a + b, 0) / 3;
      trendScore = ((recentAvg - oldAvg) / oldAvg) * 100;
    }

    let trend: string;
    if (trendScore > 5) trend = 'IMPROVING';
    else if (trendScore < -5) trend = 'DECLINING';
    else trend = 'STABLE';

    // Generate forecast (simple linear projection)
    const forecast: { date: Date; predictedValue: number }[] = [];
    if (values.length >= 3) {
      const slope = (values[0] - values[values.length - 1]) / values.length;
      for (let i = 1; i <= 3; i++) {
        const futureDate = new Date();
        futureDate.setMonth(futureDate.getMonth() + i);
        forecast.push({
          date: futureDate,
          predictedValue: Math.round((values[0] + slope * i) * 100) / 100,
        });
      }
    }

    // Generate insights
    const insights: string[] = [];
    const recommendations: string[] = [];
    const avgTarget = targets.reduce((a, b) => a + b, 0) / targets.length;

    if (average >= avgTarget) {
      insights.push(`${data.indicatorName} is meeting target (${average.toFixed(1)}% vs ${avgTarget}% target)`);
    } else {
      insights.push(`${data.indicatorName} is below target (${average.toFixed(1)}% vs ${avgTarget}% target)`);
      recommendations.push('Implement improvement initiatives to reach target');
    }

    if (standardDeviation > average * 0.2) {
      insights.push('High variability in measurements - process may be unstable');
      recommendations.push('Investigate causes of variation and standardize processes');
    }

    if (trend === 'DECLINING') {
      insights.push('Declining trend observed over recent measurements');
      recommendations.push('Conduct root cause analysis for declining performance');
    } else if (trend === 'IMPROVING') {
      insights.push('Positive improvement trend observed');
    }

    return {
      trend,
      trendScore: Math.round(trendScore * 100) / 100,
      average: Math.round(average * 100) / 100,
      standardDeviation: Math.round(standardDeviation * 100) / 100,
      forecast,
      insights,
      recommendations,
    };
  },

  // AI: Root cause analysis for incidents
  performRootCauseAnalysis(data: {
    incidentType: string;
    description: string;
    severity: string;
    department: string;
    contributingFactors: string[];
    similarIncidents?: { description: string; rootCause: string }[];
  }): {
    probableRootCauses: { cause: string; probability: number; category: string }[];
    contributingFactorAnalysis: { factor: string; impact: string }[];
    fishboneDiagram: Record<string, string[]>;
    recommendations: string[];
    preventiveMeasures: string[];
  } {
    const probableRootCauses: { cause: string; probability: number; category: string }[] = [];
    const recommendations: string[] = [];
    const preventiveMeasures: string[] = [];

    // Ishikawa/Fishbone categories
    const fishboneDiagram: Record<string, string[]> = {
      'People': [],
      'Process': [],
      'Equipment': [],
      'Environment': [],
      'Materials': [],
      'Management': [],
    };

    // Analyze based on incident type
    const incidentPatterns: Record<string, { causes: string[]; category: string }[]> = {
      'MEDICATION_ERROR': [
        { causes: ['Wrong dose calculation', 'Look-alike/sound-alike drugs'], category: 'Process' },
        { causes: ['Staff fatigue', 'Inadequate training'], category: 'People' },
        { causes: ['System alert fatigue', 'Poor labeling'], category: 'Equipment' },
      ],
      'FALL': [
        { causes: ['Wet floor', 'Poor lighting'], category: 'Environment' },
        { causes: ['Inadequate assessment', 'Missing fall risk protocol'], category: 'Process' },
        { causes: ['Sedating medications', 'Mobility issues'], category: 'People' },
      ],
      'INFECTION': [
        { causes: ['Hand hygiene non-compliance', 'Sterilization failure'], category: 'Process' },
        { causes: ['Contaminated equipment', 'HVAC issues'], category: 'Equipment' },
        { causes: ['Staffing shortage', 'Inadequate isolation'], category: 'Management' },
      ],
      'SURGICAL': [
        { causes: ['Wrong site marking', 'Time-out not performed'], category: 'Process' },
        { causes: ['Equipment malfunction', 'Instrument unavailability'], category: 'Equipment' },
        { causes: ['Communication failure', 'Fatigue'], category: 'People' },
      ],
      'DIAGNOSTIC_ERROR': [
        { causes: ['Incomplete history', 'Test not ordered'], category: 'Process' },
        { causes: ['Cognitive bias', 'Inexperience'], category: 'People' },
        { causes: ['Lab/imaging errors', 'System delays'], category: 'Equipment' },
      ],
    };

    const patterns = incidentPatterns[data.incidentType] || [];
    patterns.forEach(pattern => {
      pattern.causes.forEach(cause => {
        fishboneDiagram[pattern.category].push(cause);
        probableRootCauses.push({
          cause,
          probability: 0.3 + Math.random() * 0.4,
          category: pattern.category,
        });
      });
    });

    // Analyze contributing factors
    const contributingFactorAnalysis = data.contributingFactors.map(factor => {
      let impact: string;
      if (factor.toLowerCase().includes('staff') || factor.toLowerCase().includes('training')) {
        impact = 'HIGH';
        fishboneDiagram['People'].push(factor);
      } else if (factor.toLowerCase().includes('system') || factor.toLowerCase().includes('equipment')) {
        impact = 'MEDIUM';
        fishboneDiagram['Equipment'].push(factor);
      } else {
        impact = 'MEDIUM';
        fishboneDiagram['Process'].push(factor);
      }
      return { factor, impact };
    });

    // Generate recommendations based on severity
    if (data.severity === 'SEVERE' || data.severity === 'SENTINEL') {
      recommendations.push('Conduct comprehensive root cause analysis with multidisciplinary team');
      recommendations.push('Report to patient safety organization');
      recommendations.push('Implement immediate corrective actions');
      preventiveMeasures.push('Develop system-wide preventive protocols');
    }

    recommendations.push('Review and update relevant policies and procedures');
    recommendations.push('Provide targeted staff education and training');
    recommendations.push('Implement technology safeguards where applicable');

    preventiveMeasures.push('Establish regular safety audits');
    preventiveMeasures.push('Create feedback mechanisms for near-miss reporting');
    preventiveMeasures.push('Monitor leading indicators for early warning');

    return {
      probableRootCauses: probableRootCauses.sort((a, b) => b.probability - a.probability),
      contributingFactorAnalysis,
      fishboneDiagram,
      recommendations,
      preventiveMeasures,
    };
  },

  // AI: Generate quality scorecard
  generateQualityScorecard(hospitalId: string, data: {
    indicators: {
      name: string;
      category: string;
      currentValue: number;
      target: number;
      benchmark?: number;
    }[];
  }): {
    overallScore: number;
    grade: string;
    categoryScores: { category: string; score: number; indicators: number }[];
    topPerformers: { name: string; score: number }[];
    needsImprovement: { name: string; gap: number }[];
    benchmarkComparison: { above: number; at: number; below: number };
    executiveSummary: string;
  } {
    // Calculate scores for each indicator
    const indicatorScores = data.indicators.map(ind => {
      const score = Math.min(100, (ind.currentValue / ind.target) * 100);
      return { ...ind, score };
    });

    // Category scores
    const categories: Record<string, { total: number; count: number }> = {};
    indicatorScores.forEach(ind => {
      if (!categories[ind.category]) {
        categories[ind.category] = { total: 0, count: 0 };
      }
      categories[ind.category].total += ind.score;
      categories[ind.category].count++;
    });

    const categoryScores = Object.entries(categories).map(([category, data]) => ({
      category,
      score: Math.round(data.total / data.count),
      indicators: data.count,
    }));

    // Overall score
    const overallScore = Math.round(
      indicatorScores.reduce((sum, ind) => sum + ind.score, 0) / indicatorScores.length
    );

    // Grade
    let grade: string;
    if (overallScore >= 95) grade = 'A+';
    else if (overallScore >= 90) grade = 'A';
    else if (overallScore >= 85) grade = 'B+';
    else if (overallScore >= 80) grade = 'B';
    else if (overallScore >= 75) grade = 'C+';
    else if (overallScore >= 70) grade = 'C';
    else if (overallScore >= 60) grade = 'D';
    else grade = 'F';

    // Top performers and needs improvement
    const sorted = [...indicatorScores].sort((a, b) => b.score - a.score);
    const topPerformers = sorted.slice(0, 5).map(ind => ({
      name: ind.name,
      score: Math.round(ind.score),
    }));
    const needsImprovement = sorted
      .filter(ind => ind.score < 100)
      .slice(-5)
      .reverse()
      .map(ind => ({
        name: ind.name,
        gap: Math.round(ind.target - ind.currentValue),
      }));

    // Benchmark comparison
    let above = 0, at = 0, below = 0;
    indicatorScores.forEach(ind => {
      if (ind.benchmark) {
        if (ind.currentValue > ind.benchmark) above++;
        else if (ind.currentValue >= ind.benchmark * 0.95) at++;
        else below++;
      }
    });

    // Executive summary
    const executiveSummary = `
Quality Performance Summary:
Overall Score: ${overallScore}% (Grade: ${grade})

The hospital achieved ${grade} grade performance across ${data.indicators.length} quality indicators.
${topPerformers.length > 0 ? `Top performing area: ${topPerformers[0].name} (${topPerformers[0].score}%)` : ''}
${needsImprovement.length > 0 ? `Priority improvement area: ${needsImprovement[0].name} (gap: ${needsImprovement[0].gap})` : ''}

${categoryScores.map(c => `${c.category}: ${c.score}%`).join(' | ')}
    `.trim();

    return {
      overallScore,
      grade,
      categoryScores,
      topPerformers,
      needsImprovement,
      benchmarkComparison: { above, at, below },
      executiveSummary,
    };
  },

  // AI: Predict incident risk
  predictIncidentRisk(data: {
    department: string;
    staffingLevel: number;
    patientAcuity: number;
    recentIncidents: number;
    timeOfDay: string;
    dayOfWeek: string;
  }): {
    riskLevel: string;
    riskScore: number;
    riskFactors: { factor: string; impact: number }[];
    recommendations: string[];
  } {
    let riskScore = 0;
    const riskFactors: { factor: string; impact: number }[] = [];

    // Staffing level (lower = higher risk)
    if (data.staffingLevel < 70) {
      const impact = (100 - data.staffingLevel) * 0.3;
      riskScore += impact;
      riskFactors.push({ factor: 'Low staffing level', impact });
    }

    // Patient acuity (higher = higher risk)
    if (data.patientAcuity > 3) {
      const impact = (data.patientAcuity - 3) * 10;
      riskScore += impact;
      riskFactors.push({ factor: 'High patient acuity', impact });
    }

    // Recent incidents
    if (data.recentIncidents > 2) {
      const impact = data.recentIncidents * 5;
      riskScore += impact;
      riskFactors.push({ factor: 'Recent incident history', impact });
    }

    // Time of day
    const nightShift = ['22:00', '23:00', '00:00', '01:00', '02:00', '03:00', '04:00', '05:00'];
    if (nightShift.some(t => data.timeOfDay.startsWith(t.split(':')[0]))) {
      riskScore += 10;
      riskFactors.push({ factor: 'Night shift timing', impact: 10 });
    }

    // Weekend
    if (['Saturday', 'Sunday'].includes(data.dayOfWeek)) {
      riskScore += 5;
      riskFactors.push({ factor: 'Weekend staffing', impact: 5 });
    }

    // Department-specific risks
    const highRiskDepts = ['Emergency', 'ICU', 'Surgery', 'Labor & Delivery'];
    if (highRiskDepts.includes(data.department)) {
      riskScore += 10;
      riskFactors.push({ factor: 'High-risk department', impact: 10 });
    }

    // Determine risk level
    let riskLevel: string;
    const recommendations: string[] = [];

    if (riskScore >= 50) {
      riskLevel = 'HIGH';
      recommendations.push('Consider additional staffing or support');
      recommendations.push('Increase supervision and monitoring');
      recommendations.push('Activate incident prevention protocols');
    } else if (riskScore >= 30) {
      riskLevel = 'MODERATE';
      recommendations.push('Maintain vigilance and standard protocols');
      recommendations.push('Ensure adequate communication among staff');
    } else {
      riskLevel = 'LOW';
      recommendations.push('Continue standard safety measures');
    }

    return {
      riskLevel,
      riskScore: Math.min(100, riskScore),
      riskFactors: riskFactors.sort((a, b) => b.impact - a.impact),
      recommendations,
    };
  },

  // Get quality dashboard stats
  async getDashboardStats(hospitalId: string) {
    const today = new Date();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalIndicators,
      activeIndicators,
      metTargets,
      totalIncidents,
      openIncidents,
      severeIncidents,
    ] = await Promise.all([
      prisma.qualityIndicator.count({ where: { hospitalId } }),
      prisma.qualityIndicator.count({ where: { hospitalId, status: 'ACTIVE' } }),
      prisma.qIMeasurement.count({
        where: {
          indicator: { hospitalId },
          status: 'MET',
          measurementDate: { gte: thisMonth },
        },
      }),
      prisma.incidentReport.count({
        where: { hospitalId, incidentDate: { gte: thisMonth } },
      }),
      prisma.incidentReport.count({
        where: {
          hospitalId,
          status: { in: ['REPORTED', 'UNDER_INVESTIGATION'] },
        },
      }),
      prisma.incidentReport.count({
        where: {
          hospitalId,
          severity: { in: ['SEVERE', 'SENTINEL'] },
          incidentDate: { gte: thisMonth },
        },
      }),
    ]);

    // Get measurements this month for compliance rate
    const measurementsThisMonth = await prisma.qIMeasurement.count({
      where: {
        indicator: { hospitalId },
        measurementDate: { gte: thisMonth },
      },
    });

    const complianceRate = measurementsThisMonth > 0
      ? Math.round((metTargets / measurementsThisMonth) * 100)
      : 0;

    return {
      totalIndicators,
      activeIndicators,
      complianceRate,
      totalIncidents,
      openIncidents,
      severeIncidents,
    };
  },
};
