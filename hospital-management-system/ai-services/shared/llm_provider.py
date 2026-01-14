"""
LLM Provider Abstraction Layer for HMS AI Services

Supports OpenAI and Ollama backends with a unified interface.
Ollama uses OpenAI-compatible API format for seamless integration.
"""

import os
import logging
import time
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from enum import Enum

import httpx

logger = logging.getLogger(__name__)


class LLMProvider(str, Enum):
    """Supported LLM providers"""
    OPENAI = "openai"
    OLLAMA = "ollama"


@dataclass
class HospitalAIConfig:
    """
    Hospital-specific AI configuration.
    Loaded from Hospital.settings.aiProvider in the database.
    """
    provider: str = "openai"
    ollama_endpoint: Optional[str] = None
    ollama_model_complex: Optional[str] = None
    ollama_model_simple: Optional[str] = None

    @classmethod
    def from_settings(cls, settings: Optional[Dict]) -> "HospitalAIConfig":
        """Create config from hospital settings dict"""
        if not settings:
            return cls()

        ai_settings = settings.get("aiProvider", {})
        ollama_models = ai_settings.get("ollamaModels", {})

        return cls(
            provider=ai_settings.get("provider", "openai"),
            ollama_endpoint=ai_settings.get("ollamaEndpoint"),
            ollama_model_complex=ollama_models.get("complex", "gpt-oss:120b"),
            ollama_model_simple=ollama_models.get("simple", "gpt-oss:20b"),
        )

    def is_ollama(self) -> bool:
        """Check if Ollama provider is configured"""
        return self.provider == LLMProvider.OLLAMA and bool(self.ollama_endpoint)


