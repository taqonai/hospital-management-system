"""
Patient Health Assistant AI Service
Provides dynamic, AI-powered responses to patient health questions.

Uses GPT-4o-mini for conversational health guidance.
IMPORTANT: This is NOT a replacement for professional medical advice.
"""

import os
import sys
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

# Import shared OpenAI client
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared.openai_client import openai_manager, TaskComplexity, OPENAI_AVAILABLE

logger = logging.getLogger(__name__)


class HealthAssistantAI:
    """
    AI-powered health assistant for patients.
    Provides helpful, accurate health information while
    appropriately directing users to professional care.
    """

    def __init__(self):
        self.model_version = "1.0.0"
        ai_status = "GPT-4o enabled" if openai_manager.is_available() else "rule-based only"
        logger.info(f"HealthAssistantAI initialized - {ai_status}")
        print(f"HealthAssistantAI initialized - {ai_status}")

        self.system_prompt = """You are a helpful, compassionate AI Health Assistant for patients in a hospital management system. Your role is to provide accurate, helpful health information while being careful not to provide medical diagnoses or replace professional medical advice.

You have access to the patient's actual clinical data (lab results, medications, vitals, allergies, medical history, diagnoses). USE THIS DATA to provide personalized, specific responses. When a patient asks about their lab results, medications, or health status, reference their actual values and explain what they mean.

GUIDELINES:
1. Be warm, empathetic, and supportive in your responses
2. When clinical data is provided, ANALYZE IT SPECIFICALLY — reference actual values, flag abnormal results, and explain what they mean in plain language
3. For lab results: compare values to reference ranges, explain what each test measures, highlight any abnormal or critical values
4. For medications: explain what each medication is for, dosage guidance, and common side effects to watch for
5. For vitals: explain what the numbers mean and whether they are in normal range
6. Always recommend consulting a healthcare provider for specific medical concerns, but still provide the analysis
7. For emergency symptoms (chest pain, difficulty breathing, stroke signs, severe bleeding), urgently direct to emergency care
8. Explain medical concepts in simple, understandable language
9. Be concise but thorough - aim for 2-4 paragraphs maximum
10. Never make definitive diagnoses, but you CAN interpret data and explain what it suggests
11. Acknowledge the patient's concerns and validate their feelings

RESPONSE FORMAT:
- Start with acknowledging the patient's question/concern
- Provide specific analysis based on their actual data when available
- Explain what the values mean in plain language
- Give practical advice or recommendations
- End with appropriate next steps or reassurance

ALWAYS INCLUDE A DISCLAIMER that this is an AI interpretation and they should discuss findings with their doctor."""

    def is_available(self) -> bool:
        """Check if AI is available"""
        return openai_manager.is_available()

    async def get_response(
        self,
        message: str,
        patient_context: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Generate a dynamic response to a patient health question.

        Args:
            message: The patient's question or message
            patient_context: Optional context about the patient (age, gender, conditions)
            conversation_history: Previous messages in the conversation

        Returns:
            Dict with response, suggestedActions, and metadata
        """
        try:
            if not self.is_available():
                return self._get_fallback_response(message)

            # Build context string from patient clinical data
            context_info = ""
            if patient_context:
                # Use raw_context which contains the full clinical data from the backend
                if patient_context.get("raw_context"):
                    context_info += f"\n\nPATIENT CLINICAL DATA:\n{patient_context['raw_context']}"
                else:
                    # Fallback to structured fields
                    if patient_context.get("name"):
                        context_info += f"\nPatient name: {patient_context['name']}"
                    if patient_context.get("age"):
                        context_info += f"\nPatient age: {patient_context['age']}"
                    if patient_context.get("gender"):
                        context_info += f"\nPatient gender: {patient_context['gender']}"
                    if patient_context.get("conditions"):
                        context_info += f"\nKnown conditions: {', '.join(patient_context['conditions'])}"

            # Build messages for GPT
            messages = [
                {"role": "system", "content": self.system_prompt + context_info}
            ]

            # Add conversation history (last 5 messages for context)
            if conversation_history:
                for msg in conversation_history[-5:]:
                    messages.append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", "")
                    })

            # Add current message
            messages.append({"role": "user", "content": message})

            # Get response from GPT-4o (using complex task for better quality)
            result = openai_manager.chat_completion(
                messages=messages,
                task_complexity=TaskComplexity.COMPLEX,  # Uses gpt-4o for better health responses
                max_tokens=1200,
                temperature=0.7,
            )

            if not result or not result.get("success"):
                logger.error(f"GPT error: {result.get('error') if result else 'No response'}")
                return self._get_fallback_response(message)

            response_text = result["content"]

            # Determine suggested actions based on content
            suggested_actions = self._get_suggested_actions(message, response_text)

            return {
                "response": response_text,
                "suggestedActions": suggested_actions,
                "aiPowered": True,
                "model": result.get("model", "gpt-4o"),
                "timestamp": datetime.now().isoformat(),
                "modelVersion": self.model_version
            }

        except Exception as e:
            logger.error(f"HealthAssistantAI error: {e}")
            return self._get_fallback_response(message)

    def _get_suggested_actions(
        self,
        message: str,
        response: str
    ) -> List[Dict[str, str]]:
        """Determine suggested actions based on the conversation"""
        actions = []
        message_lower = message.lower()
        response_lower = response.lower()

        # Check for symptom-related queries
        symptom_keywords = ['symptom', 'pain', 'ache', 'fever', 'feel sick', 'unwell',
                          'headache', 'nausea', 'dizzy', 'tired', 'fatigue', 'cough']
        if any(kw in message_lower for kw in symptom_keywords):
            actions.append({
                "label": "Check Symptoms",
                "route": "/patient-portal/symptom-checker"
            })

        # Check for appointment-related queries
        appointment_keywords = ['appointment', 'book', 'schedule', 'see doctor',
                               'visit', 'consultation', 'check-up']
        if any(kw in message_lower for kw in appointment_keywords):
            actions.append({
                "label": "Book Appointment",
                "route": "/patient-portal/appointments"
            })

        # Check for medication queries
        medication_keywords = ['medication', 'medicine', 'prescription', 'drug',
                              'pill', 'dose', 'dosage', 'side effect']
        if any(kw in message_lower for kw in medication_keywords):
            actions.append({
                "label": "View Prescriptions",
                "route": "/patient-portal/prescriptions"
            })

        # Check for lab/test queries
        lab_keywords = ['lab', 'test', 'result', 'blood', 'urine', 'report']
        if any(kw in message_lower for kw in lab_keywords):
            actions.append({
                "label": "View Lab Results",
                "route": "/patient-portal/labs"
            })

        # Emergency indicators in response
        emergency_keywords = ['emergency', '911', 'immediately', 'urgent care',
                            'go to the er', 'seek immediate']
        if any(kw in response_lower for kw in emergency_keywords):
            actions.insert(0, {
                "label": "Emergency Info",
                "route": "/patient-portal/emergency"
            })

        # Limit to 3 most relevant actions
        return actions[:3]

    def _get_fallback_response(self, message: str) -> Dict[str, Any]:
        """Generate a rule-based fallback response when AI is unavailable"""
        message_lower = message.lower()

        # Emergency check
        emergency_keywords = ['chest pain', 'can\'t breathe', 'difficulty breathing',
                            'stroke', 'heart attack', 'severe bleeding', 'unconscious']
        if any(kw in message_lower for kw in emergency_keywords):
            return {
                "response": "If you're experiencing chest pain, difficulty breathing, signs of a stroke (face drooping, arm weakness, speech difficulty), severe bleeding, or loss of consciousness, please call 911 or go to the nearest emergency room immediately. These symptoms require urgent medical attention.\n\nDo not wait - seek emergency care right away.",
                "suggestedActions": [{"label": "Emergency Info", "route": "/patient-portal/emergency"}],
                "aiPowered": False,
                "modelVersion": self.model_version
            }

        # Symptom-related questions
        symptom_keywords = ['symptom', 'pain', 'ache', 'fever', 'sick', 'headache',
                          'nausea', 'dizzy', 'fatigue', 'cough', 'cold']
        if any(kw in message_lower for kw in symptom_keywords):
            return {
                "response": f"I understand you're experiencing symptoms or have questions about them. Symptoms can have many causes, and it's important to get a proper evaluation.\n\nI recommend using our AI Symptom Checker which will ask you detailed questions about your symptoms, their severity, and duration. Based on your responses, it will provide personalized guidance on whether you should see a doctor and which department would be most appropriate.\n\nIf your symptoms are severe or getting worse, please don't hesitate to seek medical care promptly.",
                "suggestedActions": [
                    {"label": "Start Symptom Check", "route": "/patient-portal/symptom-checker"},
                    {"label": "Book Appointment", "route": "/patient-portal/appointments"}
                ],
                "aiPowered": False,
                "modelVersion": self.model_version
            }

        # Doctor/appointment questions
        if 'doctor' in message_lower or 'appointment' in message_lower or 'book' in message_lower:
            return {
                "response": "I can help you with booking an appointment! Our system makes it easy to:\n\n1. **Find the right department** based on your needs\n2. **Choose a doctor** that fits your preferences\n3. **Pick a convenient time** that works for your schedule\n\nYou can either book directly if you know which department you need, or use our Symptom Checker to get a recommendation based on your symptoms.",
                "suggestedActions": [
                    {"label": "Book Appointment", "route": "/patient-portal/appointments"},
                    {"label": "Check Symptoms First", "route": "/patient-portal/symptom-checker"}
                ],
                "aiPowered": False,
                "modelVersion": self.model_version
            }

        # Medication questions
        if any(kw in message_lower for kw in ['medication', 'medicine', 'prescription', 'drug', 'pill']):
            return {
                "response": "For questions about your medications, I recommend:\n\n1. **Check your prescriptions** in the Prescriptions section to see your current medications, dosages, and instructions\n2. **Read the medication information** provided with your prescription\n3. **Contact your doctor or pharmacist** for specific questions about interactions, side effects, or dosage changes\n\nNever change your medication dose or stop taking a medication without consulting your healthcare provider first.",
                "suggestedActions": [
                    {"label": "View Prescriptions", "route": "/patient-portal/prescriptions"},
                    {"label": "Book Appointment", "route": "/patient-portal/appointments"}
                ],
                "aiPowered": False,
                "modelVersion": self.model_version
            }

        # Lab results questions
        if any(kw in message_lower for kw in ['lab', 'test', 'result', 'blood work']):
            return {
                "response": "Your lab results are available in the Lab Results section of your patient portal. Each result includes:\n\n- **Your value** - What the test measured\n- **Reference range** - What's considered normal\n- **Status indicator** - Whether your result is normal, high, or low\n\nWhile I can provide general information about lab tests, please discuss specific results with your doctor who can interpret them in the context of your overall health.",
                "suggestedActions": [
                    {"label": "View Lab Results", "route": "/patient-portal/labs"},
                    {"label": "Book Appointment", "route": "/patient-portal/appointments"}
                ],
                "aiPowered": False,
                "modelVersion": self.model_version
            }

        # Sleep questions
        if 'sleep' in message_lower:
            return {
                "response": "Good sleep is essential for your health! Here are some general tips for better sleep:\n\n- **Maintain a schedule** - Go to bed and wake up at the same time daily\n- **Create a restful environment** - Keep your room dark, quiet, and cool\n- **Limit screen time** - Avoid phones and computers 1 hour before bed\n- **Watch your diet** - Avoid caffeine and large meals close to bedtime\n- **Stay active** - Regular exercise helps, but not too close to bedtime\n\nIf you're consistently having trouble sleeping, it's worth discussing with your doctor.",
                "suggestedActions": [
                    {"label": "Wellness Hub", "route": "/patient-portal/wellness"},
                    {"label": "Book Appointment", "route": "/patient-portal/appointments"}
                ],
                "aiPowered": False,
                "modelVersion": self.model_version
            }

        # Diet/nutrition questions
        if any(kw in message_lower for kw in ['diet', 'nutrition', 'food', 'eat', 'diabetes']):
            return {
                "response": "Nutrition plays a vital role in your health! General healthy eating guidelines include:\n\n- **Eat plenty of fruits and vegetables** - Aim for variety and color\n- **Choose whole grains** - Over refined grains when possible\n- **Include lean proteins** - Fish, poultry, beans, and nuts\n- **Limit processed foods** - Reduce salt, sugar, and unhealthy fats\n- **Stay hydrated** - Drink plenty of water throughout the day\n\nIf you have specific dietary needs due to a health condition (like diabetes), please work with your healthcare team for personalized guidance.",
                "suggestedActions": [
                    {"label": "Nutrition Plan", "route": "/patient-portal/nutrition"},
                    {"label": "Book Appointment", "route": "/patient-portal/appointments"}
                ],
                "aiPowered": False,
                "modelVersion": self.model_version
            }

        # Default response
        return {
            "response": f"Thank you for your question. I'm here to help you with health-related information and guide you through our patient portal.\n\nI can assist you with:\n- **Understanding symptoms** and when to seek care\n- **General health information** and wellness tips\n- **Navigating your health records**, lab results, and prescriptions\n- **Booking appointments** with the right specialists\n- **Using our AI Symptom Checker** for guided assessment\n\nCould you please provide more details about what you'd like to know? For specific medical advice, I recommend consulting with your healthcare provider.",
            "suggestedActions": [
                {"label": "Check Symptoms", "route": "/patient-portal/symptom-checker"},
                {"label": "Book Appointment", "route": "/patient-portal/appointments"},
                {"label": "View Records", "route": "/patient-portal/records"}
            ],
            "aiPowered": False,
            "modelVersion": self.model_version
        }


# Singleton instance
health_assistant_ai = HealthAssistantAI()
