import sys, os
from PIL import Image
srcdir, outpdf = sys.argv[1], sys.argv[2]
pages = [int(x) for x in sys.argv[3].split(",")]
imgs = []
for n in pages:
    im = Image.open(os.path.join(srcdir, f"p{n:02d}.png")).convert("L")
    if im.width > 1100:
        im = im.resize((1100, int(im.height*1100/im.width)))
    imgs.append(im)
os.makedirs(os.path.dirname(outpdf), exist_ok=True)
imgs[0].save(outpdf, "PDF", save_all=True, append_images=imgs[1:], resolution=150.0)
print(f"{outpdf}  {len(pages)}p  {os.path.getsize(outpdf)//1024}KB")
