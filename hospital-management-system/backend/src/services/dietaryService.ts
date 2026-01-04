import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Nutritional requirements by condition
const NUTRITIONAL_GUIDELINES: Record<string, any> = {
  DIABETIC: {
    maxCarbs: 45, // per meal in grams
    maxSugar: 25, // daily in grams
    minFiber: 25, // daily in grams
    restrictions: ['Added sugars', 'White bread', 'Sugary drinks', 'Candy'],
    recommendations: ['Whole grains', 'Lean proteins', 'Non-starchy vegetables', 'Healthy fats'],
  },
  RENAL: {
    maxSodium: 2000, // mg per day
    maxPotassium: 2000, // mg per day
    maxPhosphorus: 800, // mg per day
    restrictions: ['Bananas', 'Oranges', 'Potatoes', 'Tomatoes', 'Dairy'],
    recommendations: ['Rice', 'White bread', 'Apples', 'Cranberries'],
  },
  CARDIAC: {
    maxSodium: 1500, // mg per day
    maxFat: 50, // grams per day
    maxCholesterol: 200, // mg per day
    restrictions: ['Fried foods', 'Processed meats', 'Full-fat dairy', 'Salty snacks'],
    recommendations: ['Fish', 'Nuts', 'Olive oil', 'Fruits', 'Vegetables'],
  },
  LOW_SODIUM: {
    maxSodium: 1500,
    restrictions: ['Salt', 'Processed foods', 'Canned soups', 'Pickles'],
    recommendations: ['Fresh foods', 'Herbs and spices', 'Homemade meals'],
  },
  HIGH_PROTEIN: {
    minProtein: 100, // grams per day
    recommendations: ['Lean meats', 'Fish', 'Eggs', 'Greek yogurt', 'Legumes'],
  },
};

// Meal timing by patient condition
const MEAL_SCHEDULES: Record<string, { breakfast: string; lunch: string; dinner: string; snacks: string[] }> = {
  REGULAR: { breakfast: '08:00', lunch: '12:30', dinner: '18:30', snacks: ['10:30', '15:30'] },
  DIABETIC: { breakfast: '07:30', lunch: '12:00', dinner: '18:00', snacks: ['10:00', '15:00', '20:00'] },
  NPO: { breakfast: '', lunch: '', dinner: '', snacks: [] },
  PEDIATRIC: { breakfast: '07:00', lunch: '11:30', dinner: '17:30', snacks: ['09:30', '14:00', '16:00'] },
};

class DietaryService {
  // ==================== DIET PLAN MANAGEMENT ====================

