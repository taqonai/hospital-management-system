"""
Recommendation Engine for A'mad Precision Health

Rule-based recommendation system that correlates data from:
- Wearable health data (steps, heart rate, sleep, HRV)
- Genomic profiles
- Lab results
- Nutrition logs
- Fitness goals

Generates personalized health recommendations and calculates daily health scores.
"""

import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
import math

logger = logging.getLogger(__name__)


class RecommendationCategory(str, Enum):
    NUTRITION = "NUTRITION"
    SUPPLEMENT = "SUPPLEMENT"
    ACTIVITY = "ACTIVITY"
    SLEEP = "SLEEP"
    LIFESTYLE = "LIFESTYLE"
    MEDICAL = "MEDICAL"
    GENOMIC = "GENOMIC"
    LAB_BASED = "LAB_BASED"
    WEARABLE_BASED = "WEARABLE_BASED"


class RecommendationPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class HealthScoreTrend(str, Enum):
    IMPROVING = "IMPROVING"
    STABLE = "STABLE"
    DECLINING = "DECLINING"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


@dataclass
class Recommendation:
    category: RecommendationCategory
    priority: RecommendationPriority
    title: str
    description: str
    reasoning: List[str]
    dataSources: List[str]
    actionItems: Optional[List[str]] = None
    validDays: int = 30


@dataclass
class HealthScore:
    overall: int  # 0-100
    sleep: int
    activity: int
    nutrition: int
    recovery: int
    compliance: int
    stress: Optional[int]
    trend: HealthScoreTrend
    insights: List[str]
    dataQuality: float  # 0.0-1.0


# Rule definitions for recommendations
WEARABLE_RULES = {
    "low_steps": {
        "condition": lambda data: data.get("avg_steps", 10000) < 5000,
        "recommendation": Recommendation(
            category=RecommendationCategory.ACTIVITY,
            priority=RecommendationPriority.MEDIUM,
            title="Increase Daily Steps",
            description="Your step count is below recommended levels. Try to incorporate more walking into your daily routine.",
            reasoning=["Average daily steps below 5,000"],
            dataSources=["WEARABLE_STEPS"],
            actionItems=[
                "Take a 10-minute walk after each meal",
                "Use stairs instead of elevators",
                "Park farther from entrances",
                "Set hourly movement reminders"
            ]
        )
    },
    "high_resting_hr": {
        "condition": lambda data: data.get("avg_resting_hr", 70) > 85,
        "recommendation": Recommendation(
            category=RecommendationCategory.ACTIVITY,
            priority=RecommendationPriority.HIGH,
            title="Elevated Resting Heart Rate",
            description="Your resting heart rate is elevated. Consider increasing cardiovascular exercise and managing stress.",
            reasoning=["Resting heart rate above 85 bpm"],
            dataSources=["WEARABLE_HEART_RATE"],
            actionItems=[
                "Start with 20 minutes of moderate cardio daily",
                "Practice deep breathing exercises",
                "Ensure adequate sleep",
                "Reduce caffeine intake"
            ]
        )
    },
    "low_hrv": {
        "condition": lambda data: data.get("avg_hrv", 50) < 30,
        "recommendation": Recommendation(
            category=RecommendationCategory.LIFESTYLE,
            priority=RecommendationPriority.MEDIUM,
            title="Low Heart Rate Variability",
            description="Your HRV indicates your body may be under stress or needs more recovery time.",
            reasoning=["HRV below 30ms indicates stress or fatigue"],
            dataSources=["WEARABLE_HRV"],
            actionItems=[
                "Prioritize 7-9 hours of sleep",
                "Include rest days in your exercise routine",
                "Practice meditation or yoga",
                "Avoid intense workouts when HRV is low"
            ]
        )
    },
    "poor_sleep": {
        "condition": lambda data: data.get("avg_sleep_hours", 7) < 6,
        "recommendation": Recommendation(
            category=RecommendationCategory.SLEEP,
            priority=RecommendationPriority.HIGH,
            title="Insufficient Sleep Duration",
            description="You're not getting enough sleep, which affects recovery, metabolism, and cognitive function.",
            reasoning=["Average sleep less than 6 hours"],
            dataSources=["WEARABLE_SLEEP"],
            actionItems=[
                "Set a consistent bedtime",
                "Avoid screens 1 hour before bed",
                "Keep bedroom cool and dark",
                "Limit caffeine after 2 PM"
            ]
        )
    },
    "low_activity_minutes": {
        "condition": lambda data: data.get("avg_active_minutes", 30) < 20,
        "recommendation": Recommendation(
            category=RecommendationCategory.ACTIVITY,
            priority=RecommendationPriority.MEDIUM,
            title="Low Active Minutes",
            description="Your daily active minutes are below recommended levels for cardiovascular health.",
            reasoning=["Less than 20 active minutes per day"],
            dataSources=["WEARABLE_ACTIVITY"],
            actionItems=[
                "Aim for 30 minutes of moderate activity daily",
                "Break up sedentary time every hour",
                "Try a fitness class or workout video",
                "Track activities to stay motivated"
            ]
        )
    }
}

