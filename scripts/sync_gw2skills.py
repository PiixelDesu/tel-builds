#!/usr/bin/env python3
import json,re,time,urllib.request,urllib.parse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BUILDS=ROOT/'data'/'builds.json'; OUT=ROOT/'data'/'gw2-build-codes.json'
CHAT=re.compile(r'\[&D[A-Za-z0-9+/=_-]+\]')

def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':'TEL-Builds/1.0 (+GitHub Pages build synchronizer)','Accept-Language':'en-US,en;q=0.9'})
    with urllib.request.urlopen(req,timeout=25) as r:
        return r.read().decode('utf-8','replace')

def extract(html):
    # The preload payload may JSON/HTML escape the chat code; normalize common forms first.
    text=(html.replace('\\u0026','&').replace('&amp;','&').replace('\\/','/'))
    m=CHAT.search(text)
    return m.group(0) if m else None

def main():
    builds=json.loads(BUILDS.read_text(encoding='utf-8'))
    try: old=json.loads(OUT.read_text(encoding='utf-8'))
    except Exception: old={}
    result={}; failures=[]
    for b in builds:
        bid=b.get('id'); url=b.get('gw2skills','')
        if not bid or 'gw2skills.' not in url: continue
        try:
            code=extract(fetch(url))
            if not code: raise RuntimeError('official build chat code not found in GW2Skills preload')
            result[bid]={'chat_code':code,'source':url}
            print(f'OK {bid}')
        except Exception as e:
            if bid in old and old[bid].get('chat_code'):
                result[bid]=old[bid]; print(f'KEEP {bid}: {e}')
            else:
                failures.append(f'{bid}: {e}'); print(f'WARN {bid}: {e}')
        time.sleep(.2)
    OUT.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    if failures:
        print('\nSome builds could not be synced; their pages will show a graceful fallback:')
        for x in failures: print(' -',x)
if __name__=='__main__': main()
