"""Cut the character sheet into one transparent PNG per pose.

Usage: python3 scripts/slice-sheet.py assets/characters/sheet-boy-source.jpg assets/characters/sheet-boy
Box coordinates are for the 682x1024 sheet; they are scaled if the sheet is larger.
"""
import importlib.util
import os
import sys
import tempfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('cutout', os.path.join(HERE, 'cutout-character.py'))
cutout = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cutout)

SHEET = (682, 1024)
# Light props (the white seat) that the enclosed-background pass would erase.
KEEP_ENCLOSED = {'sit'}
PANELS = {
    'hero': (2, 2, 280, 710),
    'front': (287, 2, 413, 298),
    'side-left': (417, 2, 538, 298),
    'back': (542, 2, 680, 298),
    'face': (287, 307, 413, 473),
    'wink': (417, 307, 546, 473),
    'laugh': (550, 307, 680, 473),
    'thumbs': (252, 480, 403, 703),
    'wave': (407, 480, 548, 703),
    'tablet': (552, 480, 680, 703),
    'walk': (2, 714, 183, 1000),
    'sit': (187, 714, 358, 1000),
    'laptop': (362, 714, 553, 1000),
    'side-right': (557, 714, 680, 1000),
}


def main(src, out_dir):
    sheet = Image.open(src).convert('RGB')
    sx = sheet.width / SHEET[0]
    sy = sheet.height / SHEET[1]
    os.makedirs(out_dir, exist_ok=True)
    sizes = {}
    for name, (l, t, r, b) in PANELS.items():
        crop = sheet.crop((round(l * sx), round(t * sy), round(r * sx), round(b * sy)))
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            crop.save(tmp.name)
            dst = os.path.join(out_dir, f'{name}.png')
            cutout.main(tmp.name, dst, enclosed=name not in KEEP_ENCLOSED)
        os.unlink(tmp.name)
        sizes[name] = Image.open(dst).size
    print(sizes)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
