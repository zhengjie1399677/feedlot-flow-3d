"""把 Poly Haven 的 1k Radiance .hdr 缩到指定宽度再写回 .hdr。

用法: python tools/hdr_min.py <输入目录|文件> <输出目录> <目标宽度>

IBL / 环境反射不需要高分辨率（PMREM 之后本来就要模糊），
1k 的天空缩到 256 宽就够，文件从 1 MB 掉到 100 KB 上下。
"""
import io
import os
import sys

import numpy as np


def read_hdr(path):
    with io.open(path, 'rb') as f:
        raw = f.read()

    if not raw.startswith(b'#?'):
        raise ValueError('not a radiance file')
    idx = raw.find(b'\n\n')
    header = raw[:idx].decode('ascii', 'replace')
    if '32-bit_rle_rgbe' not in header:
        raise ValueError('unsupported format')

    pos = idx + 2
    line_end = raw.find(b'\n', pos)
    res = raw[pos:line_end].decode('ascii').split()
    pos = line_end + 1
    # 形如 -Y 512 +X 1024
    h = int(res[1])
    w = int(res[3])

    out = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        head = raw[pos:pos + 4]
        if head[:2] == b'\x02\x02':
            # 新式 RLE：每个通道单独游程编码
            scan_w = (head[2] << 8) | head[3]
            if scan_w != w:
                raise ValueError('scanline width mismatch')
            pos += 4
            row = np.zeros((w, 4), dtype=np.uint8)
            for c in range(4):
                x = 0
                while x < w:
                    n = raw[pos]
                    pos += 1
                    if n > 128:
                        val = raw[pos]
                        pos += 1
                        row[x:x + n - 128, c] = val
                        x += n - 128
                    else:
                        row[x:x + n, c] = np.frombuffer(raw[pos:pos + n], dtype=np.uint8)
                        pos += n
                        x += n
            out[y] = row
        else:
            flat = np.frombuffer(raw[pos:pos + w * 4], dtype=np.uint8).reshape(w, 4)
            out[y] = flat
            pos += w * 4
    return out


def to_float(rgbe):
    e = rgbe[..., 3].astype(np.float32)
    scale = np.where(e > 0, np.exp2(e - 136.0), 0.0).astype(np.float32)
    return rgbe[..., :3].astype(np.float32) * scale[..., None]


def to_rgbe(rgb):
    mx = rgb.max(axis=-1)
    out = np.zeros(rgb.shape[:2] + (4,), dtype=np.uint8)
    nz = mx > 1e-6
    if not nz.any():
        return out
    m = mx[nz]
    mant, expo = np.frexp(m)
    scale = mant * 256.0 / m
    out[nz, 0] = np.clip(rgb[nz, 0] * scale, 0, 255).astype(np.uint8)
    out[nz, 1] = np.clip(rgb[nz, 1] * scale, 0, 255).astype(np.uint8)
    out[nz, 2] = np.clip(rgb[nz, 2] * scale, 0, 255).astype(np.uint8)
    out[nz, 3] = np.clip(expo + 128, 0, 255).astype(np.uint8)
    return out


def resize_box(img, w):
    h = img.shape[0]
    nw = w
    nh = max(1, int(round(h * nw / img.shape[1])))
    ys = np.linspace(0, h, nh + 1).astype(int)
    xs = np.linspace(0, img.shape[1], nw + 1).astype(int)
    chan = img.shape[2]
    out = np.zeros((nh, nw, chan), dtype=np.float64)
    for j in range(nh):
        band = img[ys[j]:max(ys[j] + 1, ys[j + 1])].astype(np.float64)
        for i in range(nw):
            blk = band[:, xs[i]:max(xs[i] + 1, xs[i + 1])]
            out[j, i] = blk.reshape(-1, chan).mean(axis=0)
    return out.astype(np.float32)


def write_hdr(path, rgbe):
    h, w = rgbe.shape[:2]
    head = ('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y %d +X %d\n' % (h, w)).encode('ascii')
    with io.open(path, 'wb') as f:
        f.write(head)
        f.write(rgbe.astype(np.uint8).tobytes())


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        return 1
    src, dst, width = sys.argv[1], sys.argv[2], int(sys.argv[3])
    os.makedirs(dst, exist_ok=True)
    files = []
    if os.path.isdir(src):
        files = [os.path.join(src, n) for n in sorted(os.listdir(src)) if n.lower().endswith('.hdr')]
    else:
        files = [src]
    for p in files:
        rgbe = read_hdr(p)
        lin = to_float(rgbe)
        small = resize_box(lin, width)
        out = to_rgbe(small)
        name = os.path.basename(p).replace('_1k', '')
        target = os.path.join(dst, name)
        write_hdr(target, out)
        print('%-46s %dx%d -> %dx%d  %.0f KB' % (
            name, rgbe.shape[1], rgbe.shape[0], out.shape[1], out.shape[0],
            os.path.getsize(target) / 1024))
    return 0


if __name__ == '__main__':
    sys.exit(main())
