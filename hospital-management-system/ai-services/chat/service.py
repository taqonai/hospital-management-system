"""
Chat AI Service with OpenAI GPT integration
Uses pattern matching for commands + GPT for conversational responses
"""

import os
import re
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum

# Try to import OpenAI
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None


class Intent(Enum):
    NAVIGATION = "navigation"
    PATIENT_ACTION = "patient_action"
    LAB_ORDER = "lab_order"
    PRESCRIPTION = "prescription"
    APPOINTMENT = "appointment"
    SEARCH = "search"
    HELP = "help"
    GREETING = "greeting"
    CONVERSATION = "conversation"
    UNKNOWN = "unknown"


@dataclass
class Entity:
    """Extracted entity from text"""
    type: str
    value: str
    confidence: float


class ChatAI:
    """
    AI-powered chat service for HIS
    Combines pattern matching for commands with GPT for conversations
    """

    def __init__(self):
        # Initialize OpenAI client if available
        self.openai_client = None
        self.openai_api_key = os.getenv("OPENAI_API_KEY")

        if OPENAI_AVAILABLE and self.openai_api_key:
            try:
                self.openai_client = OpenAI(api_key=self.openai_api_key)
                print("OpenAI GPT integration enabled")
            except Exception as e:
                print(f"Failed to initialize OpenAI: {e}")
        else:
            if not OPENAI_AVAILABLE:
                print("OpenAI package not installed - using pattern matching only")
            elif not self.openai_api_key:
                print("OPENAI_API_KEY not set - using pattern matching only")

        # System prompt for GPT
        self.system_prompt = """You are an AI assistant for a Hospital Management System (HMS). You help healthcare staff with:

1. **Navigation**: Guide users to different modules (patients, laboratory, pharmacy, IPD, OPD, emergency, radiology, surgery, billing)
2. **Patient Management**: Help register patients, schedule appointments, manage admissions/discharges
3. **Clinical Tasks**: Order lab tests, prescribe medications, manage imaging orders
4. **Information**: Answer questions about hospital workflows and system features

When responding:
- Be concise and professional
- For navigation requests, respond with the exact module name
- For clinical tasks, confirm the action clearly
- Provide helpful suggestions when appropriate
- Never provide medical advice - always defer to clinical staff

Available modules: Dashboard, Patients, Appointments, Doctors, OPD, IPD, Emergency, Laboratory, Radiology, Pharmacy, Surgery, Billing, AI Assistant

If the user asks to navigate somewhere, include the route in your response like: [NAVIGATE:/route]
If the user asks to perform an action, include: [ACTION:action_name]
"""

        # Navigation patterns
        self.nav_patterns = {
            r'\b(go\s+to|open|navigate\s+to|show)\s+(the\s+)?': 'navigation',
        }

        # Module mapping
        self.modules = {
            'dashboard': '/dashboard',
            'patients': '/patients',
            'patient': '/patients',
            'appointments': '/appointments',
            'appointment': '/appointments',
            'doctors': '/doctors',
            'doctor': '/doctors',
            'laboratory': '/laboratory',
            'lab': '/laboratory',
            'labs': '/laboratory',
            'pharmacy': '/pharmacy',
            'medications': '/pharmacy',
            'drugs': '/pharmacy',
            'ipd': '/ipd',
            'inpatient': '/ipd',
            'ward': '/ipd',
            'wards': '/ipd',
            'opd': '/opd',
            'outpatient': '/opd',
            'queue': '/opd',
            'emergency': '/emergency',
            'ed': '/emergency',
            'er': '/emergency',
            'radiology': '/radiology',
            'imaging': '/radiology',
            'xray': '/radiology',
            'x-ray': '/radiology',
            'ct': '/radiology',
            'mri': '/radiology',
            'surgery': '/surgery',
            'ot': '/surgery',
            'operating': '/surgery',
            'billing': '/billing',
            'invoices': '/billing',
            'payments': '/billing',
            'ai': '/ai-assistant',
            'assistant': '/ai-assistant',
        }

        # Action patterns
        self.action_patterns = {
            r'\b(register|add|create|new)\s+(a\s+)?(patient|admission)': 'new_patient',
            r'\b(book|schedule|create)\s+(an?\s+)?(appointment)': 'new_appointment',
            r'\b(order|request)\s+(a\s+)?(lab|test|cbc|bmp|lipid)': 'lab_order',
            r'\b(prescribe|order)\s+(medication|medicine|drug)': 'prescription',
            r'\b(admit|admission)\s+': 'admission',
            r'\b(discharge)\s+': 'discharge',
            r'\b(triage|assess)\s+': 'triage',
        }

        # Medical test patterns
        self.lab_tests = {
            'cbc': 'Complete Blood Count',
            'bmp': 'Basic Metabolic Panel',
            'cmp': 'Comprehensive Metabolic Panel',
            'lipid': 'Lipid Panel',
            'hba1c': 'HbA1c',
            'a1c': 'HbA1c',
            'lft': 'Liver Function Test',
            'rft': 'Renal Function Test',
            'kft': 'Kidney Function Test',
            'thyroid': 'Thyroid Panel',
            'tsh': 'TSH',
            'urinalysis': 'Urinalysis',
            'ua': 'Urinalysis',
            'pt': 'Prothrombin Time',
            'inr': 'INR',
            'ptt': 'Partial Thromboplastin Time',
            'troponin': 'Troponin I',
            'd-dimer': 'D-Dimer',
            'bnp': 'BNP',
            'blood culture': 'Blood Culture',
            'urine culture': 'Urine Culture',
        }

        # Greeting patterns
        self.greeting_patterns = [
            r'^(hi|hello|hey|good\s+(morning|afternoon|evening))[\s!.,]*$',
            r'^(what\'?s\s+up|howdy)[\s!.,]*$',
        ]

        # Help patterns
        self.help_patterns = [
            r'\b(help|assist|what\s+can\s+you\s+do)',
            r'\b(how\s+(do|can)\s+i)',
            r'\b(commands|features|options)',
        ]

        # Query patterns
        self.query_patterns = {
            r'\b(show|list|find|search|get)\s+(all\s+)?(critical|urgent|stat)': 'critical_filter',
            r'\b(show|list|find|search|get)\s+(all\s+)?(high[\s-]?risk)': 'high_risk_filter',
            r'\b(show|list|find|search|get)\s+(pending|waiting)': 'pending_filter',
            r'\b(how\s+many|count|total)': 'count_query',
        }

    def process_chat(
        self,
        message: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process a chat message and return response with actions
        """
        message_lower = message.lower().strip()
        context = context or {}

        # Check for greetings first
        for pattern in self.greeting_patterns:
            if re.match(pattern, message_lower):
                return self._get_greeting_response(context)

        # Check for help
        for pattern in self.help_patterns:
            if re.search(pattern, message_lower):
                return self._get_help_response(context)

        # Check for action intents FIRST (before navigation)
        action_result = self._check_actions(message_lower, context)
        if action_result:
            return action_result

        # Check for query patterns (before navigation)
        query_result = self._check_queries(message_lower, context)
        if query_result:
            return query_result

        # Check for navigation intent
        nav_result = self._check_navigation(message_lower)
        if nav_result:
            return nav_result

        # If no pattern matched, use GPT for conversational response
        if self.openai_client:
            return self._get_gpt_response(message, context)

        # Fallback response if no GPT
        return {
            "response": f'I understand you said: "{message}". I can help you navigate the system, manage patients, order tests, and more. Try saying "help" for available commands.',
            "intent": "unknown",
            "actions": [],
            "suggestions": self._get_context_suggestions(context),
        }

    def _get_gpt_response(
        self,
        message: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get a response from GPT"""
        try:
            # Build context message
            context_info = ""
            if context.get("currentModule"):
                context_info += f"\nCurrent module: {context['currentModule']}"
            if context.get("currentPatient"):
                context_info += f"\nCurrent patient: {context['currentPatient']}"

            messages = [
                {"role": "system", "content": self.system_prompt + context_info},
                {"role": "user", "content": message}
            ]

            response = self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                max_tokens=300,
                temperature=0.7,
            )

            gpt_response = response.choices[0].message.content

            # Parse GPT response for actions
            actions = []
            intent = "conversation"

            # Check for navigation in response
            nav_match = re.search(r'\[NAVIGATE:(/[^\]]+)\]', gpt_response)
            if nav_match:
                actions.append({"type": "navigate", "route": nav_match.group(1)})
                intent = "navigation"
                gpt_response = re.sub(r'\[NAVIGATE:/[^\]]+\]', '', gpt_response).strip()

            # Check for action in response
            action_match = re.search(r'\[ACTION:([^\]]+)\]', gpt_response)
            if action_match:
                action_name = action_match.group(1)
                if action_name == "new_patient":
                    actions.append({"type": "navigate", "route": "/patients?action=new"})
                elif action_name == "new_appointment":
                    actions.append({"type": "navigate", "route": "/appointments?action=new"})
                intent = "patient_action"
                gpt_response = re.sub(r'\[ACTION:[^\]]+\]', '', gpt_response).strip()

            return {
                "response": gpt_response,
                "intent": intent,
                "actions": actions,
                "suggestions": self._get_context_suggestions(context),
            }

        except Exception as e:
            print(f"GPT error: {e}")
            # Fallback to pattern matching
            return {
                "response": f'I understand you said: "{message}". How can I help you with the hospital system?',
                "intent": "unknown",
                "actions": [],
                "suggestions": self._get_context_suggestions(context),
            }

    def process_voice_command(
        self,
        transcript: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process a voice command transcript
        """
        # Clean transcript
        transcript = transcript.strip()

        # Use chat processing
        chat_result = self.process_chat(transcript, context)

        # Extract entities for voice commands
        entities = self._extract_entities(transcript)

        return {
            "intent": chat_result["intent"],
            "entities": {e.type: e.value for e in entities},
            "action": chat_result["actions"][0] if chat_result["actions"] else None,
            "response": chat_result["response"],
            "confidence": 0.9 if chat_result["intent"] != "unknown" else 0.5,
        }

    def _check_navigation(self, message: str) -> Optional[Dict[str, Any]]:
        """Check for navigation intent"""
        # Check for explicit navigation commands
        for pattern in self.nav_patterns:
            if re.search(pattern, message):
                # Find which module they want
                for module_key, route in self.modules.items():
                    if module_key in message:
                        module_name = module_key.replace('-', ' ').title()
                        return {
                            "response": f"Navigating to {module_name}...",
                            "intent": "navigation",
                            "actions": [{"type": "navigate", "route": route}],
                            "suggestions": [],
                        }

        # Also check for just module names
        words = message.split()
        if len(words) <= 3:
            for word in words:
                if word in self.modules:
                    route = self.modules[word]
                    module_name = word.replace('-', ' ').title()
                    return {
                        "response": f"Opening {module_name}...",
                        "intent": "navigation",
                        "actions": [{"type": "navigate", "route": route}],
                        "suggestions": [],
                    }

        return None

    def _check_actions(
        self, message: str, context: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Check for action intents"""
        for pattern, action in self.action_patterns.items():
            if re.search(pattern, message):
                if action == 'new_patient':
                    return {
                        "response": "Opening patient registration form...",
                        "intent": "patient_action",
                        "actions": [{"type": "navigate", "route": "/patients?action=new"}],
                        "suggestions": [],
                    }
                elif action == 'new_appointment':
                    return {
                        "response": "Opening appointment booking form...",
                        "intent": "appointment",
                        "actions": [{"type": "navigate", "route": "/appointments?action=new"}],
                        "suggestions": [],
                    }
                elif action == 'lab_order':
                    # Extract test names
                    tests = self._extract_lab_tests(message)
                    test_str = ", ".join(tests) if tests else "lab test"
                    return {
                        "response": f"Opening lab order form for {test_str}...",
                        "intent": "lab_order",
                        "actions": [
                            {"type": "navigate", "route": "/laboratory?action=new"},
                            {"type": "prefill", "tests": tests},
                        ],
                        "suggestions": [],
                    }
                elif action == 'prescription':
                    return {
                        "response": "Opening prescription form...",
                        "intent": "prescription",
                        "actions": [{"type": "navigate", "route": "/pharmacy?action=new"}],
                        "suggestions": [],
                    }
                elif action == 'admission':
                    return {
                        "response": "Opening admission form...",
                        "intent": "patient_action",
                        "actions": [{"type": "navigate", "route": "/ipd?action=admit"}],
                        "suggestions": [],
                    }
                elif action == 'discharge':
                    return {
                        "response": "Opening discharge planning...",
                        "intent": "patient_action",
                        "actions": [{"type": "navigate", "route": "/ipd?tab=discharge"}],
                        "suggestions": [],
                    }
                elif action == 'triage':
                    return {
                        "response": "Opening triage station...",
                        "intent": "patient_action",
                        "actions": [{"type": "navigate", "route": "/emergency?tab=triage"}],
                        "suggestions": [],
                    }

        return None

    def _check_queries(
        self, message: str, context: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Check for query intents"""
        for pattern, query_type in self.query_patterns.items():
            if re.search(pattern, message):
                if query_type == 'critical_filter':
                    # Determine which module based on message
                    if 'lab' in message or 'test' in message:
                        return {
                            "response": "Showing critical lab values...",
                            "intent": "search",
                            "actions": [{"type": "navigate", "route": "/laboratory?filter=critical"}],
                            "suggestions": [],
                        }
                    return {
                        "response": "Showing critical alerts...",
                        "intent": "search",
                        "actions": [{"type": "filter", "filter": "critical"}],
                        "suggestions": [],
                    }
                elif query_type == 'high_risk_filter':
                    return {
                        "response": "Showing high-risk patients...",
                        "intent": "search",
                        "actions": [{"type": "navigate", "route": "/patients?filter=high-risk"}],
                        "suggestions": [],
                    }
                elif query_type == 'pending_filter':
                    current_module = context.get('currentModule', '')
                    if current_module == 'laboratory':
                        return {
                            "response": "Showing pending lab tests...",
                            "intent": "search",
                            "actions": [{"type": "filter", "filter": "pending"}],
                            "suggestions": [],
                        }

        return None

    def _extract_lab_tests(self, message: str) -> List[str]:
        """Extract lab test names from message"""
        tests = []
        message_lower = message.lower()

        for abbrev, full_name in self.lab_tests.items():
            if abbrev in message_lower:
                tests.append(full_name)

        return tests

    def _extract_entities(self, text: str) -> List[Entity]:
        """Extract entities from text"""
        entities = []
        text_lower = text.lower()

        # Extract lab tests
        for abbrev, full_name in self.lab_tests.items():
            if abbrev in text_lower:
                entities.append(Entity(
                    type="lab_test",
                    value=full_name,
                    confidence=0.9
                ))

        # Extract patient name patterns (simple heuristic)
        name_pattern = r'\bfor\s+(patient\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b'
        name_match = re.search(name_pattern, text)
        if name_match:
            entities.append(Entity(
                type="patient_name",
                value=name_match.group(2),
                confidence=0.7
            ))

        # Extract module references
        for module in self.modules:
            if module in text_lower:
                entities.append(Entity(
                    type="module",
                    value=module,
                    confidence=0.85
                ))

        return entities

    def _get_context_suggestions(self, context: Dict[str, Any]) -> List[str]:
        """Get context-aware suggestions"""
        current_module = context.get('currentModule', '').lower()

        module_suggestions = {
            'patients': ['Register new patient', 'Search patient', 'View high-risk patients'],
            'laboratory': ['Order lab test', 'Show critical values', 'View pending tests'],
            'pharmacy': ['Check drug interactions', 'View prescriptions', 'Check inventory'],
            'ipd': ['New admission', 'View bed status', 'Discharge planning'],
            'opd': ['Call next patient', 'View queue', 'Book appointment'],
            'emergency': ['New triage', 'Show ESI 1-2', 'Update wait times'],
            'radiology': ['View worklist', 'AI analysis', 'Generate report'],
            'surgery': ['View OT schedule', 'Schedule surgery', 'Pre-op checklist'],
            'billing': ['New invoice', 'Collect payment', 'Check claims'],
        }

        return module_suggestions.get(current_module, [
            'Go to dashboard',
            'View patients',
            'Check appointments',
        ])

    def _get_greeting_response(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate greeting response"""
        if self.openai_client:
            greeting = "Hello! I'm your AI-powered hospital assistant. I can help you navigate the system, manage patients, order tests, check schedules, and much more. What would you like to do today?"
        else:
            greeting = "Hello! I'm your AI assistant. How can I help you today? You can ask me to navigate to any module, manage patients, order tests, or get help with the system."

        return {
            "response": greeting,
            "intent": "greeting",
            "actions": [],
            "suggestions": self._get_context_suggestions(context),
        }

    def _get_help_response(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate help response"""
        help_text = """I can help you with:

**Navigation:**
• "Go to patients", "Open laboratory", "Show dashboard"

**Patient Management:**
• "Register new patient", "Admit patient", "Discharge patient"

**Appointments:**
• "Book appointment", "Show today's appointments"

**Laboratory:**
• "Order CBC", "Order lipid panel", "Show critical labs"

**Pharmacy:**
• "Check drug interactions", "View prescriptions"

**Emergency:**
• "Triage patient", "Show ESI 1-2 patients"

**Queries:**
• "Show high-risk patients", "Show pending tests"

**Conversations:**
• Ask me anything about the hospital system!

What would you like to do?"""

        return {
            "response": help_text,
            "intent": "help",
            "actions": [],
            "suggestions": self._get_context_suggestions(context),
        }
