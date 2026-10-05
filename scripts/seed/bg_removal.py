"""Background-removal sample for catalog seeding (no uploads, no database).

Reads scripts/seed/bg-sample.json: Open Food Facts products picked by a
fixed rule (the first 12 South African products by barcode that have a
front image), not by hand. For each one it downloads OFF's full-resolution
front image, removes the background with rembg's isnet-general-use model,
runs the quality checks agreed for the seeding pipeline, and writes:

  out/NN-before.jpg   the OFF image as downloaded
  out/NN-after.webp   the isolated can, cropped and padded, transparent
  out/report.json     every check's value and verdict, timing, peak memory

A result that fails any check is reported as "fallback to original": the
seed run would keep OFF's own image for that can instead of shipping a
mangled one. Nothing here writes anywhere but out/.

Runs in CI (.github/workflows/bg-removal-sample.yml); the model needs more
memory than a typical dev laptop has free.

  python scripts/seed/bg_removal.py [out_dir]
"""
import io
import json
import sys
import threading
import time
import urllib.request
from pathlib import Path

import numpy as np
import psutil
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / 'out'
UA = 'Sippd/0.1 (meijermarijke444@gmail.com)'
MODEL = 'isnet-general-use'

# Thresholds agreed in the seeding brief.
MIN_SOURCE_SHORT = 400        # before: the whole photo's short side
MIN_CAN_SHORT = 200           # after: the can's own outline, short side
COVERAGE = (0.15, 0.85)       # mask share of the frame
MAIN_SHAPE_MIN = 0.90         # largest connected shape's share of the mask
EDGE_MARGIN = 2               # px: outline this close to the frame = touching
HALO_MAX = 0.08               # half-transparent px per solid px
ASPECT = (1.2, 3.0)           # outline height / width of a standing can
PAD = 0.08                    # padding around the can in the output

CHECKS = ['source_ok', 'coverage_ok', 'main_shape_ok', 'edge_ok', 'halo_ok', 'aspect_ok', 'can_px_ok']

proc = psutil.Process()
peak = {'rss': proc.memory_info().rss, 'stop': False}


def watch_memory():
    while not peak['stop']:
        peak['rss'] = max(peak['rss'], proc.memory_info().rss)
        time.sleep(0.05)


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def check(src, rgba):
    """Every agreed check, as values and pass/fail flags."""
    a = np.asarray(rgba)[:, :, 3]
    h, w = a.shape
    fg = a >= 128
    res = {'source': f'{src.width}x{src.height}', 'source_ok': min(src.size) >= MIN_SOURCE_SHORT}
    cov = float(fg.mean())
    res['coverage'] = round(cov, 3)
    res['coverage_ok'] = COVERAGE[0] <= cov <= COVERAGE[1]

    labels, n = ndimage.label(fg)
    if n == 0:
        res.update(main_shape=0, main_shape_ok=False, edges_touched=[], edge_ok=False,
                   halo=None, halo_ok=False, aspect=None, aspect_ok=False,
                   can_px=None, can_px_ok=False)
        return res, None

    sizes = ndimage.sum(fg, labels, range(1, n + 1))
    main = int(np.argmax(sizes)) + 1
    share = float(sizes[main - 1] / sizes.sum())
    res['main_shape'] = round(share, 3)
    res['main_shape_ok'] = share >= MAIN_SHAPE_MIN

    ys, xs = np.where(labels == main)
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    touching = [side for side, hit in (
        ('top', y0 <= EDGE_MARGIN), ('bottom', y1 >= h - 1 - EDGE_MARGIN),
        ('left', x0 <= EDGE_MARGIN), ('right', x1 >= w - 1 - EDGE_MARGIN)) if hit]
    res['edges_touched'] = touching
    res['edge_ok'] = not touching

    semi = int(((a > 15) & (a < 240)).sum())
    halo = semi / max(1, int((a >= 240).sum()))
    res['halo'] = round(halo, 3)
    res['halo_ok'] = halo <= HALO_MAX

    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    res['aspect'] = round(bh / bw, 2)
    res['aspect_ok'] = ASPECT[0] <= bh / bw <= ASPECT[1]
    res['can_px'] = f'{bw}x{bh}'
    res['can_px_ok'] = min(bw, bh) >= MIN_CAN_SHORT
    return res, (labels == main, (x0, y0, x1, y1))


def isolate(rgba, keep, box):
    """Only the main shape, cropped to it, centred on a padded square."""
    arr = np.asarray(rgba).copy()
    arr[:, :, 3] = np.where(keep, arr[:, :, 3], 0)
    x0, y0, x1, y1 = box
    can = Image.fromarray(arr).crop((x0, y0, x1 + 1, y1 + 1))
    side = int(max(can.size) * (1 + 2 * PAD))
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(can, ((side - can.width) // 2, (side - can.height) // 2), can)
    return canvas


def main():
    from rembg import new_session, remove

    OUT.mkdir(parents=True, exist_ok=True)
    threading.Thread(target=watch_memory, daemon=True).start()
    items = json.loads((HERE / 'bg-sample.json').read_text())

    t0 = time.time()
    session = new_session(MODEL)
    report = {'model': MODEL, 'model_load_s': round(time.time() - t0, 1),
              'thresholds': {'min_source_short': MIN_SOURCE_SHORT, 'min_can_short': MIN_CAN_SHORT,
                             'coverage': COVERAGE, 'main_shape_min': MAIN_SHAPE_MIN,
                             'halo_max': HALO_MAX, 'aspect': ASPECT},
              'items': []}
    print(f"model loaded in {report['model_load_s']}s, rss {peak['rss'] // 2**20} MB", flush=True)

    for i, it in enumerate(items, 1):
        row = {'n': i, **{k: it.get(k) for k in ('code', 'pool', 'name', 'brand', 'quantity')}}
        try:
            raw, row['used'] = fetch(it['full']), 'full'
        except Exception as e:  # no full copy: use the 400px one, and say so
            raw, row['used'] = fetch(it['src400']), f'400px (full failed: {e})'
        src = Image.open(io.BytesIO(raw)).convert('RGB')
        src.save(OUT / f'{i:02d}-before.jpg', quality=88)

        t = time.time()
        rgba = remove(src, session=session)
        row['seconds'] = round(time.time() - t, 1)
        res, main_shape = check(src, rgba)
        row.update(res)
        row['failed'] = [c[:-3] for c in CHECKS if not row.get(c)]
        row['verdict'] = 'pass' if not row['failed'] else 'fallback to original'
        (isolate(rgba, *main_shape) if main_shape else rgba).save(OUT / f'{i:02d}-after.webp', quality=85)
        report['items'].append(row)
        print(f"{i:2d} {row['verdict']:<21} {','.join(row['failed']) or '-':<36} "
              f"{row['seconds']}s rss {peak['rss'] // 2**20} MB  {row['brand']} | {row['name']}", flush=True)
        time.sleep(1.5)  # gentle on OFF's image server

    peak['stop'] = True
    report['peak_rss_mb'] = peak['rss'] // 2**20
    report['total_s'] = round(time.time() - t0, 1)
    passed = sum(r['verdict'] == 'pass' for r in report['items'])
    report['summary'] = f"{passed}/{len(items)} passed, {len(items) - passed} fall back to the original"
    (OUT / 'report.json').write_text(json.dumps(report, indent=1))
    print(report['summary'], f"| peak rss {report['peak_rss_mb']} MB | total {report['total_s']}s")


if __name__ == '__main__':
    main()
