"""
Gemini API provider implementation.

Uses the free tier of Google AI Studio (ai.google.dev) - no credit card
required for development. Get an API key and set GEMINI_API_KEY in .env.
"""

import google.generativeai as genai

from app.llm.base import LLMProvider
from app.config import settings


class GeminiProvider(LLMProvider):
    def __init__(self):
        if not settings.gemini_api_key:
            raise ValueError(
                "GEMINI_API_KEY is not set. Get a free key at https://ai.google.dev "
                "and add it to your .env file."
            )
        genai.configure(api_key=settings.gemini_api_key)
        self.model = genai.GenerativeModel(settings.gemini_model)

    def generate_json(self, prompt: str) -> str:
        response = self.model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.4,
            ),
        )
        return response.text