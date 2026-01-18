"""
Nutrition AI Service for A'mad Precision Health

AI-powered meal analysis using GPT-4 Vision:
- Food detection from photos
- Portion size estimation
- Nutritional breakdown calculation
- Regional food database (Gulf/ME foods)
"""

import logging
import base64
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import json

logger = logging.getLogger(__name__)


class MealType(str, Enum):
    BREAKFAST = "BREAKFAST"
    LUNCH = "LUNCH"
    DINNER = "DINNER"
    SNACK = "SNACK"


class FoodCategory(str, Enum):
    PROTEIN = "PROTEIN"
    CARBOHYDRATE = "CARBOHYDRATE"
    VEGETABLE = "VEGETABLE"
    FRUIT = "FRUIT"
    DAIRY = "DAIRY"
    FAT = "FAT"
    BEVERAGE = "BEVERAGE"
    MIXED = "MIXED"
    DESSERT = "DESSERT"
    CONDIMENT = "CONDIMENT"


class PortionSize(str, Enum):
    SMALL = "SMALL"
    MEDIUM = "MEDIUM"
    LARGE = "LARGE"
    EXTRA_LARGE = "EXTRA_LARGE"


@dataclass
class DetectedFood:
    name: str
    name_ar: Optional[str]
    category: FoodCategory
    confidence: float
    portion_size: PortionSize
    portion_grams: float
    calories: float
    protein: float
    carbs: float
    fat: float
    fiber: float
    sodium: Optional[float] = None
    sugar: Optional[float] = None
    is_regional: bool = False
    region: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class MealAnalysis:
    foods: List[DetectedFood]
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float
    total_fiber: float
    meal_type: MealType
    confidence: float
    suggestions: List[str]
    warnings: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "foods": [f.to_dict() for f in self.foods],
            "total_calories": self.total_calories,
            "total_protein": self.total_protein,
            "total_carbs": self.total_carbs,
            "total_fat": self.total_fat,
            "total_fiber": self.total_fiber,
            "meal_type": self.meal_type.value,
            "confidence": self.confidence,
            "suggestions": self.suggestions,
            "warnings": self.warnings
        }