class BaseLLMClient(ABC):
    """Abstract base class for LLM clients"""

    @abstractmethod
    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        task_complexity: str = "simple",
        max_tokens: int = 2000,
        temperature: float = 0.3,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """Execute chat completion"""
        pass

    @abstractmethod
    def chat_completion_json(
        self,
        messages: List[Dict[str, str]],
        task_complexity: str = "simple",
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """Execute chat completion with JSON response"""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if the client is available"""
        pass

    @abstractmethod
    def get_status(self) -> Dict[str, Any]:
        """Get client status information"""
        pass


class OllamaClient(BaseLLMClient):
    """
    Ollama client using OpenAI-compatible API format.

    Ollama exposes an OpenAI-compatible endpoint at /v1/chat/completions
    which allows us to use the OpenAI Python SDK with a different base_url.
    """

    def __init__(
        self,
        base_url: str,
        model_complex: str = "gpt-oss:120b",
        model_simple: str = "gpt-oss:20b"
    ):
        self.base_url = base_url.rstrip('/')
        self.model_complex = model_complex
        self.model_simple = model_simple
        self._client = None
        self._last_request_time = 0
        self._min_request_interval = 0.05  # 50ms between requests

        self._initialize_client()

    def _initialize_client(self):
        """Initialize OpenAI client pointing to Ollama endpoint"""
        try:
            from openai import OpenAI
            self._client = OpenAI(
                base_url=f"{self.base_url}/v1",
                api_key="ollama",  # Ollama doesn't require a real API key
                timeout=300.0,  # 5 minutes timeout for large model inference
            )
            logger.info(f"Ollama client initialized with endpoint: {self.base_url} (5min timeout)")
        except ImportError:
            logger.error("OpenAI package not installed - required for Ollama client")
            self._client = None
        except Exception as e:
            logger.error(f"Failed to initialize Ollama client: {e}")
            self._client = None

    def _get_model(self, task_complexity: str) -> str:
        """Get model based on task complexity"""
        if task_complexity == "complex":
            return self.model_complex
        return self.model_simple

    def _rate_limit(self):
        """Simple rate limiting"""
        current_time = time.time()
        elapsed = current_time - self._last_request_time
        if elapsed < self._min_request_interval:
            time.sleep(self._min_request_interval - elapsed)
        self._last_request_time = time.time()

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        task_complexity: str = "simple",
        max_tokens: int = 2000,
        temperature: float = 0.3,
        max_retries: int = 3,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """
        Execute chat completion using Ollama.

        Returns dict with 'success', 'content', 'model', 'usage' or 'error'
        """
        if not self.is_available():
            logger.warning("Ollama client not available")
            return {"success": False, "error": "Ollama client not available", "model": None}

        model = self._get_model(task_complexity)
        self._rate_limit()

        for attempt in range(max_retries):
            try:
                # Remove response_format if present - Ollama may not support it
                kwargs.pop('response_format', None)

                response = self._client.chat.completions.create(
                    model=model,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    **kwargs
                )

                return {
                    "success": True,
                    "content": response.choices[0].message.content,
                    "model": model,
                    "provider": "ollama",
                    "usage": {
                        "prompt_tokens": getattr(response.usage, 'prompt_tokens', 0),
                        "completion_tokens": getattr(response.usage, 'completion_tokens', 0),
                        "total_tokens": getattr(response.usage, 'total_tokens', 0),
                    }
                }

            except Exception as e:
                logger.warning(f"Ollama request attempt {attempt + 1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    sleep_time = 2 ** attempt
                    time.sleep(sleep_time)
                else:
                    logger.error(f"Ollama request failed after {max_retries} attempts: {e}")
                    return {
                        "success": False,
                        "error": str(e),
                        "model": model,
                        "provider": "ollama"
                    }

        return {"success": False, "error": "Max retries exceeded", "model": model, "provider": "ollama"}

    def chat_completion_json(
        self,
        messages: List[Dict[str, str]],
        task_complexity: str = "simple",
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """
        Execute chat completion with JSON response parsing.

        Note: Ollama may not support response_format, so we instruct
        the model to return JSON in the system prompt.
        """
        # Add JSON instruction to system message if not present
        json_instruction = "\nYou MUST respond with valid JSON only. No explanations or markdown."

        modified_messages = []
        has_system = False

        for msg in messages:
            if msg.get("role") == "system":
                has_system = True
                content = msg.get("content", "")
                if "json" not in content.lower():
                    content += json_instruction
                modified_messages.append({**msg, "content": content})
            else:
                modified_messages.append(msg)

        if not has_system:
            modified_messages.insert(0, {
                "role": "system",
                "content": "You are a helpful assistant." + json_instruction
            })

        result = self.chat_completion(
            messages=modified_messages,
            task_complexity=task_complexity,
            **kwargs
        )

        if result is None or not result.get("success"):
            return result

        # Parse JSON from response
        try:
            content = result["content"]
            # Clean markdown code blocks if present
            if content.strip().startswith("```"):
                lines = content.strip().split("\n")
                # Remove first and last lines (```json and ```)
                content = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

            parsed_data = json.loads(content)
            return {
                "success": True,
                "data": parsed_data,
                "model": result["model"],
                "provider": "ollama",
                "usage": result.get("usage", {})
            }
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from Ollama response: {e}")
            return {
                "success": False,
                "error": f"JSON parse error: {e}",
                "raw_content": result["content"],
                "model": result["model"],
                "provider": "ollama"
            }

    def is_available(self) -> bool:
        """Check if Ollama is reachable"""
        if self._client is None:
            return False

        try:
            response = httpx.get(f"{self.base_url}/api/tags", timeout=5.0)
            return response.status_code == 200
        except Exception:
            return False

    def get_status(self) -> Dict[str, Any]:
        """Get Ollama client status"""
        available = self.is_available()
        models = []

        if available:
            models = self.fetch_available_models(self.base_url)

        return {
            "available": available,
            "provider": "ollama",
            "endpoint": self.base_url,
            "models": {
                "complex": self.model_complex,
                "simple": self.model_simple,
            },
            "available_models": models
        }

    @staticmethod
    def fetch_available_models(base_url: str) -> List[str]:
        """
        Fetch list of available models from Ollama endpoint.

        Args:
            base_url: Ollama server URL (e.g., http://localhost:11434)

        Returns:
            List of model names
        """
        try:
            response = httpx.get(
                f"{base_url.rstrip('/')}/api/tags",
                timeout=10.0
            )
            if response.status_code == 200:
                data = response.json()
                return [model["name"] for model in data.get("models", [])]
        except Exception as e:
            logger.error(f"Failed to fetch Ollama models from {base_url}: {e}")

        return []

    @staticmethod
    def check_health(base_url: str) -> Dict[str, Any]:
        """
        Check if Ollama endpoint is healthy.

        Args:
            base_url: Ollama server URL

        Returns:
            Dict with 'available' and 'error' (if any)
        """
        try:
            response = httpx.get(
                f"{base_url.rstrip('/')}/api/tags",
                timeout=5.0
            )
            return {
                "available": response.status_code == 200,
                "status_code": response.status_code
            }
        except httpx.TimeoutException:
            return {"available": False, "error": "Connection timeout"}
        except httpx.ConnectError:
            return {"available": False, "error": "Cannot connect to Ollama endpoint"}
        except Exception as e:
            return {"available": False, "error": str(e)}

    @staticmethod
    def test_completion(base_url: str, model: str) -> Dict[str, Any]:
        """
        Test a simple completion with the specified model.

        Args:
            base_url: Ollama server URL
            model: Model name to test

        Returns:
            Dict with 'success', 'response' or 'error'
        """
        try:
            from openai import OpenAI
            client = OpenAI(
                base_url=f"{base_url.rstrip('/')}/v1",
                api_key="ollama"
            )

            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": "Say 'hello' in one word."}],
                max_tokens=10,
                temperature=0.1
            )

            return {
                "success": True,
                "response": response.choices[0].message.content,
                "model": model
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "model": model
            }
