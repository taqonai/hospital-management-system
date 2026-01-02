"""
AI-Powered Queue Prediction Service
Provides intelligent wait time prediction, queue optimization, and demand forecasting
"""

from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from datetime import datetime, timedelta
import logging
from enum import Enum

logger = logging.getLogger(__name__)


class ServiceType(str, Enum):
    REGISTRATION = "registration"
    CONSULTATION = "consultation"
    BILLING = "billing"
    PHARMACY = "pharmacy"
    LABORATORY = "laboratory"
    RADIOLOGY = "radiology"
    VACCINATION = "vaccination"
    BLOOD_COLLECTION = "blood_collection"
    REPORT_COLLECTION = "report_collection"
    OPD = "opd"
    EMERGENCY = "emergency"


class Priority(str, Enum):
    EMERGENCY = "EMERGENCY"
    HIGH = "HIGH"
    VIP = "VIP"
    PREGNANT = "PREGNANT"
    DISABLED = "DISABLED"
    SENIOR_CITIZEN = "SENIOR_CITIZEN"
    CHILD = "CHILD"
    NORMAL = "NORMAL"
    LOW = "LOW"


# Default service time parameters (in minutes)
SERVICE_TIME_PARAMS = {
    "registration": {"mean": 5, "std": 2, "min": 2, "max": 15},
    "consultation": {"mean": 15, "std": 5, "min": 8, "max": 45},
    "billing": {"mean": 5, "std": 2, "min": 2, "max": 15},
    "pharmacy": {"mean": 8, "std": 3, "min": 3, "max": 20},
    "laboratory": {"mean": 10, "std": 4, "min": 5, "max": 30},
    "radiology": {"mean": 20, "std": 8, "min": 10, "max": 60},
    "vaccination": {"mean": 8, "std": 2, "min": 5, "max": 15},
    "blood_collection": {"mean": 8, "std": 3, "min": 3, "max": 20},
    "report_collection": {"mean": 3, "std": 1, "min": 1, "max": 10},
    "opd": {"mean": 12, "std": 4, "min": 5, "max": 30},
    "emergency": {"mean": 25, "std": 10, "min": 10, "max": 90},
}

# Priority multipliers for wait time
PRIORITY_MULTIPLIERS = {
    "EMERGENCY": 0.1,
    "HIGH": 0.3,
    "VIP": 0.4,
    "PREGNANT": 0.5,
    "DISABLED": 0.5,
    "SENIOR_CITIZEN": 0.6,
    "CHILD": 0.7,
    "NORMAL": 1.0,
    "LOW": 1.2,
}

# Peak hour patterns (24-hour format)
PEAK_HOURS = {
    "morning": {"start": 9, "end": 12, "multiplier": 1.4},
    "afternoon": {"start": 14, "end": 16, "multiplier": 1.2},
    "evening": {"start": 17, "end": 19, "multiplier": 1.3},
}

# Day of week patterns (0 = Monday)
DAY_PATTERNS = {
    0: 1.15,  # Monday - busiest
    1: 1.0,   # Tuesday
    2: 1.0,   # Wednesday
    3: 1.0,   # Thursday
    4: 1.05,  # Friday - slightly busy
    5: 0.7,   # Saturday
    6: 0.4,   # Sunday
}


class QueueFeatureExtractor:
    """Extract features from queue and historical data"""

    def extract_features(self, queue_data: Dict[str, Any]) -> Dict[str, float]:
        """Extract numerical features for ML prediction"""
        features = {}

        # Current queue state
        features["queue_length"] = float(queue_data.get("currentQueueLength", 0))
        features["waiting_patients"] = float(queue_data.get("waitingPatients", 0))
        features["serving_counters"] = float(max(queue_data.get("activeCounters", 1), 1))

        # Time-based features
        now = datetime.now()
        features["hour"] = float(now.hour)
        features["minute"] = float(now.minute)
        features["day_of_week"] = float(now.weekday())
        features["is_weekend"] = 1.0 if now.weekday() >= 5 else 0.0

        # Peak hour indicators
        features["is_morning_peak"] = 1.0 if 9 <= now.hour <= 12 else 0.0
        features["is_afternoon_peak"] = 1.0 if 14 <= now.hour <= 16 else 0.0
        features["is_evening_peak"] = 1.0 if 17 <= now.hour <= 19 else 0.0

        # Service-specific
        service_type = queue_data.get("serviceType", "consultation").lower()
        params = SERVICE_TIME_PARAMS.get(service_type, SERVICE_TIME_PARAMS["consultation"])
        features["base_service_time"] = float(params["mean"])
        features["service_time_std"] = float(params["std"])

        # Historical data (if available)
        historical = queue_data.get("historicalData", {})
        features["avg_wait_today"] = float(historical.get("avgWaitTimeToday", 0))
        features["avg_service_today"] = float(historical.get("avgServiceTimeToday", params["mean"]))
        features["tickets_today"] = float(historical.get("ticketsToday", 0))
        features["completed_today"] = float(historical.get("completedToday", 0))
        features["no_shows_today"] = float(historical.get("noShowsToday", 0))

        # Calculate derived features
        if features["completed_today"] > 0:
            features["no_show_rate"] = features["no_shows_today"] / features["completed_today"]
        else:
            features["no_show_rate"] = 0.1  # Default 10%

        return features


