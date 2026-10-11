import sys, os, pypdfium2 as pdfium
ise1, ise2, base = sys.argv[1], sys.argv[2], sys.argv[3]
# (source, 1-based pages, output relative path)
jobs = [
    (ise1, [1],    "pps/pps-ise1.pdf"),
    (ise1, [2,3],  "chem/chem-ise1.pdf"),
    (ise1, [4,5],  "maths/maths-ise1.pdf"),
    (ise1, [6,7],  "em/em-ise1.pdf"),
    (ise1, [8],    "iks/iks-ise1.pdf"),
    (ise2, [1],    "iks/iks-ise2.pdf"),
    (ise2, [2],    "pps/pps-ise2.pdf"),
    (ise2, [3,4],  "maths/maths-ise2.pdf"),
    (ise2, [5,6],  "chem/chem-ise2.pdf"),
    (ise2, [7,8],  "em/em-ise2.pdf"),
]
srcs = {}
for src, pages, rel in jobs:
    if src not in srcs:
        srcs[src] = pdfium.PdfDocument(src)
    s = srcs[src]
    dst = pdfium.PdfDocument.new()
    dst.import_pages(s, [p-1 for p in pages])
    out = os.path.join(base, rel)
    dst.save(out)
    dst.close()
    chk = pdfium.PdfDocument(out)
    print(f"{rel:28s} pages={len(chk):2d}  bytes={os.path.getsize(out)}")
    chk.close()
