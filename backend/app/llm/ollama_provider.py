"""
Ollama provider implementation - for fully local development with no API costs.

Requires Ollama installed and running locally (ollama.com), with a model
pulled, e.g.:
    ollama pull llama3.2

Note: on CPU-only hardware, smaller models (3B-7B) are recommended for
reasonable response times, but JSON output reliability may be lower
than Gemini/Claude. Useful for testing pipeline plumbing, not for
evaluating final output quality.
"""

import ollama

from app.llm.base import LLMProvider
from app.config import settings


class OllamaProvider(LLMProvider):
    def __init__(self):
        self.client = ollama.Client(host=settings.ollama_host)
        self.model = settings.ollama_model

    def generate_json(self, prompt: str) -> str:
        # Ollama doesn't enforce JSON mode the same way Gemini does,
        # so we explicitly instruct the model and rely on the caller
        # to strip markdown fences / handle malformed JSON gracefully.
        response = self.client.chat(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": "You always respond with valid JSON only, no markdown fences, no extra text.",
                },
                {"role": "user", "content": prompt},
            ],
            options={"temperature": 0.4},
        )
        return response["message"]["content"]