class WaitTimePredictor:
    """ML-based wait time prediction"""

    def __init__(self):
        self.feature_extractor = QueueFeatureExtractor()

    def predict_wait_time(
        self,
        queue_data: Dict[str, Any],
        priority: str = "NORMAL"
    ) -> Dict[str, Any]:
        """Predict wait time for a new patient"""

        features = self.feature_extractor.extract_features(queue_data)
        service_type = queue_data.get("serviceType", "consultation").lower()

        # Get base service time
        params = SERVICE_TIME_PARAMS.get(service_type, SERVICE_TIME_PARAMS["consultation"])
        base_time = features.get("avg_service_today", params["mean"])

        # Calculate queue wait
        queue_position = int(features["waiting_patients"]) + 1
        active_counters = max(int(features["serving_counters"]), 1)

        # Base wait calculation
        raw_wait = (queue_position * base_time) / active_counters

        # Apply time-of-day multiplier
        hour_multiplier = 1.0
        hour = int(features["hour"])
        for period, config in PEAK_HOURS.items():
            if config["start"] <= hour <= config["end"]:
                hour_multiplier = config["multiplier"]
                break

        # Apply day-of-week multiplier
        day_multiplier = DAY_PATTERNS.get(int(features["day_of_week"]), 1.0)

        # Apply priority multiplier
        priority_multiplier = PRIORITY_MULTIPLIERS.get(priority.upper(), 1.0)

        # Calculate final wait time
        adjusted_wait = raw_wait * hour_multiplier * day_multiplier * priority_multiplier

        # Add uncertainty bounds
        std_factor = params["std"] / params["mean"]
        lower_bound = max(adjusted_wait * (1 - std_factor), 1)
        upper_bound = adjusted_wait * (1 + std_factor)

        # Determine confidence level
        if features["completed_today"] > 50:
            confidence = 0.9
        elif features["completed_today"] > 20:
            confidence = 0.8
        elif features["completed_today"] > 10:
            confidence = 0.7
        else:
            confidence = 0.6

        factors = self._get_prediction_factors(features, hour_multiplier, day_multiplier, priority)

        return {
            "estimatedWaitMinutes": round(adjusted_wait),
            "range": {
                "lower": round(lower_bound),
                "upper": round(upper_bound)
            },
            "confidence": confidence,
            "queuePosition": queue_position,
            "activeCounters": active_counters,
            "factors": factors,
            "recommendations": self._get_recommendations(adjusted_wait, features),
            "predictedCallTime": (datetime.now() + timedelta(minutes=adjusted_wait)).isoformat(),
        }

    def _get_prediction_factors(
        self,
        features: Dict[str, float],
        hour_mult: float,
        day_mult: float,
        priority: str
    ) -> List[str]:
        """Get factors affecting the prediction"""
        factors = []

        if features["waiting_patients"] > 10:
            factors.append(f"High queue volume ({int(features['waiting_patients'])} waiting)")
        elif features["waiting_patients"] > 5:
            factors.append(f"Moderate queue volume ({int(features['waiting_patients'])} waiting)")
        else:
            factors.append(f"Low queue volume ({int(features['waiting_patients'])} waiting)")

        if hour_mult > 1.0:
            factors.append(f"Peak hour period (+{int((hour_mult - 1) * 100)}% load)")

        if day_mult > 1.0:
            factors.append(f"Busy day pattern (+{int((day_mult - 1) * 100)}% load)")
        elif day_mult < 1.0:
            factors.append(f"Light day pattern ({int((1 - day_mult) * 100)}% less load)")

        if priority != "NORMAL":
            mult = PRIORITY_MULTIPLIERS.get(priority.upper(), 1.0)
            if mult < 1.0:
                factors.append(f"Priority adjustment ({priority}: {int((1 - mult) * 100)}% faster)")

        if features["serving_counters"] < 2:
            factors.append("Limited counters available")
        elif features["serving_counters"] > 3:
            factors.append(f"Multiple counters active ({int(features['serving_counters'])})")

        return factors

    def _get_recommendations(
        self,
        wait_time: float,
        features: Dict[str, float]
    ) -> List[str]:
        """Generate recommendations based on predicted wait"""
        recommendations = []

        if wait_time > 30:
            recommendations.append("Consider visiting during off-peak hours (early morning or late afternoon)")
            recommendations.append("You may step out briefly - we'll send SMS when your turn approaches")
        elif wait_time > 15:
            recommendations.append("Estimated wait is moderate - please stay in the waiting area")
        else:
            recommendations.append("Short wait expected - please proceed to the waiting area")

        if features.get("is_weekend", 0) == 0 and features.get("is_morning_peak", 0) == 0:
            if features["hour"] < 9:
                recommendations.append("You arrived during off-peak hours - shorter wait expected")

        return recommendations


