"""Precisely crop phone UI from four verified original DVIR product screenshots.

The same textile pixels remain untouched except for recoding WebP. Idempotent:
already repaired (correct-dimension) files are skipped.
"""
from pathlib import Path
from PIL import Image

CROPS = {
    "assets/pillows/p174.webp": (0, 240, 323, 480),
    "assets/pillows/p175.webp": (0, 190, 323, 520),
    "assets/curtains/c026.webp": (0, 28, 288, 550),
    "assets/curtains/c048.webp": (0, 90, 294, 586),
}

def main():
    for filename, bounds in CROPS.items():
        path = Path(filename)
        if not path.is_file():
            raise FileNotFoundError(f"Missing original photo: {path}")
        with Image.open(path) as photo:
            expected = (bounds[2] - bounds[0], bounds[3] - bounds[1])
            if photo.size == expected:
                print(f"Already repaired: {path}: {photo.size}")
                continue
            if photo.width < bounds[2] or photo.height < bounds[3]:
                raise ValueError(f"Unexpected original photo dimensions: {path} {photo.size}")
            cropped = photo.convert("RGB").crop(bounds)
            cropped.save(path, "WEBP", quality=92, method=6)
            with Image.open(path) as checked:
                assert checked.size == expected
            print(f"Repaired: {path}: {photo.size} -> {expected}")

if __name__ == "__main__":
    main()
