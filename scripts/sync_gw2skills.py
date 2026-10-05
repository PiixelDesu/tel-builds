#!/usr/bin/env python3
"""Sync GW2Skills quicklinks into TEL's native build + equipment data."""
import base64, html, json, re, subprocess, time, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BUILDS=ROOT/'data'/'builds.json'
OUT=ROOT/'data'/'gw2-build-codes.json'
UA='TEL-Builds/3.0 (+https://github.com/PiixelDesu/tel-builds)'
B64=re.compile(r'(?<![A-Za-z0-9+/_-])([A-Za-z0-9+/_-]{36,}={0,2})(?![A-Za-z0-9+/_-])')
BRACKETED=re.compile(r'\[\s*&\s*([A-Za-z0-9+/_=-]{20,})\s*\]')

ARMOR={'helm':'Head','shoulders':'Shoulders','coat':'Chest','gloves':'Hands','leggings':'Legs','boots':'Feet','breather':'Breather'}
WEAPONS={'w11':'Weapon set 1 · Main hand','w12':'Weapon set 1 · Off hand','w21':'Weapon set 2 · Main hand','w22':'Weapon set 2 · Off hand','w31':'Aquatic 1','w32':'Aquatic 2'}
TRINKETS={'amulet':'Amulet','ring1':'Ring 1','ring2':'Ring 2','earring1':'Accessory 1','earring2':'Accessory 2','back':'Back'}

def normalize_url(url):
    p=urllib.parse.urlsplit(url)
    if 'gw2skills.net' not in p.netloc.lower(): raise ValueError('not a gw2skills.net URL')
    return urllib.parse.urlunsplit(('https','en.gw2skills.net','/editor/',p.query,''))

def fetch_url(url, accept='text/html,application/xhtml+xml'):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Referer':'https://en.gw2skills.net/','Accept':accept,'Accept-Language':'en-US,en;q=0.9','Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=30) as r: return r.read().decode('utf-8','replace')

def fetch(url): return fetch_url(normalize_url(url))

def gw2_api(path):
    return json.loads(fetch_url('https://api.guildwars2.com/v2/'+path,'application/json'))

def resolve_official_items(names):
    """Resolve synced GW2Skills names to official GW2 item metadata/icons.
    The API has no name-search endpoint, so scan the public item catalogue in 200-item pages
    and stop once every requested name has been found. This runs only in the GitHub Action.
    """
    wanted={str(n).strip() for n in names if n and str(n).strip()}
    if not wanted:return {}
    found={}
    try:
        ids=gw2_api('items')
        for off in range(0,len(ids),200):
            batch=ids[off:off+200]
            rows=gw2_api('items?ids='+','.join(map(str,batch)))
            for item in rows:
                name=item.get('name','')
                if name in wanted and name not in found:
                    found[name]={'id':item.get('id'),'name':name,'icon':item.get('icon',''),'type':item.get('type',''),'details':item.get('details') or {}}
            if wanted.issubset(found):break
        print(f'Official GW2 items: resolved {len(found)}/{len(wanted)} names')
    except Exception as e:
        print('WARN official item icon resolution failed:',e)
    return found

def variants(text):
    seen=set(); queue=[text]
    for _ in range(4):
        nxt=[]
        for value in queue:
            if value in seen: continue
            seen.add(value); yield value
            transforms=[html.unescape(value),urllib.parse.unquote(value),value.replace('\\u0026','&').replace('\\u005b','[').replace('\\u005d',']').replace('\\/','/').replace('\\u003d','=').replace('\\u002b','+')]
            nxt.extend(x for x in transforms if x!=value)
        queue=nxt

def as_build_code(token):
    token=token.strip().replace(' ','')
    if token.startswith('&'): token=token[1:]
    token=token.replace('-','+').replace('_','/'); token += '='*((4-len(token)%4)%4)
    try: raw=base64.b64decode(token,validate=True)
    except Exception: return None
    if len(raw)<20 or raw[0]!=0x0d: return None
    return '[&'+base64.b64encode(raw).decode('ascii')+']'

