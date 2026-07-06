"""
Image generation stage: Script -> Script with image_path populated per panel.

STUB IMPLEMENTATION for now. On CPU-only hardware, real Stable Diffusion
generation is impractically slow (potentially 30+ min for a multi-panel
comic), so this stage currently generates a placeholder image per panel
so the rest of the pipeline (assembly, export) can be built and tested
end-to-end without waiting on real image generation.

To plug in a real image generator later:
  - Replace _generate_placeholder_image with a call to your chosen
    image API/model
  - The function signature (panel -> image_path) stays the same, so
    assembly.py doesn't need to change
"""

import os
from PIL import Image, ImageDraw, ImageFont

from app.models.schemas import Script
from app.config import settings


def _generate_placeholder_image(panel, output_dir: str) -> str:
    """Create a simple placeholder image showing the panel's visual description."""
    width, height = 512, 512
    img = Image.new("RGB", (width, height), color=(230, 230, 250))
    draw = ImageDraw.Draw(img)

    # Wrap text manually (basic word wrap)
    text = f"Panel {panel.panel_number}\n\n{panel.visual_description}"
    lines = []
    for paragraph in text.split("\n"):
        words = paragraph.split(" ")
        current_line = ""
        for word in words:
            test_line = f"{current_line} {word}".strip()
            if len(test_line) > 50:
                lines.append(current_line)
                current_line = word
            else:
                current_line = test_line
        lines.append(current_line)

    y = 20
    for line in lines:
        draw.text((20, y), line, fill=(40, 40, 40))
        y += 20

    image_path = os.path.join(output_dir, f"{panel.panel_id}.png")
    img.save(image_path)
    return image_path


def generate_images(script: Script) -> Script:
    """
    Generate (placeholder) images for each panel in the script.

    Returns the same Script with image_path populated on each panel.
    """
    output_dir = os.path.join(settings.output_dir, script.document_id, "images")
    os.makedirs(output_dir, exist_ok=True)

    for panel in script.panels:
        panel.image_path = _generate_placeholder_image(panel, output_dir)

    return script