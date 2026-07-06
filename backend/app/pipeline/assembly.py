"""
Assembly stage: Script (with images) -> comic page images.

Lays out generated panel images into comic pages (grid layout) and
saves them as page images. A simple fixed grid (2x2) is used for the
MVP; this can be made more sophisticated (variable panel sizes,
manga-style layouts) later without changing the stage's interface.
"""

import os
from PIL import Image

from app.models.schemas import Script
from app.config import settings


PANELS_PER_PAGE = 4  # 2x2 grid
PAGE_WIDTH = 1024
PAGE_HEIGHT = 1024
PANEL_SIZE = 512
MARGIN = 0


def assemble_pages(script: Script) -> list[str]:
    """
    Assemble panel images into comic pages.

    Returns:
        list of file paths to generated page images
    """
    output_dir = os.path.join(settings.output_dir, script.document_id, "pages")
    os.makedirs(output_dir, exist_ok=True)

    page_paths: list[str] = []
    panels = script.panels

    for page_start in range(0, len(panels), PANELS_PER_PAGE):
        page_panels = panels[page_start:page_start + PANELS_PER_PAGE]
        page_img = Image.new("RGB", (PAGE_WIDTH, PAGE_HEIGHT), color=(255, 255, 255))

        for idx, panel in enumerate(page_panels):
            if not panel.image_path or not os.path.exists(panel.image_path):
                continue

            panel_img = Image.open(panel.image_path).resize((PANEL_SIZE, PANEL_SIZE))

            row = idx // 2
            col = idx % 2
            x = col * PANEL_SIZE
            y = row * PANEL_SIZE

            page_img.paste(panel_img, (x, y))

        page_number = (page_start // PANELS_PER_PAGE) + 1
        page_path = os.path.join(output_dir, f"page_{page_number}.png")
        page_img.save(page_path)
        page_paths.append(page_path)

    return page_paths