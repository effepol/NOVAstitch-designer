"""NOVAstitch Designer's icon, at every size the app needs (contract, module 0,
«Aspetto rosso e icona NS», 18/11).

  python3 assets/icon/make_icons.py

Sources: ns-1024.png, the NS drawn in white dots on #CC1219 (the Signor
Poletti's draft, 1024 px), used as it is for the large sizes; and, for 16, 24,
30 and 32 px, where the dots run together, a simplified NS of full white
letters, larger, without dots (ns-small.svg, drawn here). Writes:

  assets/icon/ns-small.svg, ns-small-{16,24,30,32}.png
  src-tauri/icons/  (PNG sizes, icon.ico with 16/24/32 from the simplified
                     variant, icon.icns with 16 and 32 from it)
  ui/public/icon.png (the 1024 px icon), icon-small.png (32 px, simplified),
  icon.svg (the dotted NS as vectors, dots measured on ns-1024.png)

Needs Pillow. Deterministic: the same sources give the same bytes.
"""

import io
import os
import struct

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
RED = (0xCC, 0x12, 0x19, 255)
WHITE = (255, 255, 255, 255)
SIZE = 1024
RADIUS = 188  # the tile's corner radius on ns-1024.png

# The simplified NS on the 1024 grid: full white letters, larger than the dots.
N_LETTER = [
    [(140, 250), (270, 250), (270, 774), (140, 774)],  # left stem
    [(430, 250), (560, 250), (560, 774), (430, 774)],  # right stem
    [(140, 250), (270, 250), (560, 774), (430, 774)],  # diagonal
]
S_LETTER = [
    [(610, 250), (904, 250), (904, 380), (610, 380)],  # top
    [(610, 250), (740, 250), (740, 577), (610, 577)],  # upper left
    [(610, 447), (904, 447), (904, 577), (610, 577)],  # middle
    [(774, 447), (904, 447), (904, 774), (774, 774)],  # lower right
    [(610, 644), (904, 644), (904, 774), (610, 774)],  # bottom
]
SMALL = N_LETTER + S_LETTER


def png_bytes(im):
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=False)
    return buf.getvalue()


def small_variant(px):
    """The simplified NS at `px` pixels: drawn at 1024, scaled down smoothly."""
    big = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    d.rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), RADIUS, fill=RED)
    for poly in SMALL:
        d.polygon(poly, fill=WHITE)
    return big.resize((px, px), Image.LANCZOS)


def large(src, px):
    return src.resize((px, px), Image.LANCZOS)


def write(path, data):
    path = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)


def ico(entries):
    """An .ico with PNG entries, exactly these bytes (size, png)."""
    head = struct.pack("<HHH", 0, 1, len(entries))
    off = 6 + 16 * len(entries)
    dirs, blobs = b"", b""
    for px, data in entries:
        dirs += struct.pack("<BBBBHHII", px % 256, px % 256, 0, 0, 1, 32, len(data), off + len(blobs))
        blobs += data
    return head + dirs + blobs


def icns(entries):
    """An .icns with PNG entries (type, png)."""
    body = b"".join(t.encode("latin1") + struct.pack(">I", 8 + len(d)) + d for t, d in entries)
    return b"icns" + struct.pack(">I", 8 + len(body)) + body


def dots_svg(src):
    """The dotted NS as an SVG: the white dots measured on the 1024 px icon."""
    px = src.load()
    seen, dots = set(), []
    white = lambda p: p[3] > 200 and p[0] > 200 and p[1] > 200 and p[2] > 200
    for y in range(SIZE):
        for x in range(SIZE):
            if (x, y) in seen or not white(px[x, y]):
                continue
            stack, pts = [(x, y)], []
            seen.add((x, y))
            while stack:
                a, b = stack.pop()
                pts.append((a, b))
                for c, e in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= c < SIZE and 0 <= e < SIZE and (c, e) not in seen and white(px[c, e]):
                        seen.add((c, e))
                        stack.append((c, e))
            if len(pts) > 50:
                cx = sum(p[0] for p in pts) / len(pts) + 0.5
                cy = sum(p[1] for p in pts) / len(pts) + 0.5
                dots.append((cx, cy, (len(pts) / 3.14159) ** 0.5))
    circles = "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}"/>' for x, y, r in sorted(dots, key=lambda d: (round(d[0]), d[1])))
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">'
        f'<rect width="{SIZE}" height="{SIZE}" rx="{RADIUS}" fill="#CC1219"/>'
        f'<g fill="#FFFFFF">{circles}</g></svg>\n'
    )


def small_svg():
    polys = "".join('<polygon points="' + " ".join(f"{x},{y}" for x, y in p) + '"/>' for p in SMALL)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">'
        f'<rect width="{SIZE}" height="{SIZE}" rx="{RADIUS}" fill="#CC1219"/>'
        f'<g fill="#FFFFFF">{polys}</g></svg>\n'
    )


def main():
    src = Image.open(os.path.join(HERE, "ns-1024.png")).convert("RGBA")
    small = {px: png_bytes(small_variant(px)) for px in (16, 24, 30, 32)}
    big = {px: png_bytes(large(src, px)) for px in (44, 48, 50, 64, 71, 89, 107, 128, 142, 150, 256, 284, 310, 512)}
    big[1024] = open(os.path.join(HERE, "ns-1024.png"), "rb").read()
    for px, data in small.items():
        write(f"assets/icon/ns-small-{px}.png", data)
    write("assets/icon/ns-small.svg", small_svg().encode())
    t = "src-tauri/icons/"
    write(t + "32x32.png", small[32])
    write(t + "64x64.png", big[64])
    write(t + "128x128.png", big[128])
    write(t + "128x128@2x.png", big[256])
    write(t + "icon.png", big[512])
    write(t + "Square30x30Logo.png", small[30])
    for px in (44, 71, 89, 107, 142, 150, 284, 310):
        write(t + f"Square{px}x{px}Logo.png", big[px])
    write(t + "StoreLogo.png", big[50])
    write(t + "icon.ico", ico([(16, small[16]), (24, small[24]), (32, small[32]), (48, big[48]), (64, big[64]), (256, big[256])]))
    write(t + "icon.icns", icns([("icp4", small[16]), ("icp5", small[32]), ("ic11", small[32]), ("icp6", big[64]), ("ic12", big[64]),
                                 ("ic07", big[128]), ("ic08", big[256]), ("ic13", big[256]), ("ic09", big[512]), ("ic14", big[512]), ("ic10", big[1024])]))
    write("ui/public/icon.png", big[1024])
    write("ui/public/icon-small.png", small[32])
    write("ui/public/icon.svg", dots_svg(src).encode())


if __name__ == "__main__":
    main()