def extract_code(document):
    for text in variants(document):
        for m in BRACKETED.finditer(text):
            code=as_build_code(m.group(1))
            if code:return code
        for m in B64.finditer(text):
            code=as_build_code(m.group(1))
            if code:return code
    return None

def extract_preload(document):
    dbm=re.search(r'dbid\s*:\s*(\d+)',document)
    marker='new BuildEditor('; pos=document.find(marker)
    if not dbm or pos<0: return None,None
    depth=0; start=end=-1; quote=None; esc=False
    for i in range(pos+len(marker),len(document)):
        c=document[i]
        if quote:
            if esc: esc=False
            elif c=='\\': esc=True
            elif c==quote: quote=None
            continue
        if c in "'\"`": quote=c; continue
        if c=='{':
            if depth==0:start=i
            depth+=1
        elif c=='}' and depth:
            depth-=1
            if depth==0:end=i+1;break
    if start<0 or end<0:return None,dbm.group(1)
    literal=document[start:end]
    js="""const vm=require('vm');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{try{const c=vm.runInNewContext('('+s+')',{SI:undefined},{timeout:2000});process.stdout.write(JSON.stringify(c.preload||null));}catch(e){process.stderr.write(e.message);process.exit(2)}});"""
    p=subprocess.run(['node','-e',js],input=literal,text=True,capture_output=True,timeout=8)
    if p.returncode!=0: raise RuntimeError('could not parse GW2Skills preload: '+p.stderr[:180])
    return json.loads(p.stdout),dbm.group(1)

def table_map(table):
    if not table:return ({}, {})
    desc=table.get('desc',[]); ididx=desc.index('id') if 'id' in desc else 0
    return ({row[ididx]:row for row in table.get('rows',[])}, {x:i for i,x in enumerate(desc)})

def equipment_from(preload,db):
    eq=(preload or {}).get('equipment') or {}
    profiles,pidx=table_map(db.get('profile')); ptypes,ptidx=table_map(db.get('prfltype'))
    upgrades,uidx=table_map(db.get('upgrade')); buffs,bidx=table_map(db.get('buff'))
    def stat(pid):
        row=profiles.get(pid)
        if not row:return ''
        pcol=pidx.get('profile'); pt=ptypes.get(row[pcol]) if pcol is not None else None
        return str(pt[ptidx['name']]) if pt and 'name' in ptidx else ''
    def upgrade(uid):
        if not uid:return ''
        row=upgrades.get(uid)
        if not row or 'name' not in uidx:return ''
        name=str(row[uidx['name']] or ''); typ=row[uidx['type']] if 'type' in uidx else None
        if typ==2 and name and not name.lower().startswith('superior rune'): name='Superior Rune of '+name
        elif typ==1 and name and not name.lower().startswith('superior sigil'): name='Superior Sigil of '+name
        return name
    def buff(bid):
        row=buffs.get(bid); return str(row[bidx['name']] or '') if row and 'name' in bidx else ''
    def first(x,default=None): return x[0] if isinstance(x,list) and x else default
    def piece_data(piece,kind):
        if not piece:return None
        item=piece.get('item') or []; out={'stat':stat(first(item))}
        ups=piece.get('up') or []; inf=piece.get('inf') or []
        if kind=='armor': out['rune']=upgrade(first(first(ups,[])))
        if kind=='weapon': out['sigils']=[upgrade(first(x)) for x in ups if first(x)]
        out['infusions']=[upgrade(x) for x in inf if x]
        return {k:v for k,v in out.items() if v not in ('',[],None)}
    result={'armor':[],'weapons':[],'trinkets':[]}
    for key,label in ARMOR.items():
        d=piece_data((eq.get('armor') or {}).get(key),'armor')
        if d: result['armor'].append({'slot':label,**d})
    for key,label in WEAPONS.items():
        d=piece_data((eq.get('weapon') or {}).get(key),'weapon')
        if d: result['weapons'].append({'slot':label,**d})
    for key,label in TRINKETS.items():
        d=piece_data((eq.get('trinket') or {}).get(key),'trinket')
        if d: result['trinkets'].append({'slot':label,**d})
    result['food']=buff((eq.get('buff') or {}).get('food'))
    result['utility']=buff((eq.get('buff') or {}).get('utility'))
    result['relic']=upgrade(eq.get('relic'))
    result['enrichment']=upgrade(first(first(((eq.get('trinket') or {}).get('amulet') or {}).get('up') or [],[])))
    return {k:v for k,v in result.items() if v not in ('',[],None)}