LAB_RULES = {
    "low_vitamin_d": {
        "condition": lambda data: any(
            r.get("testName", "").lower().find("vitamin d") >= 0 and
            float(r.get("value", "30").replace('<', '').replace('>', '')) < 30
            for r in data.get("lab_results", [])
        ),
        "recommendation": Recommendation(
            category=RecommendationCategory.SUPPLEMENT,
            priority=RecommendationPriority.MEDIUM,
            title="Low Vitamin D Levels",
            description="Your vitamin D levels are below optimal. Supplementation may be beneficial.",
            reasoning=["Vitamin D below 30 ng/mL"],
            dataSources=["LAB_VITAMIN_D"],
            actionItems=[
                "Consider vitamin D3 supplementation (2000-4000 IU daily)",
                "Get 15-20 minutes of sun exposure daily",
                "Eat vitamin D rich foods (fatty fish, eggs)",
                "Retest in 3 months"
            ]
        )
    },
    "high_fasting_glucose": {
        "condition": lambda data: any(
            "glucose" in r.get("testName", "").lower() and
            float(r.get("value", "90").replace('<', '').replace('>', '')) > 100
            for r in data.get("lab_results", [])
        ),
        "recommendation": Recommendation(
            category=RecommendationCategory.NUTRITION,
            priority=RecommendationPriority.HIGH,
            title="Elevated Fasting Glucose",
            description="Your fasting glucose is elevated, indicating potential insulin resistance.",
            reasoning=["Fasting glucose above 100 mg/dL"],
            dataSources=["LAB_GLUCOSE"],
            actionItems=[
                "Reduce refined carbohydrate intake",
                "Increase fiber consumption",
                "Regular post-meal walks",
                "Consider HbA1c test",
                "Consult with your doctor"
            ]
        )
    },
    "high_ldl": {
        "condition": lambda data: any(
            "ldl" in r.get("testName", "").lower() and
            float(r.get("value", "100").replace('<', '').replace('>', '')) > 130
            for r in data.get("lab_results", [])
        ),
        "recommendation": Recommendation(
            category=RecommendationCategory.NUTRITION,
            priority=RecommendationPriority.MEDIUM,
            title="Elevated LDL Cholesterol",
            description="Your LDL cholesterol is above optimal levels.",
            reasoning=["LDL above 130 mg/dL"],
            dataSources=["LAB_CHOLESTEROL"],
            actionItems=[
                "Reduce saturated fat intake",
                "Increase soluble fiber (oats, beans)",
                "Consider plant sterols/stanols",
                "Regular cardiovascular exercise",
                "Follow up with your doctor"
            ]
        )
    }
}

