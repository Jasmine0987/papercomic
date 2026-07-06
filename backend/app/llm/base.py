"""
Abstract base class for LLM providers.

All providers implement a single method: generate_json(prompt, schema_hint).
This means the script generation stage doesn't care whether it's talking
to Gemini, Ollama, or Claude - swapping providers is a one-line config change.
"""

from abc import ABC, abstractmethod


class LLMProvider(ABC):
    @abstractmethod
    def generate_json(self, prompt: str) -> str:
        """
        Send a prompt to the LLM and return the raw text response.
        The response is expected to be JSON (possibly wrapped in
        markdown code fences, which callers should strip).

        Args:
            prompt: the full prompt, including instructions to respond in JSON

        Returns:
            raw text response from the model
        """
        raise NotImplementedError