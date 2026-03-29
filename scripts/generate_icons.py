from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "public"
TAURI_DIR = ROOT / "src-tauri"

SIZE = 1024
PADDING = 96
RADIUS = 238
NODE_SIZE = 154
STROKE = 92


def icon_palette(kind: str) -> dict[str, str]:
    if kind == "light":
        return {
            "bg": "#2da44e",
            "border": "#238636",
            "glyph": "#0d1117",
            "glow": "#20803d",
            "sheen": "#55c776",
        }

    return {
        "bg": "#161b22",
        "border": "#30363d",
        "glyph": "#f0f6fc",
        "glow": "#2da44e",
        "sheen": "#2a313c",
    }


def build_geometry() -> dict[str, tuple[int, int]]:
    center_x = SIZE // 2
    center_y = 500
    return {
        "left": (center_x - 214, 312),
        "right": (center_x + 214, 312),
        "bottom": (center_x, 734),
        "center": (center_x, center_y),
    }


def draw_icon(kind: str, size: int = SIZE) -> Image.Image:
    palette = icon_palette(kind)
    scale = size / SIZE
    pad = int(PADDING * scale)
    radius = int(RADIUS * scale)
    node_size = int(NODE_SIZE * scale)
    stroke = int(STROKE * scale)
    border_width = max(4, int(12 * scale))
    inset = max(8, int(18 * scale))
    glow_radius = max(8, int(24 * scale))
    shadow_offset = max(6, int(12 * scale))

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
        fill=hex_to_rgba(palette["glow"], 110 if kind == "dark" else 70),
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
        [geometry["left"], geometry["center"], geometry["right"]],
        fill=palette["glyph"],
        width=stroke,
        joint="curve",
    )
    line_draw.line(
        [geometry["center"], geometry["bottom"]],
        fill=palette["glyph"],
        width=stroke,
    )

    junction_radius = max(18, int(34 * scale))
    line_draw.ellipse(
        (
            geometry["center"][0] - junction_radius,
            geometry["center"][1] - junction_radius,
            geometry["center"][0] + junction_radius,
            geometry["center"][1] + junction_radius,
        ),
        fill=palette["glyph"],
    )

    for key in ("left", "right", "bottom"):
        cx, cy = geometry[key]
        half = node_size // 2
        line_draw.rounded_rectangle(
            (cx - half, cy - half, cx + half, cy + half),
            radius=max(18, int(40 * scale)),
            fill=palette["glyph"],
        )

    return image


def build_svg(kind: str) -> str:
    palette = icon_palette(kind)
    geometry = build_geometry()

    pad = PADDING
    inner_pad = 114
    inner_radius = RADIUS - 22
    half = NODE_SIZE // 2
    junction_radius = 34

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
  <path d="M {geometry["left"][0]} {geometry["left"][1]} L {geometry["center"][0]} {geometry["center"][1]} L {geometry["right"][0]} {geometry["right"][1]}" stroke="{escape(palette["glyph"])}" stroke-width="{STROKE}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M {geometry["center"][0]} {geometry["center"][1]} L {geometry["bottom"][0]} {geometry["bottom"][1]}" stroke="{escape(palette["glyph"])}" stroke-width="{STROKE}" stroke-linecap="round"/>
  <circle cx="{geometry["center"][0]}" cy="{geometry["center"][1]}" r="{junction_radius}" fill="{escape(palette["glyph"])}"/>
  <rect x="{geometry["left"][0] - half}" y="{geometry["left"][1] - half}" width="{NODE_SIZE}" height="{NODE_SIZE}" rx="40" fill="{escape(palette["glyph"])}"/>
  <rect x="{geometry["right"][0] - half}" y="{geometry["right"][1] - half}" width="{NODE_SIZE}" height="{NODE_SIZE}" rx="40" fill="{escape(palette["glyph"])}"/>
  <rect x="{geometry["bottom"][0] - half}" y="{geometry["bottom"][1] - half}" width="{NODE_SIZE}" height="{NODE_SIZE}" rx="40" fill="{escape(palette["glyph"])}"/>
</svg>
"""


def hex_to_rgba(hex_color: str, alpha: int) -> tuple[int, int, int, int]:
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[index : index + 2], 16) for index in (0, 2, 4)) + (alpha,)


def main() -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    TAURI_DIR.mkdir(parents=True, exist_ok=True)

    dark_png = draw_icon("dark", SIZE)
    light_png = draw_icon("light", SIZE)

    dark_png.save(TAURI_DIR / "icon-desktop.png")
    dark_png.save(PUBLIC_DIR / "icon-dark.png")
    light_png.save(PUBLIC_DIR / "icon-light.png")
    light_png.resize((180, 180), Image.Resampling.LANCZOS).save(PUBLIC_DIR / "apple-touch-icon.png")

    (PUBLIC_DIR / "icon-dark.svg").write_text(build_svg("dark"), encoding="utf-8")
    (PUBLIC_DIR / "icon-light.svg").write_text(build_svg("light"), encoding="utf-8")


if __name__ == "__main__":
    main()