# Regional Food Database - Gulf/Middle Eastern Foods
# Nutrition per 100g serving
REGIONAL_FOOD_DATABASE = {
    # Rice Dishes
    "kabsa": {
        "name": "Kabsa",
        "name_ar": "كبسة",
        "category": FoodCategory.MIXED,
        "calories": 180,
        "protein": 12,
        "carbs": 25,
        "fat": 6,
        "fiber": 1.5,
        "region": "gulf",
        "aliases": ["كبسه", "kabseh", "machboos rice"]
    },
    "mandi": {
        "name": "Mandi",
        "name_ar": "مندي",
        "category": FoodCategory.MIXED,
        "calories": 195,
        "protein": 14,
        "carbs": 22,
        "fat": 7,
        "fiber": 1,
        "region": "gulf",
        "aliases": ["منديي", "yemen mandi"]
    },
    "machboos": {
        "name": "Machboos",
        "name_ar": "مجبوس",
        "category": FoodCategory.MIXED,
        "calories": 185,
        "protein": 13,
        "carbs": 24,
        "fat": 6.5,
        "fiber": 1.5,
        "region": "gulf",
        "aliases": ["مچبوس", "machbous", "majboos"]
    },
    "biryani": {
        "name": "Biryani",
        "name_ar": "برياني",
        "category": FoodCategory.MIXED,
        "calories": 175,
        "protein": 10,
        "carbs": 28,
        "fat": 5,
        "fiber": 1.2,
        "region": "gulf",
        "aliases": ["برياني دجاج", "chicken biryani"]
    },

    # Breads
    "khubz": {
        "name": "Khubz (Arabic Bread)",
        "name_ar": "خبز عربي",
        "category": FoodCategory.CARBOHYDRATE,
        "calories": 275,
        "protein": 9,
        "carbs": 55,
        "fat": 1.5,
        "fiber": 2.5,
        "region": "gulf",
        "aliases": ["خبز", "arabic bread", "pita"]
    },
    "raqaq": {
        "name": "Raqaq (Thin Bread)",
        "name_ar": "رقاق",
        "category": FoodCategory.CARBOHYDRATE,
        "calories": 310,
        "protein": 8,
        "carbs": 62,
        "fat": 3,
        "fiber": 2,
        "region": "gulf",
        "aliases": ["regag", "ruqaq"]
    },
    "samoon": {
        "name": "Samoon",
        "name_ar": "صمون",
        "category": FoodCategory.CARBOHYDRATE,
        "calories": 270,
        "protein": 8,
        "carbs": 52,
        "fat": 2.5,
        "fiber": 2,
        "region": "gulf",
        "aliases": ["صمونة", "iraqi bread"]
    },

    # Meat Dishes
    "shawarma": {
        "name": "Shawarma",
        "name_ar": "شاورما",
        "category": FoodCategory.PROTEIN,
        "calories": 210,
        "protein": 18,
        "carbs": 8,
        "fat": 12,
        "fiber": 0.5,
        "region": "levant",
        "aliases": ["شاورمة", "shawerma", "chicken shawarma"]
    },
    "kebab": {
        "name": "Kebab",
        "name_ar": "كباب",
        "category": FoodCategory.PROTEIN,
        "calories": 245,
        "protein": 20,
        "carbs": 2,
        "fat": 18,
        "fiber": 0.3,
        "region": "gulf",
        "aliases": ["كباب لحم", "lamb kebab", "kofta"]
    },
    "shish_tawook": {
        "name": "Shish Tawook",
        "name_ar": "شيش طاووق",
        "category": FoodCategory.PROTEIN,
        "calories": 165,
        "protein": 26,
        "carbs": 3,
        "fat": 6,
        "fiber": 0.2,
        "region": "levant",
        "aliases": ["شيش طاوق", "grilled chicken"]
    },
    "lamb_ouzi": {
        "name": "Lamb Ouzi",
        "name_ar": "خروف محشي",
        "category": FoodCategory.PROTEIN,
        "calories": 290,
        "protein": 22,
        "carbs": 15,
        "fat": 16,
        "fiber": 1,
        "region": "gulf",
        "aliases": ["اوزي", "ouzi", "stuffed lamb"]
    },

    # Appetizers & Sides
    "hummus": {
        "name": "Hummus",
        "name_ar": "حمص",
        "category": FoodCategory.MIXED,
        "calories": 166,
        "protein": 8,
        "carbs": 14,
        "fat": 10,
        "fiber": 6,
        "region": "levant",
        "aliases": ["حمص بالطحينة", "humous"]
    },
    "mutabbal": {
        "name": "Mutabbal (Baba Ganoush)",
        "name_ar": "متبل",
        "category": FoodCategory.VEGETABLE,
        "calories": 130,
        "protein": 4,
        "carbs": 10,
        "fat": 9,
        "fiber": 4,
        "region": "levant",
        "aliases": ["بابا غنوج", "baba ghanoush", "eggplant dip"]
    },
    "tabbouleh": {
        "name": "Tabbouleh",
        "name_ar": "تبولة",
        "category": FoodCategory.VEGETABLE,
        "calories": 90,
        "protein": 3,
        "carbs": 16,
        "fat": 2,
        "fiber": 3.5,
        "region": "levant",
        "aliases": ["تبوله", "tabbouli"]
    },
    "fattoush": {
        "name": "Fattoush",
        "name_ar": "فتوش",
        "category": FoodCategory.VEGETABLE,
        "calories": 120,
        "protein": 3,
        "carbs": 14,
        "fat": 6,
        "fiber": 3,
        "region": "levant",
        "aliases": ["فتوشة", "arabic salad"]
    },
    "foul": {
        "name": "Foul Medames",
        "name_ar": "فول مدمس",
        "category": FoodCategory.PROTEIN,
        "calories": 187,
        "protein": 13,
        "carbs": 29,
        "fat": 2,
        "fiber": 9,
        "region": "gulf",
        "aliases": ["فول", "ful", "fava beans"]
    },
    "falafel": {
        "name": "Falafel",
        "name_ar": "فلافل",
        "category": FoodCategory.PROTEIN,
        "calories": 333,
        "protein": 13,
        "carbs": 32,
        "fat": 18,
        "fiber": 5,
        "region": "levant",
        "aliases": ["طعمية", "taamiya"]
    },

    # Soups & Stews
    "harees": {
        "name": "Harees",
        "name_ar": "هريس",
        "category": FoodCategory.MIXED,
        "calories": 145,
        "protein": 8,
        "carbs": 22,
        "fat": 3,
        "fiber": 2,
        "region": "gulf",
        "aliases": ["هريسة", "jareesh"]
    },
    "jareesh": {
        "name": "Jareesh",
        "name_ar": "جريش",
        "category": FoodCategory.MIXED,
        "calories": 160,
        "protein": 7,
        "carbs": 28,
        "fat": 3,
        "fiber": 3,
        "region": "gulf",
        "aliases": ["جريشة"]
    },
    "thareed": {
        "name": "Thareed",
        "name_ar": "ثريد",
        "category": FoodCategory.MIXED,
        "calories": 155,
        "protein": 9,
        "carbs": 20,
        "fat": 5,
        "fiber": 2,
        "region": "gulf",
        "aliases": ["ثريدة", "bread stew"]
    },
    "saloona": {
        "name": "Saloona",
        "name_ar": "صالونة",
        "category": FoodCategory.MIXED,
        "calories": 140,
        "protein": 10,
        "carbs": 12,
        "fat": 6,
        "fiber": 2.5,
        "region": "gulf",
        "aliases": ["صالونه", "vegetable stew"]
    },

    # Desserts
    "kunafa": {
        "name": "Kunafa",
        "name_ar": "كنافة",
        "category": FoodCategory.DESSERT,
        "calories": 385,
        "protein": 8,
        "carbs": 45,
        "fat": 20,
        "fiber": 1,
        "region": "levant",
        "aliases": ["كنافه", "knafeh", "kunafeh"]
    },
    "luqaimat": {
        "name": "Luqaimat",
        "name_ar": "لقيمات",
        "category": FoodCategory.DESSERT,
        "calories": 350,
        "protein": 4,
        "carbs": 55,
        "fat": 13,
        "fiber": 0.5,
        "region": "gulf",
        "aliases": ["لقيمة", "lugaimat", "sweet dumplings"]
    },
    "basbousa": {
        "name": "Basbousa",
        "name_ar": "بسبوسة",
        "category": FoodCategory.DESSERT,
        "calories": 340,
        "protein": 5,
        "carbs": 48,
        "fat": 15,
        "fiber": 1.5,
        "region": "levant",
        "aliases": ["هريسة حلوة", "semolina cake"]
    },
    "umm_ali": {
        "name": "Umm Ali",
        "name_ar": "أم علي",
        "category": FoodCategory.DESSERT,
        "calories": 290,
        "protein": 8,
        "carbs": 38,
        "fat": 12,
        "fiber": 1,
        "region": "gulf",
        "aliases": ["ام علي", "bread pudding"]
    },
    "dates": {
        "name": "Dates",
        "name_ar": "تمر",
        "category": FoodCategory.FRUIT,
        "calories": 277,
        "protein": 2,
        "carbs": 75,
        "fat": 0.2,
        "fiber": 7,
        "region": "gulf",
        "aliases": ["رطب", "khalas", "khudri", "medjool"]
    },

    # Beverages
    "arabic_coffee": {
        "name": "Arabic Coffee",
        "name_ar": "قهوة عربية",
        "category": FoodCategory.BEVERAGE,
        "calories": 5,
        "protein": 0.2,
        "carbs": 0.8,
        "fat": 0,
        "fiber": 0,
        "region": "gulf",
        "aliases": ["قهوة", "gahwa", "saudi coffee"]
    },
    "karak_tea": {
        "name": "Karak Tea",
        "name_ar": "شاي كرك",
        "category": FoodCategory.BEVERAGE,
        "calories": 120,
        "protein": 2,
        "carbs": 18,
        "fat": 4,
        "fiber": 0,
        "region": "gulf",
        "aliases": ["كرك", "chai karak", "masala chai"]
    },
    "laban": {
        "name": "Laban (Buttermilk)",
        "name_ar": "لبن",
        "category": FoodCategory.DAIRY,
        "calories": 40,
        "protein": 3,
        "carbs": 5,
        "fat": 1,
        "fiber": 0,
        "region": "gulf",
        "aliases": ["لبن خض", "ayran"]
    },
    "jallab": {
        "name": "Jallab",
        "name_ar": "جلاب",
        "category": FoodCategory.BEVERAGE,
        "calories": 95,
        "protein": 0.5,
        "carbs": 24,
        "fat": 0,
        "fiber": 0.5,
        "region": "levant",
        "aliases": ["عصير جلاب"]
    }
}


