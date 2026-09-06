"""Create an editable local copy; keep recovered originals and prices unchanged."""
import json,re,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=root/'site'
if source.exists(): raise SystemExit('Refusing to overwrite maintained site')
shutil.copytree(root/'recovered',source)
s=(source/'index.html').read_text()
# Analytics are not required to reconstruct the checkout; do not emit production events.
s=re.sub(r'<script\b[^>]*>[\s\S]*?</script>',lambda m: '' if any(x in m[0] for x in ['googletagmanager.com','gtag(', 'connect.facebook.net']) else m[0],s)
s=re.sub(r'<noscript>[\s\S]*?</noscript>','',s)
s=re.sub(r'<link\b[^>]*rel="preconnect"[^>]*>','',s)
for a in json.loads((root/'evidence/assets.json').read_text()):
    if 'error' not in a: s=s.replace(a['url'],a['path'].removeprefix('recovered/'))
s=s.replace('https://${s3_bucket_name}.s3.${aws_region}.amazonaws.com/${imageName}.jpg','assets/menus/${imageName}.jpg')
s=s.replace('https://${s3_bucket_name}.s3.${aws_region}.amazonaws.com/${fallbackImageName}.jpg','assets/menus/${fallbackImageName}.jpg')
(source/'js').mkdir()
inline=[]
def extract(m):
    if re.search(r'\bsrc=',m[1]): return m[0]
    code=m[2]
    name='checkout.js' if '// --- CONSTANTS ---' in code else 'nutrition-fallback.js'
    (source/'js'/name).write_text(code.strip()+'\n')
    inline.append(name)
    return '<script src="js/'+name+'"></script>'
s=re.sub(r'<script\b([^>]*)>([\s\S]*?)</script>',extract,s)
(source/'index.html').write_text(s)
manifest=json.loads((source/'manifest.json').read_text())
for i in manifest['icons']: i['src']='assets/LOGO+BG.png'
(source/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
css=(source/'vendor/fonts.css').read_text()
css=re.sub(r'https://fonts.gstatic.com/[^)]+',lambda m:'fonts/'+m[0].rsplit('/',1)[1],css)
(source/'vendor/fonts.css').write_text(css)
print('Prepared maintained site:',inline)
