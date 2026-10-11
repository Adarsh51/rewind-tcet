import sys, os, pypdfium2 as pdfium
src, outdir, dpi = sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv)>3 else 120
os.makedirs(outdir, exist_ok=True)
pdf = pdfium.PdfDocument(src)
scale = dpi/72.0
for i in range(len(pdf)):
    img = pdf[i].render(scale=scale).to_pil()
    img.save(os.path.join(outdir, f"p{i+1:02d}.png"))
    print("wrote", f"p{i+1:02d}.png", img.size)
