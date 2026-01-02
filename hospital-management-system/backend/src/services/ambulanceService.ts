import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Ambulance type capabilities
const AMBULANCE_CAPABILITIES: Record<string, string[]> = {
  BASIC_LIFE_SUPPORT: ['First Aid', 'Oxygen', 'Basic Monitoring', 'CPR'],
  ADVANCED_LIFE_SUPPORT: ['Advanced Airway', 'Cardiac Monitor', 'Defibrillator', 'IV Medications', 'Ventilator'],
  PATIENT_TRANSPORT: ['Wheelchair', 'Stretcher', 'Basic Monitoring'],
  NEONATAL: ['Incubator', 'Neonatal Ventilator', 'Warmer', 'Specialized Monitors'],
  BARIATRIC: ['Heavy-duty Stretcher', 'Ramp', 'Reinforced Equipment'],
  AIR_AMBULANCE: ['All ALS Equipment', 'Long-range Transport', 'Helipad Access'],
};

// Response time targets (minutes)
const RESPONSE_TARGETS: Record<string, number> = {
  EMERGENCY: 8,
  URGENT: 15,
  ROUTINE: 30,
  SCHEDULED: 60,
};

class AmbulanceService {
  // ==================== FLEET MANAGEMENT ====================

  async addAmbulance(hospitalId: string, data: any) {
    return prisma.ambulance.create({
      data: {
        hospitalId,
        vehicleNumber: data.vehicleNumber,
        vehicleType: data.vehicleType,
        make: data.make,
        model: data.model,
        year: data.year,
        equipmentList: data.equipmentList || AMBULANCE_CAPABILITIES[data.vehicleType] || [],
        hasVentilator: data.hasVentilator || false,
        hasDefibrillator: data.hasDefibrillator || false,
        hasOxygenSupply: data.hasOxygenSupply ?? true,
        driverId: data.driverId,
        paramedicId: data.paramedicId,
        lastServiceDate: data.lastServiceDate ? new Date(data.lastServiceDate) : null,
        nextServiceDate: data.nextServiceDate ? new Date(data.nextServiceDate) : null,
        mileage: data.mileage,
        fuelLevel: data.fuelLevel,
      },
    });
  }

  async getAmbulances(hospitalId: string, status?: string) {
    const where: any = { hospitalId, isActive: true };
    if (status) where.status = status;

    return prisma.ambulance.findMany({
      where,
      orderBy: { vehicleNumber: 'asc' },
    });
  }

