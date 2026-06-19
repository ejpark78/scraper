import fitz, os

pdfs = sorted(os.listdir('data'))
results = {}
for p in pdfs:
    if not p.endswith('.pdf'):
        continue
    doc = fitz.open(f'data/{p}')
    pages = doc.page_count
    toc = doc.get_toc()
    chapters = [(e[1], e[2]) for e in toc if e[0] == 1]
    results[p] = {'pages': pages, 'chapters': chapters[:20], 'total_chapters': len(chapters)}
    doc.close()

for name, info in results.items():
    print(f"=== {name} ({info['pages']}p, {info['total_chapters']} chapters) ===")
    for title, page in info['chapters']:
        print(f"  {title} (p.{page})")
    print()
