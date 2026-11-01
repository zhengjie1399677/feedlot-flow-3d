"""把 ambientCG 的 1K-JPG 材质包整理成 public/tex/<name>/ 下的四张图。

用法: python tools/tex_prep.py <zip 目录> <输出目录> <边长>

输出: color.jpg / normal.jpg / rough.jpg / ao.jpg / metal.jpg（有才输出）
法线图不做色彩管理，JPEG 质量给高一点，避免压缩出条纹。
"""
import io
import os
import sys
import zipfile

from PIL import Image

MAPS = [
    ('_Color.jpg', 'color.jpg', 'RGB', 86),
    ('_NormalGL.jpg', 'normal.jpg', 'RGB', 92),
    ('_Roughness.jpg', 'rough.jpg', 'L', 82),
    ('_AmbientOcclusion.jpg', 'ao.jpg', 'L', 82),
    ('_Metalness.jpg', 'metal.jpg', 'L', 82),
]


def shrink(img, size, mode):
    if img.mode != mode:
        img = img.convert(mode)
    if img.size != (size, size):
        img = img.resize((size, size), Image.LANCZOS)
    return img


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        return 1
    src, dst, size = sys.argv[1], sys.argv[2], int(sys.argv[3])
    os.makedirs(dst, exist_ok=True)

    for name in sorted(os.listdir(src)):
        if not name.lower().endswith('.zip'):
            continue
        asset = name.split('_')[0]
        outdir = os.path.join(dst, asset)
        os.makedirs(outdir, exist_ok=True)
        with zipfile.ZipFile(os.path.join(src, name)) as z:
            entries = {os.path.basename(n): n for n in z.namelist()}
            for suffix, outname, mode, quality in MAPS:
                hit = [n for n in entries if n.endswith(suffix)]
                if not hit:
                    continue
                with z.open(entries[hit[0]]) as f:
                    img = Image.open(io.BytesIO(f.read()))
                    img.load()
                img = shrink(img, size, mode)
                path = os.path.join(outdir, outname)
                img.save(path, 'JPEG', quality=quality, optimize=True)
                print('  %-24s -> %-46s %5.0f KB' % (hit[0], os.path.relpath(path, dst),
                                                     os.path.getsize(path) / 1024))
        print(asset, 'ok')
    return 0


if __name__ == '__main__':
    sys.exit(main())