  async getAmbulanceById(id: string) {
    return prisma.ambulance.findUnique({
      where: { id },
      include: {
        trips: {
          orderBy: { requestedAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async updateAmbulanceStatus(id: string, status: string, location?: { lat: number; lng: number }) {
    const data: any = {
      status,
      lastLocationUpdate: new Date(),
    };

    if (location) {
      data.lastLatitude = location.lat;
      data.lastLongitude = location.lng;
    }

    return prisma.ambulance.update({ where: { id }, data });
  }

  async updateAmbulanceLocation(id: string, lat: number, lng: number, currentLocation?: string) {
    return prisma.ambulance.update({
      where: { id },
      data: {
        lastLatitude: lat,
        lastLongitude: lng,
        currentLocation,
        lastLocationUpdate: new Date(),
      },
    });
  }

  // ==================== TRIP MANAGEMENT ====================

  async createTrip(hospitalId: string, data: any) {
    const tripNumber = `TRIP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    // AI: Find optimal ambulance
    const recommendation = await this.findOptimalAmbulance(hospitalId, data);

    const trip = await prisma.ambulanceTrip.create({
      data: {
        hospitalId,
        tripNumber,
        ambulanceId: data.ambulanceId || recommendation.recommendedAmbulance?.id,
        requestType: data.requestType,
        priority: data.priority,
        requestedAt: new Date(),
        requestedBy: data.requestedBy,
        patientName: data.patientName,
        patientAge: data.patientAge,
        patientGender: data.patientGender,
        patientCondition: data.patientCondition,
        pickupAddress: data.pickupAddress,
        pickupLatitude: data.pickupLatitude,
        pickupLongitude: data.pickupLongitude,
        pickupContact: data.pickupContact,
        destinationAddress: data.destinationAddress,
        destinationLatitude: data.destinationLatitude,
        destinationLongitude: data.destinationLongitude,
        aiOptimalRoute: recommendation.routeInfo,
        aiEstimatedTime: recommendation.estimatedTime,
      },
    });

    return { trip, recommendation };
  }

  async getTrips(hospitalId: string, params: any) {
    const { page = 1, limit = 20, status, priority, date, ambulanceId } = params;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (ambulanceId) where.ambulanceId = ambulanceId;
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.requestedAt = { gte: startOfDay, lte: endOfDay };
    }

    const [trips, total] = await Promise.all([
      prisma.ambulanceTrip.findMany({
        where,
        skip,
        take: limit,
        orderBy: { requestedAt: 'desc' },
        include: { ambulance: true },
      }),
      prisma.ambulanceTrip.count({ where }),
    ]);

    return { trips, total, page, limit };
  }

  async dispatchAmbulance(tripId: string, data: any) {
    const trip = await prisma.ambulanceTrip.update({
      where: { id: tripId },
      data: {
        ambulanceId: data.ambulanceId,
        driverId: data.driverId,
        paramedicIds: data.paramedicIds || [],
        dispatchedAt: new Date(),
        status: 'DISPATCHED',
      },
    });

    // Update ambulance status
    await prisma.ambulance.update({
      where: { id: data.ambulanceId },
      data: { status: 'ON_CALL' },
    });

    return trip;
  }

  async updateTripStatus(tripId: string, status: string, data?: any) {
    const updateData: any = { status };

    switch (status) {
      case 'EN_ROUTE_TO_PICKUP':
        updateData.dispatchedAt = updateData.dispatchedAt || new Date();
        break;
      case 'AT_PICKUP':
        updateData.arrivedAtScene = new Date();
        break;
      case 'EN_ROUTE_TO_DESTINATION':
        updateData.departedScene = new Date();
        break;
      case 'AT_DESTINATION':
        updateData.arrivedAtDestination = new Date();
        break;
      case 'COMPLETED':
        updateData.completedAt = new Date();
        if (data) {
          updateData.distanceKm = data.distanceKm;
          updateData.durationMinutes = data.durationMinutes;
          updateData.treatmentProvided = data.treatmentProvided;
          updateData.medicationsGiven = data.medicationsGiven || [];
          updateData.vitalsRecorded = data.vitalsRecorded;
          updateData.chargeAmount = data.chargeAmount;
        }
        break;
      case 'CANCELLED':
        updateData.cancellationReason = data?.reason;
        break;
    }

    const trip = await prisma.ambulanceTrip.update({
      where: { id: tripId },
      data: updateData,
    });

    // Update ambulance status when trip completes
    if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'NO_PATIENT') {
      await prisma.ambulance.update({
        where: { id: trip.ambulanceId },
        data: { status: 'AVAILABLE' },
      });
    } else if (status === 'EN_ROUTE_TO_PICKUP') {
      await prisma.ambulance.update({
        where: { id: trip.ambulanceId },
        data: { status: 'EN_ROUTE_TO_SCENE' },
      });
    } else if (status === 'AT_PICKUP') {
      await prisma.ambulance.update({
        where: { id: trip.ambulanceId },
        data: { status: 'AT_SCENE' },
      });
    } else if (status === 'EN_ROUTE_TO_DESTINATION') {
      await prisma.ambulance.update({
        where: { id: trip.ambulanceId },
        data: { status: 'EN_ROUTE_TO_HOSPITAL' },
      });
    }

    return trip;
  }

  // ==================== AI FEATURES ====================

  // AI: Find optimal ambulance
  async findOptimalAmbulance(hospitalId: string, request: any): Promise<{
    recommendedAmbulance: any;
    alternatives: any[];
    estimatedTime: number;
    routeInfo: any;
    reasoning: string[];
  }> {
    const availableAmbulances = await prisma.ambulance.findMany({
      where: {
        hospitalId,
        isActive: true,
        status: 'AVAILABLE',
      },
    });

    if (availableAmbulances.length === 0) {
      return {
        recommendedAmbulance: null,
        alternatives: [],
        estimatedTime: 0,
        routeInfo: null,
        reasoning: ['No ambulances currently available'],
      };
    }

    const reasoning: string[] = [];
    const scored: { ambulance: any; score: number; eta: number }[] = [];

    for (const ambulance of availableAmbulances) {
      let score = 100;
      let eta = 15; // Default ETA in minutes

      // Check vehicle type suitability
      if (request.patientCondition) {
        const condition = request.patientCondition.toLowerCase();

        if (condition.includes('cardiac') || condition.includes('stroke') || condition.includes('trauma')) {
          if (ambulance.vehicleType === 'ADVANCED_LIFE_SUPPORT') {
            score += 30;
          } else if (ambulance.vehicleType === 'BASIC_LIFE_SUPPORT') {
            score -= 20;
          }
        }

        if (condition.includes('neonatal') || condition.includes('infant') || condition.includes('newborn')) {
          if (ambulance.vehicleType === 'NEONATAL') {
            score += 50;
          } else {
            score -= 30;
          }
        }

        if (condition.includes('obese') || condition.includes('bariatric')) {
          if (ambulance.vehicleType === 'BARIATRIC') {
            score += 50;
          } else {
            score -= 20;
          }
        }
      }

      // Priority matching
      if (request.priority === 'EMERGENCY') {
        if (ambulance.hasDefibrillator && ambulance.hasVentilator) {
          score += 20;
        }
      }

      // Calculate ETA based on location
      if (ambulance.lastLatitude && ambulance.lastLongitude && request.pickupLatitude && request.pickupLongitude) {
        const distance = this.calculateDistance(
          Number(ambulance.lastLatitude),
          Number(ambulance.lastLongitude),
          Number(request.pickupLatitude),
          Number(request.pickupLongitude)
        );
        eta = Math.round(distance * 2); // Rough estimate: 2 min per km
        score -= eta; // Closer is better
      }

      // Fuel level consideration
      if (ambulance.fuelLevel && ambulance.fuelLevel < 25) {
        score -= 30;
      }

      scored.push({ ambulance, score, eta });
    }

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    reasoning.push(`Selected ${best.ambulance.vehicleNumber} (${best.ambulance.vehicleType})`);
    reasoning.push(`Estimated arrival: ${best.eta} minutes`);

    if (best.ambulance.hasDefibrillator) reasoning.push('Equipped with defibrillator');
    if (best.ambulance.hasVentilator) reasoning.push('Equipped with ventilator');

    return {
      recommendedAmbulance: best.ambulance,
      alternatives: scored.slice(1, 4).map((s) => ({
        ambulance: s.ambulance,
        eta: s.eta,
      })),
      estimatedTime: best.eta,
      routeInfo: {
        estimatedDistance: best.eta / 2, // Approximate
        trafficCondition: 'Normal',
      },
      reasoning,
    };
  }

  // AI: Optimize dispatch
  optimizeDispatch(params: {
    pendingRequests: any[];
    availableAmbulances: any[];
    currentTime: Date;
  }): {
    assignments: { requestId: string; ambulanceId: string; estimatedArrival: number; priority: string }[];
    unassigned: { requestId: string; reason: string }[];
    recommendations: string[];
  } {
    const { pendingRequests, availableAmbulances } = params;
    const assignments: any[] = [];
    const unassigned: any[] = [];
    const recommendations: string[] = [];

    // Sort requests by priority
    const priorityOrder: Record<string, number> = {
      EMERGENCY: 0,
      URGENT: 1,
      ROUTINE: 2,
      SCHEDULED: 3,
    };

    const sortedRequests = [...pendingRequests].sort(
      (a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3)
    );

    const assignedAmbulances = new Set<string>();

    for (const request of sortedRequests) {
      const available = availableAmbulances.filter((a: any) => !assignedAmbulances.has(a.id));

      if (available.length === 0) {
        unassigned.push({
          requestId: request.id,
          reason: 'No available ambulances',
        });
        continue;
      }

      // Find best match
      let bestMatch: any = null;
      let bestEta = Infinity;

      for (const ambulance of available) {
        const eta = this.estimateArrivalTime(ambulance, request);

        // Check capability match
        let capable = true;
        if (request.requiresALS && ambulance.vehicleType !== 'ADVANCED_LIFE_SUPPORT') {
          capable = false;
        }

        if (capable && eta < bestEta) {
          bestEta = eta;
          bestMatch = ambulance;
        }
      }

      if (bestMatch) {
        assignments.push({
          requestId: request.id,
          ambulanceId: bestMatch.id,
          estimatedArrival: bestEta,
          priority: request.priority,
        });
        assignedAmbulances.add(bestMatch.id);
      } else {
        unassigned.push({
          requestId: request.id,
          reason: 'No suitable ambulance available',
        });
      }
    }

    // Generate recommendations
    if (unassigned.length > 0) {
      recommendations.push(`${unassigned.length} requests could not be assigned - consider mutual aid`);
    }

    const emergencyUnassigned = unassigned.filter(
      (u) => pendingRequests.find((r: any) => r.id === u.requestId)?.priority === 'EMERGENCY'
    );
    if (emergencyUnassigned.length > 0) {
      recommendations.push('CRITICAL: Emergency requests unassigned - escalate immediately');
    }

    return { assignments, unassigned, recommendations };
  }

  // AI: Predict response time
  predictResponseTime(params: {
    pickupLocation: { lat: number; lng: number };
    priority: string;
    timeOfDay: number; // 0-23
    dayOfWeek: number; // 0-6
    weatherCondition?: string;
  }): {
    predictedMinutes: number;
    confidence: number;
    factors: { factor: string; impact: string }[];
    targetMet: boolean;
    target: number;
  } {
    const { priority, timeOfDay, dayOfWeek, weatherCondition = 'clear' } = params;

    let baseTime = 12; // Base response time in minutes
    const factors: { factor: string; impact: string }[] = [];

    // Time of day impact
    if (timeOfDay >= 7 && timeOfDay <= 9) {
      baseTime *= 1.4;
      factors.push({ factor: 'Morning rush hour', impact: '+40%' });
    } else if (timeOfDay >= 17 && timeOfDay <= 19) {
      baseTime *= 1.5;
      factors.push({ factor: 'Evening rush hour', impact: '+50%' });
    } else if (timeOfDay >= 22 || timeOfDay <= 5) {
      baseTime *= 0.8;
      factors.push({ factor: 'Night time (less traffic)', impact: '-20%' });
    }

    // Day of week impact
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      baseTime *= 0.9;
      factors.push({ factor: 'Weekend', impact: '-10%' });
    }

    // Weather impact
    if (weatherCondition === 'rain') {
      baseTime *= 1.3;
      factors.push({ factor: 'Rainy conditions', impact: '+30%' });
    } else if (weatherCondition === 'snow' || weatherCondition === 'fog') {
      baseTime *= 1.5;
      factors.push({ factor: 'Adverse weather', impact: '+50%' });
    }

    const predictedMinutes = Math.round(baseTime);
    const target = RESPONSE_TARGETS[priority] || 30;
    const targetMet = predictedMinutes <= target;

    return {
      predictedMinutes,
      confidence: 0.85,
      factors,
      targetMet,
      target,
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private estimateArrivalTime(ambulance: any, request: any): number {
    if (ambulance.lastLatitude && ambulance.lastLongitude && request.pickupLatitude && request.pickupLongitude) {
      const distance = this.calculateDistance(
        Number(ambulance.lastLatitude),
        Number(ambulance.lastLongitude),
        Number(request.pickupLatitude),
        Number(request.pickupLongitude)
      );
      return Math.round(distance * 2.5); // 2.5 min per km average
    }
    return 15; // Default estimate
  }

  // ==================== STATISTICS ====================

  async getAmbulanceStats(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalAmbulances,
      available,
      onCall,
      outOfService,
      todayTrips,
      completedTrips,
      emergencyTrips,
      avgResponseTime,
    ] = await Promise.all([
      prisma.ambulance.count({ where: { hospitalId, isActive: true } }),
      prisma.ambulance.count({ where: { hospitalId, status: 'AVAILABLE', isActive: true } }),
      prisma.ambulance.count({
        where: {
          hospitalId,
          isActive: true,
          status: { in: ['ON_CALL', 'EN_ROUTE_TO_SCENE', 'AT_SCENE', 'EN_ROUTE_TO_HOSPITAL'] },
        },
      }),
      prisma.ambulance.count({ where: { hospitalId, status: 'OUT_OF_SERVICE' } }),
      prisma.ambulanceTrip.count({
        where: { hospitalId, requestedAt: { gte: today } },
      }),
      prisma.ambulanceTrip.count({
        where: { hospitalId, requestedAt: { gte: today }, status: 'COMPLETED' },
      }),
      prisma.ambulanceTrip.count({
        where: { hospitalId, requestedAt: { gte: today }, priority: 'EMERGENCY' },
      }),
      prisma.ambulanceTrip.aggregate({
        where: {
          hospitalId,
          requestedAt: { gte: today },
          status: 'COMPLETED',
          arrivedAtScene: { not: null },
        },
        _avg: { durationMinutes: true },
      }),
    ]);

    return {
      fleet: {
        total: totalAmbulances,
        available,
        onCall,
        outOfService,
      },
      todayStats: {
        totalTrips: todayTrips,
        completed: completedTrips,
        emergency: emergencyTrips,
        avgResponseTime: avgResponseTime._avg.durationMinutes || 0,
      },
    };
  }
}

export const ambulanceService = new AmbulanceService();
