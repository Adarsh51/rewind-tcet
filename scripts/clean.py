import sys, os, glob
import numpy as np
from PIL import Image, ImageFilter
def clean_page(path):
    im = Image.open(path).convert("RGB")
    arr = np.asarray(im).astype(np.float32)
    R, G, B = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    # red-ink mask (teacher/pen marks) -> treat as background
    red = (R - np.maximum(G, B)) > 55
    g = im.convert("L")
    # illumination / background estimate via big blur, then divide (flatten paper to white)
    bg = g.filter(ImageFilter.GaussianBlur(21))
    a = np.asarray(g).astype(np.float32)
    b = np.asarray(bg).astype(np.float32) + 1.0
    norm = np.clip(a / b * 255.0, 0, 255)
    # gentle contrast curve: lift near-white to white, deepen dark text
    norm = np.where(norm > 196, 255.0, norm)
    norm = np.clip((norm - 40) * (255.0 / (235 - 40)), 0, 255)
    norm[red] = 255.0
    return Image.fromarray(norm.astype(np.uint8))
src = sys.argv[1]
out = sys.argv[2]
os.makedirs(out, exist_ok=True)
for p in sorted(glob.glob(os.path.join(src, "p*.png"))):
    clean_page(p).save(os.path.join(out, os.path.basename(p)))
    print("cleaned", os.path.basename(p))
