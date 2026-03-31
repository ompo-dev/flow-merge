from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "public"
TAURI_DIR = ROOT / "src-tauri"

SIZE = 1024
PADDING = 92
RADIUS = 236
NODE_SIZE = 170
STROKE = 66
GITHUB_GREEN = "#2da44e"
GITHUB_GREEN_BORDER = "#238636"
GLYPH = "#f0f6fc"

def icon_palette() -> dict[str, str]:
    return {
        "bg": GITHUB_GREEN,
        "border": GITHUB_GREEN_BORDER,
        "glyph": GLYPH,
        "glow": "#1f7a38",
        "sheen": "#63d481",
    }


def build_geometry() -> dict[str, tuple[int, int]]:
    center_x = SIZE // 2
    center_y = 520
    return {
        "top": (center_x, 242),
        "left": (center_x - 288, 726),
        "right": (center_x + 288, 726),
        "junction": (center_x, center_y),
    }


def draw_icon(size: int = SIZE) -> Image.Image:
    palette = icon_palette()
    scale = size / SIZE
    pad = int(PADDING * scale)
    radius = int(RADIUS * scale)
    node_size = int(NODE_SIZE * scale)
    stroke = int(STROKE * scale)
    border_width = max(4, int(10 * scale))
    inset = max(8, int(18 * scale))
    glow_radius = max(8, int(24 * scale))
    shadow_offset = max(6, int(12 * scale))
    node_radius = max(18, int(34 * scale))

    geometry = build_geometry()
    geometry = {
        key: (int(x * scale), int(y * scale))
        for key, (x, y) in geometry.items()
    }

    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Soft outer glow for better separation on mixed desktops.
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.rounded_rectangle(
        (pad, pad, size - pad, size - pad),
        radius=radius,
        fill=hex_to_rgba(palette["glow"], 86),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(glow_radius))
    image.alpha_composite(glow)

    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (pad, pad + shadow_offset, size - pad, size - pad + shadow_offset),
        radius=radius,
        fill=(0, 0, 0, 120),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(10, int(30 * scale))))
    image.alpha_composite(shadow)

    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (pad, pad, size - pad, size - pad),
        radius=radius,
        fill=palette["bg"],
        outline=palette["border"],
        width=border_width,
    )

    draw.rounded_rectangle(
        (pad + inset, pad + inset, size - pad - inset, size - pad - inset),
        radius=max(32, radius - inset),
        outline=hex_to_rgba(palette["sheen"], 120),
        width=max(2, int(6 * scale)),
    )

    line_draw = ImageDraw.Draw(image)
    line_draw.line(
        [geometry["left"], geometry["junction"], geometry["right"]],
        fill=palette["glyph"],
        width=stroke,
        joint="curve",
    )
    line_draw.line(
        [geometry["junction"], geometry["top"]],
        fill=palette["glyph"],
        width=stroke,
    )

    for key in ("left", "right", "top"):
        cx, cy = geometry[key]
        half = node_size // 2
        line_draw.rounded_rectangle(
            (cx - half, cy - half, cx + half, cy + half),
            radius=node_radius,
            outline=palette["glyph"],
            width=max(12, int(24 * scale)),
        )

    return image


def build_svg() -> str:
    palette = icon_palette()
    geometry = build_geometry()

    pad = PADDING
    inner_pad = 114
    inner_radius = RADIUS - 22
    half = NODE_SIZE // 2

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" fill="none">
  <defs>
    <filter id="shadow" x="0" y="0" width="{SIZE}" height="{SIZE}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="14" stdDeviation="24" flood-color="#000000" flood-opacity="0.28"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <rect x="{pad}" y="{pad}" width="{SIZE - pad * 2}" height="{SIZE - pad * 2}" rx="{RADIUS}" fill="{escape(palette["bg"])}" stroke="{escape(palette["border"])}" stroke-width="12"/>
    <rect x="{inner_pad}" y="{inner_pad}" width="{SIZE - inner_pad * 2}" height="{SIZE - inner_pad * 2}" rx="{inner_radius}" stroke="{escape(palette["sheen"])}" stroke-opacity="0.45" stroke-width="6"/>
  </g>
  <path d="M {geometry["left"][0]} {geometry["left"][1]} V {geometry["junction"][1] - 54} C {geometry["left"][0]} {geometry["junction"][1] - 24}, {geometry["left"][0] + 30} {geometry["junction"][1]}, {geometry["left"][0] + 64} {geometry["junction"][1]} H {geometry["right"][0] - 64} C {geometry["right"][0] - 30} {geometry["junction"][1]}, {geometry["right"][0]} {geometry["junction"][1] - 24}, {geometry["right"][0]} {geometry["junction"][1] - 54} V {geometry["right"][1]}" stroke="{escape(palette["glyph"])}" stroke-width="{STROKE}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M {geometry["junction"][0]} {geometry["junction"][1]} V {geometry["top"][1] + half}" stroke="{escape(palette["glyph"])}" stroke-width="{STROKE}" stroke-linecap="round"/>
  <rect x="{geometry["left"][0] - half}" y="{geometry["left"][1] - half}" width="{NODE_SIZE}" height="{NODE_SIZE}" rx="44" stroke="{escape(palette["glyph"])}" stroke-width="28"/>
  <rect x="{geometry["right"][0] - half}" y="{geometry["right"][1] - half}" width="{NODE_SIZE}" height="{NODE_SIZE}" rx="44" stroke="{escape(palette["glyph"])}" stroke-width="28"/>
  <rect x="{geometry["top"][0] - half}" y="{geometry["top"][1] - half}" width="{NODE_SIZE}" height="{NODE_SIZE}" rx="44" stroke="{escape(palette["glyph"])}" stroke-width="28"/>
</svg>
"""


def hex_to_rgba(hex_color: str, alpha: int) -> tuple[int, int, int, int]:
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[index : index + 2], 16) for index in (0, 2, 4)) + (alpha,)


def main() -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    TAURI_DIR.mkdir(parents=True, exist_ok=True)

    brand_png = draw_icon(SIZE)

    brand_png.save(TAURI_DIR / "icon-desktop.png")
    brand_png.save(PUBLIC_DIR / "icon-dark.png")
    brand_png.save(PUBLIC_DIR / "icon-light.png")
    brand_png.resize((180, 180), Image.Resampling.LANCZOS).save(PUBLIC_DIR / "apple-touch-icon.png")

    svg = build_svg()
    (PUBLIC_DIR / "icon-dark.svg").write_text(svg, encoding="utf-8")
    (PUBLIC_DIR / "icon-light.svg").write_text(svg, encoding="utf-8")


if __name__ == "__main__":
    main()
