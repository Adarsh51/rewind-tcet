import sys, os, glob
from PIL import Image, ImageDraw
d = sys.argv[1]
W = 760
frac = float(sys.argv[2]) if len(sys.argv) > 2 else 0.30
pages = sorted(glob.glob(os.path.join(d, "p*.png")))
strips = []
for p in pages:
    im = Image.open(p).convert("RGB")
    w, h = im.size
    crop = im.crop((0, 0, w, int(h*frac)))
    nw = W; nh = int(crop.height * (W/crop.width))
    crop = crop.resize((nw, nh))
    label = Image.new("RGB", (nw, nh+26), (20,20,30))
    dr = ImageDraw.Draw(label)
    dr.text((8,6), os.path.basename(p), fill=(255,220,80))
    label.paste(crop, (0,26))
    strips.append(label)
tot = sum(s.height for s in strips)
sheet = Image.new("RGB", (W, tot), (255,255,255))
y = 0
for s in strips:
    sheet.paste(s, (0,y)); y += s.height
out = os.path.join("work", os.path.basename(d.rstrip("/\\")) + "_sheet.png")
sheet.save(out)
print(out, sheet.size)