# Standard Food Database - Common International Foods
STANDARD_FOOD_DATABASE = {
    # Proteins
    "grilled_chicken": {
        "name": "Grilled Chicken Breast",
        "category": FoodCategory.PROTEIN,
        "calories": 165,
        "protein": 31,
        "carbs": 0,
        "fat": 3.6,
        "fiber": 0
    },
    "grilled_salmon": {
        "name": "Grilled Salmon",
        "category": FoodCategory.PROTEIN,
        "calories": 208,
        "protein": 20,
        "carbs": 0,
        "fat": 13,
        "fiber": 0
    },
    "beef_steak": {
        "name": "Beef Steak",
        "category": FoodCategory.PROTEIN,
        "calories": 271,
        "protein": 26,
        "carbs": 0,
        "fat": 18,
        "fiber": 0
    },
    "eggs": {
        "name": "Eggs",
        "category": FoodCategory.PROTEIN,
        "calories": 155,
        "protein": 13,
        "carbs": 1.1,
        "fat": 11,
        "fiber": 0
    },

    # Carbohydrates
    "white_rice": {
        "name": "White Rice",
        "category": FoodCategory.CARBOHYDRATE,
        "calories": 130,
        "protein": 2.7,
        "carbs": 28,
        "fat": 0.3,
        "fiber": 0.4
    },
    "brown_rice": {
        "name": "Brown Rice",
        "category": FoodCategory.CARBOHYDRATE,
        "calories": 112,
        "protein": 2.6,
        "carbs": 24,
        "fat": 0.9,
        "fiber": 1.8
    },
    "pasta": {
        "name": "Pasta",
        "category": FoodCategory.CARBOHYDRATE,
        "calories": 131,
        "protein": 5,
        "carbs": 25,
        "fat": 1.1,
        "fiber": 1.8
    },
    "bread_white": {
        "name": "White Bread",
        "category": FoodCategory.CARBOHYDRATE,
        "calories": 265,
        "protein": 9,
        "carbs": 49,
        "fat": 3.2,
        "fiber": 2.7
    },

    # Vegetables
    "salad_mixed": {
        "name": "Mixed Green Salad",
        "category": FoodCategory.VEGETABLE,
        "calories": 20,
        "protein": 1.5,
        "carbs": 4,
        "fat": 0.2,
        "fiber": 2
    },
    "broccoli": {
        "name": "Broccoli",
        "category": FoodCategory.VEGETABLE,
        "calories": 34,
        "protein": 2.8,
        "carbs": 7,
        "fat": 0.4,
        "fiber": 2.6
    },
    "french_fries": {
        "name": "French Fries",
        "category": FoodCategory.VEGETABLE,
        "calories": 312,
        "protein": 3.4,
        "carbs": 41,
        "fat": 15,
        "fiber": 3.8
    },

    # Dairy
    "yogurt": {
        "name": "Yogurt",
        "category": FoodCategory.DAIRY,
        "calories": 59,
        "protein": 10,
        "carbs": 4,
        "fat": 0.7,
        "fiber": 0
    },
    "cheese": {
        "name": "Cheese",
        "category": FoodCategory.DAIRY,
        "calories": 402,
        "protein": 25,
        "carbs": 1.3,
        "fat": 33,
        "fiber": 0
    },

    # Fast Food
    "burger": {
        "name": "Hamburger",
        "category": FoodCategory.MIXED,
        "calories": 295,
        "protein": 17,
        "carbs": 24,
        "fat": 14,
        "fiber": 1.3
    },
    "pizza": {
        "name": "Pizza Slice",
        "category": FoodCategory.MIXED,
        "calories": 266,
        "protein": 11,
        "carbs": 33,
        "fat": 10,
        "fiber": 2.3
    },
    "sandwich": {
        "name": "Sandwich",
        "category": FoodCategory.MIXED,
        "calories": 250,
        "protein": 12,
        "carbs": 28,
        "fat": 10,
        "fiber": 2
    }
}


