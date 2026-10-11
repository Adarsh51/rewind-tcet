import sys
from PIL import Image
out = sys.argv[1]
imgs = []
for p in sys.argv[2:]:
    im = Image.open(p).convert("RGB")
    if im.width > 1300:
        im = im.resize((1300, int(im.height*1300/im.width)))
    imgs.append(im)
imgs[0].save(out, "PDF", save_all=True, append_images=imgs[1:], resolution=150.0)
import os; print(os.path.basename(out), len(imgs), "pg", os.path.getsize(out)//1024, "KB")