GENOMIC_RULES = {
    "slow_caffeine_metabolizer": {
        "condition": lambda data: any(
            m.get("gene") == "CYP1A2" and "slow" in m.get("phenotype", "").lower()
            for m in data.get("genomic_markers", [])
        ),
        "recommendation": Recommendation(
            category=RecommendationCategory.GENOMIC,
            priority=RecommendationPriority.LOW,
            title="Limit Caffeine Intake",
            description="Based on your genetics, you metabolize caffeine slowly.",
            reasoning=["CYP1A2 slow metabolizer variant"],
            dataSources=["GENOMIC_CYP1A2"],
            actionItems=[
                "Limit coffee to 1-2 cups daily",
                "Avoid caffeine after noon",
                "Switch to decaf in the afternoon",
                "Monitor heart rate after caffeine"
            ]
        )
    },
    "reduced_folate": {
        "condition": lambda data: any(
            m.get("gene") == "MTHFR" and "reduced" in m.get("phenotype", "").lower()
            for m in data.get("genomic_markers", [])
        ),
        "recommendation": Recommendation(
            category=RecommendationCategory.GENOMIC,
            priority=RecommendationPriority.MEDIUM,
            title="Optimize Folate Intake",
            description="Your genetics indicate reduced folate metabolism.",
            reasoning=["MTHFR variant affecting folate processing"],
            dataSources=["GENOMIC_MTHFR"],
            actionItems=[
                "Choose methylfolate over folic acid",
                "Eat plenty of leafy greens",
                "Consider B-complex supplementation",
                "Important to discuss with doctor if planning pregnancy"
            ]
        )
    },
    "lactose_intolerant": {
        "condition": lambda data: any(
            m.get("gene") == "LCT" and "intolerant" in m.get("phenotype", "").lower()
            for m in data.get("genomic_markers", [])
        ),
        "recommendation": Recommendation(
            category=RecommendationCategory.GENOMIC,
            priority=RecommendationPriority.LOW,
            title="Consider Dairy Alternatives",
            description="Your genetics indicate lactose intolerance.",
            reasoning=["LCT variant - lactase non-persistence"],
            dataSources=["GENOMIC_LCT"],
            actionItems=[
                "Choose lactose-free dairy products",
                "Try plant-based alternatives",
                "Fermented dairy (yogurt, aged cheese) may be tolerated",
                "Ensure adequate calcium from other sources"
            ]
        )
    }
}

NUTRITION_RULES = {
    "low_protein": {
        "condition": lambda data: data.get("avg_protein", 50) < 40,
        "recommendation": Recommendation(
            category=RecommendationCategory.NUTRITION,
            priority=RecommendationPriority.MEDIUM,
            title="Increase Protein Intake",
            description="Your protein intake is below recommended levels for muscle maintenance.",
            reasoning=["Average protein intake below 40g daily"],
            dataSources=["NUTRITION_LOGS"],
            actionItems=[
                "Include protein at every meal",
                "Aim for 0.8-1g protein per kg body weight",
                "Good sources: eggs, fish, poultry, legumes",
                "Consider protein-rich snacks"
            ]
        )
    },
    "high_sodium": {
        "condition": lambda data: data.get("avg_sodium", 2000) > 2500,
        "recommendation": Recommendation(
            category=RecommendationCategory.NUTRITION,
            priority=RecommendationPriority.MEDIUM,
            title="Reduce Sodium Intake",
            description="Your sodium intake is above recommended levels.",
            reasoning=["Average sodium intake above 2500mg daily"],
            dataSources=["NUTRITION_LOGS"],
            actionItems=[
                "Reduce processed food consumption",
                "Cook more meals at home",
                "Use herbs and spices instead of salt",
                "Read nutrition labels carefully"
            ]
        )
    },
    "low_fiber": {
        "condition": lambda data: data.get("avg_fiber", 25) < 20,
        "recommendation": Recommendation(
            category=RecommendationCategory.NUTRITION,
            priority=RecommendationPriority.LOW,
            title="Increase Fiber Intake",
            description="Your fiber intake is below recommended levels.",
            reasoning=["Average fiber intake below 20g daily"],
            dataSources=["NUTRITION_LOGS"],
            actionItems=[
                "Eat more vegetables and fruits",
                "Choose whole grains over refined",
                "Add legumes to your meals",
                "Try chia seeds or flaxseeds"
            ]
        )
    }
}


