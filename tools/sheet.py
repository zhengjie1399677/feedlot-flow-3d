"""把 shots.sh 出的 3×3 对照图拼成一张联络表（tools/base/sheet.png）。

用法: python tools/sheet.py <图目录> "<视角1 视角2 视角3>" "<时刻1 时刻2 时刻3>"
"""
import os
import sys

from PIL import Image, ImageDraw

out = sys.argv[1]
views = sys.argv[2].split()
hours = sys.argv[3].split()

cells = [(v, h) for v in views for h in hours]
imgs = []
for v, h in cells:
    p = os.path.join(out, "%s_%s.png" % (v, h))
    imgs.append(Image.open(p).convert("RGB"))

tw, th = imgs[0].size
cols, rows = len(hours), len(views)
pad, lab = 8, 20
sheet = Image.new(
    "RGB",
    (cols * tw + pad * (cols + 1), rows * (th + lab) + pad * (rows + 1)),
    (16, 17, 19),
)
d = ImageDraw.Draw(sheet)
for i, (v, h) in enumerate(cells):
    r, c = divmod(i, cols)
    x = pad + c * (tw + pad)
    y = pad + r * (th + lab + pad)
    sheet.paste(imgs[i], (x, y + lab))
    d.text((x + 2, y + 4), "%s / hour=%s" % (v, h), fill=(190, 195, 200))

dst = os.path.join(out, "sheet.png")
sheet.save(dst)
print("sheet.png", sheet.size, "->", dst)
