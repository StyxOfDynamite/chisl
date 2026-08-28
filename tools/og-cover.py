#!/usr/bin/env python3
"""Generate the chisl Open Graph cover: muted walnut desk, laptop, wordmark."""
import random, pathlib

random.seed(7)  # deterministic — regenerating gives the identical file

W, H = 1200, 630

# Site palette (site/css/styles.css)
STONE = "#EDE6D9"
BRASS = "#B98B4F"
UMBER = "#8B6F47"
FOG = "#9A8E7C"

# Muted walnut, desaturated warm browns
WALNUT_HI = "#6A5138"
WALNUT_MID = "#54402C"
WALNUT_LO = "#3B2C1E"

out = []
A = out.append

A(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')

# ---------- defs ----------
A("<defs>")
A(f'''<linearGradient id="desk" x1="0" y1="0" x2="0.3" y2="1">
  <stop offset="0" stop-color="{WALNUT_HI}"/>
  <stop offset="0.55" stop-color="{WALNUT_MID}"/>
  <stop offset="1" stop-color="{WALNUT_LO}"/>
</linearGradient>''')
# Light falling from upper left, so the desk darkens toward the corners.
A('''<radialGradient id="vignette" cx="0.34" cy="0.3" r="0.95">
  <stop offset="0" stop-color="#000000" stop-opacity="0"/>
  <stop offset="0.6" stop-color="#000000" stop-opacity="0.18"/>
  <stop offset="1" stop-color="#000000" stop-opacity="0.55"/>
</radialGradient>''')
A(f'''<linearGradient id="lidFace" x1="0" y1="0" x2="0.4" y2="1">
  <stop offset="0" stop-color="#40372E"/>
  <stop offset="1" stop-color="#2C251E"/>
</linearGradient>''')
A('''<linearGradient id="baseFace" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#4A4038"/>
  <stop offset="1" stop-color="#2E2721"/>
</linearGradient>''')
# Warm glow from the screen spilling onto the desk.
A(f'''<radialGradient id="screenGlow" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0" stop-color="{BRASS}" stop-opacity="0.16"/>
  <stop offset="1" stop-color="{BRASS}" stop-opacity="0"/>
</radialGradient>''')
A('''<radialGradient id="contactShadow" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0" stop-color="#150F0A" stop-opacity="0.62"/>
  <stop offset="1" stop-color="#150F0A" stop-opacity="0"/>
</radialGradient>''')
A('<filter id="soften"><feGaussianBlur stdDeviation="7"/></filter>')
A("</defs>")

# ---------- desk ----------
A(f'<rect width="{W}" height="{H}" fill="url(#desk)"/>')

# Wood grain: long, near-horizontal wavy strokes with occasional tight pairs,
# the way walnut actually runs. Kept low-opacity so it reads as texture.
A('<g fill="none" stroke-linecap="round">')
y = -20.0
while y < H + 20:
    amp = random.uniform(3, 11)
    width = random.uniform(0.6, 2.3)
    darker = random.random() < 0.55
    colour = "#2E2218" if darker else "#7A5E40"
    opacity = random.uniform(0.09, 0.26) if darker else random.uniform(0.06, 0.15)
    phase = random.uniform(0, 6.28)
    pts = []
    for i in range(0, W + 40, 40):
        import math
        yy = y + math.sin(i / 190.0 + phase) * amp + math.sin(i / 47.0 + phase) * (amp * 0.22)
        pts.append(f"{i},{yy:.1f}")
    A(f'<polyline points="{" ".join(pts)}" stroke="{colour}" stroke-opacity="{opacity:.3f}" stroke-width="{width:.2f}"/>')
    y += random.uniform(4, 12)
A("</g>")

A(f'<rect width="{W}" height="{H}" fill="url(#vignette)"/>')

# ---------- laptop ----------
SX, SW = 728, 322          # screen left / width
STOP, SHGT = 158, 218      # screen top / height
BASE_Y = STOP + SHGT       # where lid meets base
cx = SX + SW / 2

# Contact shadow on the desk, thrown to the lower right.
A(f'<ellipse cx="{cx + 22}" cy="{BASE_Y + 66}" rx="262" ry="38" fill="url(#contactShadow)"/>')
# Screen light spilling forward onto the walnut.
A(f'<ellipse cx="{cx}" cy="{BASE_Y + 58}" rx="250" ry="78" fill="url(#screenGlow)"/>')

# Lid
A(f'<rect x="{SX}" y="{STOP}" width="{SW}" height="{SHGT}" rx="9" fill="url(#lidFace)"/>')
A(f'<rect x="{SX}" y="{STOP}" width="{SW}" height="{SHGT}" rx="9" fill="none" stroke="{UMBER}" stroke-opacity="0.34" stroke-width="1.2"/>')

# Panel
px, py = SX + 13, STOP + 13
pw, ph = SW - 26, SHGT - 30
A(f'<rect x="{px}" y="{py}" width="{pw}" height="{ph}" rx="3" fill="#14110C"/>')

# On-screen: an abstract of the site's own hero — three headline bars,
# a brass rule, and a couple of button shapes.
tx = px + 22
A(f'<rect x="{tx}" y="{py + 26}" width="46" height="5" rx="2.5" fill="{BRASS}" fill-opacity="0.85"/>')
for i, bw in enumerate((176, 150, 118)):
    A(f'<rect x="{tx}" y="{py + 46 + i * 21}" width="{bw}" height="12" rx="3" fill="{STONE}" fill-opacity="{0.90 - i * 0.16:.2f}"/>')
A(f'<rect x="{tx}" y="{py + 116}" width="210" height="4" rx="2" fill="{STONE}" fill-opacity="0.14"/>')
A(f'<rect x="{tx}" y="{py + 132}" width="68" height="20" rx="3" fill="{BRASS}" fill-opacity="0.78"/>')
A(f'<rect x="{tx + 78}" y="{py + 132}" width="68" height="20" rx="3" fill="none" stroke="{STONE}" stroke-opacity="0.30" stroke-width="1.2"/>')

# Screen reflection: a soft diagonal sheen across the glass.
A(f'<path d="M{px} {py + ph} L{px + pw * 0.52} {py} L{px + pw * 0.78} {py} L{px + pw * 0.18} {py + ph} Z" fill="{STONE}" fill-opacity="0.035"/>')

# Hinge
A(f'<rect x="{SX + 4}" y="{BASE_Y - 9}" width="{SW - 8}" height="7" rx="3" fill="#241E18"/>')

# Base in perspective: front edge wider than the hinge line.
bl, br = SX - 46, SX + SW + 46
A(f'<path d="M{SX} {BASE_Y} L{SX + SW} {BASE_Y} L{br} {BASE_Y + 40} L{bl} {BASE_Y + 40} Z" fill="url(#baseFace)"/>')
A(f'<ellipse cx="{cx}" cy="{BASE_Y + 48}" rx="196" ry="9" fill="#160F09" fill-opacity="0.55" filter="url(#soften)"/>')
# Front lip catching the light.
A(f'<path d="M{bl} {BASE_Y + 40} L{br} {BASE_Y + 40} L{br - 3} {BASE_Y + 47} L{bl + 3} {BASE_Y + 47} Z" fill="#564A40"/>')
# Trackpad, foreshortened.
A(f'<path d="M{cx - 46} {BASE_Y + 14} L{cx + 46} {BASE_Y + 14} L{cx + 53} {BASE_Y + 34} L{cx - 53} {BASE_Y + 34} Z" fill="#241E19" fill-opacity="0.75"/>')

# ---------- type ----------
TX = 96
A(f'<text x="{TX}" y="228" font-family="Georgia, serif" font-size="15" letter-spacing="4.2" fill="{BRASS}">WEB DEVELOPMENT STUDIO</text>')
A(f'<text x="{TX}" y="342" font-family="Georgia, serif" font-size="118" font-weight="bold" fill="{STONE}">chi<tspan fill="{BRASS}">s</tspan>l</text>')
A(f'<rect x="{TX}" y="374" width="104" height="2.5" fill="{BRASS}" fill-opacity="0.9"/>')
A(f'<text x="{TX}" y="424" font-family="Georgia, serif" font-size="27" fill="{STONE}" fill-opacity="0.92">We don’t build websites.</text>')
A(f'<text x="{TX}" y="461" font-family="Georgia, serif" font-size="27" fill="{STONE}" fill-opacity="0.92">We carve them.</text>')
A(f'<text x="{TX}" y="527" font-family="Georgia, serif" font-size="17" letter-spacing="2.6" fill="{STONE}" fill-opacity="0.55">chisl.io</text>')

A("</svg>")

path = pathlib.Path("og-cover.svg")
path.write_text("\n".join(out))
print(f"wrote {path} ({path.stat().st_size} bytes)")