class QueueOptimizer:
    """Optimize queue flow and counter assignments"""

    def find_optimal_counter(
        self,
        counters: List[Dict[str, Any]],
        service_type: str,
        patient_priority: str = "NORMAL"
    ) -> Dict[str, Any]:
        """Find the optimal counter for a patient"""

        if not counters:
            return {"counterId": None, "reason": "No counters available"}

        # Filter counters that serve this service type
        eligible = []
        for counter in counters:
            counter_type = counter.get("counterType", "").lower()
            services = counter.get("servicesOffered", [])

            if (counter_type == service_type.lower() or
                service_type.lower() in [s.lower() for s in services]):
                eligible.append(counter)

        if not eligible:
            # Fall back to general counters
            eligible = [c for c in counters if c.get("counterType", "").lower() == "general"]

        if not eligible:
            return {"counterId": None, "reason": "No suitable counters found"}

        # Score each counter
        scored_counters = []
        for counter in eligible:
            score = self._score_counter(counter, patient_priority)
            scored_counters.append((counter, score))

        # Sort by score (higher is better)
        scored_counters.sort(key=lambda x: x[1], reverse=True)
        best_counter, best_score = scored_counters[0]

        return {
            "counterId": best_counter.get("id"),
            "counterNumber": best_counter.get("counterNumber"),
            "counterName": best_counter.get("counterName"),
            "score": round(best_score, 2),
            "queueLength": len(best_counter.get("tickets", [])),
            "estimatedServiceTime": best_counter.get("avgServiceTime", 10),
            "reason": self._get_selection_reason(best_counter, scored_counters)
        }

    def _score_counter(self, counter: Dict[str, Any], priority: str) -> float:
        """Score a counter for optimal assignment"""
        score = 100.0

        # Penalize based on queue length
        queue_length = len(counter.get("tickets", []))
        score -= queue_length * 10

        # Bonus for faster service time
        avg_time = counter.get("avgServiceTime", 10)
        if avg_time < 8:
            score += 10
        elif avg_time > 15:
            score -= 10

        # Consider current load
        if counter.get("currentTicketId"):
            score -= 5  # Currently busy

        # Check if counter is active
        if not counter.get("isActive", True):
            score -= 50

        return max(score, 0)

    def _get_selection_reason(
        self,
        selected: Dict[str, Any],
        all_scored: List[Tuple[Dict, float]]
    ) -> str:
        """Explain why this counter was selected"""
        queue_len = len(selected.get("tickets", []))

        if queue_len == 0:
            return "Counter has no queue - immediate service available"
        elif queue_len == 1:
            return "Counter has shortest queue (1 patient waiting)"
        else:
            return f"Optimal counter based on queue length ({queue_len}) and service time"


