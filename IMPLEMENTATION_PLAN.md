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
| HIGH | 5 items | 15-19 days |
| MEDIUM | 5 items | 14-18 days |
| LOW | 5 items | 23-31 days |
| **TOTAL** | **15 items** | **52-68 days** |

---

*Document created: January 2026*
*Last updated: January 2026*
