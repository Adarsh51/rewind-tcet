import sys
from PIL import Image
from collections import deque
im = Image.open("assets/tcet-logo.png").convert("RGBA")
w, h = im.size
px = im.load()
TH = 232
def light(p): return p[0] >= TH and p[1] >= TH and p[2] >= TH
seen = [[False]*w for _ in range(h)]
dq = deque()
for x in range(w):
    for y in (0, h-1):
        dq.append((x, y))
for y in range(h):
    for x in (0, w-1):
        dq.append((x, y))
while dq:
    x, y = dq.popleft()
    if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
        continue
    seen[y][x] = True
    p = px[x, y]
    if not light(p):
        continue
    px[x, y] = (p[0], p[1], p[2], 0)
    dq.extend([(x+1,y),(x-1,y),(x,y+1),(x,y-1)])
# trim to content bbox
bbox = im.getbbox()
im = im.crop(bbox)
im.save("assets/tcet-logo.png")
print("transparent logo", im.size)
# dark-bg preview
bg = Image.new("RGBA", im.size, (12,15,26,255))
bg.alpha_composite(im)
bg.convert("RGB").save("work/logo_on_dark.png")
print("preview saved")