  async createDietPlan(hospitalId: string, data: any) {
    const planCode = `DIET-${data.category}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    return prisma.dietPlan.create({
      data: {
        hospitalId,
        planCode,
        name: data.name,
        description: data.description,
        category: data.category,
        calories: data.calories,
        protein: data.protein,
        carbohydrates: data.carbohydrates,
        fat: data.fat,
        fiber: data.fiber,
        sodium: data.sodium,
        restrictions: data.restrictions || [],
        allergens: data.allergens || [],
        breakfastItems: data.breakfastItems || [],
        lunchItems: data.lunchItems || [],
        dinnerItems: data.dinnerItems || [],
        snackItems: data.snackItems || [],
      },
    });
  }

  async getDietPlans(hospitalId: string, params: any = {}) {
    const page = parseInt(params.page) || 1;
    const limit = parseInt(params.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId, isActive: true };
    if (params.category) where.category = params.category;

    const [plans, total] = await Promise.all([
      prisma.dietPlan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.dietPlan.count({ where }),
    ]);

    return { plans, total, page, limit };
  }

  async updateDietPlan(id: string, data: any) {
    return prisma.dietPlan.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        calories: data.calories,
        protein: data.protein,
        carbohydrates: data.carbohydrates,
        fat: data.fat,
        fiber: data.fiber,
        sodium: data.sodium,
        restrictions: data.restrictions,
        allergens: data.allergens,
        breakfastItems: data.breakfastItems,
        lunchItems: data.lunchItems,
        dinnerItems: data.dinnerItems,
        snackItems: data.snackItems,
      },
    });
  }

  async getDietPlanById(id: string) {
    return prisma.dietPlan.findUnique({ where: { id } });
  }

  // ==================== PATIENT DIET ASSIGNMENT ====================

  async assignPatientDiet(hospitalId: string, data: any) {
    return this.assignDiet(hospitalId, data);
  }

  async assignDiet(hospitalId: string, data: any) {
    // Get patient details for AI recommendations
    const patient = await prisma.patient.findUnique({
      where: { id: data.patientId },
      include: { allergies: true, medicalHistory: true },
    });

    // AI: Generate nutritional recommendations
    const recommendations = this.generateNutritionalRecommendations(
      data.category,
      patient?.allergies?.map((a: any) => a.allergen) || [],
      patient?.medicalHistory?.chronicConditions || []
    );

    const patientDiet = await prisma.patientDiet.create({
      data: {
        hospitalId,
        patientId: data.patientId,
        admissionId: data.admissionId,
        dietPlanId: data.dietPlanId,
        specialInstructions: data.specialInstructions,
        allergies: data.allergies || patient?.allergies?.map((a: any) => a.allergen) || [],
        preferences: data.preferences || [],
        avoidItems: data.avoidItems || [],
        feedingMethod: data.feedingMethod || 'ORAL',
        assistanceRequired: data.assistanceRequired || false,
        startDate: new Date(data.startDate || new Date()),
        prescribedBy: data.prescribedBy,
        prescribedAt: new Date(),
      },
      include: { dietPlan: true },
    });

    return { patientDiet, recommendations };
  }

  async getPatientDiets(hospitalId: string, params: any = {}) {
    const page = parseInt(params.page) || 1;
    const limit = parseInt(params.limit) || 20;
    const skip = (page - 1) * limit;
    const { patientId, admissionId, status } = params;

    const where: any = { hospitalId };
    if (patientId) where.patientId = patientId;
    if (admissionId) where.admissionId = admissionId;
    if (status) where.status = status;

    const [diets, total] = await Promise.all([
      prisma.patientDiet.findMany({
        where,
        skip,
        take: limit,
        include: { dietPlan: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.patientDiet.count({ where }),
    ]);

    return { diets, total, page, limit };
  }

  async getPatientDietById(id: string) {
    return prisma.patientDiet.findUnique({
      where: { id },
      include: { dietPlan: true },
    });
  }

  async updatePatientDiet(id: string, data: any) {
    return prisma.patientDiet.update({
      where: { id },
      data: {
        specialInstructions: data.specialInstructions,
        preferences: data.preferences,
        avoidItems: data.avoidItems,
        feedingMethod: data.feedingMethod,
        assistanceRequired: data.assistanceRequired,
        status: data.status,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });
  }

  // ==================== MEAL ORDERS ====================

  async createMealOrder(hospitalId: string, data: any) {
    const orderNumber = `MEAL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    return prisma.mealOrder.create({
      data: {
        hospitalId,
        orderNumber,
        patientDietId: data.patientDietId,
        patientId: data.patientId,
        bedNumber: data.bedNumber,
        wardName: data.wardName,
        mealType: data.mealType,
        mealDate: new Date(data.mealDate),
        items: data.items,
        specialRequest: data.specialRequest,
        scheduledTime: new Date(data.scheduledTime),
      },
    });
  }

  async getMealOrders(hospitalId: string, params: any = {}) {
    const page = parseInt(params.page) || 1;
    const limit = parseInt(params.limit) || 20;
    const skip = (page - 1) * limit;
    const { date, wardName, status, mealType } = params;

    const where: any = { hospitalId };
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.mealDate = { gte: startOfDay, lte: endOfDay };
    }
    if (wardName) where.wardName = wardName;
    if (status) where.status = status;
    if (mealType) where.mealType = mealType;

