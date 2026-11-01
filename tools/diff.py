"""比对两组对照图（tools/shots.sh 的输出），量化"迁移前后画面差多少"。

用法: python tools/diff.py <旧目录> <新目录> [差异图输出目录] [存图阈值%]

打印每个机位的平均绝对误差 / 明显差异像素占比；给了输出目录时，把差异最大的
几对存成「左旧 | 右新 | 差异放大」三联图，方便肉眼定位。
"""
import os
import sys

from PIL import Image, ImageChops

THRESH = 8  # 单通道差值超过它算"肉眼可见"


def compare(a_path, b_path):
    a = Image.open(a_path).convert("RGB")
    b = Image.open(b_path).convert("RGB")
    if a.size != b.size:
        return None
    d = ImageChops.difference(a, b)
    px = d.getdata()
    total = len(px)
    acc = 0
    visible = 0
    for r, g, b_ in px:
        m = max(r, g, b_)
        acc += r + g + b_
        if m > THRESH:
            visible += 1
    return a, b, d, acc / (total * 3.0), visible * 100.0 / total


def main():
    da, db = sys.argv[1], sys.argv[2]
    out = sys.argv[3] if len(sys.argv) > 3 else None
    save_pct = float(sys.argv[4]) if len(sys.argv) > 4 else 0.5
    if out:
        os.makedirs(out, exist_ok=True)

    names = sorted(
        f for f in os.listdir(da) if f.endswith(".png") and f != "sheet.png"
    )
    rows = []
    for n in names:
        pb = os.path.join(db, n)
        if not os.path.exists(pb):
            rows.append((n, None, None))
            continue
        res = compare(os.path.join(da, n), pb)
        if res is None:
            rows.append((n, "SIZE", None))
            continue
        a, b, d, mean, pct = res
        rows.append((n, mean, pct))
        if out and pct > save_pct:
            amp = d.point(lambda v: min(255, v * 6))
            w, h = a.size
            strip = Image.new("RGB", (w * 3 + 16, h), (20, 20, 22))
            strip.paste(a, (0, 0))
            strip.paste(b, (w + 8, 0))
            strip.paste(amp, (w * 2 + 16, 0))
            strip.save(os.path.join(out, n.replace(".png", "_diff.png")))

    print("%-18s %10s %10s" % ("image", "meanDiff", "visible%"))
    for n, mean, pct in rows:
        if mean is None:
            print("%-18s %10s %10s" % (n, "-", "missing"))
        elif mean == "SIZE":
            print("%-18s %10s %10s" % (n, "-", "size mismatch"))
        else:
            flag = "" if pct < 0.5 else ("  <-- 有差异" if pct < 2 else "  <-- 差异明显")
            print("%-18s %10.3f %9.2f%%%s" % (n, mean, pct, flag))


if __name__ == "__main__":
    main()