def collect_item_names(eq):
    names=[]
    for group in ('armor','weapons','trinkets'):
        for x in eq.get(group,[]):
            if x.get('rune'): names.append(x['rune'])
            names += list(x.get('sigils') or []) + list(x.get('infusions') or [])
    for k in ('relic','enrichment','food','utility'):
        if eq.get(k): names.append(eq[k])
    return names

def enrich_equipment(eq,items):
    def obj(v):
        if not v:return v
        m=items.get(v)
        return {'name':v,'id':m.get('id'),'icon':m.get('icon',''),'type':m.get('type','')} if m else {'name':v}
    out=json.loads(json.dumps(eq))
    for group in ('armor','weapons','trinkets'):
        for x in out.get(group,[]):
            if x.get('rune'):x['rune']=obj(x['rune'])
            if x.get('sigils'):x['sigils']=[obj(v) for v in x['sigils']]
            if x.get('infusions'):x['infusions']=[obj(v) for v in x['infusions']]
    for k in ('relic','enrichment','food','utility'):
        if out.get(k):out[k]=obj(out[k])
    return out

def main():
    builds=json.loads(BUILDS.read_text(encoding='utf-8'))
    try: old=json.loads(OUT.read_text(encoding='utf-8'))
    except Exception: old={}
    result={}; failures=[]; dbcache={}
    for b in builds:
        bid=b.get('id'); url=b.get('gw2skills','')
        if not bid or 'gw2skills.net' not in url.lower():continue
        try:
            doc=fetch(url); preload,dbid=extract_preload(doc)
            code=as_build_code((preload or {}).get('chatlink','')) or extract_code(doc)
            if not code: raise RuntimeError(f'no valid build-template payload found in {len(doc)} bytes')
            entry={'chat_code':code,'source':url}
            if preload and dbid:
                if dbid not in dbcache: dbcache[dbid]=json.loads(fetch_url(f'https://en.gw2skills.net/ajax/db/en.{dbid}.json','application/json'))
                eq=equipment_from(preload,dbcache[dbid])
                if eq: entry['equipment']=eq
            result[bid]=entry
            print(f"OK {bid}: build + {'equipment' if entry.get('equipment') else 'no equipment'}")
        except Exception as e:
            if bid in old and old[bid].get('chat_code'):
                result[bid]=old[bid]; print(f'KEEP {bid}: {e}')
            else: failures.append(f'{bid}: {e}'); print(f'ERROR {bid}: {e}')
        time.sleep(.15)
    # Resolve real ArenaNet item icons once all builds have been parsed.
    names=[]
    for entry in result.values(): names += collect_item_names(entry.get('equipment') or {})
    item_meta=resolve_official_items(names)
    for entry in result.values():
        if entry.get('equipment'): entry['equipment']=enrich_equipment(entry['equipment'],item_meta)
    OUT.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    if failures:
        print('\nGW2Skills sync failed:'); [print(' -',x) for x in failures]; raise SystemExit(1)
    print(f'\nSynced {len(result)} GW2Skills builds.')
if __name__=='__main__':main()