class DemandForecaster:
    """Forecast queue demand and staffing needs"""

    def forecast_demand(
        self,
        historical_data: List[Dict[str, Any]],
        target_date: str,
        service_type: str
    ) -> Dict[str, Any]:
        """Forecast demand for a specific date"""

        if not historical_data:
            return self._default_forecast(target_date, service_type)

        # Parse target date
        target = datetime.fromisoformat(target_date) if isinstance(target_date, str) else target_date
        target_weekday = target.weekday()

        # Filter historical data for same day of week
        same_day_data = [
            d for d in historical_data
            if datetime.fromisoformat(d.get("date", target_date)).weekday() == target_weekday
        ]

        if not same_day_data:
            same_day_data = historical_data

        # Calculate hourly predictions
        hourly_predictions = {}
        for hour in range(7, 21):  # 7 AM to 9 PM
            hour_data = []
            for d in same_day_data:
                hourly = d.get("hourlyData", {})
                if str(hour) in hourly:
                    hour_data.append(hourly[str(hour)])

            if hour_data:
                avg_tickets = np.mean([h.get("tickets", 0) for h in hour_data])
                avg_wait = np.mean([h.get("avgWait", 10) for h in hour_data])
            else:
                # Use time-of-day patterns
                base = 10
                if 9 <= hour <= 12:
                    avg_tickets = base * 1.4
                elif 14 <= hour <= 16:
                    avg_tickets = base * 1.2
                elif 17 <= hour <= 19:
                    avg_tickets = base * 1.3
                else:
                    avg_tickets = base * 0.8
                avg_wait = 10

            hourly_predictions[hour] = {
                "expectedTickets": round(avg_tickets),
                "expectedWaitTime": round(avg_wait),
                "staffingRecommendation": self._calculate_staffing(avg_tickets, avg_wait)
            }

        # Find peak hours
        peak_hours = sorted(
            hourly_predictions.items(),
            key=lambda x: x[1]["expectedTickets"],
            reverse=True
        )[:3]

        total_expected = sum(h["expectedTickets"] for h in hourly_predictions.values())

        return {
            "date": target_date,
            "serviceType": service_type,
            "totalExpectedTickets": total_expected,
            "hourlyForecast": hourly_predictions,
            "peakHours": [{"hour": h, "data": d} for h, d in peak_hours],
            "staffingRecommendation": {
                "minimum": max(2, total_expected // 100),
                "optimal": max(3, total_expected // 60),
                "peak": max(4, total_expected // 40)
            },
            "confidence": 0.75 if len(same_day_data) >= 4 else 0.6,
        }

    def _default_forecast(self, target_date: str, service_type: str) -> Dict[str, Any]:
        """Generate default forecast when no historical data"""
        target = datetime.fromisoformat(target_date) if isinstance(target_date, str) else target_date
        day_mult = DAY_PATTERNS.get(target.weekday(), 1.0)

        hourly_predictions = {}
        for hour in range(7, 21):
            base = 10 * day_mult
            if 9 <= hour <= 12:
                tickets = base * 1.4
            elif 14 <= hour <= 16:
                tickets = base * 1.2
            elif 17 <= hour <= 19:
                tickets = base * 1.3
            else:
                tickets = base * 0.7

            hourly_predictions[hour] = {
                "expectedTickets": round(tickets),
                "expectedWaitTime": 10,
                "staffingRecommendation": self._calculate_staffing(tickets, 10)
            }

        return {
            "date": target_date,
            "serviceType": service_type,
            "totalExpectedTickets": sum(h["expectedTickets"] for h in hourly_predictions.values()),
            "hourlyForecast": hourly_predictions,
            "peakHours": [{"hour": 10, "data": hourly_predictions.get(10, {})}],
            "staffingRecommendation": {"minimum": 2, "optimal": 3, "peak": 4},
            "confidence": 0.5,
            "note": "Default forecast - insufficient historical data"
        }

    def _calculate_staffing(self, expected_tickets: float, avg_wait: float) -> int:
        """Calculate recommended staffing level"""
        if expected_tickets <= 5:
            return 1
        elif expected_tickets <= 15:
            return 2
        elif expected_tickets <= 30:
            return 3
        else:
            return max(4, int(expected_tickets / 10))


class QueuePredictionAI:
    """Main Queue Prediction AI Service"""

    def __init__(self):
        self.model_version = "1.0.0"
        self.wait_predictor = WaitTimePredictor()
        self.optimizer = QueueOptimizer()
        self.forecaster = DemandForecaster()

    def predict_wait_time(
        self,
        queue_data: Dict[str, Any],
        priority: str = "NORMAL"
    ) -> Dict[str, Any]:
        """Predict wait time for a patient"""
        try:
            result = self.wait_predictor.predict_wait_time(queue_data, priority)
            result["modelVersion"] = self.model_version
            return result
        except Exception as e:
            logger.error(f"Wait time prediction error: {e}")
            return {
                "estimatedWaitMinutes": 15,
                "range": {"lower": 10, "upper": 25},
                "confidence": 0.5,
                "error": str(e),
                "modelVersion": self.model_version
            }

    def optimize_queue(
        self,
        counters: List[Dict[str, Any]],
        service_type: str,
        patient_priority: str = "NORMAL"
    ) -> Dict[str, Any]:
        """Find optimal counter assignment"""
        try:
            result = self.optimizer.find_optimal_counter(counters, service_type, patient_priority)
            result["modelVersion"] = self.model_version
            return result
        except Exception as e:
            logger.error(f"Queue optimization error: {e}")
            return {
                "counterId": None,
                "error": str(e),
                "modelVersion": self.model_version
            }

    def forecast_demand(
        self,
        historical_data: List[Dict[str, Any]],
        target_date: str,
        service_type: str
    ) -> Dict[str, Any]:
        """Forecast queue demand"""
        try:
            result = self.forecaster.forecast_demand(historical_data, target_date, service_type)
            result["modelVersion"] = self.model_version
            return result
        except Exception as e:
            logger.error(f"Demand forecast error: {e}")
            return {
                "error": str(e),
                "modelVersion": self.model_version
            }

    def calculate_priority_score(
        self,
        priority: str,
        age: int = 35,
        has_appointment: bool = False,
        urgency_level: Optional[str] = None
    ) -> Dict[str, Any]:
        """Calculate AI-based priority score"""
        score = 50  # Base score
        factors = []

        # Priority contribution
        priority_scores = {
            "EMERGENCY": 100,
            "HIGH": 80,
            "VIP": 75,
            "PREGNANT": 70,
            "DISABLED": 70,
            "SENIOR_CITIZEN": 65,
            "CHILD": 60,
            "NORMAL": 50,
            "LOW": 30,
        }
        score = priority_scores.get(priority.upper(), 50)
        factors.append(f"Base priority ({priority}): {score} points")

        # Age adjustment
        if age >= 75:
            score += 15
            factors.append(f"Senior age ({age}): +15 points")
        elif age >= 65:
            score += 10
            factors.append(f"Elder age ({age}): +10 points")
        elif age <= 5:
            score += 10
            factors.append(f"Infant/toddler ({age}): +10 points")
        elif age <= 12:
            score += 5
            factors.append(f"Child ({age}): +5 points")

        # Appointment bonus
        if has_appointment:
            score += 10
            factors.append("Has scheduled appointment: +10 points")

        # Urgency level
        if urgency_level:
            urgency_scores = {
                "critical": 30,
                "high": 20,
                "medium": 10,
                "low": 0,
            }
            urgency_add = urgency_scores.get(urgency_level.lower(), 0)
            if urgency_add > 0:
                score += urgency_add
                factors.append(f"Urgency level ({urgency_level}): +{urgency_add} points")

        return {
            "score": min(score, 100),
            "factors": factors,
            "recommendedPosition": "front" if score >= 80 else "priority" if score >= 60 else "normal",
            "modelVersion": self.model_version
        }

    def analyze_queue_health(
        self,
        queue_status: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze overall queue health and provide insights"""
        waiting = queue_status.get("waiting", 0)
        serving = queue_status.get("serving", 0)
        completed = queue_status.get("completed", 0)
        no_show = queue_status.get("noShow", 0)
        avg_wait = queue_status.get("avgWaitTime", 0)
        active_counters = queue_status.get("activeCounters", 1)

        # Calculate metrics
        throughput = completed / max(active_counters, 1)
        no_show_rate = no_show / max(completed + no_show, 1) * 100
        queue_per_counter = waiting / max(active_counters, 1)

        # Determine health status
        issues = []
        recommendations = []

        if avg_wait > 30:
            issues.append("High average wait time")
            recommendations.append("Consider opening additional counters")
            health_score = 40
        elif avg_wait > 20:
            issues.append("Moderate wait time")
            recommendations.append("Monitor queue flow")
            health_score = 60
        else:
            health_score = 80

        if no_show_rate > 15:
            issues.append(f"High no-show rate ({no_show_rate:.1f}%)")
            recommendations.append("Implement SMS reminders")
            health_score -= 10

        if queue_per_counter > 10:
            issues.append("Queue overload detected")
            recommendations.append("Activate standby counters")
            health_score -= 15

        if not issues:
            issues.append("All metrics within normal range")
            recommendations.append("Continue current operations")

        return {
            "healthScore": max(health_score, 0),
            "status": "healthy" if health_score >= 70 else "warning" if health_score >= 50 else "critical",
            "metrics": {
                "waitingPatients": waiting,
                "servingPatients": serving,
                "completedToday": completed,
                "noShowToday": no_show,
                "avgWaitTime": round(avg_wait),
                "throughputPerCounter": round(throughput, 1),
                "noShowRate": round(no_show_rate, 1),
                "queuePerCounter": round(queue_per_counter, 1)
            },
            "issues": issues,
            "recommendations": recommendations,
            "modelVersion": self.model_version
        }