# GPT-4 Vision Prompt for Food Detection
FOOD_DETECTION_PROMPT = """Analyze this food image and identify all visible food items.

For each food item, provide:
1. Food name (in English)
2. Arabic name if it's a Middle Eastern/Gulf food
3. Food category (PROTEIN, CARBOHYDRATE, VEGETABLE, FRUIT, DAIRY, FAT, BEVERAGE, MIXED, DESSERT, CONDIMENT)
4. Estimated portion size (SMALL, MEDIUM, LARGE, EXTRA_LARGE)
5. Estimated weight in grams
6. Confidence score (0.0-1.0)

Focus on identifying Middle Eastern and Gulf foods like:
- Rice dishes: Kabsa, Mandi, Machboos, Biryani
- Breads: Khubz, Raqaq, Samoon
- Meats: Shawarma, Kebab, Shish Tawook
- Appetizers: Hummus, Mutabbal, Tabbouleh, Fattoush, Falafel
- Soups: Harees, Jareesh, Thareed, Saloona
- Desserts: Kunafa, Luqaimat, Basbousa, Um Ali
- Beverages: Arabic Coffee, Karak Tea, Laban

Return the response as a JSON array with the following structure:
{
    "foods": [
        {
            "name": "food name",
            "name_ar": "اسم الطعام",
            "category": "CATEGORY",
            "portion_size": "SIZE",
            "estimated_grams": 150,
            "confidence": 0.85,
            "is_regional": true,
            "region": "gulf"
        }
    ],
    "meal_type": "LUNCH",
    "overall_confidence": 0.82,
    "notes": "Any relevant observations about the meal"
}
"""


