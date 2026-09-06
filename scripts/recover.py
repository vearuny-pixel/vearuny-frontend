"""Fetch only explicitly referenced public static assets. Never deploy or submit orders."""
import hashlib,json,sys,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
manifest_path=ROOT/'evidence/assets.json'
records=json.loads(manifest_path.read_text()) if manifest_path.exists() else []

def fetch(url,path):
    target=ROOT/'recovered'/path
    target.parent.mkdir(parents=True,exist_ok=True)
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 Vearuny-public-asset-recovery'})
    try:
        with urllib.request.urlopen(req,timeout=30) as r:
            data=r.read(20*1024*1024+1)
            if len(data)>20*1024*1024: raise ValueError('asset exceeds limit')
            if r.headers.get_content_type()=='text/html' and not path.endswith('.html'): raise ValueError('HTML fallback instead of asset')
            target.write_bytes(data)
            record={'url':url,'path':'recovered/'+path,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'content_type':r.headers.get_content_type()}
    except Exception as e: record={'url':url,'path':'recovered/'+path,'error':str(e)}
    records[:]=[x for x in records if x['url']!=url]
    records.append(record)
    manifest_path.write_text(json.dumps(records,indent=2)+'\n')
    print(path,record.get('bytes',record.get('error')))

if __name__=='__main__':
    for url,path in json.loads(Path(sys.argv[1]).read_text()): fetch(url,path)