class RecommendationService:
    """
    Service for generating personalized health recommendations
    and calculating daily health scores.
    """

    def __init__(self):
        self.wearable_rules = WEARABLE_RULES
        self.lab_rules = LAB_RULES
        self.genomic_rules = GENOMIC_RULES
        self.nutrition_rules = NUTRITION_RULES
        logger.info("RecommendationService initialized")

    def generate_recommendations(self, patient_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Generate personalized recommendations based on all available patient data.

        patient_data should include (accepts multiple field name formats):
        - healthData / wearable_data: Dict of aggregated wearable metrics
        - genomicProfile / genomic_markers: Dict with markers list or list of markers
        - labResults / lab_results: List of recent lab results
        - nutritionLogs / nutrition_logs: List of nutrition entries
        - fitnessGoals / fitness_goals: Dict with fitness and wellness goals
        """
        recommendations = []

        # Process wearable data (support both field names)
        health_data = patient_data.get("healthData") or patient_data.get("wearable_data", {})
        wearable_metrics = self._aggregate_wearable_data(health_data)

        for rule_name, rule in self.wearable_rules.items():
            try:
                if rule["condition"](wearable_metrics):
                    rec = rule["recommendation"]
                    recommendations.append(self._recommendation_to_dict(rec))
            except Exception as e:
                logger.warning(f"Error evaluating wearable rule {rule_name}: {e}")

        # Process lab results (support both field names)
        lab_results = patient_data.get("labResults") or patient_data.get("lab_results", [])
        lab_data = {"lab_results": lab_results}
        for rule_name, rule in self.lab_rules.items():
            try:
                if rule["condition"](lab_data):
                    rec = rule["recommendation"]
                    recommendations.append(self._recommendation_to_dict(rec))
            except Exception as e:
                logger.warning(f"Error evaluating lab rule {rule_name}: {e}")

        # Process genomic markers (support multiple formats)
        genomic_profile = patient_data.get("genomicProfile") or {}
        genomic_markers = patient_data.get("genomic_markers") or genomic_profile.get("markers", [])
        # Handle both list of markers and profile with markers key
        if isinstance(genomic_markers, dict) and "markers" in genomic_markers:
            genomic_markers = genomic_markers["markers"]
        genomic_data = {"genomic_markers": genomic_markers}
        for rule_name, rule in self.genomic_rules.items():
            try:
                if rule["condition"](genomic_data):
                    rec = rule["recommendation"]
                    recommendations.append(self._recommendation_to_dict(rec))
            except Exception as e:
                logger.warning(f"Error evaluating genomic rule {rule_name}: {e}")

        # Process nutrition logs (support both field names)
        nutrition_logs = patient_data.get("nutritionLogs") or patient_data.get("nutrition_logs", [])
        nutrition_data = self._aggregate_nutrition_data(nutrition_logs)
        for rule_name, rule in self.nutrition_rules.items():
            try:
                if rule["condition"](nutrition_data):
                    rec = rule["recommendation"]
                    recommendations.append(self._recommendation_to_dict(rec))
            except Exception as e:
                logger.warning(f"Error evaluating nutrition rule {rule_name}: {e}")

        # Sort by priority
        priority_order = {"URGENT": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
        recommendations.sort(key=lambda x: priority_order.get(x["priority"], 4))

        logger.info(f"Generated {len(recommendations)} recommendations")
        return recommendations

    def _aggregate_wearable_data(self, health_data: Dict[str, Any]) -> Dict[str, Any]:
        """Aggregate wearable data into metrics for rule evaluation."""
        aggregated = {}

        # Extract steps
        if "STEPS" in health_data:
            values = [v["value"] for v in health_data["STEPS"].get("values", [])]
            aggregated["avg_steps"] = sum(values) / len(values) if values else 0

        # Extract resting heart rate
        if "HEART_RATE_RESTING" in health_data:
            values = [v["value"] for v in health_data["HEART_RATE_RESTING"].get("values", [])]
            aggregated["avg_resting_hr"] = sum(values) / len(values) if values else 70

        # Extract HRV
        if "HRV" in health_data:
            values = [v["value"] for v in health_data["HRV"].get("values", [])]
            aggregated["avg_hrv"] = sum(values) / len(values) if values else 50

        # Extract sleep
        if "SLEEP_DURATION" in health_data:
            values = [v["value"] / 60 for v in health_data["SLEEP_DURATION"].get("values", [])]  # Convert to hours
            aggregated["avg_sleep_hours"] = sum(values) / len(values) if values else 7

        # Extract active minutes
        if "ACTIVE_MINUTES" in health_data:
            values = [v["value"] for v in health_data["ACTIVE_MINUTES"].get("values", [])]
            aggregated["avg_active_minutes"] = sum(values) / len(values) if values else 30

        return aggregated

    def _aggregate_nutrition_data(self, nutrition_logs: List[Dict]) -> Dict[str, Any]:
        """Aggregate nutrition data for rule evaluation."""
        if not nutrition_logs:
            return {}

        totals = {"protein": 0, "sodium": 0, "fiber": 0, "count": 0}

        for log in nutrition_logs:
            totals["protein"] += float(log.get("protein", 0) or 0)
            totals["sodium"] += float(log.get("sodium", 0) or 0)
            totals["fiber"] += float(log.get("fiber", 0) or 0)
            totals["count"] += 1

        days = max(1, totals["count"] / 3)  # Assume ~3 meals per day

        return {
            "avg_protein": totals["protein"] / days,
            "avg_sodium": totals["sodium"] / days,
            "avg_fiber": totals["fiber"] / days,
        }

    def _recommendation_to_dict(self, rec: Recommendation) -> Dict[str, Any]:
        """Convert Recommendation to dictionary."""
        return {
            "category": rec.category.value,
            "priority": rec.priority.value,
            "title": rec.title,
            "description": rec.description,
            "reasoning": rec.reasoning,
            "dataSources": rec.dataSources,
            "actionItems": rec.actionItems,
            "validDays": rec.validDays
        }

    def calculate_daily_score(self, patient_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate daily health score based on available data.

        Returns a HealthScore with component scores and insights.
        Accepts multiple field name formats for flexibility.
        """
        scores = {}
        insights = []
        data_points = 0
        max_data_points = 5  # sleep, activity, nutrition, recovery, compliance

        # Sleep score (based on duration and quality)
        # Support both field name formats
        health_data = patient_data.get("healthData") or patient_data.get("wearable_data", {})
        sleep_data = health_data.get("SLEEP_DURATION", {}).get("values", [])
        if sleep_data:
            avg_sleep_hours = sum(v["value"] / 60 for v in sleep_data) / len(sleep_data)
            # Optimal is 7-9 hours
            if 7 <= avg_sleep_hours <= 9:
                scores["sleep"] = 100
            elif 6 <= avg_sleep_hours < 7 or 9 < avg_sleep_hours <= 10:
                scores["sleep"] = 75
            elif 5 <= avg_sleep_hours < 6 or 10 < avg_sleep_hours <= 11:
                scores["sleep"] = 50
            else:
                scores["sleep"] = 25
            data_points += 1

            if avg_sleep_hours < 7:
                insights.append(f"Average sleep: {avg_sleep_hours:.1f} hours - below optimal 7-9 hours")
        else:
            scores["sleep"] = 50  # Default

        # Activity score (based on steps and active minutes)
        steps_data = health_data.get("STEPS", {}).get("values", [])
        if steps_data:
            avg_steps = sum(v["value"] for v in steps_data) / len(steps_data)
            # Target: 10,000 steps
            scores["activity"] = min(100, int((avg_steps / 10000) * 100))
            data_points += 1

            if avg_steps < 5000:
                insights.append(f"Average steps: {int(avg_steps)} - try to reach 10,000")
        else:
            scores["activity"] = 50

        # Nutrition score (based on logged meals)
        # Support both field name formats
        nutrition_logs = patient_data.get("nutritionLogs") or patient_data.get("nutrition_logs", [])
        if nutrition_logs:
            # Score based on meal logging compliance and balance
            meals_logged = len(nutrition_logs)
            expected_meals = 3  # Per day
            logging_score = min(100, int((meals_logged / expected_meals) * 100))

            # Check for balanced macros
            total_protein = sum(float(log.get("protein", 0) or 0) for log in nutrition_logs)
            total_carbs = sum(float(log.get("carbs", 0) or 0) for log in nutrition_logs)
            total_fat = sum(float(log.get("fat", 0) or 0) for log in nutrition_logs)

            if total_protein > 0 and total_carbs > 0 and total_fat > 0:
                # Check if reasonably balanced
                total_macros = total_protein + total_carbs + total_fat
                protein_pct = total_protein / total_macros * 100
                balance_score = 100 if 15 <= protein_pct <= 35 else 70

                scores["nutrition"] = int((logging_score + balance_score) / 2)
            else:
                scores["nutrition"] = logging_score

            data_points += 1
        else:
            scores["nutrition"] = 50
            insights.append("No nutrition data logged today")

        # Recovery score (based on HRV and resting heart rate)
        hrv_data = health_data.get("HRV", {}).get("values", [])
        rhr_data = health_data.get("HEART_RATE_RESTING", {}).get("values", [])

        if hrv_data:
            avg_hrv = sum(v["value"] for v in hrv_data) / len(hrv_data)
            # Higher HRV is better, typical range 20-70+
            if avg_hrv >= 60:
                hrv_score = 100
            elif avg_hrv >= 40:
                hrv_score = 75
            elif avg_hrv >= 25:
                hrv_score = 50
            else:
                hrv_score = 25
                insights.append(f"Low HRV ({int(avg_hrv)}ms) - consider more recovery time")

            scores["recovery"] = hrv_score
            data_points += 1
        elif rhr_data:
            avg_rhr = sum(v["value"] for v in rhr_data) / len(rhr_data)
            # Lower resting HR is generally better
            if avg_rhr <= 60:
                scores["recovery"] = 100
            elif avg_rhr <= 70:
                scores["recovery"] = 75
            elif avg_rhr <= 80:
                scores["recovery"] = 50
            else:
                scores["recovery"] = 25
            data_points += 1
        else:
            scores["recovery"] = 50

        # Compliance score (goal adherence)
        # Support both field name formats
        goals = patient_data.get("fitnessGoals") or patient_data.get("fitness_goals", {})
        fitness_goals = goals.get("fitness", [])
        wellness_goals = goals.get("wellness", [])

        if fitness_goals or wellness_goals:
            all_goals = fitness_goals + wellness_goals
            if all_goals:
                completion_rates = []
                for goal in all_goals:
                    target = float(goal.get("target", 1) or 1)
                    current = float(goal.get("current", 0) or 0)
                    completion_rates.append(min(1.0, current / target))

                scores["compliance"] = int(sum(completion_rates) / len(completion_rates) * 100)
                data_points += 1
            else:
                scores["compliance"] = 50
        else:
            scores["compliance"] = 50

        # Stress score (inverse - lower stress is better)
        stress_data = health_data.get("STRESS_LEVEL", {}).get("values", [])
        if stress_data:
            avg_stress = sum(v["value"] for v in stress_data) / len(stress_data)
            # Assuming stress is 0-100 scale
            scores["stress"] = max(0, 100 - int(avg_stress))
        else:
            scores["stress"] = None

        # Calculate overall score (weighted average)
        weights = {"sleep": 0.25, "activity": 0.2, "nutrition": 0.2, "recovery": 0.2, "compliance": 0.15}
        weighted_sum = sum(scores.get(k, 50) * w for k, w in weights.items())
        overall = int(weighted_sum)

        # Calculate data quality
        data_quality = data_points / max_data_points

        # Determine trend (would need historical data, placeholder for now)
        trend = HealthScoreTrend.INSUFFICIENT_DATA if data_quality < 0.4 else HealthScoreTrend.STABLE

        # Add general insights
        if overall >= 80:
            insights.insert(0, "Great job! Your health metrics are looking strong.")
        elif overall >= 60:
            insights.insert(0, "Good progress! A few areas could use attention.")
        else:
            insights.insert(0, "Focus on improving sleep and activity for better health.")

        return {
            "overall": overall,
            "sleep": scores.get("sleep", 50),
            "activity": scores.get("activity", 50),
            "nutrition": scores.get("nutrition", 50),
            "recovery": scores.get("recovery", 50),
            "compliance": scores.get("compliance", 50),
            "stress": scores.get("stress"),
            "trend": trend.value,
            "insights": insights,
            "dataQuality": data_quality
        }


# Singleton instance
_recommendation_service: Optional[RecommendationService] = None


def get_recommendation_service() -> RecommendationService:
    """Get or create the recommendation service singleton"""
    global _recommendation_service
    if _recommendation_service is None:
        _recommendation_service = RecommendationService()
    return _recommendation_service


# Create default instance for backwards compatibility
recommendation_service = get_recommendation_service()
