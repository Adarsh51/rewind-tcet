import sys, pdfplumber
path = sys.argv[1]
with pdfplumber.open(path) as pdf:
    print("PAGES:", len(pdf.pages))
    for i, pg in enumerate(pdf.pages):
        t = (pg.extract_text() or "").strip().replace("\n", " | ")
        print(f"--- p{i+1} ---")
        print(t[:260])
