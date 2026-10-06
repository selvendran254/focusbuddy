"""Split the right arm off a photo character so it can be animated.

Usage:
  python3 scripts/split-arm.py assets/characters/hoodie-boy.png hoodie
  python3 scripts/split-arm.py assets/characters/sheet-boy/front.png sheet-front
Writes <name>-body.png and <name>-arm.png next to the input, same canvas size,
so they stack exactly. The clip-path for each preset in
src/character3d-photo.css mirrors its SHOULDER; update both together.
"""
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

PRESETS = {
    'hoodie': {
        'size': (282, 640),
        'arm': [
            (227, 262), (262, 262), (271, 298), (279, 340), (280, 395),
            (271, 437), (220, 439), (219, 398), (216, 352), (215, 334), (225, 300),
        ],
        'shoulder': (222, 238, 266, 288),
    },
    'sheet-front': {
        'size': (107, 279),
        'arm': [
            (80, 84), (92, 82), (99, 96), (102, 130), (102, 152),
            (98, 181), (80, 181), (79, 152), (79, 120), (78, 100),
        ],
        'shoulder': (77, 72, 99, 92),
    },
}


def main(src, preset_name):
    preset = PRESETS[preset_name]
    image = Image.open(src).convert('RGBA')
    sx = image.width / preset['size'][0]
    sy = image.height / preset['size'][1]
    scale = lambda box: tuple(v * (sx if i % 2 == 0 else sy) for i, v in enumerate(box))

    arm_shape = Image.new('L', image.size, 0)
    ImageDraw.Draw(arm_shape).polygon([(x * sx, y * sy) for x, y in preset['arm']], fill=255)
    arm_shape = arm_shape.filter(ImageFilter.GaussianBlur(0.7))

    cap = Image.new('L', image.size, 0)
    ImageDraw.Draw(cap).ellipse(scale(preset['shoulder']), fill=255)
    cap = cap.filter(ImageFilter.GaussianBlur(1.2))

    alpha = image.getchannel('A')
    removed = ImageChops.multiply(arm_shape, ImageChops.invert(cap))

    arm = image.copy()
    arm.putalpha(ImageChops.multiply(alpha, arm_shape))
    body = image.copy()
    body.putalpha(ImageChops.multiply(alpha, ImageChops.invert(removed)))

    base, _ = os.path.splitext(src)
    body.save(f'{base}-body.png')
    arm.save(f'{base}-arm.png')
    print('saved body and arm for', src)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'hoodie')
