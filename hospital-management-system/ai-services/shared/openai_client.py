"""
Centralized OpenAI Client Manager for HMS AI Services

Provides a singleton OpenAI client with:
- Automatic retry with exponential backoff
- Model selection based on task complexity
- Unified error handling
- Support for chat completions, vision, and speech-to-text
- Hospital-aware provider selection (OpenAI or Ollama)
"""
import os
import logging
import time
import json
from typing import Optional, Dict, Any, List, Union

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None

# Import LLM provider abstraction for Ollama support
from .llm_provider import OllamaClient, HospitalAIConfig, LLMProvider

logger = logging.getLogger(__name__)


class Models:
    """OpenAI Model Constants"""
    # Complex reasoning tasks (diagnosis, clinical analysis, medical imaging, triage)
    GPT_4O = "gpt-4o"

    # Simple tasks (entity extraction, chat, basic queries, explanations)
    GPT_4O_MINI = "gpt-4o-mini"

    # Speech-to-text
    WHISPER = "whisper-1"

    # Legacy (for backward compatibility - will use gpt-4o-mini)
    GPT_35_TURBO = "gpt-3.5-turbo"


class TaskComplexity:
    """Task complexity levels for automatic model selection"""
    COMPLEX = "complex"    # Uses gpt-4o
    SIMPLE = "simple"      # Uses gpt-4o-mini
    SPEECH = "speech"      # Uses whisper-1


# Model selection mapping
MODEL_MAP = {
    TaskComplexity.COMPLEX: Models.GPT_4O,
    TaskComplexity.SIMPLE: Models.GPT_4O_MINI,
    TaskComplexity.SPEECH: Models.WHISPER,
}