    const [orders, total] = await Promise.all([
      prisma.mealOrder.findMany({
        where,
        skip,
        take: limit,
        include: { patientDiet: { include: { dietPlan: true } } },
        orderBy: [{ scheduledTime: 'asc' }],
      }),
      prisma.mealOrder.count({ where }),
    ]);

    return { orders, total, page, limit };
  }

  async updateMealOrderStatus(id: string, status: string, data: any = {}) {
    const updateData: any = { status };

    if (status === 'PREPARING') {
      updateData.preparedBy = data.preparedBy;
    } else if (status === 'READY') {
      updateData.preparedAt = new Date();
    } else if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
      updateData.deliveredBy = data.deliveredBy;
    } else if (status === 'CONSUMED') {
      updateData.consumptionPercent = data.consumptionPercent;
      updateData.consumptionNotes = data.consumptionNotes;
      updateData.recordedBy = data.recordedBy;
    }

    return prisma.mealOrder.update({ where: { id }, data: updateData });
  }

  // Generate daily meal orders for all admitted patients
  async generateDailyMealOrders(hospitalId: string, date: Date) {
    // Get all active patient diets
    const activeDiets = await prisma.patientDiet.findMany({
      where: {
        hospitalId,
        status: 'ACTIVE',
      },
      include: {
        dietPlan: true,
      },
    });

    // Get bed info for patients
    const admissions = await prisma.admission.findMany({
      where: {
        hospitalId,
        patientId: { in: activeDiets.map(d => d.patientId) },
        status: 'ADMITTED',
      },
      include: {
        bed: { include: { ward: true } },
      },
    });

    const admissionMap = new Map(admissions.map(a => [a.patientId, a]));
    const orders: any[] = [];

    for (const diet of activeDiets) {
      const admission = admissionMap.get(diet.patientId);
      if (!admission) continue;

      const schedule = MEAL_SCHEDULES[diet.dietPlan.category] || MEAL_SCHEDULES.REGULAR;

      // Create orders for each meal
      const mealTypes = ['BREAKFAST', 'LUNCH', 'DINNER'];
      const times = [schedule.breakfast, schedule.lunch, schedule.dinner];

      for (let i = 0; i < mealTypes.length; i++) {
        if (!times[i]) continue; // Skip if NPO

        const [hours, minutes] = times[i].split(':').map(Number);
        const scheduledTime = new Date(date);
        scheduledTime.setHours(hours, minutes, 0, 0);

        const mealItems = this.getMealItems(diet.dietPlan, mealTypes[i] as any);

        orders.push({
          hospitalId,
          patientDietId: diet.id,
          patientId: diet.patientId,
          bedNumber: admission.bed?.bedNumber || 'Unknown',
          wardName: admission.bed?.ward?.name || 'Unknown',
          mealType: mealTypes[i],
          mealDate: date,
          items: mealItems,
          scheduledTime,
        });
      }

      // Create snack orders
      for (const snackTime of schedule.snacks) {
        if (!snackTime) continue;
        const [hours, minutes] = snackTime.split(':').map(Number);
        const scheduledTime = new Date(date);
        scheduledTime.setHours(hours, minutes, 0, 0);

        orders.push({
          hospitalId,
          patientDietId: diet.id,
          patientId: diet.patientId,
          bedNumber: admission.bed?.bedNumber || 'Unknown',
          wardName: admission.bed?.ward?.name || 'Unknown',
          mealType: 'SNACK',
          mealDate: date,
          items: diet.dietPlan.snackItems,
          scheduledTime,
        });
      }
    }

    // Bulk create orders
    const createdOrders = [];
    for (const order of orders) {
      const orderNumber = `MEAL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const created = await prisma.mealOrder.create({
        data: { ...order, orderNumber },
      });
      createdOrders.push(created);
    }

    return {
      totalOrders: createdOrders.length,
      byMealType: {
        breakfast: createdOrders.filter(o => o.mealType === 'BREAKFAST').length,
        lunch: createdOrders.filter(o => o.mealType === 'LUNCH').length,
        dinner: createdOrders.filter(o => o.mealType === 'DINNER').length,
        snacks: createdOrders.filter(o => o.mealType === 'SNACK').length,
      },
    };
  }

  private getMealItems(dietPlan: any, mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER'): any {
    const itemsMap = {
      BREAKFAST: dietPlan.breakfastItems,
      LUNCH: dietPlan.lunchItems,
      DINNER: dietPlan.dinnerItems,
    };
    return itemsMap[mealType] || [];
  }

  // ==================== AI FEATURES ====================

  // Alias for route compatibility
  getAINutritionalRecommendations(params: any) {
    return this.generateNutritionalRecommendations(
      params.dietCategory || 'REGULAR',
      params.allergies || [],
      params.conditions || []
    );
  }

  // Alias for route compatibility
  analyzeNutritionIntake(params: any) {
    const dateRange = {
      start: params.startDate ? new Date(params.startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: params.endDate ? new Date(params.endDate) : new Date(),
    };
    return this.analyzeNutritionIntakeByPatient(params.patientId, dateRange);
  }

  // AI: Generate nutritional recommendations
  generateNutritionalRecommendations(
    dietCategory: string,
    allergies: string[],
    conditions: string[]
  ): {
    dailyCalories: number;
    macronutrients: { protein: number; carbs: number; fat: number };
    restrictions: string[];
    recommendations: string[];
    mealTiming: string;
    hydration: string;
    supplements?: string[];
  } {
    let dailyCalories = 2000;
    let macronutrients = { protein: 50, carbs: 250, fat: 65 };
    const restrictions: string[] = [...allergies];
    const recommendations: string[] = [];
    let mealTiming = '3 main meals with 2 snacks';
    let hydration = '8 glasses of water daily';
    const supplements: string[] = [];

    // Apply guidelines based on diet category
    const guidelines = NUTRITIONAL_GUIDELINES[dietCategory];
    if (guidelines) {
      restrictions.push(...(guidelines.restrictions || []));
      recommendations.push(...(guidelines.recommendations || []));
    }

    // Adjust for conditions
    if (conditions.includes('diabetes') || dietCategory === 'DIABETIC') {
      dailyCalories = 1800;
      macronutrients = { protein: 75, carbs: 180, fat: 60 };
      mealTiming = '3 main meals with 3 small snacks to maintain blood sugar';
      recommendations.push('Monitor blood glucose before and after meals');
      supplements.push('Consider chromium supplementation (consult doctor)');
    }

    if (conditions.includes('hypertension') || dietCategory === 'CARDIAC') {
      restrictions.push('High sodium foods', 'Caffeine in excess');
      recommendations.push('DASH diet principles', 'Potassium-rich foods');
    }

    if (conditions.includes('kidney disease') || dietCategory === 'RENAL') {
      dailyCalories = 1600;
      hydration = 'Fluid restricted - follow physician orders';
      recommendations.push('Limit protein to prescribed amount');
    }

    if (dietCategory === 'HIGH_PROTEIN') {
      macronutrients.protein = 120;
      recommendations.push('Protein with every meal');
      supplements.push('Protein shake if needed to meet targets');
    }

    if (dietCategory === 'NPO') {
      dailyCalories = 0;
      mealTiming = 'Nothing by mouth - IV nutrition if ordered';
      hydration = 'No oral fluids';
    }

    return {
      dailyCalories,
      macronutrients,
      restrictions: [...new Set(restrictions)],
      recommendations: [...new Set(recommendations)],
      mealTiming,
      hydration,
      supplements: supplements.length > 0 ? supplements : undefined,
    };
  }

  // AI: Suggest diet plan based on patient condition
  suggestDietPlan(params: {
    diagnosis?: string[];
    chronicConditions?: string[];
    allergies?: string[];
    age?: number;
    weight?: number;
    height?: number;
    activityLevel?: string;
  }): {
    suggestedCategory: string;
    alternativeCategories: string[];
    calorieTarget: number;
    specialConsiderations: string[];
    contraindications: string[];
  } {
    const { diagnosis = [], chronicConditions = [], allergies = [], age, weight, height } = params;
    const allConditions = [...diagnosis, ...chronicConditions].map(c => c.toLowerCase());

    let suggestedCategory = 'REGULAR';
    const alternativeCategories: string[] = [];
    const specialConsiderations: string[] = [];
    const contraindications: string[] = [];

    // Determine primary diet
    if (allConditions.some(c => c.includes('diabetes'))) {
      suggestedCategory = 'DIABETIC';
      specialConsiderations.push('Consistent carbohydrate diet');
      specialConsiderations.push('Avoid simple sugars');
    } else if (allConditions.some(c => c.includes('kidney') || c.includes('renal'))) {
      suggestedCategory = 'RENAL';
      specialConsiderations.push('Restrict potassium, phosphorus, and sodium');
      specialConsiderations.push('May need protein restriction');
    } else if (allConditions.some(c => c.includes('heart') || c.includes('cardiac') || c.includes('hypertension'))) {
      suggestedCategory = 'CARDIAC';
      alternativeCategories.push('LOW_SODIUM');
      specialConsiderations.push('Low saturated fat, low cholesterol');
    } else if (allConditions.some(c => c.includes('surgery') || c.includes('wound') || c.includes('burn'))) {
      suggestedCategory = 'HIGH_PROTEIN';
      specialConsiderations.push('Increased protein for wound healing');
      specialConsiderations.push('Vitamin C and zinc supplementation may help');
    } else if (allConditions.some(c => c.includes('dysphagia') || c.includes('swallowing'))) {
      suggestedCategory = 'SOFT';
      alternativeCategories.push('LIQUID');
      specialConsiderations.push('May need thickened liquids');
      specialConsiderations.push('Speech therapy consultation recommended');
    }

    // Calculate calorie target (Mifflin-St Jeor equation approximation)
    let calorieTarget = 2000;
    if (weight && height && age) {
      const bmr = 10 * weight + 6.25 * height - 5 * age + 5; // Male formula as base
      calorieTarget = Math.round(bmr * 1.3); // Moderate activity factor for hospitalized
    }

    // Consider allergies
    allergies.forEach(allergy => {
      if (allergy.toLowerCase().includes('gluten')) {
        alternativeCategories.push('GLUTEN_FREE');
        contraindications.push('Wheat, barley, rye products');
      }
      if (allergy.toLowerCase().includes('lactose') || allergy.toLowerCase().includes('dairy')) {
        alternativeCategories.push('LACTOSE_FREE');
        contraindications.push('Milk, cheese, yogurt');
      }
    });

    // Age considerations
    if (age && age < 12) {
      alternativeCategories.push('PEDIATRIC');
      specialConsiderations.push('Child-friendly portions and presentation');
    } else if (age && age > 70) {
      alternativeCategories.push('GERIATRIC');
      specialConsiderations.push('Easy to chew, nutrient-dense foods');
      calorieTarget = Math.round(calorieTarget * 0.9);
    }

    return {
      suggestedCategory,
      alternativeCategories: [...new Set(alternativeCategories)],
      calorieTarget,
      specialConsiderations,
      contraindications,
    };
  }

  // AI: Analyze nutrition intake
  async analyzeNutritionIntakeByPatient(patientId: string, dateRange: { start: Date; end: Date }) {
    const mealOrders = await prisma.mealOrder.findMany({
      where: {
        patientId,
        mealDate: { gte: dateRange.start, lte: dateRange.end },
        status: 'CONSUMED',
      },
      include: { patientDiet: { include: { dietPlan: true } } },
    });

    if (mealOrders.length === 0) {
      return { message: 'No consumed meals found in the date range' };
    }

    // Calculate average intake
    const totalMeals = mealOrders.length;
    const avgConsumption = mealOrders.reduce((sum, m) => sum + (m.consumptionPercent || 0), 0) / totalMeals;

    const days = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000));

    const analysis = {
      period: { start: dateRange.start, end: dateRange.end, days },
      totalMeals,
      averageConsumption: Math.round(avgConsumption),
      consumptionByMeal: {
        breakfast: this.calculateMealTypeConsumption(mealOrders, 'BREAKFAST'),
        lunch: this.calculateMealTypeConsumption(mealOrders, 'LUNCH'),
        dinner: this.calculateMealTypeConsumption(mealOrders, 'DINNER'),
        snacks: this.calculateMealTypeConsumption(mealOrders, 'SNACK'),
      },
      nutritionStatus: avgConsumption >= 75 ? 'ADEQUATE' : avgConsumption >= 50 ? 'SUBOPTIMAL' : 'POOR',
      alerts: [] as string[],
      recommendations: [] as string[],
    };

    // Generate alerts and recommendations
    if (avgConsumption < 50) {
      analysis.alerts.push('Patient consuming less than 50% of meals - nutritional intervention needed');
      analysis.recommendations.push('Consider nutrition consult');
      analysis.recommendations.push('Evaluate for appetite stimulants');
      analysis.recommendations.push('Consider calorie-dense supplements');
    } else if (avgConsumption < 75) {
      analysis.alerts.push('Suboptimal meal consumption - monitor closely');
      analysis.recommendations.push('Evaluate food preferences');
      analysis.recommendations.push('Consider meal timing adjustments');
    }

    if (analysis.consumptionByMeal.breakfast < 50) {
      analysis.recommendations.push('Investigate low breakfast consumption - nausea? medication timing?');
    }

    return analysis;
  }

  private calculateMealTypeConsumption(orders: any[], mealType: string): number {
    const filtered = orders.filter(o => o.mealType === mealType);
    if (filtered.length === 0) return 0;
    return Math.round(filtered.reduce((sum, o) => sum + (o.consumptionPercent || 0), 0) / filtered.length);
  }

  // ==================== KITCHEN STATS ====================

  async getDashboardStats(hospitalId: string) {
    return this.getKitchenStats(hospitalId);
  }

  async getKitchenStats(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalOrders,
      pendingOrders,
      preparingOrders,
      deliveredOrders,
      activeDiets,
      specialDiets,
    ] = await Promise.all([
      prisma.mealOrder.count({
        where: { hospitalId, mealDate: { gte: today, lt: tomorrow } },
      }),
      prisma.mealOrder.count({
        where: { hospitalId, mealDate: { gte: today, lt: tomorrow }, status: 'PENDING' },
      }),
      prisma.mealOrder.count({
        where: { hospitalId, mealDate: { gte: today, lt: tomorrow }, status: 'PREPARING' },
      }),
      prisma.mealOrder.count({
        where: { hospitalId, mealDate: { gte: today, lt: tomorrow }, status: 'DELIVERED' },
      }),
      prisma.patientDiet.count({
        where: { hospitalId, status: 'ACTIVE' },
      }),
      prisma.patientDiet.count({
        where: {
          hospitalId,
          status: 'ACTIVE',
          dietPlan: { category: { notIn: ['REGULAR'] } },
        },
      }),
    ]);

    return {
      todayOrders: {
        total: totalOrders,
        pending: pendingOrders,
        preparing: preparingOrders,
        delivered: deliveredOrders,
      },
      activeDiets,
      specialDiets,
    };
  }
}

export const dietaryService = new DietaryService();
