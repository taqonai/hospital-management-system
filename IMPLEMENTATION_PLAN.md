# HMS Implementation Plan - Feature Completion Roadmap

This document outlines the implementation plan for completing the Hospital Management System with AI features, organized by priority.

---

## Table of Contents

1. [High Priority](#high-priority)
2. [Medium Priority](#medium-priority)
3. [Low Priority](#low-priority)
4. [Implementation Patterns](#implementation-patterns)

---

## HIGH PRIORITY

### 1. Complete Smart Orders API Endpoints

**Status:** Placeholder endpoints return hardcoded responses
**Effort:** 2-3 days
**Dependencies:** None

#### 1.1 Backend Implementation

**Files to modify:**
- `backend/src/services/smartOrderService.ts` (create new)
- `backend/src/routes/smartOrderRoutes.ts` (modify)

**Database Schema Addition:**
```prisma
// Add to schema.prisma
model SmartOrder {
  id            String   @id @default(uuid())
  hospitalId    String
  hospital      Hospital @relation(fields: [hospitalId], references: [id])
  patientId     String
  patient       Patient  @relation(fields: [patientId], references: [id])
  orderedById   String
  orderedBy     User     @relation(fields: [orderedById], references: [id])

  orderType     OrderType  // LAB, RADIOLOGY, MEDICATION, PROCEDURE
  orderCode     String
  orderName     String
  quantity      Int        @default(1)
  priority      String     @default("ROUTINE")
  status        OrderStatus @default(PENDING)

  aiRecommended Boolean    @default(false)
  aiConfidence  Float?
  aiReasoning   String?
  bundleId      String?

  notes         String?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([hospitalId, patientId])
  @@index([hospitalId, status])
}

enum OrderType {
  LAB
  RADIOLOGY
  MEDICATION
  PROCEDURE
  REFERRAL
}

enum OrderStatus {
  PENDING
  APPROVED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}
```

**Service Implementation:**
```typescript
// backend/src/services/smartOrderService.ts
import { prisma } from '../config/database';
import axios from 'axios';

class SmartOrderService {
  private aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

  // Place orders for a patient
  async placeOrders(hospitalId: string, data: PlaceOrdersInput) {
    const { patientId, orders, orderedById } = data;

    const createdOrders = await prisma.$transaction(
      orders.map(order =>
        prisma.smartOrder.create({
          data: {
            hospitalId,
            patientId,
            orderedById,
            orderType: order.type,
            orderCode: order.code,
            orderName: order.name,
            quantity: order.quantity || 1,
            priority: order.priority || 'ROUTINE',
            aiRecommended: order.aiRecommended || false,
            aiConfidence: order.aiConfidence,
            aiReasoning: order.aiReasoning,
            bundleId: order.bundleId,
            notes: order.notes
          }
        })
      )
    );

    return createdOrders;
  }

  // Get order history for a patient
  async getOrderHistory(hospitalId: string, patientId: string, options?: OrderHistoryOptions) {
    const { page = 1, limit = 20, status, orderType, startDate, endDate } = options || {};

    const where = {
      hospitalId,
      patientId,
      ...(status && { status }),
      ...(orderType && { orderType }),
      ...(startDate && endDate && {
        createdAt: { gte: startDate, lte: endDate }
      })
    };

    const [orders, total] = await Promise.all([
      prisma.smartOrder.findMany({
        where,
        include: {
          patient: { select: { firstName: true, lastName: true } },
          orderedBy: { select: { firstName: true, lastName: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.smartOrder.count({ where })
    ]);

    return { orders, total, page, limit };
  }

  // Update order status
  async updateOrderStatus(hospitalId: string, orderId: string, status: OrderStatus) {
    return prisma.smartOrder.update({
      where: { id: orderId, hospitalId },
      data: { status }
    });
  }

  // Get AI recommendations (proxy to AI service)
  async getRecommendations(hospitalId: string, patientContext: PatientContext) {
    try {
      const response = await axios.post(
        `${this.aiServiceUrl}/api/smart-orders/recommend`,
        patientContext
      );
      return response.data;
    } catch (error) {
      console.error('AI recommendation failed:', error);
      return { recommendations: [], bundles: [] };
    }
  }
}

export const smartOrderService = new SmartOrderService();
```

**Routes Update:**
```typescript
// Add to smartOrderRoutes.ts
router.post('/place',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req, res) => {
    const orders = await smartOrderService.placeOrders(
      req.user!.hospitalId,
      { ...req.body, orderedById: req.user!.id }
    );
    sendCreated(res, orders, 'Orders placed successfully');
  })
);

router.get('/history/:patientId',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN', 'RECEPTIONIST'),
  asyncHandler(async (req, res) => {
    const result = await smartOrderService.getOrderHistory(
      req.user!.hospitalId,
      req.params.patientId,
      req.query
    );
    sendPaginated(res, result.orders, {
      page: result.page,
      limit: result.limit,
      total: result.total
    });
  })
);

router.patch('/:orderId/status',
  authenticate,
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req, res) => {
    const order = await smartOrderService.updateOrderStatus(
      req.user!.hospitalId,
      req.params.orderId,
      req.body.status
    );
    sendSuccess(res, order, 'Order status updated');
  })
);
```

#### 1.2 AI Service Update

**File:** `ai-services/main.py`

Replace placeholder endpoints (lines ~1733-1758):
```python
@app.post("/api/smart-orders/place")
async def place_smart_orders(request: PlaceOrdersRequest):
    """Place orders - validation and enrichment before backend storage"""
    enriched_orders = []
    for order in request.orders:
        # Validate order against clinical guidelines
        validation = smart_orders_ai.validate_order(
            order.dict(),
            request.patient_context
        )
        enriched_orders.append({
            **order.dict(),
            "validation": validation,
            "clinicalNotes": smart_orders_ai.generate_clinical_notes(order)
        })
    return {"orders": enriched_orders, "status": "validated"}

@app.get("/api/smart-orders/history/{patient_id}")
async def get_order_history_analytics(patient_id: str):
    """Get order history with AI analytics"""
    # This endpoint provides AI insights on ordering patterns
    # Actual history is stored in backend
    return {
        "patientId": patient_id,
        "insights": {
            "orderingPatterns": [],
            "recommendations": [],
            "alerts": []
        }
    }
```

---

### 2. Quality Management Frontend Dashboard

**Status:** No frontend page exists
**Effort:** 3-4 days
**Dependencies:** Backend quality routes (already exist)

#### 2.1 Create Quality Dashboard Page

**Files to create:**
- `frontend/src/pages/Quality/index.tsx`
- `frontend/src/pages/Quality/components/QualityIndicators.tsx`
- `frontend/src/pages/Quality/components/IncidentReporting.tsx`
- `frontend/src/pages/Quality/components/AuditTracker.tsx`
- `frontend/src/pages/Quality/components/TrendChart.tsx`

**Main Page Structure:**
```typescript
// frontend/src/pages/Quality/index.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentCheckIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import { qualityApi } from '../../services/api';
import QualityIndicators from './components/QualityIndicators';
import IncidentReporting from './components/IncidentReporting';
import AuditTracker from './components/AuditTracker';
import TrendChart from './components/TrendChart';

type TabType = 'dashboard' | 'indicators' | 'incidents' | 'audits';

export default function QualityManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const queryClient = useQueryClient();

  // Fetch quality metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['quality-metrics'],
    queryFn: () => qualityApi.getMetrics()
  });

  // Fetch indicators
  const { data: indicators } = useQuery({
    queryKey: ['quality-indicators'],
    queryFn: () => qualityApi.getIndicators()
  });

  // Fetch recent incidents
  const { data: incidents } = useQuery({
    queryKey: ['quality-incidents'],
    queryFn: () => qualityApi.getIncidents({ limit: 10 })
  });

  // Fetch audits
  const { data: audits } = useQuery({
    queryKey: ['quality-audits'],
    queryFn: () => qualityApi.getAudits({ limit: 10 })
  });

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: ChartBarIcon },
    { id: 'indicators', name: 'Indicators', icon: ArrowTrendingUpIcon },
    { id: 'incidents', name: 'Incidents', icon: ExclamationTriangleIcon },
    { id: 'audits', name: 'Audits', icon: ClipboardDocumentCheckIcon },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Quality Management</h1>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-5 h-5 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <DashboardView metrics={metrics} indicators={indicators} />
      )}
      {activeTab === 'indicators' && (
        <QualityIndicators indicators={indicators} />
      )}
      {activeTab === 'incidents' && (
        <IncidentReporting incidents={incidents} />
      )}
      {activeTab === 'audits' && (
        <AuditTracker audits={audits} />
      )}
    </div>
  );
}

function DashboardView({ metrics, indicators }) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Patient Safety Score"
          value={metrics?.safetyScore || 0}
          target={95}
          unit="%"
        />
        <MetricCard
          title="Infection Rate"
          value={metrics?.infectionRate || 0}
          target={2}
          unit="%"
          inverse
        />
        <MetricCard
          title="Readmission Rate"
          value={metrics?.readmissionRate || 0}
          target={5}
          unit="%"
          inverse
        />
        <MetricCard
          title="Patient Satisfaction"
          value={metrics?.satisfactionScore || 0}
          target={90}
          unit="%"
        />
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TrendChart
          title="Quality Trends (30 Days)"
          data={metrics?.trends || []}
        />
        <TrendChart
          title="Incident Trends"
          data={metrics?.incidentTrends || []}
        />
      </div>
    </div>
  );
}
```

#### 2.2 Add API Client Methods

**File:** `frontend/src/services/api.ts`

```typescript
// Add to api.ts
export const qualityApi = {
  // Metrics
  getMetrics: () => api.get('/quality/metrics').then(r => r.data),

  // Indicators
  getIndicators: (params?: any) => api.get('/quality/indicators', { params }).then(r => r.data),
  createIndicator: (data: any) => api.post('/quality/indicators', data).then(r => r.data),
  updateIndicator: (id: string, data: any) => api.patch(`/quality/indicators/${id}`, data).then(r => r.data),
  deleteIndicator: (id: string) => api.delete(`/quality/indicators/${id}`).then(r => r.data),

  // Measurements
  recordMeasurement: (indicatorId: string, data: any) =>
    api.post(`/quality/indicators/${indicatorId}/measurements`, data).then(r => r.data),
  getMeasurementTrend: (indicatorId: string, params?: any) =>
    api.get(`/quality/indicators/${indicatorId}/trend`, { params }).then(r => r.data),

  // Incidents
  getIncidents: (params?: any) => api.get('/quality/incidents', { params }).then(r => r.data),
  createIncident: (data: any) => api.post('/quality/incidents', data).then(r => r.data),
  updateIncident: (id: string, data: any) => api.patch(`/quality/incidents/${id}`, data).then(r => r.data),

  // Audits
  getAudits: (params?: any) => api.get('/quality/audits', { params }).then(r => r.data),
  createAudit: (data: any) => api.post('/quality/audits', data).then(r => r.data),
  getAuditById: (id: string) => api.get(`/quality/audits/${id}`).then(r => r.data),

  // AI Analysis
  analyzeQualityTrends: (data: any) => api.post('/quality/ai/analyze-trends', data).then(r => r.data),
  getRootCauseAnalysis: (incidentId: string) =>
    api.post('/quality/ai/root-cause', { incidentId }).then(r => r.data),
};
```

#### 2.3 Add Route to App.tsx

```typescript
// Add to frontend/src/App.tsx routes
import Quality from './pages/Quality';

// In routes array:
{ path: '/quality', element: <Quality /> }
```

---

### 3. AI Microservices - EWS and Smart Orders

**Status:** Referenced but not implemented as separate services
**Effort:** 4-5 days
**Dependencies:** Docker configuration

#### 3.1 Early Warning System (EWS) Microservice

**Directory Structure:**
```
ai-services/
├── ews/
│   ├── __init__.py
│   ├── service.py
│   ├── knowledge_base.py
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
```

**Service Implementation:**
```python
# ai-services/ews/service.py
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import numpy as np

class EarlyWarningService:
    """
    Early Warning System for detecting patient deterioration.
    Uses NEWS2 (National Early Warning Score 2) as baseline.
    """

    # NEWS2 Score Parameters
    VITAL_RANGES = {
        'respiratory_rate': [
            (25, float('inf'), 3),   # >=25: 3 points
            (21, 24, 2),              # 21-24: 2 points
            (12, 20, 0),              # 12-20: 0 points (normal)
            (9, 11, 1),               # 9-11: 1 point
            (0, 8, 3),                # <=8: 3 points
        ],
        'oxygen_saturation': [
            (96, 100, 0),             # >=96: 0 points
            (94, 95, 1),              # 94-95: 1 point
            (92, 93, 2),              # 92-93: 2 points
            (0, 91, 3),               # <=91: 3 points
        ],
        'systolic_bp': [
            (220, float('inf'), 3),   # >=220: 3 points
            (111, 219, 0),            # 111-219: 0 points
            (101, 110, 1),            # 101-110: 1 point
            (91, 100, 2),             # 91-100: 2 points
            (0, 90, 3),               # <=90: 3 points
        ],
        'heart_rate': [
            (131, float('inf'), 3),   # >=131: 3 points
            (111, 130, 2),            # 111-130: 2 points
            (91, 110, 1),             # 91-110: 1 point
            (51, 90, 0),              # 51-90: 0 points
            (41, 50, 1),              # 41-50: 1 point
            (0, 40, 3),               # <=40: 3 points
        ],
        'temperature': [
            (39.1, float('inf'), 2),  # >=39.1: 2 points
            (38.1, 39.0, 1),          # 38.1-39.0: 1 point
            (36.1, 38.0, 0),          # 36.1-38.0: 0 points
            (35.1, 36.0, 1),          # 35.1-36.0: 1 point
            (0, 35.0, 3),             # <=35.0: 3 points
        ],
    }

    RISK_LEVELS = {
        (0, 0): ('LOW', 'Routine monitoring'),
        (1, 4): ('LOW_MEDIUM', 'Increase monitoring frequency'),
        (5, 6): ('MEDIUM', 'Urgent clinical review required'),
        (7, float('inf')): ('HIGH', 'Emergency response - immediate review'),
    }

    def calculate_news2_score(self, vitals: Dict) -> Dict:
        """Calculate NEWS2 score from vital signs."""
        total_score = 0
        component_scores = {}

        for vital, value in vitals.items():
            if vital in self.VITAL_RANGES and value is not None:
                score = self._get_vital_score(vital, value)
                component_scores[vital] = score
                total_score += score

        # Add consciousness score (AVPU)
        if 'consciousness' in vitals:
            avpu = vitals['consciousness'].upper()
            consciousness_score = 0 if avpu == 'A' else 3
            component_scores['consciousness'] = consciousness_score
            total_score += consciousness_score

        # Add supplemental oxygen score
        if vitals.get('on_supplemental_oxygen', False):
            component_scores['supplemental_oxygen'] = 2
            total_score += 2

        risk_level, action = self._get_risk_level(total_score)

        return {
            'totalScore': total_score,
            'componentScores': component_scores,
            'riskLevel': risk_level,
            'recommendedAction': action,
            'timestamp': datetime.utcnow().isoformat()
        }

    def _get_vital_score(self, vital: str, value: float) -> int:
        """Get score for a specific vital sign value."""
        ranges = self.VITAL_RANGES.get(vital, [])
        for low, high, score in ranges:
            if low <= value <= high:
                return score
        return 0

    def _get_risk_level(self, total_score: int) -> tuple:
        """Determine risk level based on total score."""
        for (low, high), (level, action) in self.RISK_LEVELS.items():
            if low <= total_score <= high:
                return level, action
        return 'HIGH', 'Immediate clinical review'

    def analyze_trend(self, vital_history: List[Dict]) -> Dict:
        """Analyze vital sign trends for deterioration patterns."""
        if len(vital_history) < 3:
            return {'trend': 'INSUFFICIENT_DATA', 'alerts': []}

        alerts = []
        trends = {}

        for vital in ['heart_rate', 'respiratory_rate', 'systolic_bp', 'temperature']:
            values = [v.get(vital) for v in vital_history if v.get(vital) is not None]
            if len(values) >= 3:
                trend = self._calculate_trend(values)
                trends[vital] = trend

                if trend['direction'] == 'DETERIORATING' and trend['rate'] > 10:
                    alerts.append({
                        'vital': vital,
                        'severity': 'WARNING',
                        'message': f'{vital} showing rapid deterioration',
                        'changeRate': trend['rate']
                    })

        return {
            'trends': trends,
            'alerts': alerts,
            'overallStatus': 'DETERIORATING' if alerts else 'STABLE'
        }

    def _calculate_trend(self, values: List[float]) -> Dict:
        """Calculate trend direction and rate of change."""
        if len(values) < 2:
            return {'direction': 'STABLE', 'rate': 0}

        # Simple linear regression
        x = np.arange(len(values))
        slope = np.polyfit(x, values, 1)[0]

        # Percentage change from first to last
        pct_change = ((values[-1] - values[0]) / values[0]) * 100 if values[0] != 0 else 0

        if slope > 0.5:
            direction = 'INCREASING'
        elif slope < -0.5:
            direction = 'DECREASING'
        else:
            direction = 'STABLE'

        return {
            'direction': direction,
            'rate': abs(pct_change),
            'slope': float(slope)
        }

    def predict_deterioration(self, patient_data: Dict) -> Dict:
        """
        Predict likelihood of patient deterioration in next 4-12 hours.
        Uses combination of current vitals, trends, and patient factors.
        """
        risk_factors = []
        risk_score = 0

        # Current NEWS2 score contribution
        current_news = self.calculate_news2_score(patient_data.get('currentVitals', {}))
        risk_score += current_news['totalScore'] * 5

        # Age factor
        age = patient_data.get('age', 50)
        if age > 70:
            risk_factors.append('Advanced age (>70)')
            risk_score += 10
        elif age > 60:
            risk_score += 5

        # Comorbidities
        comorbidities = patient_data.get('comorbidities', [])
        high_risk_conditions = ['COPD', 'heart_failure', 'diabetes', 'renal_disease']
        for condition in comorbidities:
            if condition.lower() in [c.lower() for c in high_risk_conditions]:
                risk_factors.append(f'High-risk comorbidity: {condition}')
                risk_score += 8

        # Recent deterioration trend
        trend_analysis = self.analyze_trend(patient_data.get('vitalHistory', []))
        if trend_analysis['overallStatus'] == 'DETERIORATING':
            risk_factors.append('Deteriorating vital signs trend')
            risk_score += 15

        # Normalize to 0-100
        normalized_score = min(100, risk_score)

        return {
            'deteriorationRisk': normalized_score,
            'riskLevel': 'HIGH' if normalized_score > 60 else 'MEDIUM' if normalized_score > 30 else 'LOW',
            'riskFactors': risk_factors,
            'currentNEWS2': current_news,
            'trendAnalysis': trend_analysis,
            'recommendations': self._get_recommendations(normalized_score, risk_factors)
        }

    def _get_recommendations(self, risk_score: float, risk_factors: List[str]) -> List[str]:
        """Generate clinical recommendations based on risk assessment."""
        recommendations = []

        if risk_score > 60:
            recommendations.extend([
                'Immediate senior clinician review',
                'Consider ICU consultation',
                'Continuous vital sign monitoring',
                'Prepare for potential rapid response'
            ])
        elif risk_score > 30:
            recommendations.extend([
                'Increase monitoring frequency to every 1-2 hours',
                'Clinical review within 30 minutes',
                'Review current treatment plan'
            ])
        else:
            recommendations.append('Continue routine monitoring as per protocol')

        return recommendations

# Instantiate service
ews_service = EarlyWarningService()
```

**FastAPI Entry Point:**
```python
# ai-services/ews/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from service import ews_service

app = FastAPI(title="Early Warning System API", version="1.0.0")

class VitalsInput(BaseModel):
    respiratory_rate: Optional[float] = None
    oxygen_saturation: Optional[float] = None
    systolic_bp: Optional[float] = None
    heart_rate: Optional[float] = None
    temperature: Optional[float] = None
    consciousness: Optional[str] = "A"
    on_supplemental_oxygen: bool = False

class PatientDataInput(BaseModel):
    patientId: str
    age: int
    currentVitals: VitalsInput
    vitalHistory: Optional[List[Dict]] = []
    comorbidities: Optional[List[str]] = []

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ews"}

@app.post("/api/ews/calculate")
async def calculate_ews(vitals: VitalsInput):
    """Calculate NEWS2 score from vital signs."""
    return ews_service.calculate_news2_score(vitals.dict())

@app.post("/api/ews/predict")
async def predict_deterioration(patient_data: PatientDataInput):
    """Predict patient deterioration risk."""
    return ews_service.predict_deterioration(patient_data.dict())

@app.post("/api/ews/analyze-trend")
async def analyze_vital_trends(vital_history: List[Dict]):
    """Analyze vital sign trends."""
    return ews_service.analyze_trend(vital_history)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8012)
```

**Dockerfile:**
```dockerfile
# ai-services/ews/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8012

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8012"]
```

**Requirements:**
```
# ai-services/ews/requirements.txt
fastapi==0.108.0
uvicorn[standard]==0.25.0
pydantic==2.5.3
numpy==1.26.2
```

#### 3.2 Docker Compose Update

Add to `docker-compose.yml`:
```yaml
  ews-service:
    build:
      context: ./ai-services/ews
      dockerfile: Dockerfile
    container_name: hms-ews
    ports:
      - "8012:8012"
    environment:
      - PYTHONUNBUFFERED=1
    networks:
      - hms-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8012/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  smart-orders-service:
    build:
      context: ./ai-services/smart_orders
      dockerfile: Dockerfile
    container_name: hms-smart-orders
    ports:
      - "8013:8013"
    environment:
      - PYTHONUNBUFFERED=1
    networks:
      - hms-network
```

---

### 4. Complete AI Scribe Database Persistence

**Status:** Notes only logged, not fully persisted
**Effort:** 2 days
**Dependencies:** None

#### 4.1 Update AI Scribe Service

**File:** `backend/src/services/aiScribeService.ts`

```typescript
// Add to aiScribeService.ts

interface SaveNoteInput {
  sessionId: string;
  patientId: string;
  consultationId?: string;
  appointmentId?: string;
  noteType: 'SOAP' | 'PROGRESS' | 'PROCEDURE' | 'DISCHARGE';
  content: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    fullText?: string;
  };
  extractedEntities?: {
    symptoms?: string[];
    diagnoses?: string[];
    medications?: string[];
    procedures?: string[];
  };
  icdCodes?: string[];
  cptCodes?: string[];
  transcriptId?: string;
}

async saveGeneratedNote(hospitalId: string, userId: string, input: SaveNoteInput) {
  const {
    sessionId,
    patientId,
    consultationId,
    appointmentId,
    noteType,
    content,
    extractedEntities,
    icdCodes,
    cptCodes,
    transcriptId
  } = input;

  // Start transaction for data integrity
  return prisma.$transaction(async (tx) => {
    // 1. Create or update clinical note
    const clinicalNote = await tx.clinicalNote.create({
      data: {
        hospitalId,
        patientId,
        authorId: userId,
        consultationId,
        appointmentId,
        noteType,
        subjective: content.subjective,
        objective: content.objective,
        assessment: content.assessment,
        plan: content.plan,
        fullText: content.fullText || this.composeFullText(content),
        status: 'DRAFT',
        aiGenerated: true,
        aiSessionId: sessionId,
        transcriptId
      }
    });

    // 2. Save extracted diagnoses
    if (extractedEntities?.diagnoses?.length) {
      await tx.noteDiagnosis.createMany({
        data: extractedEntities.diagnoses.map((diagnosis, index) => ({
          noteId: clinicalNote.id,
          diagnosis,
          isPrimary: index === 0,
          icdCode: icdCodes?.[index]
        }))
      });
    }

    // 3. Save extracted medications as prescriptions if consultation exists
    if (consultationId && extractedEntities?.medications?.length) {
      for (const medication of extractedEntities.medications) {
        await tx.prescription.create({
          data: {
            hospitalId,
            patientId,
            consultationId,
            prescribedById: userId,
            drugName: medication,
            status: 'DRAFT',
            aiExtracted: true,
            sourceNoteId: clinicalNote.id
          }
        });
      }
    }

    // 4. Create audit trail
    await tx.auditLog.create({
      data: {
        hospitalId,
        userId,
        action: 'AI_NOTE_GENERATED',
        entityType: 'ClinicalNote',
        entityId: clinicalNote.id,
        details: {
          sessionId,
          noteType,
          icdCodes,
          cptCodes,
          entitiesExtracted: extractedEntities
        }
      }
    });

    // 5. Update scribe session status
    await tx.aiScribeSession.update({
      where: { id: sessionId },
      data: {
        status: 'NOTE_GENERATED',
        noteId: clinicalNote.id,
        completedAt: new Date()
      }
    });

    return {
      note: clinicalNote,
      sessionId,
      status: 'saved'
    };
  });
}

private composeFullText(content: any): string {
  const sections = [];
  if (content.subjective) sections.push(`SUBJECTIVE:\n${content.subjective}`);
  if (content.objective) sections.push(`OBJECTIVE:\n${content.objective}`);
  if (content.assessment) sections.push(`ASSESSMENT:\n${content.assessment}`);
  if (content.plan) sections.push(`PLAN:\n${content.plan}`);
  return sections.join('\n\n');
}
```

#### 4.2 Add Database Models

Add to `schema.prisma`:
```prisma
model ClinicalNote {
  id            String   @id @default(uuid())
  hospitalId    String
  hospital      Hospital @relation(fields: [hospitalId], references: [id])
  patientId     String
  patient       Patient  @relation(fields: [patientId], references: [id])
  authorId      String
  author        User     @relation(fields: [authorId], references: [id])

  consultationId String?
  appointmentId  String?

  noteType      NoteType
  subjective    String?  @db.Text
  objective     String?  @db.Text
  assessment    String?  @db.Text
  plan          String?  @db.Text
  fullText      String?  @db.Text

  status        NoteStatus @default(DRAFT)

  aiGenerated   Boolean  @default(false)
  aiSessionId   String?
  transcriptId  String?

  signedAt      DateTime?
  signedById    String?

  diagnoses     NoteDiagnosis[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([hospitalId, patientId])
  @@index([hospitalId, authorId])
}

model NoteDiagnosis {
  id          String  @id @default(uuid())
  noteId      String
  note        ClinicalNote @relation(fields: [noteId], references: [id])
  diagnosis   String
  isPrimary   Boolean @default(false)
  icdCode     String?

  @@index([noteId])
}

model AiScribeSession {
  id            String   @id @default(uuid())
  hospitalId    String
  userId        String
  patientId     String?

  status        ScribeSessionStatus @default(ACTIVE)

  transcriptText String? @db.Text
  noteId        String?

  startedAt     DateTime @default(now())
  completedAt   DateTime?

  @@index([hospitalId, status])
}

enum NoteType {
  SOAP
  PROGRESS
  PROCEDURE
  DISCHARGE
  ADMISSION
  CONSULTATION
}

enum NoteStatus {
  DRAFT
  PENDING_REVIEW
  SIGNED
  AMENDED
}

enum ScribeSessionStatus {
  ACTIVE
  TRANSCRIBING
  GENERATING_NOTE
  NOTE_GENERATED
  COMPLETED
  CANCELLED
}
```

---

### 5. Patient Portal Dashboard

**Status:** Single line re-export
**Effort:** 4-5 days
**Dependencies:** Auth system for patient role

#### 5.1 Create Patient Portal Structure

**Directory:**
```
frontend/src/pages/PatientPortal/
├── index.tsx                    # Main dashboard
├── components/
│   ├── AppointmentsList.tsx     # View/manage appointments
│   ├── MedicalRecords.tsx       # View medical history
│   ├── Prescriptions.tsx        # View/request refills
│   ├── LabResults.tsx           # View lab results
│   ├── Messages.tsx             # Message providers
│   ├── BillingOverview.tsx      # View bills/payments
│   └── ProfileSettings.tsx      # Update profile
```

**Main Dashboard:**
```typescript
// frontend/src/pages/PatientPortal/index.tsx
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import {
  CalendarIcon,
  DocumentTextIcon,
  BeakerIcon,
  ChatBubbleLeftRightIcon,
  CreditCardIcon,
  UserCircleIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../services/api';
import AppointmentsList from './components/AppointmentsList';
import MedicalRecords from './components/MedicalRecords';
import Prescriptions from './components/Prescriptions';
import LabResults from './components/LabResults';
import Messages from './components/Messages';
import BillingOverview from './components/BillingOverview';
import SymptomChecker from '../SymptomChecker';

type PortalSection =
  | 'dashboard'
  | 'appointments'
  | 'records'
  | 'prescriptions'
  | 'labs'
  | 'messages'
  | 'billing'
  | 'symptom-checker';

export default function PatientPortal() {
  const [activeSection, setActiveSection] = useState<PortalSection>('dashboard');
  const user = useSelector((state: any) => state.auth.user);

  // Fetch patient summary
  const { data: summary, isLoading } = useQuery({
    queryKey: ['patient-summary'],
    queryFn: () => patientPortalApi.getSummary()
  });

  const navigation = [
    { id: 'dashboard', name: 'Dashboard', icon: HeartIcon },
    { id: 'appointments', name: 'Appointments', icon: CalendarIcon, count: summary?.upcomingAppointments },
    { id: 'records', name: 'Medical Records', icon: DocumentTextIcon },
    { id: 'prescriptions', name: 'Prescriptions', icon: DocumentTextIcon, count: summary?.activePrescriptions },
    { id: 'labs', name: 'Lab Results', icon: BeakerIcon, count: summary?.pendingLabs },
    { id: 'messages', name: 'Messages', icon: ChatBubbleLeftRightIcon, count: summary?.unreadMessages },
    { id: 'billing', name: 'Billing', icon: CreditCardIcon, count: summary?.pendingBills },
    { id: 'symptom-checker', name: 'Symptom Checker', icon: HeartIcon },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white shadow-sm">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Patient Portal</h2>
          <p className="text-sm text-gray-600">Welcome, {user?.firstName}</p>
        </div>
        <nav className="p-4 space-y-1">
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as PortalSection)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                activeSection === item.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center">
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </div>
              {item.count > 0 && (
                <span className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full text-xs">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {activeSection === 'dashboard' && <DashboardView summary={summary} />}
        {activeSection === 'appointments' && <AppointmentsList />}
        {activeSection === 'records' && <MedicalRecords />}
        {activeSection === 'prescriptions' && <Prescriptions />}
        {activeSection === 'labs' && <LabResults />}
        {activeSection === 'messages' && <Messages />}
        {activeSection === 'billing' && <BillingOverview />}
        {activeSection === 'symptom-checker' && <SymptomChecker />}
      </main>
    </div>
  );
}

function DashboardView({ summary }: { summary: any }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Your Health Dashboard</h1>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Next Appointment"
          value={summary?.nextAppointment?.date || 'None scheduled'}
          subtitle={summary?.nextAppointment?.doctor}
        />
        <StatCard
          title="Active Medications"
          value={summary?.activePrescriptions || 0}
        />
        <StatCard
          title="Pending Lab Results"
          value={summary?.pendingLabs || 0}
        />
        <StatCard
          title="Unread Messages"
          value={summary?.unreadMessages || 0}
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {summary?.recentActivity?.map((activity: any, index: number) => (
            <div key={index} className="flex items-center text-sm">
              <span className="w-24 text-gray-500">{activity.date}</span>
              <span>{activity.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Health Reminders */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">Health Reminders</h2>
        <ul className="space-y-2 text-blue-800">
          {summary?.reminders?.map((reminder: string, index: number) => (
            <li key={index} className="flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              {reminder}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

#### 5.2 Backend Routes for Patient Portal

**File:** `backend/src/routes/patientPortalRoutes.ts`

```typescript
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { patientPortalService } from '../services/patientPortalService';
import { sendSuccess, sendPaginated } from '../utils/response';

const router = Router();

// All routes require PATIENT role
router.use(authenticate, authorize('PATIENT'));

// Get patient summary/dashboard
router.get('/summary', asyncHandler(async (req, res) => {
  const summary = await patientPortalService.getPatientSummary(
    req.user!.hospitalId,
    req.user!.patientId // Linked patient ID
  );
  sendSuccess(res, summary);
}));

// Appointments
router.get('/appointments', asyncHandler(async (req, res) => {
  const appointments = await patientPortalService.getAppointments(
    req.user!.hospitalId,
    req.user!.patientId,
    req.query
  );
  sendPaginated(res, appointments.data, appointments.pagination);
}));

router.post('/appointments', asyncHandler(async (req, res) => {
  const appointment = await patientPortalService.bookAppointment(
    req.user!.hospitalId,
    req.user!.patientId,
    req.body
  );
  sendSuccess(res, appointment, 'Appointment booked successfully');
}));

router.patch('/appointments/:id/cancel', asyncHandler(async (req, res) => {
  await patientPortalService.cancelAppointment(
    req.user!.hospitalId,
    req.user!.patientId,
    req.params.id
  );
  sendSuccess(res, null, 'Appointment cancelled');
}));

// Medical Records
router.get('/records', asyncHandler(async (req, res) => {
  const records = await patientPortalService.getMedicalRecords(
    req.user!.hospitalId,
    req.user!.patientId,
    req.query
  );
  sendPaginated(res, records.data, records.pagination);
}));

// Prescriptions
router.get('/prescriptions', asyncHandler(async (req, res) => {
  const prescriptions = await patientPortalService.getPrescriptions(
    req.user!.hospitalId,
    req.user!.patientId,
    req.query
  );
  sendPaginated(res, prescriptions.data, prescriptions.pagination);
}));

router.post('/prescriptions/:id/refill', asyncHandler(async (req, res) => {
  const refillRequest = await patientPortalService.requestRefill(
    req.user!.hospitalId,
    req.user!.patientId,
    req.params.id
  );
  sendSuccess(res, refillRequest, 'Refill request submitted');
}));

// Lab Results
router.get('/labs', asyncHandler(async (req, res) => {
  const labs = await patientPortalService.getLabResults(
    req.user!.hospitalId,
    req.user!.patientId,
    req.query
  );
  sendPaginated(res, labs.data, labs.pagination);
}));

// Messages
router.get('/messages', asyncHandler(async (req, res) => {
  const messages = await patientPortalService.getMessages(
    req.user!.hospitalId,
    req.user!.patientId,
    req.query
  );
  sendPaginated(res, messages.data, messages.pagination);
}));

router.post('/messages', asyncHandler(async (req, res) => {
  const message = await patientPortalService.sendMessage(
    req.user!.hospitalId,
    req.user!.patientId,
    req.body
  );
  sendSuccess(res, message, 'Message sent');
}));

// Billing
router.get('/bills', asyncHandler(async (req, res) => {
  const bills = await patientPortalService.getBills(
    req.user!.hospitalId,
    req.user!.patientId,
    req.query
  );
  sendPaginated(res, bills.data, bills.pagination);
}));

export default router;
```

---

### 6. AI-Enhanced Consultation Flow

**Status:** Consultation exists but with minimal AI integration
**Effort:** 5-7 days
**Dependencies:** DiagnosticAI, PharmacyAI, EarlyWarningAI services

This is a comprehensive enhancement to integrate AI throughout the entire patient consultation workflow.

#### 6.1 Overview: AI Consultation Features

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI-ENHANCED CONSULTATION FLOW                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │ 1. PATIENT   │───▶│ 2. SYMPTOMS  │───▶│ 3. DIAGNOSIS │───▶│ 4. TREAT- │ │
│  │    INTAKE    │    │    & VITALS  │    │    & TESTS   │    │    MENT   │ │
│  └──────────────┘    └──────────────┘    └──────────────┘    └───────────┘ │
│        │                    │                   │                   │       │
│        ▼                    ▼                   ▼                   ▼       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │ • AI Patient │    │ • AI Vital   │    │ • AI Diag-   │    │ • AI Drug │ │
│  │   Summary    │    │   Interpre-  │    │   nosis      │    │   Inter-  │ │
│  │ • Risk Flags │    │   tation     │    │   Suggest    │    │   action  │ │
│  │ • Allergy    │    │ • EWS Score  │    │ • ICD-10     │    │ • Dosage  │ │
│  │   Alerts     │    │ • Symptom    │    │   Codes      │    │   Calc    │ │
│  │              │    │   Extraction │    │ • Lab/Test   │    │ • Allergy │ │
│  │              │    │              │    │   Recommend  │    │   Check   │ │
│  └──────────────┘    └──────────────┘    └──────────────┘    └───────────┘ │
│                                                                             │
│                              ┌───────────────┐                              │
│                              │ 5. AI SCRIBE  │                              │
│                              │ • SOAP Notes  │                              │
│                              │ • Summary     │                              │
│                              │ • Follow-up   │                              │
│                              └───────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 6.2 Backend: AI Consultation Service

**File:** `backend/src/services/aiConsultationService.ts`

```typescript
// backend/src/services/aiConsultationService.ts
import axios from 'axios';
import { prisma } from '../config/database';

class AIConsultationService {
  private aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

  /**
   * Get AI-enhanced patient context before consultation starts
   */
  async getPatientAIContext(hospitalId: string, patientId: string) {
    // Fetch patient data
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
      include: {
        allergies: true,
        medicalHistory: true,
        medications: { where: { status: 'ACTIVE' } },
        vitals: { orderBy: { recordedAt: 'desc' }, take: 10 },
        consultations: { orderBy: { createdAt: 'desc' }, take: 5 }
      }
    });

    if (!patient) throw new Error('Patient not found');

    // Get AI risk assessment
    const riskAssessment = await this.assessPatientRisk(patient);

    // Get medication alerts
    const medicationAlerts = await this.checkCurrentMedications(patient);

    // Get allergy warnings
    const allergyWarnings = this.getHighRiskAllergies(patient.allergies);

    return {
      patient: {
        id: patient.id,
        name: `${patient.firstName} ${patient.lastName}`,
        age: this.calculateAge(patient.dateOfBirth),
        gender: patient.gender,
        bloodGroup: patient.bloodGroup
      },
      aiInsights: {
        riskLevel: riskAssessment.riskLevel,
        riskFactors: riskAssessment.factors,
        recentTrends: riskAssessment.trends,
        medicationAlerts,
        allergyWarnings,
        lastVisitSummary: patient.consultations[0]?.diagnosis || null
      },
      currentMedications: patient.medications,
      allergies: patient.allergies,
      recentVitals: patient.vitals[0] || null
    };
  }

  /**
   * Interpret vital signs using EWS AI
   */
  async interpretVitals(vitals: VitalsInput) {
    try {
      const response = await axios.post(`${this.aiServiceUrl}/api/ews/calculate`, {
        respiratory_rate: vitals.respiratoryRate,
        oxygen_saturation: vitals.oxygenSaturation,
        systolic_bp: vitals.systolicBP,
        heart_rate: vitals.heartRate,
        temperature: vitals.temperature,
        consciousness: vitals.consciousness || 'A',
        on_supplemental_oxygen: vitals.onSupplementalOxygen || false
      });

      return {
        ewsScore: response.data.totalScore,
        riskLevel: response.data.riskLevel,
        componentScores: response.data.componentScores,
        recommendedAction: response.data.recommendedAction,
        abnormalFindings: this.identifyAbnormalVitals(vitals),
        clinicalAlerts: this.generateVitalAlerts(response.data)
      };
    } catch (error) {
      console.error('EWS calculation failed:', error);
      return this.fallbackVitalInterpretation(vitals);
    }
  }

  /**
   * Get AI diagnosis suggestions based on symptoms
   */
  async getDiagnosisSuggestions(input: DiagnosisInput) {
    try {
      // Call DiagnosticAI
      const response = await axios.post(`${this.aiServiceUrl}/api/diagnose`, {
        symptoms: input.symptoms,
        patient_age: input.patientAge,
        patient_gender: input.patientGender,
        medical_history: input.medicalHistory || [],
        duration: input.duration,
        severity: input.severity
      });

      // Enrich with ICD-10 codes
      const enrichedDiagnoses = await this.enrichWithICDCodes(response.data.diagnoses);

      return {
        primaryDiagnosis: enrichedDiagnoses[0] || null,
        differentialDiagnoses: enrichedDiagnoses.slice(1, 5),
        confidence: response.data.confidence,
        redFlags: response.data.red_flags || [],
        recommendedTests: response.data.recommended_tests || [],
        reasoning: response.data.reasoning
      };
    } catch (error) {
      console.error('Diagnosis AI failed:', error);
      return { primaryDiagnosis: null, differentialDiagnoses: [], recommendedTests: [] };
    }
  }

  /**
   * Get AI-recommended lab tests based on diagnosis
   */
  async getRecommendedTests(diagnosis: string, patientContext: any) {
    try {
      const response = await axios.post(`${this.aiServiceUrl}/api/smart-orders/recommend`, {
        diagnosis,
        patientAge: patientContext.age,
        patientGender: patientContext.gender,
        existingConditions: patientContext.medicalHistory,
        currentMedications: patientContext.medications
      });

      return {
        labTests: response.data.recommendations.filter((r: any) => r.type === 'LAB'),
        imagingTests: response.data.recommendations.filter((r: any) => r.type === 'RADIOLOGY'),
        otherTests: response.data.recommendations.filter((r: any) => !['LAB', 'RADIOLOGY'].includes(r.type)),
        bundles: response.data.bundles || []
      };
    } catch (error) {
      console.error('Test recommendation failed:', error);
      return { labTests: [], imagingTests: [], otherTests: [], bundles: [] };
    }
  }

  /**
   * Validate prescription with AI (drug interactions, dosage, allergies)
   */
  async validatePrescription(input: PrescriptionValidationInput) {
    const { medications, patientId, hospitalId } = input;

    // Get patient context
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, hospitalId },
      include: {
        allergies: true,
        medications: { where: { status: 'ACTIVE' } }
      }
    });

    // Get all medication names (new + existing)
    const allMedications = [
      ...medications.map(m => m.drugName),
      ...patient.medications.map(m => m.drugName)
    ];

    // Check drug interactions
    const interactionResponse = await axios.post(
      `${this.aiServiceUrl}/api/pharmacy/check-interactions`,
      {
        medications: allMedications,
        patient_age: this.calculateAge(patient.dateOfBirth),
        patient_weight: patient.weight,
        patient_conditions: patient.medicalHistory?.conditions || [],
        allergies: patient.allergies.map(a => a.allergen),
        renal_function: input.renalFunction || 'normal',
        hepatic_function: input.hepaticFunction || 'normal'
      }
    );

    // Check each medication for dosage and allergies
    const medicationValidations = await Promise.all(
      medications.map(async (med) => {
        const dosageCheck = await this.validateDosage(med, patient);
        const allergyCheck = this.checkAllergyConflict(med.drugName, patient.allergies);

        return {
          drugName: med.drugName,
          dosage: med.dosage,
          isValid: dosageCheck.isValid && !allergyCheck.hasConflict,
          dosageValidation: dosageCheck,
          allergyWarning: allergyCheck,
          interactions: interactionResponse.data.interactions.filter(
            (i: any) => i.drugs.includes(med.drugName)
          )
        };
      })
    );

    return {
      isValid: medicationValidations.every(v => v.isValid),
      overallRisk: interactionResponse.data.overall_risk,
      medications: medicationValidations,
      interactions: interactionResponse.data.interactions,
      recommendations: interactionResponse.data.recommendations,
      contraindications: interactionResponse.data.contraindications
    };
  }

  /**
   * Generate AI SOAP notes from consultation
   */
  async generateSOAPNotes(consultationData: ConsultationData) {
    try {
      const response = await axios.post(`${this.aiServiceUrl}/api/notes/generate-soap`, {
        chiefComplaint: consultationData.chiefComplaint,
        symptoms: consultationData.symptoms,
        vitals: consultationData.vitals,
        examination: consultationData.examination,
        diagnosis: consultationData.diagnosis,
        treatment: consultationData.treatment,
        patientHistory: consultationData.medicalHistory
      });

      return {
        subjective: response.data.subjective,
        objective: response.data.objective,
        assessment: response.data.assessment,
        plan: response.data.plan,
        icdCodes: response.data.icd_codes,
        cptCodes: response.data.cpt_codes,
        followUpRecommendation: response.data.follow_up
      };
    } catch (error) {
      console.error('SOAP generation failed:', error);
      return this.generateBasicSOAP(consultationData);
    }
  }

  /**
   * Get AI follow-up recommendations
   */
  async getFollowUpRecommendations(consultationId: string) {
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        prescriptions: { include: { medications: true } },
        labOrders: true
      }
    });

    const recommendations = [];

    // Based on diagnosis
    if (consultation.diagnosis) {
      recommendations.push(...this.getDiagnosisFollowUp(consultation.diagnosis));
    }

    // Based on medications
    for (const prescription of consultation.prescriptions) {
      for (const med of prescription.medications) {
        const medFollowUp = this.getMedicationFollowUp(med);
        if (medFollowUp) recommendations.push(medFollowUp);
      }
    }

    // Based on pending labs
    if (consultation.labOrders.length > 0) {
      recommendations.push({
        type: 'LAB_REVIEW',
        timing: '3-5 days',
        reason: 'Review lab results',
        priority: 'ROUTINE'
      });
    }

    return recommendations;
  }

  // Helper methods
  private calculateAge(dob: Date): number {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }

  private identifyAbnormalVitals(vitals: VitalsInput): string[] {
    const abnormal = [];
    if (vitals.heartRate && (vitals.heartRate < 50 || vitals.heartRate > 100)) {
      abnormal.push(`Heart rate: ${vitals.heartRate} bpm (abnormal)`);
    }
    if (vitals.systolicBP && (vitals.systolicBP < 90 || vitals.systolicBP > 140)) {
      abnormal.push(`Systolic BP: ${vitals.systolicBP} mmHg (abnormal)`);
    }
    if (vitals.temperature && (vitals.temperature < 36 || vitals.temperature > 38)) {
      abnormal.push(`Temperature: ${vitals.temperature}°C (abnormal)`);
    }
    if (vitals.oxygenSaturation && vitals.oxygenSaturation < 95) {
      abnormal.push(`SpO2: ${vitals.oxygenSaturation}% (low)`);
    }
    return abnormal;
  }

  private checkAllergyConflict(drugName: string, allergies: any[]): AllergyCheckResult {
    const drugLower = drugName.toLowerCase();

    // Direct allergy match
    for (const allergy of allergies) {
      if (drugLower.includes(allergy.allergen.toLowerCase())) {
        return {
          hasConflict: true,
          severity: 'CRITICAL',
          message: `Patient is allergic to ${allergy.allergen}`,
          type: 'DIRECT'
        };
      }
    }

    // Cross-reactivity check
    const crossReactivity: Record<string, string[]> = {
      'penicillin': ['amoxicillin', 'ampicillin', 'cephalosporins'],
      'aspirin': ['ibuprofen', 'naproxen', 'nsaids'],
      'sulfa': ['sulfamethoxazole', 'sulfasalazine'],
      'codeine': ['morphine', 'hydrocodone', 'oxycodone']
    };

    for (const allergy of allergies) {
      const allergenLower = allergy.allergen.toLowerCase();
      const relatedDrugs = crossReactivity[allergenLower] || [];

      for (const related of relatedDrugs) {
        if (drugLower.includes(related)) {
          return {
            hasConflict: true,
            severity: 'WARNING',
            message: `Potential cross-reactivity: patient allergic to ${allergy.allergen}, ${drugName} may cause reaction`,
            type: 'CROSS_REACTIVITY'
          };
        }
      }
    }

    return { hasConflict: false, severity: 'NONE', message: '', type: 'NONE' };
  }

  private async validateDosage(medication: any, patient: any): Promise<DosageValidation> {
    try {
      const response = await axios.post(`${this.aiServiceUrl}/api/pharmacy/calculate-dosage`, {
        drug_name: medication.drugName,
        patient_age: this.calculateAge(patient.dateOfBirth),
        patient_weight: patient.weight || 70,
        indication: medication.indication || 'general',
        renal_function: 'normal',
        hepatic_function: 'normal'
      });

      const recommendedDose = response.data.recommended_dose;
      const maxDose = response.data.max_daily_dose;
      const prescribedDose = parseFloat(medication.dosage);

      return {
        isValid: prescribedDose <= maxDose,
        recommendedDose,
        maxDailyDose: maxDose,
        prescribedDose: medication.dosage,
        adjustments: response.data.adjustments || [],
        warnings: response.data.warnings || []
      };
    } catch (error) {
      return {
        isValid: true,
        recommendedDose: null,
        maxDailyDose: null,
        prescribedDose: medication.dosage,
        adjustments: [],
        warnings: ['Unable to validate dosage automatically']
      };
    }
  }
}