class NutritionAIService:
    """Service for AI-powered meal analysis and nutrition tracking"""

    def __init__(self, openai_client=None):
        """Initialize the nutrition AI service

        Args:
            openai_client: Optional OpenAI client for GPT-4 Vision
        """
        self.openai_client = openai_client

        # Auto-initialize OpenAI client from environment if not provided
        if self.openai_client is None:
            import os
            api_key = os.getenv("OPENAI_API_KEY")
            if api_key:
                try:
                    from openai import AsyncOpenAI
                    self.openai_client = AsyncOpenAI(api_key=api_key)
                    logger.info("NutritionAIService: OpenAI client initialized from environment")
                except Exception as e:
                    logger.warning(f"NutritionAIService: Failed to initialize OpenAI client: {e}")

        self.regional_db = REGIONAL_FOOD_DATABASE
        self.standard_db = STANDARD_FOOD_DATABASE
        logger.info("NutritionAIService initialized")

    def set_openai_client(self, client):
        """Set the OpenAI client for vision analysis"""
        self.openai_client = client

    async def analyze_meal_image(
        self,
        image_base64: str,
        meal_type: Optional[MealType] = None
    ) -> MealAnalysis:
        """Analyze a meal image using GPT-4 Vision

        Args:
            image_base64: Base64-encoded image data
            meal_type: Optional meal type hint

        Returns:
            MealAnalysis with detected foods and nutritional breakdown
        """
        if not self.openai_client:
            logger.warning("OpenAI client not configured, using fallback analysis")
            return self._fallback_analysis(meal_type)

        try:
            # Call GPT-4 Vision
            response = await self._call_vision_api(image_base64, meal_type)

            # Parse the response and match to database
            detected_foods = self._parse_vision_response(response)

            # Calculate totals and generate analysis
            return self._create_meal_analysis(detected_foods, meal_type)

        except Exception as e:
            logger.error(f"Error analyzing meal image: {e}")
            return self._fallback_analysis(meal_type)

    async def _call_vision_api(
        self,
        image_base64: str,
        meal_type: Optional[MealType]
    ) -> Dict[str, Any]:
        """Call GPT-4 Vision API for food detection"""
        prompt = FOOD_DETECTION_PROMPT
        if meal_type:
            prompt += f"\n\nHint: This appears to be a {meal_type.value.lower()} meal."

        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_base64}",
                                    "detail": "high"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=1500
            )

            # Parse JSON from response
            content = response.choices[0].message.content

            # Extract JSON from response (may be wrapped in markdown code blocks)
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            return json.loads(content.strip())

        except Exception as e:
            logger.error(f"GPT-4 Vision API error: {e}")
            raise

    def _parse_vision_response(self, response: Dict[str, Any]) -> List[DetectedFood]:
        """Parse GPT-4 Vision response and match to food database"""
        detected_foods = []

        for food_data in response.get("foods", []):
            food_name = food_data.get("name", "Unknown")
            name_ar = food_data.get("name_ar")
            is_regional = food_data.get("is_regional", False)

            # Try to match to database for accurate nutrition
            db_food = self._find_in_database(food_name, name_ar, is_regional)

            portion_size = PortionSize(food_data.get("portion_size", "MEDIUM"))
            estimated_grams = food_data.get("estimated_grams", 150)

            # Get nutrition multiplier based on portion
            multiplier = estimated_grams / 100.0

            if db_food:
                # Use database nutrition values
                detected = DetectedFood(
                    name=db_food.get("name", food_name),
                    name_ar=db_food.get("name_ar", name_ar),
                    category=FoodCategory(food_data.get("category", db_food.get("category", "MIXED"))),
                    confidence=food_data.get("confidence", 0.8),
                    portion_size=portion_size,
                    portion_grams=estimated_grams,
                    calories=db_food["calories"] * multiplier,
                    protein=db_food["protein"] * multiplier,
                    carbs=db_food["carbs"] * multiplier,
                    fat=db_food["fat"] * multiplier,
                    fiber=db_food["fiber"] * multiplier,
                    is_regional=is_regional or db_food.get("region") is not None,
                    region=db_food.get("region", food_data.get("region"))
                )
            else:
                # Estimate nutrition based on category
                estimated = self._estimate_nutrition(
                    FoodCategory(food_data.get("category", "MIXED")),
                    estimated_grams
                )
                detected = DetectedFood(
                    name=food_name,
                    name_ar=name_ar,
                    category=FoodCategory(food_data.get("category", "MIXED")),
                    confidence=food_data.get("confidence", 0.6),
                    portion_size=portion_size,
                    portion_grams=estimated_grams,
                    calories=estimated["calories"],
                    protein=estimated["protein"],
                    carbs=estimated["carbs"],
                    fat=estimated["fat"],
                    fiber=estimated["fiber"],
                    is_regional=is_regional,
                    region=food_data.get("region")
                )

            detected_foods.append(detected)

        return detected_foods

    def _find_in_database(
        self,
        name: str,
        name_ar: Optional[str],
        is_regional: bool
    ) -> Optional[Dict[str, Any]]:
        """Find food in database by name or Arabic name"""
        name_lower = name.lower()

        # Search regional database first if flagged as regional
        if is_regional:
            for key, food in self.regional_db.items():
                if name_lower in key or name_lower in food["name"].lower():
                    return food
                if name_ar and name_ar in food.get("name_ar", ""):
                    return food
                # Check aliases
                for alias in food.get("aliases", []):
                    if name_lower in alias.lower() or (name_ar and name_ar in alias):
                        return food

        # Search standard database
        for key, food in self.standard_db.items():
            if name_lower in key or name_lower in food["name"].lower():
                return food

        # If not found and might be regional, search regional anyway
        for key, food in self.regional_db.items():
            if name_lower in key or name_lower in food["name"].lower():
                return food
            if name_ar and name_ar in food.get("name_ar", ""):
                return food
            for alias in food.get("aliases", []):
                if name_lower in alias.lower():
                    return food

        return None

    def _estimate_nutrition(
        self,
        category: FoodCategory,
        grams: float
    ) -> Dict[str, float]:
        """Estimate nutrition based on food category when not in database"""
        # Average values per 100g by category
        category_averages = {
            FoodCategory.PROTEIN: {"calories": 200, "protein": 22, "carbs": 2, "fat": 12, "fiber": 0},
            FoodCategory.CARBOHYDRATE: {"calories": 250, "protein": 6, "carbs": 52, "fat": 2, "fiber": 2},
            FoodCategory.VEGETABLE: {"calories": 35, "protein": 2, "carbs": 7, "fat": 0.3, "fiber": 3},
            FoodCategory.FRUIT: {"calories": 55, "protein": 1, "carbs": 14, "fat": 0.2, "fiber": 2.5},
            FoodCategory.DAIRY: {"calories": 100, "protein": 6, "carbs": 8, "fat": 5, "fiber": 0},
            FoodCategory.FAT: {"calories": 600, "protein": 1, "carbs": 2, "fat": 65, "fiber": 0},
            FoodCategory.BEVERAGE: {"calories": 45, "protein": 1, "carbs": 10, "fat": 0.5, "fiber": 0},
            FoodCategory.MIXED: {"calories": 180, "protein": 10, "carbs": 20, "fat": 8, "fiber": 2},
            FoodCategory.DESSERT: {"calories": 320, "protein": 5, "carbs": 45, "fat": 14, "fiber": 1},
            FoodCategory.CONDIMENT: {"calories": 50, "protein": 1, "carbs": 8, "fat": 2, "fiber": 0.5}
        }

        avg = category_averages.get(category, category_averages[FoodCategory.MIXED])
        multiplier = grams / 100.0

        return {
            "calories": avg["calories"] * multiplier,
            "protein": avg["protein"] * multiplier,
            "carbs": avg["carbs"] * multiplier,
            "fat": avg["fat"] * multiplier,
            "fiber": avg["fiber"] * multiplier
        }

    def _create_meal_analysis(
        self,
        foods: List[DetectedFood],
        meal_type: Optional[MealType]
    ) -> MealAnalysis:
        """Create comprehensive meal analysis from detected foods"""
        # Calculate totals
        total_calories = sum(f.calories for f in foods)
        total_protein = sum(f.protein for f in foods)
        total_carbs = sum(f.carbs for f in foods)
        total_fat = sum(f.fat for f in foods)
        total_fiber = sum(f.fiber for f in foods)

        # Calculate average confidence
        avg_confidence = sum(f.confidence for f in foods) / len(foods) if foods else 0

        # Determine meal type if not provided
        if not meal_type:
            meal_type = self._infer_meal_type(foods, total_calories)

        # Generate suggestions and warnings
        suggestions, warnings = self._generate_feedback(
            foods, total_calories, total_protein, total_carbs, total_fat, total_fiber
        )

        return MealAnalysis(
            foods=foods,
            total_calories=round(total_calories, 1),
            total_protein=round(total_protein, 1),
            total_carbs=round(total_carbs, 1),
            total_fat=round(total_fat, 1),
            total_fiber=round(total_fiber, 1),
            meal_type=meal_type,
            confidence=round(avg_confidence, 2),
            suggestions=suggestions,
            warnings=warnings
        )

    def _infer_meal_type(
        self,
        foods: List[DetectedFood],
        total_calories: float
    ) -> MealType:
        """Infer meal type based on foods and calories"""
        # Check for breakfast indicators
        breakfast_foods = ["eggs", "toast", "cereal", "yogurt", "foul", "cheese"]
        has_breakfast_food = any(
            any(bf in f.name.lower() for bf in breakfast_foods)
            for f in foods
        )

        if has_breakfast_food and total_calories < 500:
            return MealType.BREAKFAST
        elif total_calories < 300:
            return MealType.SNACK
        elif total_calories < 600:
            return MealType.LUNCH
        else:
            return MealType.DINNER

    def _generate_feedback(
        self,
        foods: List[DetectedFood],
        calories: float,
        protein: float,
        carbs: float,
        fat: float,
        fiber: float
    ) -> tuple[List[str], List[str]]:
        """Generate nutritional suggestions and warnings"""
        suggestions = []
        warnings = []

        # Check calorie content
        if calories > 800:
            warnings.append("This meal is high in calories. Consider smaller portions.")
        elif calories < 300:
            suggestions.append("Consider adding more protein or healthy fats for satiety.")

        # Check protein
        if protein < 15:
            suggestions.append("Add a protein source like grilled chicken, fish, or legumes.")
        elif protein > 50:
            suggestions.append("High protein intake - ensure adequate hydration.")

        # Check fiber
        if fiber < 5:
            suggestions.append("Consider adding vegetables or whole grains for fiber.")

        # Check fat ratio
        fat_calories = fat * 9
        if fat_calories / calories > 0.4 if calories > 0 else False:
            warnings.append("This meal is high in fat. Choose lean proteins and limit fried foods.")

        # Check for variety
        categories = set(f.category for f in foods)
        if len(categories) < 2:
            suggestions.append("Try to include foods from multiple categories for balanced nutrition.")

        # Check for vegetables
        has_vegetables = any(f.category == FoodCategory.VEGETABLE for f in foods)
        if not has_vegetables:
            suggestions.append("Add vegetables or salad for vitamins and minerals.")

        # Regional food specific
        regional_foods = [f for f in foods if f.is_regional]
        if regional_foods:
            high_cal_regional = [f for f in regional_foods if f.calories > 300]
            if high_cal_regional:
                suggestions.append(
                    f"Traditional dish portions can be reduced for calorie management."
                )

        return suggestions, warnings

    def _fallback_analysis(self, meal_type: Optional[MealType]) -> MealAnalysis:
        """Fallback when GPT-4 Vision is not available"""
        return MealAnalysis(
            foods=[],
            total_calories=0,
            total_protein=0,
            total_carbs=0,
            total_fat=0,
            total_fiber=0,
            meal_type=meal_type or MealType.SNACK,
            confidence=0,
            suggestions=["Unable to analyze image. Please enter food manually."],
            warnings=["AI analysis unavailable. Nutrition values may be inaccurate."]
        )

    def search_foods(
        self,
        query: str,
        include_regional: bool = True,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Search food database by name

        Args:
            query: Search query
            include_regional: Include regional foods
            limit: Maximum results

        Returns:
            List of matching foods with nutrition info
        """
        query_lower = query.lower()
        results = []

        # Search regional database
        if include_regional:
            for key, food in self.regional_db.items():
                score = 0
                if query_lower in key:
                    score = 100
                elif query_lower in food["name"].lower():
                    score = 90
                elif query_lower in food.get("name_ar", ""):
                    score = 95
                else:
                    for alias in food.get("aliases", []):
                        if query_lower in alias.lower():
                            score = 80
                            break

                if score > 0:
                    results.append({
                        "id": key,
                        **food,
                        "score": score,
                        "is_regional": True
                    })

        # Search standard database
        for key, food in self.standard_db.items():
            score = 0
            if query_lower in key:
                score = 85
            elif query_lower in food["name"].lower():
                score = 75

            if score > 0:
                results.append({
                    "id": key,
                    **food,
                    "score": score,
                    "is_regional": False
                })

        # Sort by score and limit
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]

    def get_food_details(self, food_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed nutrition info for a food item"""
        if food_id in self.regional_db:
            return {"id": food_id, **self.regional_db[food_id], "is_regional": True}
        if food_id in self.standard_db:
            return {"id": food_id, **self.standard_db[food_id], "is_regional": False}
        return None

    def estimate_portion(
        self,
        food_id: str,
        portion_size: PortionSize
    ) -> Dict[str, Any]:
        """Estimate nutrition for a specific portion size"""
        food = self.get_food_details(food_id)
        if not food:
            return {"error": "Food not found"}

        # Portion multipliers
        multipliers = {
            PortionSize.SMALL: 0.5,
            PortionSize.MEDIUM: 1.0,
            PortionSize.LARGE: 1.5,
            PortionSize.EXTRA_LARGE: 2.0
        }

        mult = multipliers.get(portion_size, 1.0)

        return {
            "food_id": food_id,
            "portion_size": portion_size.value,
            "estimated_grams": 100 * mult,
            "calories": food["calories"] * mult,
            "protein": food["protein"] * mult,
            "carbs": food["carbs"] * mult,
            "fat": food["fat"] * mult,
            "fiber": food["fiber"] * mult
        }

    def get_regional_foods(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all regional foods, optionally filtered by region"""
        results = []
        for key, food in self.regional_db.items():
            if region is None or food.get("region") == region:
                results.append({
                    "id": key,
                    **food,
                    "is_regional": True
                })
        return results

    def get_supported_regions(self) -> List[str]:
        """Get list of supported regions"""
        regions = set()
        for food in self.regional_db.values():
            if food.get("region"):
                regions.add(food["region"])
        return list(regions)


# Singleton instance
_nutrition_service: Optional[NutritionAIService] = None


def get_nutrition_service() -> NutritionAIService:
    """Get or create the nutrition AI service singleton"""
    global _nutrition_service
    if _nutrition_service is None:
        _nutrition_service = NutritionAIService()
    return _nutrition_service
