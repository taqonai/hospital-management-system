"""
Insurance Coding AI Service

Provides AI-powered assistance for:
- ICD-10 and CPT code suggestions from clinical text
- Medical necessity validation
- Claim acceptance prediction
- Code pair validation
"""

from .service import InsuranceCodingAI
from .knowledge_base import InsuranceCodingKnowledgeBase

__all__ = ['InsuranceCodingAI', 'InsuranceCodingKnowledgeBase']