export const aiConsultationService = new AIConsultationService();
```

#### 6.3 Backend: AI Consultation Routes

**File:** `backend/src/routes/aiConsultationRoutes.ts`

```typescript
// backend/src/routes/aiConsultationRoutes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { aiConsultationService } from '../services/aiConsultationService';
import { sendSuccess } from '../utils/response';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get AI patient context before consultation
router.get('/patient-context/:patientId',
  authorize('DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'),
  asyncHandler(async (req, res) => {
    const context = await aiConsultationService.getPatientAIContext(
      req.user!.hospitalId,
      req.params.patientId
    );
    sendSuccess(res, context);
  })
);

// Interpret vital signs
router.post('/interpret-vitals',
  authorize('DOCTOR', 'NURSE'),
  asyncHandler(async (req, res) => {
    const interpretation = await aiConsultationService.interpretVitals(req.body);
    sendSuccess(res, interpretation);
  })
);

// Get diagnosis suggestions
router.post('/suggest-diagnosis',
  authorize('DOCTOR'),
  asyncHandler(async (req, res) => {
    const suggestions = await aiConsultationService.getDiagnosisSuggestions(req.body);
    sendSuccess(res, suggestions);
  })
);

// Get recommended tests
router.post('/recommend-tests',
  authorize('DOCTOR'),
  asyncHandler(async (req, res) => {
    const recommendations = await aiConsultationService.getRecommendedTests(
      req.body.diagnosis,
      req.body.patientContext
    );
    sendSuccess(res, recommendations);
  })
);

