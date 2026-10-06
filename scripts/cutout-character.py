"""Turn a character photo on a plain studio background into a transparent PNG.

Usage: python3 scripts/cutout-character.py input.jpg assets/characters/hoodie-boy.png
"""
import sys
from collections import deque

from PIL import Image, ImageFilter

TOLERANCE = 20
ENCLOSED_TOLERANCE = 16
SHADOW_RANGE = 60
EDGE = 12
TARGET_HEIGHT = 640


def edge_model(px, width, height):
    model = []
    for y in range(height):
        left = [px[x, y] for x in range(EDGE)]
        right = [px[width - 1 - x, y] for x in range(EDGE)]
        avg = lambda items: tuple(sum(c[i] for c in items) / len(items) for i in range(3))
        model.append((avg(left), avg(right)))
    return model


def background_at(model, x, y, width):
    left, right = model[y]
    t = x / max(1, width - 1)
    return tuple(left[i] * (1 - t) + right[i] * t for i in range(3))


def keep_largest(alpha, width, height):
    ap = alpha.load()
    label = [0] * (width * height)
    sizes = {}
    current = 0
    for sy in range(height):
        for sx in range(width):
            if ap[sx, sy] != 255 or label[sy * width + sx]:
                continue
            current += 1
            count = 0
            stack = [(sx, sy)]
            label[sy * width + sx] = current
            while stack:
                x, y = stack.pop()
                count += 1
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < width and 0 <= ny < height:
                        i = ny * width + nx
                        if not label[i] and ap[nx, ny] == 255:
                            label[i] = current
                            stack.append((nx, ny))
            sizes[current] = count
    if not sizes:
        return
    best = max(sizes, key=sizes.get)
    for y in range(height):
        for x in range(width):
            if ap[x, y] == 255 and label[y * width + x] != best:
                ap[x, y] = 0


def main(src, dst, enclosed=True):
    image = Image.open(src).convert('RGB')
    width, height = image.size
    px = image.load()
    model = edge_model(px, width, height)

    def dist(x, y):
        bg = background_at(model, x, y, width)
        c = px[x, y]
        return max(abs(c[i] - bg[i]) for i in range(3)), sum(c) / 3 - sum(bg) / 3, max(c) - min(c)

    alpha = Image.new('L', (width, height), 255)
    ap = alpha.load()
    seen = bytearray(width * height)
    queue = deque()
    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    def bright(c):
        return sum(c) / 3

    def grayish(c):
        return max(c) - min(c) < 18 and bright(c) > 120

    while queue:
        x, y = queue.popleft()
        idx = y * width + x
        if seen[idx]:
            continue
        seen[idx] = 1
        c = px[x, y]
        if not grayish(c):
            continue
        d, darker, _ = dist(x, y)
        if y > height * 0.84 and darker < -TOLERANCE:
            ap[x, y] = int(min(150, (-darker / SHADOW_RANGE) * 170))
        else:
            ap[x, y] = 0
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height and not seen[ny * width + nx]:
                n = px[nx, ny]
                if abs(bright(n) - bright(c)) < 7:
                    queue.append((nx, ny))

    shadow = Image.new('L', (width, height), 0)
    sp = shadow.load()
    for y in range(height):
        for x in range(width):
            if 0 < ap[x, y] < 255:
                sp[x, y] = ap[x, y]
                ap[x, y] = 0
    for y in range(height if enclosed else 0):
        for x in range(width):
            if ap[x, y] == 255 and grayish(px[x, y]) and dist(x, y)[0] <= ENCLOSED_TOLERANCE:
                ap[x, y] = 0

    floor_start = int(height * 0.78)
    for x in range(width):
        last_dark = -999
        for y in range(floor_start - 40, height):
            c = px[x, y]
            if ap[x, y] == 255 and bright(c) < 90:
                last_dark = y
            if y < floor_start or ap[x, y] != 255:
                continue
            if max(c) - min(c) < 22 and bright(c) > 150 and y - last_dark > 30:
                ap[x, y] = 0
    keep_largest(alpha, width, height)
    body = alpha.point(lambda v: 255 if v == 255 else 0).getbbox()
    if body:
        left, top, right, bottom = body
        for y in range(height):
            for x in range(width):
                if sp[x, y] and (x < left or x > right or y > bottom + 24):
                    sp[x, y] = 0
    solid = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))

    out = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    op = out.load()
    so = solid.load()
    for y in range(height):
        for x in range(width):
            a = so[x, y]
            if a > 0:
                r, g, b = px[x, y]
                op[x, y] = (r, g, b, a)
            elif sp[x, y]:
                op[x, y] = (20, 24, 32, sp[x, y])

    box = out.getbbox()
    out = out.crop(box)
    scale = TARGET_HEIGHT / out.height
    if scale < 1:
        out = out.resize((round(out.width * scale), TARGET_HEIGHT), Image.LANCZOS)
    out.save(dst)
    print('saved', dst, out.size)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