class OpenAIClientManager:
    """
    Singleton manager for OpenAI client with retry logic and centralized error handling.

    Usage:
        from shared.openai_client import openai_manager, TaskComplexity

        # Chat completion
        result = openai_manager.chat_completion(
            messages=[{"role": "user", "content": "Hello"}],
            task_complexity=TaskComplexity.SIMPLE
        )

        # Vision completion
        result = openai_manager.vision_completion(
            prompt="Analyze this X-ray",
            image_url="https://..."
        )

        # Audio transcription
        result = openai_manager.transcribe_audio(audio_file)
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def _initialize(self):
        """Initialize the OpenAI client"""
        if self._initialized:
            return

        self.api_key = os.getenv("OPENAI_API_KEY")
        self._client = None
        self._last_request_time = 0
        self._min_request_interval = 0.05  # 50ms between requests

        if OPENAI_AVAILABLE and self.api_key:
            try:
                self._client = OpenAI(api_key=self.api_key)
                logger.info("OpenAI client initialized successfully")
                print("OpenAI GPT integration enabled")
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI client: {e}")
                print(f"OpenAI initialization failed: {e}")
        else:
            if not OPENAI_AVAILABLE:
                logger.warning("OpenAI package not installed")
            elif not self.api_key:
                logger.warning("OPENAI_API_KEY not set")

        self._initialized = True

    def __init__(self):
        self._initialize()

    @property
    def client(self) -> Optional[Any]:
        """Get the underlying OpenAI client"""
        return self._client

    def is_available(self) -> bool:
        """Check if OpenAI API is available"""
        return self._client is not None

    def get_model(self, task_complexity: str) -> str:
        """Get appropriate model based on task complexity"""
        return MODEL_MAP.get(task_complexity, Models.GPT_4O_MINI)

    def _rate_limit(self):
        """Simple rate limiting to avoid API throttling"""
        current_time = time.time()
        elapsed = current_time - self._last_request_time
        if elapsed < self._min_request_interval:
            time.sleep(self._min_request_interval - elapsed)
        self._last_request_time = time.time()

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        task_complexity: str = TaskComplexity.SIMPLE,
        model_override: Optional[str] = None,
        max_tokens: int = 2000,
        temperature: float = 0.3,
        response_format: Optional[Dict] = None,
        max_retries: int = 3,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """
        Unified chat completion with retry logic and error handling.

        Args:
            messages: List of message dicts with 'role' and 'content'
            task_complexity: COMPLEX (gpt-4o) or SIMPLE (gpt-4o-mini)
            model_override: Override automatic model selection
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature (0-1)
            response_format: Optional {"type": "json_object"} for JSON responses
            max_retries: Number of retry attempts
            **kwargs: Additional parameters passed to OpenAI API

        Returns:
            Dict with 'success', 'content', 'model', 'usage' or 'error'
        """
        if not self.is_available():
            logger.warning("OpenAI not available, returning None")
            return None

        model = model_override or self.get_model(task_complexity)

        # Rate limiting
        self._rate_limit()

        # Retry logic with exponential backoff
        for attempt in range(max_retries):
            try:
                params = {
                    "model": model,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    **kwargs
                }

                if response_format:
                    params["response_format"] = response_format

                response = self._client.chat.completions.create(**params)

                return {
                    "success": True,
                    "content": response.choices[0].message.content,
                    "model": model,
                    "usage": {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens,
                    }
                }

            except Exception as e:
                logger.warning(f"OpenAI request attempt {attempt + 1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    sleep_time = 2 ** attempt  # 1, 2, 4 seconds
                    time.sleep(sleep_time)
                else:
                    logger.error(f"OpenAI request failed after {max_retries} attempts: {e}")
                    return {"success": False, "error": str(e), "model": model}

        return {"success": False, "error": "Max retries exceeded", "model": model}

    def chat_completion_json(
        self,
        messages: List[Dict[str, str]],
        task_complexity: str = TaskComplexity.SIMPLE,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """
        Chat completion with JSON response format.
        Automatically parses JSON from response.

        Returns:
            Dict with 'success', 'data' (parsed JSON), 'model', 'usage' or 'error'
        """
        result = self.chat_completion(
            messages=messages,
            task_complexity=task_complexity,
            response_format={"type": "json_object"},
            **kwargs
        )

        if result is None:
            return None

        if not result.get("success"):
            return result

        try:
            content = result["content"]
            # Clean markdown code blocks if present
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]

            parsed_data = json.loads(content)
            return {
                "success": True,
                "data": parsed_data,
                "model": result["model"],
                "usage": result["usage"]
            }
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            return {
                "success": False,
                "error": f"JSON parse error: {e}",
                "raw_content": result["content"],
                "model": result["model"]
            }

    def vision_completion(
        self,
        prompt: str,
        image_url: str,
        max_tokens: int = 2000,
        temperature: float = 0.3,
        detail: str = "high",
        max_retries: int = 3
    ) -> Optional[Dict[str, Any]]:
        """
        GPT-4o Vision completion for medical image analysis.

        Args:
            prompt: Text prompt describing what to analyze
            image_url: URL of image or base64 data URI
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature
            detail: Image detail level ("low", "high", "auto")
            max_retries: Number of retry attempts

        Returns:
            Dict with 'success', 'content', 'model', 'usage' or 'error'
        """
        if not self.is_available():
            return None

        self._rate_limit()

        for attempt in range(max_retries):
            try:
                response = self._client.chat.completions.create(
                    model=Models.GPT_4O,
                    messages=[{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_url,
                                    "detail": detail
                                }
                            }
                        ]
                    }],
                    max_tokens=max_tokens,
                    temperature=temperature
                )

                return {
                    "success": True,
                    "content": response.choices[0].message.content,
                    "model": Models.GPT_4O,
                    "usage": {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens,
                    }
                }

            except Exception as e:
                logger.warning(f"Vision request attempt {attempt + 1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                else:
                    logger.error(f"Vision request failed after {max_retries} attempts: {e}")
                    return {"success": False, "error": str(e), "model": Models.GPT_4O}

        return {"success": False, "error": "Max retries exceeded", "model": Models.GPT_4O}

    def transcribe_audio(
        self,
        audio_file: Any,
        language: str = "en",
        prompt: Optional[str] = None,
        response_format: str = "verbose_json"
    ) -> Optional[Dict[str, Any]]:
        """
        Transcribe audio using Whisper.

        Args:
            audio_file: File object or path to audio file
            language: Language code (e.g., "en")
            prompt: Optional context prompt for better accuracy
            response_format: Response format ("json", "text", "srt", "verbose_json", "vtt")

        Returns:
            Dict with 'success', 'transcript', 'segments', 'duration' or 'error'
        """
        if not self.is_available():
            return None

        self._rate_limit()

        try:
            params = {
                "model": Models.WHISPER,
                "file": audio_file,
                "language": language,
                "response_format": response_format
            }

            if prompt:
                params["prompt"] = prompt

            response = self._client.audio.transcriptions.create(**params)

            return {
                "success": True,
                "transcript": response.text,
                "duration": getattr(response, 'duration', None),
                "segments": getattr(response, 'segments', []),
                "language": getattr(response, 'language', language)
            }

        except Exception as e:
            logger.error(f"Whisper transcription failed: {e}")
            return {"success": False, "error": str(e)}

    def get_status(self) -> Dict[str, Any]:
        """Get status information about the OpenAI client"""
        return {
            "available": self.is_available(),
            "api_key_set": bool(self.api_key),
            "package_installed": OPENAI_AVAILABLE,
            "models": {
                "complex": Models.GPT_4O,
                "simple": Models.GPT_4O_MINI,
                "speech": Models.WHISPER,
                "vision": Models.GPT_4O
            }
        }

    # =========================================================================
    # Hospital-Aware Provider Selection (OpenAI or Ollama)
    # =========================================================================

    _ollama_clients: Dict[str, OllamaClient] = {}  # Cache by endpoint+models

    def get_provider_client(self, config: HospitalAIConfig) -> Union["OpenAIClientManager", OllamaClient]:
        """
        Get the appropriate LLM client based on hospital configuration.

        Args:
            config: Hospital AI configuration

        Returns:
            OllamaClient if Ollama is configured, otherwise self (OpenAI)
        """
        if config.is_ollama():
            cache_key = f"{config.ollama_endpoint}|{config.ollama_model_complex}|{config.ollama_model_simple}"

            if cache_key not in self._ollama_clients:
                self._ollama_clients[cache_key] = OllamaClient(
                    base_url=config.ollama_endpoint,
                    model_complex=config.ollama_model_complex or "gpt-oss:120b",
                    model_simple=config.ollama_model_simple or "gpt-oss:20b",
                )
                logger.info(f"Created new Ollama client for {config.ollama_endpoint}")

            return self._ollama_clients[cache_key]

        return self  # Default to OpenAI

    def chat_completion_with_config(
        self,
        messages: List[Dict[str, str]],
        hospital_config: Optional[HospitalAIConfig] = None,
        task_complexity: str = TaskComplexity.SIMPLE,
        max_tokens: int = 2000,
        temperature: float = 0.3,
        response_format: Optional[Dict] = None,
        max_retries: int = 3,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """
        Chat completion with hospital-specific provider selection.

        If hospital_config specifies Ollama, uses Ollama client.
        Otherwise, uses OpenAI (default).

        Args:
            messages: List of message dicts
            hospital_config: Optional hospital AI configuration
            task_complexity: COMPLEX or SIMPLE
            max_tokens: Maximum tokens in response
            temperature: Sampling temperature
            response_format: Optional JSON response format (OpenAI only)
            max_retries: Number of retry attempts
            **kwargs: Additional parameters

        Returns:
            Dict with 'success', 'content', 'model', 'provider', 'usage' or 'error'
        """
        # Use Ollama if configured
        if hospital_config and hospital_config.is_ollama():
            client = self.get_provider_client(hospital_config)
            return client.chat_completion(
                messages=messages,
                task_complexity=task_complexity,
                max_tokens=max_tokens,
                temperature=temperature,
                max_retries=max_retries,
                **kwargs
            )

        # Default to OpenAI
        result = self.chat_completion(
            messages=messages,
            task_complexity=task_complexity,
            max_tokens=max_tokens,
            temperature=temperature,
            response_format=response_format,
            max_retries=max_retries,
            **kwargs
        )

        # Add provider info to result
        if result:
            result["provider"] = "openai"

        return result

    def chat_completion_json_with_config(
        self,
        messages: List[Dict[str, str]],
        hospital_config: Optional[HospitalAIConfig] = None,
        task_complexity: str = TaskComplexity.SIMPLE,
        **kwargs
    ) -> Optional[Dict[str, Any]]:
        """
        Chat completion with JSON response and hospital-specific provider.

        Args:
            messages: List of message dicts
            hospital_config: Optional hospital AI configuration
            task_complexity: COMPLEX or SIMPLE
            **kwargs: Additional parameters

        Returns:
            Dict with 'success', 'data', 'model', 'provider', 'usage' or 'error'
        """
        # Use Ollama if configured
        if hospital_config and hospital_config.is_ollama():
            client = self.get_provider_client(hospital_config)
            return client.chat_completion_json(
                messages=messages,
                task_complexity=task_complexity,
                **kwargs
            )

        # Default to OpenAI
        result = self.chat_completion_json(
            messages=messages,
            task_complexity=task_complexity,
            **kwargs
        )

        # Add provider info to result
        if result:
            result["provider"] = "openai"

        return result

    def get_provider_status(self, hospital_config: Optional[HospitalAIConfig] = None) -> Dict[str, Any]:
        """
        Get status for the configured provider.

        Args:
            hospital_config: Optional hospital AI configuration

        Returns:
            Status dict for the appropriate provider
        """
        if hospital_config and hospital_config.is_ollama():
            client = self.get_provider_client(hospital_config)
            return client.get_status()

        return {
            **self.get_status(),
            "provider": "openai"
        }


# Singleton instance - import this in other modules
openai_manager = OpenAIClientManager()