// Validate prescription (real-time)
router.post('/validate-prescription',
  authorize('DOCTOR'),
  asyncHandler(async (req, res) => {
    const validation = await aiConsultationService.validatePrescription({
      ...req.body,
      hospitalId: req.user!.hospitalId
    });
    sendSuccess(res, validation);
  })
);

// Generate SOAP notes
router.post('/generate-soap',
  authorize('DOCTOR'),
  asyncHandler(async (req, res) => {
    const soap = await aiConsultationService.generateSOAPNotes(req.body);
    sendSuccess(res, soap);
  })
);

// Get follow-up recommendations
router.get('/follow-up/:consultationId',
  authorize('DOCTOR'),
  asyncHandler(async (req, res) => {
    const recommendations = await aiConsultationService.getFollowUpRecommendations(
      req.params.consultationId
    );
    sendSuccess(res, recommendations);
  })
);

export default router;
```

#### 6.4 Frontend: AI-Enhanced Consultation Page

**File:** `frontend/src/pages/Consultation/index.tsx` (major update)

```typescript
// frontend/src/pages/Consultation/index.tsx
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { debounce } from 'lodash';
import {
  ExclamationTriangleIcon,
  LightBulbIcon,
  BeakerIcon,
  ClipboardDocumentListIcon,
  SparklesIcon,
  ShieldExclamationIcon
} from '@heroicons/react/24/outline';
import { consultationApi, aiConsultationApi } from '../../services/api';

