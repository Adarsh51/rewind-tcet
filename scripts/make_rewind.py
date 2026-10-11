from PIL import Image
from collections import deque
im = Image.open("assets/rewind-src.png").convert("RGBA")
w, h = im.size
px = im.load()
def light(p):
    r,g,b,a = p
    return a>0 and min(r,g,b) >= 180 and (max(r,g,b)-min(r,g,b)) <= 32
# 1) connected flood from borders
seen = bytearray(w*h)
dq = deque()
for x in range(w): dq.append((x,0)); dq.append((x,h-1))
for y in range(h): dq.append((0,y)); dq.append((w-1,y))
while dq:
    x,y = dq.popleft()
    if x<0 or y<0 or x>=w or y>=h or seen[y*w+x]: continue
    seen[y*w+x]=1
    p = px[x,y]
    if not light(p): continue
    px[x,y]=(p[0],p[1],p[2],0)
    dq.extend([(x+1,y),(x-1,y),(x,y+1),(x,y-1)])
# 2) global pass: kill any leftover grayish-white (letter counters, stray slivers); keeps blue/dark
for y in range(h):
    for x in range(w):
        p = px[x,y]
        if light(p): px[x,y]=(p[0],p[1],p[2],0)
im = im.crop(im.getbbox())
im.save("assets/rewind-logo.png"); print("logo", im.size)
w2,h2 = im.size
icon = im.crop((0,0,int(w2*0.30),h2)); icon = icon.crop(icon.getbbox())
s = max(icon.size)+16
sq = Image.new("RGBA",(s,s),(0,0,0,0)); sq.paste(icon,((s-icon.width)//2,(s-icon.height)//2),icon)
sq.save("assets/rewind-icon.png"); print("favicon", sq.size)
b=Image.new("RGBA",im.size,(12,15,26,255)); b.alpha_composite(im); b.convert("RGB").save("work/rewind_dark.png")
