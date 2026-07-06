"""
Factory function: returns the configured LLM provider.

This is the single place that decides "which LLM are we using" -
the rest of the codebase just calls provider.generate_json(prompt)
and never needs to know whether that's Gemini or Ollama.
"""

from app.llm.base import LLMProvider
from app.config import settings


def get_llm_provider() -> LLMProvider:
    if settings.llm_provider == "gemini":
        from app.llm.gemini_provider import GeminiProvider
        return GeminiProvider()
    elif settings.llm_provider == "ollama":
        from app.llm.ollama_provider import OllamaProvider
        return OllamaProvider()
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {settings.llm_provider}")