// Components
import PatientHeader from './components/PatientHeader';
import AIInsightsPanel from './components/AIInsightsPanel';
import VitalsEntry from './components/VitalsEntry';
import SymptomsEntry from './components/SymptomsEntry';
import DiagnosisSection from './components/DiagnosisSection';
import PrescriptionSection from './components/PrescriptionSection';
import SOAPNotesSection from './components/SOAPNotesSection';

export default function Consultation() {
  const { appointmentId, patientId } = useParams();

  // State
  const [activeTab, setActiveTab] = useState<'vitals' | 'symptoms' | 'diagnosis' | 'prescription' | 'notes'>('vitals');
  const [vitals, setVitals] = useState<VitalsData | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<Diagnosis | null>(null);
  const [prescriptions, setPrescriptions] = useState<Medication[]>([]);
  const [showAIPanel, setShowAIPanel] = useState(true);

  // Fetch AI patient context
  const { data: patientContext, isLoading: contextLoading } = useQuery({
    queryKey: ['patient-ai-context', patientId],
    queryFn: () => aiConsultationApi.getPatientContext(patientId!),
    enabled: !!patientId
  });

  // AI Vital interpretation
  const { data: vitalInterpretation, refetch: interpretVitals } = useQuery({
    queryKey: ['vital-interpretation', vitals],
    queryFn: () => aiConsultationApi.interpretVitals(vitals!),
    enabled: false
  });

  // AI Diagnosis suggestions
  const diagnosisMutation = useMutation({
    mutationFn: aiConsultationApi.suggestDiagnosis
  });

  // AI Prescription validation (real-time)
  const prescriptionValidation = useMutation({
    mutationFn: aiConsultationApi.validatePrescription
  });

  // Debounced prescription validation
  const debouncedValidatePrescription = useCallback(
    debounce((meds: Medication[]) => {
      if (meds.length > 0 && patientId) {
        prescriptionValidation.mutate({
          medications: meds,
          patientId
        });
      }
    }, 500),
    [patientId]
  );

  // Validate prescription whenever it changes
  useEffect(() => {
    debouncedValidatePrescription(prescriptions);
  }, [prescriptions, debouncedValidatePrescription]);

  // Handle vital signs submission
  const handleVitalsSubmit = async (vitalsData: VitalsData) => {
    setVitals(vitalsData);
    await interpretVitals();
    setActiveTab('symptoms');
  };

  // Handle symptoms submission
  const handleSymptomsSubmit = async (symptomData: { chiefComplaint: string; symptoms: string[] }) => {
    setChiefComplaint(symptomData.chiefComplaint);
    setSymptoms(symptomData.symptoms);

    // Get AI diagnosis suggestions
    diagnosisMutation.mutate({
      symptoms: symptomData.symptoms,
      chiefComplaint: symptomData.chiefComplaint,
      patientAge: patientContext?.patient.age,
      patientGender: patientContext?.patient.gender,
      medicalHistory: patientContext?.aiInsights.recentTrends
    });

    setActiveTab('diagnosis');
  };

  // Handle adding medication
  const handleAddMedication = (medication: Medication) => {
    setPrescriptions(prev => [...prev, medication]);
  };

  // Handle removing medication
  const handleRemoveMedication = (index: number) => {
    setPrescriptions(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Content */}
      <div className={`flex-1 overflow-hidden ${showAIPanel ? 'mr-96' : ''}`}>
        {/* Patient Header with Alerts */}
        <PatientHeader
          patient={patientContext?.patient}
          alerts={patientContext?.aiInsights}
          isLoading={contextLoading}
        />

        {/* Critical Alerts Banner */}
        {patientContext?.aiInsights?.allergyWarnings?.length > 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mx-6 mt-4">
            <div className="flex items-center">
              <ShieldExclamationIcon className="w-6 h-6 text-red-500 mr-3" />
              <div>
                <h4 className="text-red-800 font-semibold">Allergy Alert</h4>
                <ul className="text-red-700 text-sm">
                  {patientContext.aiInsights.allergyWarnings.map((warning: string, i: number) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 px-6 mt-4">
          <nav className="flex space-x-8">
            {[
              { id: 'vitals', label: 'Vitals', icon: '❤️' },
              { id: 'symptoms', label: 'Symptoms', icon: '🩺' },
              { id: 'diagnosis', label: 'Diagnosis', icon: '📋' },
              { id: 'prescription', label: 'Prescription', icon: '💊' },
              { id: 'notes', label: 'Notes', icon: '📝' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto" style={{ height: 'calc(100vh - 200px)' }}>
          {activeTab === 'vitals' && (
            <VitalsEntry
              onSubmit={handleVitalsSubmit}
              interpretation={vitalInterpretation}
            />
          )}

          {activeTab === 'symptoms' && (
            <SymptomsEntry
              onSubmit={handleSymptomsSubmit}
              patientContext={patientContext}
            />
          )}

          {activeTab === 'diagnosis' && (
            <DiagnosisSection
              suggestions={diagnosisMutation.data}
              isLoading={diagnosisMutation.isPending}
              selectedDiagnosis={selectedDiagnosis}
              onSelectDiagnosis={setSelectedDiagnosis}
              patientContext={patientContext}
            />
          )}

          {activeTab === 'prescription' && (
            <PrescriptionSection
              prescriptions={prescriptions}
              validation={prescriptionValidation.data}
              isValidating={prescriptionValidation.isPending}
              onAddMedication={handleAddMedication}
              onRemoveMedication={handleRemoveMedication}
              patientContext={patientContext}
              diagnosis={selectedDiagnosis}
            />
          )}

          {activeTab === 'notes' && (
            <SOAPNotesSection
              consultationData={{
                chiefComplaint,
                symptoms,
                vitals,
                diagnosis: selectedDiagnosis,
                prescriptions
              }}
            />
          )}
        </div>
      </div>

      {/* AI Insights Side Panel */}
      {showAIPanel && (
        <AIInsightsPanel
          patientContext={patientContext}
          vitalInterpretation={vitalInterpretation}
          diagnosisSuggestions={diagnosisMutation.data}
          prescriptionValidation={prescriptionValidation.data}
          onClose={() => setShowAIPanel(false)}
        />
      )}

      {/* Toggle AI Panel Button */}
      {!showAIPanel && (
        <button
          onClick={() => setShowAIPanel(true)}
          className="fixed right-4 top-1/2 transform -translate-y-1/2 bg-primary-600 text-white p-3 rounded-l-lg shadow-lg hover:bg-primary-700"
        >
          <SparklesIcon className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
```

#### 6.5 Frontend: AI Insights Panel Component

**File:** `frontend/src/pages/Consultation/components/AIInsightsPanel.tsx`

```typescript
// frontend/src/pages/Consultation/components/AIInsightsPanel.tsx
import {
  XMarkIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  LightBulbIcon,
  BeakerIcon
} from '@heroicons/react/24/outline';

interface AIInsightsPanelProps {
  patientContext: any;
  vitalInterpretation: any;
  diagnosisSuggestions: any;
  prescriptionValidation: any;
  onClose: () => void;
}

export default function AIInsightsPanel({
  patientContext,
  vitalInterpretation,
  diagnosisSuggestions,
  prescriptionValidation,
  onClose
}: AIInsightsPanelProps) {
  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl border-l border-gray-200 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gradient-to-r from-primary-600 to-primary-700 text-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <LightBulbIcon className="w-6 h-6 mr-2" />
          <h2 className="font-semibold">AI Clinical Assistant</h2>
        </div>
        <button onClick={onClose} className="hover:bg-primary-500 rounded p-1">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Patient Risk Summary */}
        {patientContext?.aiInsights && (
          <section>
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              Patient Risk Assessment
            </h3>
            <div className={`p-3 rounded-lg ${
              patientContext.aiInsights.riskLevel === 'HIGH' ? 'bg-red-50' :
              patientContext.aiInsights.riskLevel === 'MEDIUM' ? 'bg-yellow-50' : 'bg-green-50'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Risk Level</span>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  patientContext.aiInsights.riskLevel === 'HIGH' ? 'bg-red-200 text-red-800' :
                  patientContext.aiInsights.riskLevel === 'MEDIUM' ? 'bg-yellow-200 text-yellow-800' :
                  'bg-green-200 text-green-800'
                }`}>
                  {patientContext.aiInsights.riskLevel}
                </span>
              </div>
              {patientContext.aiInsights.riskFactors?.length > 0 && (
                <ul className="text-sm text-gray-600 space-y-1">
                  {patientContext.aiInsights.riskFactors.map((factor: string, i: number) => (
                    <li key={i} className="flex items-start">
                      <span className="text-yellow-500 mr-1">•</span>
                      {factor}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* Vital Signs Interpretation */}
        {vitalInterpretation && (
          <section>
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
              Vital Signs Analysis
            </h3>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">NEWS2 Score</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  vitalInterpretation.ewsScore >= 7 ? 'bg-red-500 text-white' :
                  vitalInterpretation.ewsScore >= 5 ? 'bg-orange-500 text-white' :
                  vitalInterpretation.ewsScore >= 1 ? 'bg-yellow-500 text-white' :
                  'bg-green-500 text-white'
                }`}>
                  {vitalInterpretation.ewsScore}
                </span>
              </div>
              {vitalInterpretation.abnormalFindings?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-gray-500 mb-1">Abnormal Findings:</p>
                  {vitalInterpretation.abnormalFindings.map((finding: string, i: number) => (
                    <div key={i} className="flex items-center text-sm text-orange-700 bg-orange-50 px-2 py-1 rounded mb-1">
                      <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                      {finding}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-600 mt-2">
                <strong>Recommended:</strong> {vitalInterpretation.recommendedAction}
              </p>
            </div>
          </section>
        )}

        {/* Diagnosis Suggestions */}
        {diagnosisSuggestions && (
          <section>
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
              <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
              AI Diagnosis Suggestions
            </h3>
            {diagnosisSuggestions.primaryDiagnosis && (
              <div className="bg-purple-50 rounded-lg p-3 mb-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-purple-900">
                    {diagnosisSuggestions.primaryDiagnosis.name}
                  </span>
                  <span className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded">
                    {Math.round(diagnosisSuggestions.primaryDiagnosis.confidence * 100)}%
                  </span>
                </div>
                <span className="text-xs text-purple-600">
                  ICD-10: {diagnosisSuggestions.primaryDiagnosis.icdCode}
                </span>
              </div>
            )}
            {diagnosisSuggestions.differentialDiagnoses?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500">Differential Diagnoses:</p>
                {diagnosisSuggestions.differentialDiagnoses.map((dx: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-gray-50 px-2 py-1 rounded">
                    <span>{dx.name}</span>
                    <span className="text-xs text-gray-500">{Math.round(dx.confidence * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
            {diagnosisSuggestions.redFlags?.length > 0 && (
              <div className="mt-2 bg-red-50 rounded p-2">
                <p className="text-xs font-bold text-red-700 mb-1">Red Flags:</p>
                {diagnosisSuggestions.redFlags.map((flag: string, i: number) => (
                  <div key={i} className="text-xs text-red-600 flex items-center">
                    <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
                    {flag}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Prescription Validation */}
        {prescriptionValidation && (
          <section>
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Prescription Safety Check
            </h3>
            <div className={`rounded-lg p-3 ${
              prescriptionValidation.isValid ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <div className="flex items-center mb-2">
                {prescriptionValidation.isValid ? (
                  <>
                    <CheckCircleIcon className="w-5 h-5 text-green-500 mr-2" />
                    <span className="text-green-700 font-medium">No Critical Issues</span>
                  </>
                ) : (
                  <>
                    <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mr-2" />
                    <span className="text-red-700 font-medium">Issues Detected</span>
                  </>
                )}
              </div>

              {/* Drug Interactions */}
              {prescriptionValidation.interactions?.length > 0 && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs font-medium text-gray-600">Drug Interactions:</p>
                  {prescriptionValidation.interactions.map((interaction: any, i: number) => (
                    <div key={i} className={`text-xs p-2 rounded ${
                      interaction.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                      interaction.severity === 'SEVERE' ? 'bg-orange-100 text-orange-800' :
                      interaction.severity === 'MODERATE' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      <div className="font-medium">{interaction.drugs.join(' + ')}</div>
                      <div>{interaction.description}</div>
                      <div className="mt-1 text-xs opacity-75">
                        Severity: {interaction.severity}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {prescriptionValidation.recommendations?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-gray-600">Recommendations:</p>
                  <ul className="text-xs text-gray-700 space-y-1 mt-1">
                    {prescriptionValidation.recommendations.map((rec: string, i: number) => (
                      <li key={i} className="flex items-start">
                        <LightBulbIcon className="w-3 h-3 mr-1 mt-0.5 text-yellow-500" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Recommended Tests */}
        {diagnosisSuggestions?.recommendedTests?.length > 0 && (
          <section>
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
              <BeakerIcon className="w-4 h-4 mr-2 text-blue-500" />
              Recommended Tests
            </h3>
            <div className="space-y-1">
              {diagnosisSuggestions.recommendedTests.map((test: string, i: number) => (
                <div key={i} className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded text-sm">
                  <span>{test}</span>
                  <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    + Add
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
```

#### 6.6 Frontend: Prescription Section with Real-time Validation

**File:** `frontend/src/pages/Consultation/components/PrescriptionSection.tsx`

```typescript
// frontend/src/pages/Consultation/components/PrescriptionSection.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PlusIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { pharmacyApi } from '../../../services/api';

interface PrescriptionSectionProps {
  prescriptions: Medication[];
  validation: any;
  isValidating: boolean;
  onAddMedication: (medication: Medication) => void;
  onRemoveMedication: (index: number) => void;
  patientContext: any;
  diagnosis: any;
}

export default function PrescriptionSection({
  prescriptions,
  validation,
  isValidating,
  onAddMedication,
  onRemoveMedication,
  patientContext,
  diagnosis
}: PrescriptionSectionProps) {
  const [drugSearch, setDrugSearch] = useState('');
  const [selectedDrug, setSelectedDrug] = useState<any>(null);
  const [dosageForm, setDosageForm] = useState({
    dosage: '',
    frequency: 'OD',
    duration: '7',
    route: 'ORAL',
    instructions: ''
  });

  // Drug search
  const { data: drugResults } = useQuery({
    queryKey: ['drug-search', drugSearch],
    queryFn: () => pharmacyApi.searchDrugs(drugSearch),
    enabled: drugSearch.length >= 2
  });

  // Get AI dosage recommendation when drug is selected
  const { data: dosageRecommendation } = useQuery({
    queryKey: ['dosage-recommendation', selectedDrug?.name, patientContext?.patient],
    queryFn: () => pharmacyApi.calculateDosage({
      drugName: selectedDrug.name,
      patientAge: patientContext?.patient?.age,
      patientWeight: patientContext?.patient?.weight,
      indication: diagnosis?.name
    }),
    enabled: !!selectedDrug && !!patientContext?.patient
  });

  const handleSelectDrug = (drug: any) => {
    setSelectedDrug(drug);
    setDrugSearch(drug.name);

    // Auto-fill recommended dosage if available
    if (dosageRecommendation) {
      setDosageForm(prev => ({
        ...prev,
        dosage: dosageRecommendation.recommendedDose || prev.dosage,
        frequency: dosageRecommendation.frequency || prev.frequency
      }));
    }
  };

  const handleAddMedication = () => {
    if (!selectedDrug || !dosageForm.dosage) return;

    onAddMedication({
      drugName: selectedDrug.name,
      drugId: selectedDrug.id,
      ...dosageForm
    });

    // Reset form
    setSelectedDrug(null);
    setDrugSearch('');
    setDosageForm({
      dosage: '',
      frequency: 'OD',
      duration: '7',
      route: 'ORAL',
      instructions: ''
    });
  };

  // Get validation status for a specific medication
  const getMedicationValidation = (drugName: string) => {
    if (!validation?.medications) return null;
    return validation.medications.find((m: any) => m.drugName === drugName);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Prescription</h2>

      {/* Allergy Warning */}
      {patientContext?.allergies?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mr-2" />
            <span className="font-medium text-red-800">Patient Allergies:</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {patientContext.allergies.map((allergy: any, i: number) => (
              <span key={i} className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                {allergy.allergen}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Current Medications Warning */}
      {patientContext?.currentMedications?.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <InformationCircleIcon className="w-5 h-5 text-blue-500 mr-2" />
            <span className="font-medium text-blue-800">Current Medications:</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {patientContext.currentMedications.map((med: any, i: number) => (
              <span key={i} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                {med.drugName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add Medication Form */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-medium mb-4">Add Medication</h3>

        <div className="grid grid-cols-2 gap-4">
          {/* Drug Search */}
          <div className="col-span-2 relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Drug Name
            </label>
            <input
              type="text"
              value={drugSearch}
              onChange={(e) => setDrugSearch(e.target.value)}
              placeholder="Search drug..."
              className="w-full border rounded-lg px-3 py-2"
            />

            {/* Search Results Dropdown */}
            {drugResults?.length > 0 && !selectedDrug && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {drugResults.map((drug: any) => (
                  <button
                    key={drug.id}
                    onClick={() => handleSelectDrug(drug)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0"
                  >
                    <div className="font-medium">{drug.name}</div>
                    <div className="text-sm text-gray-500">
                      {drug.genericName} • {drug.form} • {drug.strength}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* AI Dosage Recommendation */}
          {selectedDrug && dosageRecommendation && (
            <div className="col-span-2 bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center mb-2">
                <CheckCircleIcon className="w-5 h-5 text-green-500 mr-2" />
                <span className="font-medium text-green-800">AI Dosage Recommendation</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Recommended:</span>
                  <span className="ml-1 font-medium">{dosageRecommendation.recommendedDose}</span>
                </div>
                <div>
                  <span className="text-gray-600">Max Daily:</span>
                  <span className="ml-1 font-medium">{dosageRecommendation.maxDailyDose}</span>
                </div>
                <div>
                  <span className="text-gray-600">Frequency:</span>
                  <span className="ml-1 font-medium">{dosageRecommendation.frequency}</span>
                </div>
              </div>
              {dosageRecommendation.adjustments?.length > 0 && (
                <div className="mt-2 text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
                  <strong>Adjustments:</strong>
                  <ul className="list-disc list-inside">
                    {dosageRecommendation.adjustments.map((adj: string, i: number) => (
                      <li key={i}>{adj}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Dosage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
            <input
              type="text"
              value={dosageForm.dosage}
              onChange={(e) => setDosageForm(prev => ({ ...prev, dosage: e.target.value }))}
              placeholder="e.g., 500mg"
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <select
              value={dosageForm.frequency}
              onChange={(e) => setDosageForm(prev => ({ ...prev, frequency: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="OD">Once Daily (OD)</option>
              <option value="BD">Twice Daily (BD)</option>
              <option value="TDS">Three Times Daily (TDS)</option>
              <option value="QID">Four Times Daily (QID)</option>
              <option value="PRN">As Needed (PRN)</option>
              <option value="STAT">Immediately (STAT)</option>
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
            <input
              type="number"
              value={dosageForm.duration}
              onChange={(e) => setDosageForm(prev => ({ ...prev, duration: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          {/* Route */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
            <select
              value={dosageForm.route}
              onChange={(e) => setDosageForm(prev => ({ ...prev, route: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="ORAL">Oral</option>
              <option value="IV">Intravenous (IV)</option>
              <option value="IM">Intramuscular (IM)</option>
              <option value="SC">Subcutaneous (SC)</option>
              <option value="TOPICAL">Topical</option>
              <option value="INHALATION">Inhalation</option>
            </select>
          </div>

          {/* Instructions */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
            <input
              type="text"
              value={dosageForm.instructions}
              onChange={(e) => setDosageForm(prev => ({ ...prev, instructions: e.target.value }))}
              placeholder="e.g., Take after meals"
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <button
          onClick={handleAddMedication}
          disabled={!selectedDrug || !dosageForm.dosage}
          className="mt-4 flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Add Medication
        </button>
      </div>

      {/* Prescription List */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drug</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dosage</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {prescriptions.map((med, index) => {
              const medValidation = getMedicationValidation(med.drugName);

              return (
                <tr key={index} className={medValidation && !medValidation.isValid ? 'bg-red-50' : ''}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{med.drugName}</div>
                    {medValidation?.allergyWarning?.hasConflict && (
                      <div className="flex items-center text-xs text-red-600 mt-1">
                        <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                        {medValidation.allergyWarning.message}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">{med.dosage}</td>
                  <td className="px-4 py-3">{med.frequency}</td>
                  <td className="px-4 py-3">{med.duration} days</td>
                  <td className="px-4 py-3">
                    {isValidating ? (
                      <span className="text-gray-400">Checking...</span>
                    ) : medValidation ? (
                      medValidation.isValid ? (
                        <span className="flex items-center text-green-600">
                          <CheckCircleIcon className="w-5 h-5 mr-1" />
                          Safe
                        </span>
                      ) : (
                        <span className="flex items-center text-red-600">
                          <ExclamationTriangleIcon className="w-5 h-5 mr-1" />
                          Warning
                        </span>
                      )
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onRemoveMedication(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {prescriptions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No medications added yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Interaction Summary */}
      {validation?.interactions?.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h3 className="font-medium text-orange-800 mb-2 flex items-center">
            <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
            Drug Interactions Detected
          </h3>
          <div className="space-y-2">
            {validation.interactions.map((interaction: any, i: number) => (
              <div key={i} className={`p-3 rounded ${
                interaction.severity === 'CRITICAL' ? 'bg-red-100' :
                interaction.severity === 'SEVERE' ? 'bg-orange-100' :
                'bg-yellow-100'
              }`}>
                <div className="font-medium">
                  {interaction.drugs.join(' + ')}
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                    interaction.severity === 'CRITICAL' ? 'bg-red-500 text-white' :
                    interaction.severity === 'SEVERE' ? 'bg-orange-500 text-white' :
                    'bg-yellow-500 text-white'
                  }`}>
                    {interaction.severity}
                  </span>
                </div>
                <div className="text-sm text-gray-700 mt-1">{interaction.description}</div>
                {interaction.recommendation && (
                  <div className="text-sm text-blue-700 mt-1">
                    <strong>Recommendation:</strong> {interaction.recommendation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### 7. Advanced Pharmacy AI Features

**Status:** Basic drug interaction exists, needs enhancement
**Effort:** 4-5 days
**Dependencies:** OpenAI API for advanced analysis

This enhancement adds advanced AI capabilities to the pharmacy module.

#### 7.1 Enhanced Pharmacy AI Service

**File:** `ai-services/pharmacy/service.py` (major enhancement)

```python
# ai-services/pharmacy/service.py - Enhanced Version
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import re
from openai import OpenAI
import os

class EnhancedPharmacyAI:
    """
    Advanced Pharmacy AI with:
    - Intelligent drug interaction analysis
    - Personalized dosing recommendations
    - Therapeutic drug monitoring
    - Medication adherence prediction
    - Polypharmacy optimization
    - Drug-gene interaction (pharmacogenomics)
    - Cost-effective alternatives
    """

    def __init__(self):
        self.client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        self._load_knowledge_bases()

    def _load_knowledge_bases(self):
        """Load comprehensive drug databases."""
        from .knowledge_base import (
            DRUG_DATABASE,
            DRUG_INTERACTIONS,
            FOOD_INTERACTIONS,
            THERAPEUTIC_RANGES,
            PHARMACOGENOMICS_DATA,
            DRUG_COSTS
        )
        self.drug_db = DRUG_DATABASE
        self.interactions_db = DRUG_INTERACTIONS
        self.food_interactions = FOOD_INTERACTIONS
        self.therapeutic_ranges = THERAPEUTIC_RANGES
        self.pharmacogenomics = PHARMACOGENOMICS_DATA
        self.drug_costs = DRUG_COSTS

    # ==========================================
    # 1. INTELLIGENT DRUG INTERACTION ANALYSIS
    # ==========================================

    async def analyze_interactions_comprehensive(
        self,
        medications: List[str],
        patient_data: Dict
    ) -> Dict:
        """
        Comprehensive drug interaction analysis including:
        - Drug-drug interactions
        - Drug-food interactions
        - Drug-disease contraindications
        - Drug-lab test interference
        - Therapeutic duplication
        """
        results = {
            'drugDrugInteractions': [],
            'drugFoodInteractions': [],
            'diseaseContraindications': [],
            'labInterferences': [],
            'therapeuticDuplications': [],
            'overallRisk': 'LOW',
            'recommendations': []
        }

        # 1. Drug-Drug Interactions
        for i, drug1 in enumerate(medications):
            for drug2 in medications[i+1:]:
                interaction = self._check_drug_interaction(drug1, drug2)
                if interaction:
                    results['drugDrugInteractions'].append(interaction)

        # 2. Drug-Food Interactions
        for drug in medications:
            food_interactions = self._check_food_interactions(drug)
            results['drugFoodInteractions'].extend(food_interactions)

        # 3. Disease Contraindications
        patient_conditions = patient_data.get('conditions', [])
        for drug in medications:
            contraindications = self._check_disease_contraindications(drug, patient_conditions)
            results['diseaseContraindications'].extend(contraindications)

        # 4. Lab Test Interferences
        for drug in medications:
            lab_interferences = self._check_lab_interferences(drug)
            results['labInterferences'].extend(lab_interferences)

        # 5. Therapeutic Duplication
        duplications = self._check_therapeutic_duplication(medications)
        results['therapeuticDuplications'] = duplications

        # Calculate overall risk
        results['overallRisk'] = self._calculate_overall_risk(results)

        # Generate AI recommendations
        results['recommendations'] = await self._generate_ai_recommendations(results, patient_data)

        return results

    def _check_drug_interaction(self, drug1: str, drug2: str) -> Optional[Dict]:
        """Check for interaction between two drugs."""
        drug1_lower = drug1.lower()
        drug2_lower = drug2.lower()

        # Check in interaction database
        for interaction in self.interactions_db:
            if (drug1_lower in interaction['drugs'] and drug2_lower in interaction['drugs']):
                return {
                    'drugs': [drug1, drug2],
                    'severity': interaction['severity'],
                    'mechanism': interaction['mechanism'],
                    'effect': interaction['effect'],
                    'management': interaction['management'],
                    'documentation': interaction.get('documentation', 'Fair')
                }

        return None

    def _check_food_interactions(self, drug: str) -> List[Dict]:
        """Check drug-food interactions."""
        interactions = []
        drug_lower = drug.lower()

        food_interaction_db = {
            'warfarin': [
                {'food': 'Vitamin K rich foods (leafy greens)', 'effect': 'Decreased anticoagulant effect', 'severity': 'MODERATE'},
                {'food': 'Cranberry juice', 'effect': 'Increased bleeding risk', 'severity': 'MODERATE'},
                {'food': 'Alcohol', 'effect': 'Variable anticoagulant effect', 'severity': 'MODERATE'}
            ],
            'ciprofloxacin': [
                {'food': 'Dairy products', 'effect': 'Decreased absorption', 'severity': 'MODERATE'},
                {'food': 'Calcium-fortified foods', 'effect': 'Decreased absorption', 'severity': 'MODERATE'}
            ],
            'metformin': [
                {'food': 'Alcohol', 'effect': 'Increased lactic acidosis risk', 'severity': 'SEVERE'}
            ],
            'lisinopril': [
                {'food': 'Potassium-rich foods', 'effect': 'Hyperkalemia risk', 'severity': 'MODERATE'},
                {'food': 'Salt substitutes', 'effect': 'Hyperkalemia risk', 'severity': 'MODERATE'}
            ],
            'levothyroxine': [
                {'food': 'Soy products', 'effect': 'Decreased absorption', 'severity': 'MODERATE'},
                {'food': 'Coffee', 'effect': 'Decreased absorption', 'severity': 'MINOR'},
                {'food': 'High-fiber foods', 'effect': 'Decreased absorption', 'severity': 'MINOR'}
            ],
            'statins': [
                {'food': 'Grapefruit juice', 'effect': 'Increased statin levels and toxicity', 'severity': 'SEVERE'}
            ],
            'mao_inhibitors': [
                {'food': 'Tyramine-rich foods (aged cheese, wine)', 'effect': 'Hypertensive crisis', 'severity': 'CRITICAL'}
            ]
        }

        for drug_key, food_list in food_interaction_db.items():
            if drug_key in drug_lower:
                for food_int in food_list:
                    interactions.append({
                        'drug': drug,
                        **food_int
                    })

        return interactions

    def _check_therapeutic_duplication(self, medications: List[str]) -> List[Dict]:
        """Check for therapeutic duplications."""
        duplications = []

        drug_classes = {
            'ACE_INHIBITORS': ['lisinopril', 'enalapril', 'ramipril', 'captopril'],
            'ARBS': ['losartan', 'valsartan', 'irbesartan', 'olmesartan'],
            'STATINS': ['atorvastatin', 'simvastatin', 'rosuvastatin', 'pravastatin'],
            'PPIS': ['omeprazole', 'pantoprazole', 'esomeprazole', 'lansoprazole'],
            'SSRIS': ['fluoxetine', 'sertraline', 'paroxetine', 'escitalopram', 'citalopram'],
            'BETA_BLOCKERS': ['metoprolol', 'atenolol', 'carvedilol', 'propranolol'],
            'NSAIDS': ['ibuprofen', 'naproxen', 'diclofenac', 'meloxicam', 'celecoxib'],
            'BENZODIAZEPINES': ['lorazepam', 'alprazolam', 'diazepam', 'clonazepam'],
            'OPIOIDS': ['morphine', 'oxycodone', 'hydrocodone', 'fentanyl', 'tramadol']
        }

        med_lower = [m.lower() for m in medications]

        for drug_class, drugs in drug_classes.items():
            found_drugs = [m for m in med_lower if any(d in m for d in drugs)]
            if len(found_drugs) > 1:
                duplications.append({
                    'class': drug_class.replace('_', ' ').title(),
                    'drugs': found_drugs,
                    'risk': 'Increased side effects and toxicity',
                    'recommendation': f'Consider using only one {drug_class.replace("_", " ").lower()}'
                })

        return duplications

    # ==========================================
    # 2. PERSONALIZED DOSING RECOMMENDATIONS
    # ==========================================

    async def calculate_personalized_dose(
        self,
        drug_name: str,
        patient: Dict
    ) -> Dict:
        """
        Calculate personalized dose based on:
        - Age, weight, BSA
        - Renal function (CrCl/eGFR)
        - Hepatic function
        - Genetic factors (if available)
        - Concurrent medications
        """
        # Extract patient parameters
        age = patient.get('age', 50)
        weight = patient.get('weight', 70)
        height = patient.get('height', 170)
        gender = patient.get('gender', 'male')
        scr = patient.get('serumCreatinine', 1.0)  # mg/dL

        # Calculate derived values
        bsa = self._calculate_bsa(weight, height)
        crcl = self._calculate_creatinine_clearance(age, weight, scr, gender)
        egfr = self._calculate_egfr(age, scr, gender)

        # Get base dosing
        drug_info = self.drug_db.get(drug_name.lower(), {})
        base_dose = drug_info.get('standard_dose', 'Unknown')

        # Calculate adjustments
        adjustments = []
        adjusted_dose = base_dose

        # Renal adjustment
        renal_adj = self._get_renal_adjustment(drug_name, crcl)
        if renal_adj:
            adjustments.append(renal_adj)

        # Hepatic adjustment
        hepatic_function = patient.get('hepaticFunction', 'normal')
        hepatic_adj = self._get_hepatic_adjustment(drug_name, hepatic_function)
        if hepatic_adj:
            adjustments.append(hepatic_adj)

        # Age adjustment
        if age > 65:
            age_adj = self._get_geriatric_adjustment(drug_name)
            if age_adj:
                adjustments.append(age_adj)

        # Weight-based dosing
        if drug_info.get('weight_based', False):
            weight_dose = self._calculate_weight_based_dose(drug_name, weight)
            adjustments.append({
                'type': 'WEIGHT_BASED',
                'recommendation': f'Weight-based dose: {weight_dose}'
            })

        # Pharmacogenomic adjustment (if genetic data available)
        if patient.get('geneticProfile'):
            pg_adj = self._get_pharmacogenomic_adjustment(drug_name, patient['geneticProfile'])
            if pg_adj:
                adjustments.append(pg_adj)

        return {
            'drug': drug_name,
            'patientParameters': {
                'age': age,
                'weight': weight,
                'bsa': round(bsa, 2),
                'creatinineClearance': round(crcl, 1),
                'eGFR': round(egfr, 1),
                'renalFunction': self._classify_renal_function(crcl),
                'hepaticFunction': hepatic_function
            },
            'baseDose': base_dose,
            'adjustments': adjustments,
            'recommendedDose': self._apply_adjustments(base_dose, adjustments),
            'maxDailyDose': drug_info.get('max_daily_dose', 'Consult reference'),
            'frequency': drug_info.get('frequency', 'As directed'),
            'warnings': self._get_dosing_warnings(drug_name, patient),
            'monitoringRequired': drug_info.get('monitoring', [])
        }

    def _calculate_bsa(self, weight: float, height: float) -> float:
        """Calculate Body Surface Area using Mosteller formula."""
        return ((height * weight) / 3600) ** 0.5

    def _calculate_creatinine_clearance(
        self, age: int, weight: float, scr: float, gender: str
    ) -> float:
        """Calculate CrCl using Cockcroft-Gault formula."""
        crcl = ((140 - age) * weight) / (72 * scr)
        if gender.lower() == 'female':
            crcl *= 0.85
        return crcl

    def _calculate_egfr(self, age: int, scr: float, gender: str) -> float:
        """Calculate eGFR using CKD-EPI formula (simplified)."""
        if gender.lower() == 'female':
            if scr <= 0.7:
                return 144 * (scr / 0.7) ** -0.329 * 0.993 ** age
            else:
                return 144 * (scr / 0.7) ** -1.209 * 0.993 ** age
        else:
            if scr <= 0.9:
                return 141 * (scr / 0.9) ** -0.411 * 0.993 ** age
            else:
                return 141 * (scr / 0.9) ** -1.209 * 0.993 ** age

    def _classify_renal_function(self, crcl: float) -> str:
        """Classify renal function based on CrCl."""
        if crcl >= 90:
            return 'Normal'
        elif crcl >= 60:
            return 'Mild impairment'
        elif crcl >= 30:
            return 'Moderate impairment'
        elif crcl >= 15:
            return 'Severe impairment'
        else:
            return 'End-stage renal disease'

    # ==========================================
    # 3. THERAPEUTIC DRUG MONITORING
    # ==========================================

    def get_tdm_requirements(self, drug_name: str) -> Dict:
        """Get therapeutic drug monitoring requirements."""
        tdm_drugs = {
            'vancomycin': {
                'requiresTDM': True,
                'targetRange': {'trough': '10-20 mcg/mL', 'peak': '20-40 mcg/mL'},
                'sampleTiming': 'Trough: 30 min before dose, Peak: 1-2h after infusion',
                'frequency': 'Every 3-5 days until stable, then weekly',
                'toxicity': 'Nephrotoxicity, ototoxicity if levels too high'
            },
            'gentamicin': {
                'requiresTDM': True,
                'targetRange': {'trough': '<2 mcg/mL', 'peak': '5-10 mcg/mL'},
                'sampleTiming': 'Trough: 30 min before dose, Peak: 30 min after infusion',
                'frequency': 'Every 2-3 days',
                'toxicity': 'Nephrotoxicity, ototoxicity'
            },
            'digoxin': {
                'requiresTDM': True,
                'targetRange': {'level': '0.8-2.0 ng/mL'},
                'sampleTiming': 'At least 6 hours post-dose',
                'frequency': 'Weekly until stable, then with dose changes',
                'toxicity': 'Cardiac arrhythmias, nausea, visual disturbances'
            },
            'lithium': {
                'requiresTDM': True,
                'targetRange': {'level': '0.6-1.2 mEq/L'},
                'sampleTiming': '12 hours post-dose (trough)',
                'frequency': 'Weekly x4, then monthly',
                'toxicity': 'Tremor, polyuria, hypothyroidism, renal impairment'
            },
            'phenytoin': {
                'requiresTDM': True,
                'targetRange': {'total': '10-20 mcg/mL', 'free': '1-2 mcg/mL'},
                'sampleTiming': 'Trough level',
                'frequency': 'Weekly until stable',
                'toxicity': 'Nystagmus, ataxia, cognitive impairment'
            },
            'warfarin': {
                'requiresTDM': True,
                'targetRange': {'INR': '2.0-3.0 (standard), 2.5-3.5 (mechanical valve)'},
                'sampleTiming': 'Anytime (INR)',
                'frequency': 'Every 1-4 weeks depending on stability',
                'toxicity': 'Bleeding'
            },
            'tacrolimus': {
                'requiresTDM': True,
                'targetRange': {'trough': '5-15 ng/mL (varies by indication)'},
                'sampleTiming': 'Trough: 12h post-dose',
                'frequency': 'Twice weekly initially, then weekly',
                'toxicity': 'Nephrotoxicity, neurotoxicity, hyperglycemia'
            },
            'cyclosporine': {
                'requiresTDM': True,
                'targetRange': {'trough': '100-400 ng/mL (varies by indication)'},
                'sampleTiming': 'Trough: 12h post-dose',
                'frequency': 'Twice weekly initially, then weekly',
                'toxicity': 'Nephrotoxicity, hypertension, tremor'
            }
        }

        drug_lower = drug_name.lower()
        for key, value in tdm_drugs.items():
            if key in drug_lower:
                return value

        return {
            'requiresTDM': False,
            'message': 'Routine therapeutic drug monitoring not required'
        }

    # ==========================================
    # 4. MEDICATION ADHERENCE PREDICTION
    # ==========================================

    async def predict_adherence_risk(
        self,
        patient: Dict,
        medications: List[Dict]
    ) -> Dict:
        """
        Predict medication adherence risk based on:
        - Number of medications (polypharmacy)
        - Dosing complexity
        - Side effect profile
        - Cost factors
        - Patient factors
        """
        risk_score = 0
        risk_factors = []

        # 1. Polypharmacy risk
        med_count = len(medications)
        if med_count >= 10:
            risk_score += 30
            risk_factors.append(f'Taking {med_count} medications (high polypharmacy)')
        elif med_count >= 5:
            risk_score += 15
            risk_factors.append(f'Taking {med_count} medications (moderate polypharmacy)')

        # 2. Dosing complexity
        total_daily_doses = sum(self._get_daily_frequency(m.get('frequency', 'OD')) for m in medications)
        if total_daily_doses > 8:
            risk_score += 20
            risk_factors.append(f'{total_daily_doses} doses per day (complex regimen)')

        # 3. Different timing requirements
        timing_variations = self._analyze_timing_complexity(medications)
        if timing_variations > 3:
            risk_score += 15
            risk_factors.append('Multiple different timing requirements')

        # 4. Side effect burden
        high_side_effect_drugs = [m for m in medications if self._has_high_side_effects(m['drugName'])]
        if len(high_side_effect_drugs) >= 2:
            risk_score += 15
            risk_factors.append('Multiple medications with significant side effects')

        # 5. Patient age
        age = patient.get('age', 50)
        if age > 75:
            risk_score += 10
            risk_factors.append('Age >75 (cognitive/physical barriers)')

        # 6. Cognitive status
        if patient.get('cognitiveImpairment'):
            risk_score += 20
            risk_factors.append('Cognitive impairment')

        # Generate recommendations
        recommendations = self._generate_adherence_recommendations(risk_factors, medications)

        return {
            'adherenceRisk': min(risk_score, 100),
            'riskLevel': 'HIGH' if risk_score >= 50 else 'MEDIUM' if risk_score >= 25 else 'LOW',
            'riskFactors': risk_factors,
            'recommendations': recommendations,
            'simplificationOptions': self._suggest_regimen_simplification(medications)
        }

    def _get_daily_frequency(self, frequency: str) -> int:
        """Convert frequency code to daily dose count."""
        freq_map = {
            'OD': 1, 'QD': 1, 'DAILY': 1,
            'BD': 2, 'BID': 2,
            'TDS': 3, 'TID': 3,
            'QID': 4,
            'Q4H': 6,
            'Q6H': 4,
            'Q8H': 3,
            'Q12H': 2
        }
        return freq_map.get(frequency.upper(), 1)

    # ==========================================
    # 5. COST-EFFECTIVE ALTERNATIVES
    # ==========================================

    async def suggest_cost_effective_alternatives(
        self,
        medications: List[Dict],
        insurance_formulary: Optional[Dict] = None
    ) -> List[Dict]:
        """Suggest cost-effective therapeutic alternatives."""
        alternatives = []

        for med in medications:
            drug_name = med.get('drugName', '').lower()

            # Check for generic alternatives
            generic = self._get_generic_alternative(drug_name)
            if generic:
                alternatives.append({
                    'original': med['drugName'],
                    'alternative': generic['name'],
                    'type': 'GENERIC',
                    'savings': generic.get('savingsPercent', 'Significant'),
                    'therapeutic_equivalence': 'AB rated (therapeutically equivalent)'
                })

            # Check for therapeutic alternatives
            therapeutic_alts = self._get_therapeutic_alternatives(drug_name)
            for alt in therapeutic_alts:
                alternatives.append({
                    'original': med['drugName'],
                    'alternative': alt['name'],
                    'type': 'THERAPEUTIC_ALTERNATIVE',
                    'rationale': alt['rationale'],
                    'considerations': alt.get('considerations', [])
                })

            # Check formulary status if available
            if insurance_formulary:
                formulary_alt = self._check_formulary_alternative(drug_name, insurance_formulary)
                if formulary_alt:
                    alternatives.append({
                        'original': med['drugName'],
                        'alternative': formulary_alt['name'],
                        'type': 'FORMULARY_PREFERRED',
                        'tier': formulary_alt['tier'],
                        'copay': formulary_alt.get('copay')
                    })

        return alternatives

    # ==========================================
    # 6. AI-POWERED ANALYSIS
    # ==========================================

    async def _generate_ai_recommendations(
        self,
        analysis_results: Dict,
        patient_data: Dict
    ) -> List[str]:
        """Use GPT to generate clinical recommendations."""
        try:
            prompt = f"""
            As a clinical pharmacist, analyze these findings and provide recommendations:

            Patient: {patient_data.get('age')} year old {patient_data.get('gender')}
            Conditions: {', '.join(patient_data.get('conditions', []))}

            Drug Interactions Found: {len(analysis_results.get('drugDrugInteractions', []))}
            - Critical/Severe: {len([i for i in analysis_results.get('drugDrugInteractions', []) if i['severity'] in ['CRITICAL', 'SEVERE']])}

            Food Interactions: {len(analysis_results.get('drugFoodInteractions', []))}
            Disease Contraindications: {len(analysis_results.get('diseaseContraindications', []))}
            Therapeutic Duplications: {len(analysis_results.get('therapeuticDuplications', []))}

            Provide 3-5 specific, actionable recommendations for the prescriber.
            Focus on patient safety and clinical significance.
            Format as a JSON array of strings.
            """

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a clinical pharmacist providing medication safety recommendations."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                max_tokens=500
            )

            import json
            result = json.loads(response.choices[0].message.content)
            return result.get('recommendations', [])

        except Exception as e:
            print(f"AI recommendation failed: {e}")
            return self._generate_fallback_recommendations(analysis_results)

    def _generate_fallback_recommendations(self, results: Dict) -> List[str]:
        """Generate basic recommendations without AI."""
        recommendations = []

        if results.get('drugDrugInteractions'):
            critical = [i for i in results['drugDrugInteractions'] if i['severity'] == 'CRITICAL']
            if critical:
                recommendations.append(f"URGENT: {len(critical)} critical drug interaction(s) require immediate review")

        if results.get('therapeuticDuplications'):
            recommendations.append("Consider discontinuing duplicate therapy to reduce side effect risk")

        if results.get('drugFoodInteractions'):
            recommendations.append("Provide patient education on food-drug interactions")

        return recommendations


# Export enhanced service
pharmacy_ai = EnhancedPharmacyAI()
```

#### 7.2 Additional Pharmacy AI Endpoints

Add to `ai-services/main.py`:

```python
# Enhanced Pharmacy AI Endpoints

@app.post("/api/pharmacy/comprehensive-analysis")
async def comprehensive_medication_analysis(request: MedicationAnalysisRequest):
    """Comprehensive medication analysis with all interaction types."""
    return await pharmacy_ai.analyze_interactions_comprehensive(
        medications=request.medications,
        patient_data=request.patient_data
    )

@app.post("/api/pharmacy/personalized-dose")
async def calculate_personalized_dose(request: PersonalizedDoseRequest):
    """Calculate personalized dosing based on patient parameters."""
    return await pharmacy_ai.calculate_personalized_dose(
        drug_name=request.drug_name,
        patient=request.patient
    )

@app.get("/api/pharmacy/tdm/{drug_name}")
async def get_tdm_requirements(drug_name: str):
    """Get therapeutic drug monitoring requirements."""
    return pharmacy_ai.get_tdm_requirements(drug_name)

@app.post("/api/pharmacy/adherence-risk")
async def predict_adherence_risk(request: AdherenceRiskRequest):
    """Predict medication adherence risk."""
    return await pharmacy_ai.predict_adherence_risk(
        patient=request.patient,
        medications=request.medications
    )

@app.post("/api/pharmacy/cost-alternatives")
async def get_cost_alternatives(request: CostAlternativesRequest):
    """Get cost-effective medication alternatives."""
    return await pharmacy_ai.suggest_cost_effective_alternatives(
        medications=request.medications,
        insurance_formulary=request.formulary
    )

@app.post("/api/pharmacy/regimen-optimization")
async def optimize_medication_regimen(request: RegimenOptimizationRequest):
    """AI-powered medication regimen optimization."""
    return await pharmacy_ai.optimize_regimen(
        medications=request.medications,
        patient=request.patient,
        goals=request.optimization_goals
    )
```

#### 7.3 Pharmacy AI Knowledge Base Enhancement

**File:** `ai-services/pharmacy/knowledge_base.py` (additions)

```python
# Add to knowledge_base.py

THERAPEUTIC_RANGES = {
    'vancomycin': {'trough_min': 10, 'trough_max': 20, 'peak_min': 20, 'peak_max': 40, 'unit': 'mcg/mL'},
    'gentamicin': {'trough_max': 2, 'peak_min': 5, 'peak_max': 10, 'unit': 'mcg/mL'},
    'digoxin': {'min': 0.8, 'max': 2.0, 'unit': 'ng/mL'},
    'lithium': {'min': 0.6, 'max': 1.2, 'unit': 'mEq/L'},
    'phenytoin': {'total_min': 10, 'total_max': 20, 'free_min': 1, 'free_max': 2, 'unit': 'mcg/mL'},
    'carbamazepine': {'min': 4, 'max': 12, 'unit': 'mcg/mL'},
    'valproic_acid': {'min': 50, 'max': 100, 'unit': 'mcg/mL'},
    'theophylline': {'min': 10, 'max': 20, 'unit': 'mcg/mL'},
    'tacrolimus': {'min': 5, 'max': 15, 'unit': 'ng/mL'},
    'cyclosporine': {'min': 100, 'max': 400, 'unit': 'ng/mL'}
}

RENAL_DOSE_ADJUSTMENTS = {
    'metformin': {
        'crcl_30_60': '50% dose reduction',
        'crcl_below_30': 'Contraindicated',
        'dialysis': 'Contraindicated'
    },
    'gabapentin': {
        'crcl_30_60': '300-700mg daily',
        'crcl_15_30': '100-300mg daily',
        'crcl_below_15': '100-150mg daily',
        'dialysis': '125-350mg post-dialysis'
    },
    'enoxaparin': {
        'crcl_below_30': 'Reduce dose by 50%',
        'dialysis': 'Use unfractionated heparin instead'
    },
    'ciprofloxacin': {
        'crcl_30_50': '250-500mg q12h',
        'crcl_5_30': '250-500mg q18h',
        'dialysis': '250-500mg q24h after dialysis'
    },
    'vancomycin': {
        'crcl_50_80': '15-20mg/kg q12-24h',
        'crcl_20_49': '15-20mg/kg q24-48h',
        'crcl_below_20': '15-20mg/kg, redose per levels',
        'dialysis': '15-25mg/kg, redose post-HD per levels'
    }
}

PHARMACOGENOMICS_DATA = {
    'clopidogrel': {
        'gene': 'CYP2C19',
        'poor_metabolizer': 'Consider alternative antiplatelet (prasugrel, ticagrelor)',
        'intermediate_metabolizer': 'Consider alternative or higher dose',
        'normal_metabolizer': 'Standard dosing'
    },
    'warfarin': {
        'gene': 'CYP2C9/VKORC1',
        'sensitive': 'Start lower dose (2-3mg)',
        'highly_sensitive': 'Start very low dose (1-2mg)',
        'resistant': 'May need higher doses'
    },
    'codeine': {
        'gene': 'CYP2D6',
        'poor_metabolizer': 'Ineffective - use alternative analgesic',
        'ultrarapid_metabolizer': 'AVOID - risk of toxicity'
    },
    'simvastatin': {
        'gene': 'SLCO1B1',
        'decreased_function': 'Use lower dose or alternative statin'
    },
    'abacavir': {
        'gene': 'HLA-B*5701',
        'positive': 'CONTRAINDICATED - risk of hypersensitivity'
    }
}

DRUG_COSTS = {
    # Brand -> Generic savings examples
    'lipitor': {'generic': 'atorvastatin', 'savings_percent': 90},
    'plavix': {'generic': 'clopidogrel', 'savings_percent': 85},
    'nexium': {'generic': 'esomeprazole', 'savings_percent': 80},
    'singulair': {'generic': 'montelukast', 'savings_percent': 85},
    'crestor': {'generic': 'rosuvastatin', 'savings_percent': 80}
}

GERIATRIC_CONSIDERATIONS = {
    'benzodiazepines': {
        'recommendation': 'AVOID in elderly (Beers Criteria)',
        'reason': 'Increased sensitivity, fall risk, cognitive impairment',
        'alternatives': ['trazodone', 'melatonin', 'CBT-I']
    },
    'anticholinergics': {
        'recommendation': 'AVOID or minimize in elderly',
        'reason': 'Cognitive impairment, delirium risk, urinary retention',
        'examples': ['diphenhydramine', 'oxybutynin', 'tricyclic antidepressants']
    },
    'nsaids': {
        'recommendation': 'Use with caution, short-term only',
        'reason': 'GI bleeding, renal impairment, cardiovascular risk',
        'alternatives': ['acetaminophen', 'topical NSAIDs']
    },
    'sulfonylureas': {
        'recommendation': 'Avoid long-acting (glyburide)',
        'reason': 'Prolonged hypoglycemia risk',
        'alternatives': ['glipizide', 'metformin', 'DPP-4 inhibitors']
    }
}
```

---

## MEDIUM PRIORITY

### 6. PDF Document Analysis

**Status:** Incomplete entity extraction
**Effort:** 3-4 days
**Dependencies:** OpenAI API key for GPT-4 Vision

#### 6.1 Enhanced PDF Service

**File:** `ai-services/pdf_analysis/service.py`

```python
# ai-services/pdf_analysis/service.py
import fitz  # PyMuPDF
import base64
from typing import Dict, List, Optional
from openai import OpenAI
import os
import re

class PDFAnalysisService:
    """
    PDF analysis service with OCR, entity extraction, and medical document parsing.
    """

    def __init__(self):
        self.client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

    async def analyze_document(
        self,
        pdf_content: bytes,
        document_type: str = 'medical_report'
    ) -> Dict:
        """
        Analyze a PDF document and extract structured information.
        """
        # Extract text and images from PDF
        doc = fitz.open(stream=pdf_content, filetype="pdf")

        extracted_text = []
        images = []

        for page_num, page in enumerate(doc):
            # Extract text
            text = page.get_text()
            extracted_text.append({
                'page': page_num + 1,
                'text': text
            })

            # Extract images for OCR if text is sparse
            if len(text.strip()) < 100:
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                img_bytes = pix.tobytes("png")
                images.append({
                    'page': page_num + 1,
                    'data': base64.b64encode(img_bytes).decode()
                })

        doc.close()

        full_text = '\n\n'.join([p['text'] for p in extracted_text])

        # Use GPT-4 for intelligent extraction
        analysis = await self._analyze_with_gpt(full_text, document_type, images)

        return {
            'documentType': document_type,
            'pageCount': len(extracted_text),
            'extractedText': extracted_text,
            'analysis': analysis
        }

    async def _analyze_with_gpt(
        self,
        text: str,
        document_type: str,
        images: List[Dict]
    ) -> Dict:
        """Use GPT-4 to analyze and extract structured data."""

        prompts = {
            'medical_report': """
                Analyze this medical report and extract:
                1. Patient Information (name, DOB, MRN if present)
                2. Date of Service
                3. Provider Information
                4. Chief Complaint/Reason for Visit
                5. Diagnoses (with ICD-10 codes if mentioned)
                6. Procedures Performed (with CPT codes if mentioned)
                7. Medications (name, dosage, frequency)
                8. Lab Results (test name, value, reference range, abnormal flag)
                9. Vital Signs
                10. Follow-up Recommendations

                Return as structured JSON.
            """,
            'lab_report': """
                Extract from this lab report:
                1. Patient Information
                2. Collection Date/Time
                3. Ordering Provider
                4. All Test Results with:
                   - Test Name
                   - Value
                   - Units
                   - Reference Range
                   - Flag (Normal/High/Low/Critical)
                5. Comments or Interpretations

                Return as structured JSON.
            """,
            'discharge_summary': """
                Extract from this discharge summary:
                1. Admission Date
                2. Discharge Date
                3. Admitting Diagnosis
                4. Discharge Diagnoses
                5. Procedures During Stay
                6. Discharge Medications (with instructions)
                7. Follow-up Appointments
                8. Patient Instructions
                9. Activity Restrictions

                Return as structured JSON.
            """,
            'radiology_report': """
                Extract from this radiology report:
                1. Exam Type and Body Part
                2. Date of Exam
                3. Clinical Indication
                4. Technique/Protocol
                5. Findings (detailed)
                6. Impression/Conclusion
                7. Recommendations
                8. Comparison to Prior Studies (if mentioned)

                Return as structured JSON.
            """
        }

        system_prompt = prompts.get(document_type, prompts['medical_report'])

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Document text:\n\n{text[:15000]}"}  # Limit context
        ]

        # Add image analysis for scanned documents
        if images and len(text.strip()) < 500:
            messages.append({
                "role": "user",
                "content": [
                    {"type": "text", "text": "The document appears to be scanned. Please also analyze these page images:"},
                    *[{
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{img['data']}"}
                    } for img in images[:3]]  # Limit to first 3 pages
                ]
            })

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                response_format={"type": "json_object"},
                max_tokens=4000
            )

            import json
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            return {
                "error": str(e),
                "rawText": text[:5000]
            }

    def extract_entities(self, text: str) -> Dict:
        """
        Extract medical entities using pattern matching and NLP.
        """
        entities = {
            'medications': self._extract_medications(text),
            'diagnoses': self._extract_diagnoses(text),
            'vitals': self._extract_vitals(text),
            'labValues': self._extract_lab_values(text),
            'dates': self._extract_dates(text)
        }
        return entities

    def _extract_medications(self, text: str) -> List[Dict]:
        """Extract medication mentions with dosage."""
        # Common medication patterns
        med_pattern = r'([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?)\s*(?:(once|twice|three times|QD|BID|TID|QID|daily|weekly|PRN))?'
        matches = re.findall(med_pattern, text, re.IGNORECASE)

        medications = []
        for match in matches:
            medications.append({
                'name': match[0],
                'dose': match[1],
                'unit': match[2],
                'frequency': match[3] if len(match) > 3 else None
            })
        return medications

    def _extract_diagnoses(self, text: str) -> List[Dict]:
        """Extract ICD-10 codes and diagnosis text."""
        # ICD-10 pattern
        icd_pattern = r'([A-Z]\d{2}(?:\.\d{1,4})?)\s*[-:]\s*([^\n]+)'
        matches = re.findall(icd_pattern, text)

        diagnoses = []
        for code, description in matches:
            diagnoses.append({
                'icdCode': code,
                'description': description.strip()
            })
        return diagnoses

    def _extract_vitals(self, text: str) -> Dict:
        """Extract vital signs."""
        vitals = {}

        patterns = {
            'bloodPressure': r'BP[:\s]+(\d{2,3})/(\d{2,3})',
            'heartRate': r'(?:HR|Heart Rate|Pulse)[:\s]+(\d{2,3})',
            'temperature': r'(?:Temp|Temperature)[:\s]+(\d{2,3}(?:\.\d)?)',
            'respiratoryRate': r'(?:RR|Resp(?:iratory)? Rate)[:\s]+(\d{1,2})',
            'oxygenSaturation': r'(?:SpO2|O2 Sat|Oxygen)[:\s]+(\d{2,3})%?',
            'weight': r'(?:Weight|Wt)[:\s]+(\d{2,3}(?:\.\d)?)\s*(?:kg|lbs?)',
            'height': r'(?:Height|Ht)[:\s]+(\d{1,3}(?:\.\d)?)\s*(?:cm|in|ft)'
        }

        for vital, pattern in patterns.items():
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                vitals[vital] = match.group(1) if vital != 'bloodPressure' else f"{match.group(1)}/{match.group(2)}"

        return vitals

    def _extract_lab_values(self, text: str) -> List[Dict]:
        """Extract laboratory values."""
        # Common lab value pattern: Name: Value Unit (Reference)
        lab_pattern = r'([A-Za-z\s]+):\s*(\d+(?:\.\d+)?)\s*([a-zA-Z/%]+)?\s*(?:\(([^)]+)\))?'
        matches = re.findall(lab_pattern, text)

        labs = []
        for match in matches:
            labs.append({
                'testName': match[0].strip(),
                'value': match[1],
                'unit': match[2] if match[2] else None,
                'referenceRange': match[3] if len(match) > 3 else None
            })
        return labs

    def _extract_dates(self, text: str) -> List[str]:
        """Extract dates from text."""
        date_patterns = [
            r'\d{1,2}/\d{1,2}/\d{2,4}',
            r'\d{4}-\d{2}-\d{2}',
            r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}'
        ]

        dates = []
        for pattern in date_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            dates.extend(matches)

        return list(set(dates))

# Instance
pdf_service = PDFAnalysisService()
```

---

### 7. Asset Management Frontend

**Status:** Backend exists, no frontend
**Effort:** 3-4 days
**Dependencies:** None

#### 7.1 Create Asset Management Page

**File:** `frontend/src/pages/Assets/index.tsx`

```typescript
// frontend/src/pages/Assets/index.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CubeIcon,
  WrenchScrewdriverIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { assetApi } from '../../services/api';
import AssetList from './components/AssetList';
import AssetForm from './components/AssetForm';
import MaintenanceSchedule from './components/MaintenanceSchedule';
import AssetAnalytics from './components/AssetAnalytics';

type AssetTab = 'inventory' | 'maintenance' | 'analytics';

export default function AssetManagement() {
  const [activeTab, setActiveTab] = useState<AssetTab>('inventory');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const queryClient = useQueryClient();

  // Fetch assets
  const { data: assets, isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: () => assetApi.getAssets()
  });

  // Fetch maintenance due
  const { data: maintenanceDue } = useQuery({
    queryKey: ['maintenance-due'],
    queryFn: () => assetApi.getMaintenanceDue()
  });

  // Fetch asset stats
  const { data: stats } = useQuery({
    queryKey: ['asset-stats'],
    queryFn: () => assetApi.getStats()
  });

  // Create asset mutation
  const createAsset = useMutation({
    mutationFn: assetApi.createAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setShowAddModal(false);
    }
  });

  const tabs = [
    { id: 'inventory', name: 'Inventory', icon: CubeIcon },
    { id: 'maintenance', name: 'Maintenance', icon: WrenchScrewdriverIcon, badge: maintenanceDue?.length },
    { id: 'analytics', name: 'Analytics', icon: CalendarIcon },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Asset Management</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Add Asset
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Assets" value={stats?.total || 0} />
        <StatCard title="Active" value={stats?.active || 0} color="green" />
        <StatCard title="Under Maintenance" value={stats?.underMaintenance || 0} color="yellow" />
        <StatCard title="Retired" value={stats?.retired || 0} color="gray" />
      </div>

      {/* Alerts */}
      {maintenanceDue?.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400 mr-2" />
            <span className="text-yellow-700">
              {maintenanceDue.length} assets require maintenance
            </span>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AssetTab)}
              className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-5 h-5 mr-2" />
              {tab.name}
              {tab.badge > 0 && (
                <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'inventory' && (
        <AssetList
          assets={assets}
          onSelect={setSelectedAsset}
          isLoading={isLoading}
        />
      )}
      {activeTab === 'maintenance' && (
        <MaintenanceSchedule maintenanceDue={maintenanceDue} />
      )}
      {activeTab === 'analytics' && (
        <AssetAnalytics stats={stats} />
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <AssetForm
          asset={selectedAsset}
          onSubmit={(data) => createAsset.mutate(data)}
          onClose={() => {
            setShowAddModal(false);
            setSelectedAsset(null);
          }}
          isLoading={createAsset.isPending}
        />
      )}
    </div>
  );
}
```

---

### 8. Telemedicine Recording

**Status:** Basic video room, no recording
**Effort:** 3-4 days
**Dependencies:** Media server or cloud recording service

#### 8.1 Implementation Approach

**Options:**
1. **Cloud Recording (Recommended)**: Integrate with Twilio, Daily.co, or Vonage for built-in recording
2. **Self-Hosted**: Use MediaRecorder API + S3 storage

**For Cloud Recording (Twilio):**

```typescript
// backend/src/services/telemedicineService.ts

import twilio from 'twilio';

class TelemedicineService {
  private twilioClient: twilio.Twilio;

  constructor() {
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  async createRoom(appointmentId: string, enableRecording: boolean = false) {
    const room = await this.twilioClient.video.v1.rooms.create({
      uniqueName: `appointment-${appointmentId}`,
      type: 'group',
      recordParticipantsOnConnect: enableRecording,
      statusCallback: `${process.env.API_URL}/api/v1/telemedicine/webhook`,
      statusCallbackMethod: 'POST'
    });

    return {
      roomSid: room.sid,
      roomName: room.uniqueName,
      recordingEnabled: enableRecording
    };
  }

  async startRecording(roomSid: string) {
    const recording = await this.twilioClient.video.v1
      .rooms(roomSid)
      .recordings
      .create();

    return {
      recordingSid: recording.sid,
      status: recording.status
    };
  }

  async stopRecording(roomSid: string, recordingSid: string) {
    await this.twilioClient.video.v1
      .rooms(roomSid)
      .recordings(recordingSid)
      .update({ status: 'stopped' });
  }

  async getRecordings(roomSid: string) {
    const recordings = await this.twilioClient.video.v1
      .rooms(roomSid)
      .recordings
      .list();

    return recordings.map(r => ({
      sid: r.sid,
      duration: r.duration,
      size: r.size,
      status: r.status,
      createdAt: r.dateCreated
    }));
  }

  async getRecordingUrl(recordingSid: string) {
    // Recordings are stored in Twilio's cloud
    // Generate a signed URL for playback
    const media = await this.twilioClient.video.v1
      .recordings(recordingSid)
      .fetch();

    return media.links.media;
  }
}

export const telemedicineService = new TelemedicineService();
```

---

### 9. Lab Sample Tracking

**Status:** Orders exist, no sample tracking
**Effort:** 2-3 days
**Dependencies:** None

#### 9.1 Database Schema

Add to `schema.prisma`:
```prisma
model LabSample {
  id            String   @id @default(uuid())
  hospitalId    String
  hospital      Hospital @relation(fields: [hospitalId], references: [id])

  orderId       String
  order         LabOrder @relation(fields: [orderId], references: [id])
  patientId     String
  patient       Patient  @relation(fields: [patientId], references: [id])

  sampleId      String   @unique  // Barcode/identifier
  sampleType    SampleType
  collectionTime DateTime
  collectedById String
  collectedBy   User     @relation("SampleCollector", fields: [collectedById], references: [id])

  status        SampleStatus @default(COLLECTED)

  // Tracking
  receivedAt    DateTime?
  receivedById  String?
  processedAt   DateTime?
  processedById String?

  // Storage
  storageLocation String?
  storageTemp     String?

  // Quality
  isHemolyzed   Boolean @default(false)
  isLipemic     Boolean @default(false)
  isIcteric     Boolean @default(false)
  rejectionReason String?

  notes         String?

  trackingHistory SampleTracking[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([hospitalId, sampleId])
  @@index([hospitalId, status])
}

model SampleTracking {
  id          String   @id @default(uuid())
  sampleId    String
  sample      LabSample @relation(fields: [sampleId], references: [id])

  status      SampleStatus
  location    String?
  handledById String
  handledBy   User     @relation(fields: [handledById], references: [id])

  notes       String?
  timestamp   DateTime @default(now())

  @@index([sampleId])
}

enum SampleType {
  BLOOD
  URINE
  STOOL
  SPUTUM
  CSF
  TISSUE
  SWAB
  OTHER
}

enum SampleStatus {
  COLLECTED
  IN_TRANSIT
  RECEIVED
  PROCESSING
  COMPLETED
  REJECTED
}
```

#### 9.2 Sample Tracking Service

```typescript
// backend/src/services/labSampleService.ts
import { prisma } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

class LabSampleService {

  async collectSample(hospitalId: string, data: CollectSampleInput) {
    const sampleId = this.generateSampleId();

    const sample = await prisma.$transaction(async (tx) => {
      const newSample = await tx.labSample.create({
        data: {
          hospitalId,
          orderId: data.orderId,
          patientId: data.patientId,
          sampleId,
          sampleType: data.sampleType,
          collectionTime: new Date(),
          collectedById: data.collectedById,
          status: 'COLLECTED',
          notes: data.notes
        }
      });

      // Create initial tracking entry
      await tx.sampleTracking.create({
        data: {
          sampleId: newSample.id,
          status: 'COLLECTED',
          location: data.collectionLocation,
          handledById: data.collectedById,
          notes: 'Sample collected'
        }
      });

      // Update order status
      await tx.labOrder.update({
        where: { id: data.orderId },
        data: { status: 'SAMPLE_COLLECTED' }
      });

      return newSample;
    });

    return sample;
  }

  async updateSampleStatus(
    hospitalId: string,
    sampleDbId: string,
    data: UpdateSampleStatusInput
  ) {
    return prisma.$transaction(async (tx) => {
      const sample = await tx.labSample.update({
        where: { id: sampleDbId, hospitalId },
        data: {
          status: data.status,
          ...(data.status === 'RECEIVED' && {
            receivedAt: new Date(),
            receivedById: data.handledById
          }),
          ...(data.status === 'PROCESSING' && {
            processedAt: new Date(),
            processedById: data.handledById
          }),
          ...(data.status === 'REJECTED' && {
            rejectionReason: data.rejectionReason
          }),
          storageLocation: data.storageLocation,
          storageTemp: data.storageTemp
        }
      });

      // Add tracking entry
      await tx.sampleTracking.create({
        data: {
          sampleId: sampleDbId,
          status: data.status,
          location: data.location,
          handledById: data.handledById,
          notes: data.notes
        }
      });

      return sample;
    });
  }

  async getSampleByBarcode(hospitalId: string, sampleId: string) {
    return prisma.labSample.findFirst({
      where: { hospitalId, sampleId },
      include: {
        patient: { select: { firstName: true, lastName: true, mrn: true } },
        order: { include: { tests: true } },
        trackingHistory: {
          orderBy: { timestamp: 'desc' },
          include: { handledBy: { select: { firstName: true, lastName: true } } }
        },
        collectedBy: { select: { firstName: true, lastName: true } }
      }
    });
  }

  async getSamplesByStatus(hospitalId: string, status: string) {
    return prisma.labSample.findMany({
      where: { hospitalId, status: status as any },
      include: {
        patient: { select: { firstName: true, lastName: true, mrn: true } },
        order: true
      },
      orderBy: { collectionTime: 'asc' }
    });
  }

  private generateSampleId(): string {
    // Format: LAB-YYYYMMDD-XXXX
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `LAB-${dateStr}-${random}`;
  }
}

export const labSampleService = new LabSampleService();
```

---

### 10. Dietary Management UI

**Status:** Minimal frontend
**Effort:** 2-3 days
**Dependencies:** Backend dietary routes (exist)

**Implementation similar to Quality Dashboard - create:**
- `frontend/src/pages/Dietary/index.tsx`
- Components: MealPlanning, DietaryOrders, NutritionTracking, MenuManagement

---

## LOW PRIORITY

### 11. Advanced Analytics (Financial Forecasting)

**Effort:** 5-7 days
**Dependencies:** Historical billing data

**Features:**
- Revenue forecasting using time series analysis
- Cost center analytics
- Budget vs actual tracking
- Department profitability analysis

### 12. OR/Bed Optimization

**Effort:** 5-7 days
**Dependencies:** Surgery and IPD modules

**Features:**
- OR scheduling optimization using constraint satisfaction
- Bed assignment optimization
- Turnover time prediction
- Resource utilization analytics

### 13. GPS Tracking for Ambulances

**Effort:** 3-4 days
**Dependencies:** Mobile app or GPS device integration

**Features:**
- Real-time location tracking
- ETA calculation
- Route optimization
- Dispatch management

### 14. PACS Integration for Radiology

**Effort:** 7-10 days
**Dependencies:** DICOM server, PACS system

**Features:**
- DICOM image viewing
- Study list management
- Worklist integration
- Image annotation

### 15. Energy/Sustainability Module

**Effort:** 3-4 days
**Dependencies:** Building management system integration

**Features:**
- Energy consumption tracking
- Waste management tracking
- Sustainability metrics dashboard
- Environmental compliance reporting

---

## Implementation Patterns

### Backend Pattern
```
1. Add Prisma model if needed (schema.prisma)
2. Run: npx prisma migrate dev
3. Create service (services/{module}Service.ts)
4. Create routes (routes/{module}Routes.ts)
5. Register in routes/index.ts
6. Add API methods to frontend (services/api.ts)
```

### Frontend Pattern
```
1. Create page directory (pages/{Module}/)
2. Create index.tsx with tab navigation
3. Create component files in components/
4. Add route to App.tsx
5. Add navigation link to sidebar
```

### AI Service Pattern
```
1. Create directory (ai-services/{service}/)
2. Create service.py with main class
3. Create knowledge_base.py if needed
4. Create main.py with FastAPI endpoints
5. Create Dockerfile and requirements.txt
6. Add to docker-compose.yml
7. Create backend proxy routes
```

---

## Timeline Summary

| Priority | Items | Estimated Effort |
|----------|-------|------------------|
| HIGH | 7 items | 24-31 days |
| MEDIUM | 5 items | 14-18 days |
| LOW | 5 items | 23-31 days |
| **TOTAL** | **17 items** | **61-80 days** |

### HIGH PRIORITY Items
1. Complete Smart Orders API (2-3 days)
2. Quality Management Frontend (3-4 days)
3. AI Microservices - EWS and Smart Orders (4-5 days)
4. AI Scribe Database Persistence (2 days)
5. Patient Portal Dashboard (4-5 days)
6. **NEW**: AI-Enhanced Consultation Flow (5-7 days)
7. **NEW**: Advanced Pharmacy AI Features (4-5 days)

---

*Document created: January 2026*
*Last updated: January 2026*
