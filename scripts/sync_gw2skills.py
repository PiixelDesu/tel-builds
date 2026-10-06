#!/usr/bin/env python3
"""Sync GW2Skills quicklinks into TEL's native build + equipment data."""
import base64, html, json, re, subprocess, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BUILDS=ROOT/'data'/'builds.json'
OUT=ROOT/'data'/'gw2-build-codes.json'
ITEM_CACHE=ROOT/'data'/'gw2-item-cache.json'
ITEM_ASSETS=ROOT/'assets'/'gw2'/'items'
CLASS_ASSETS=ROOT/'assets'/'gw2'/'classes'
CLASS_ICONS=ROOT/'data'/'gw2-class-icons.json'
MECH_DEBUG=ROOT/'data'/'gw2-mechanics-debug.json'
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

def sync_class_icons():
    """Cache profession/specialization icons locally so homepage rendering has no external dependency."""
    CLASS_ASSETS.mkdir(parents=True,exist_ok=True)
    icons={'professions':{},'specializations':{}}
    rows=[('professions',gw2_api('professions?ids=all')),('specializations',gw2_api('specializations?ids=all'))]
    for kind,items in rows:
        for item in items:
            name=str(item.get('name') or item.get('id') or '').strip().lower()
            if not name: continue
            url=(item.get('icon_big') or item.get('profession_icon_big') or item.get('profession_icon') or item.get('icon') or '')
            if not url: continue
            slug=re.sub(r'[^a-z0-9]+','-',name).strip('-')
            suffix=Path(urllib.parse.urlsplit(url).path).suffix.lower()
            if suffix not in ('.png','.jpg','.jpeg','.webp'): suffix='.png'
            target=CLASS_ASSETS/f'{kind[:-1]}-{slug}{suffix}'
            if not target.exists():
                req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'image/*'})
                with urllib.request.urlopen(req,timeout=30) as r: target.write_bytes(r.read())
            icons[kind][name]=target.relative_to(ROOT).as_posix()
    CLASS_ICONS.write_text(json.dumps(icons,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(f'GW2 class icons: {len(icons["professions"])} professions, {len(icons["specializations"])} specializations cached locally')

def load_item_cache():
    try:
        raw=json.loads(ITEM_CACHE.read_text(encoding='utf-8'))
        return raw if isinstance(raw,dict) else {}
    except Exception:
        return {}

def save_item_cache(cache):
    ITEM_CACHE.parent.mkdir(parents=True,exist_ok=True)
    ITEM_CACHE.write_text(json.dumps(cache,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

def api_json_url(url,timeout=30):
    return json.loads(fetch_url(url,'application/json'))

def download_icon(item_id,url):
    if not item_id or not url:return ''
    ITEM_ASSETS.mkdir(parents=True,exist_ok=True)
    suffix=Path(urllib.parse.urlsplit(url).path).suffix.lower()
    if suffix not in ('.png','.jpg','.jpeg','.webp'):suffix='.png'
    target=ITEM_ASSETS/f'{item_id}{suffix}'
    if not target.exists():
        req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'image/*'})
        with urllib.request.urlopen(req,timeout=30) as r: target.write_bytes(r.read())
    return target.relative_to(ROOT).as_posix()

def resolve_official_items(names):
    """Resolve item names once, persist metadata, and store icons locally.

    GW2 has no public item-name search endpoint. Unknown names therefore require one
    catalogue pass, but pages are fetched concurrently. Once a name is cached,
    future syncs make no catalogue request for it. Existing local icons are never
    downloaded again.
    """
    wanted={str(n).strip() for n in names if n and str(n).strip()}
    cache=load_item_cache()
    found={name:cache[name] for name in wanted if name in cache}
    missing=wanted-set(found)
    print(f'GW2 item cache: {len(found)} hit(s), {len(missing)} new name(s)')

    if missing:
        try:
            # Discover page count cheaply, then scan pages in parallel. page_size 200 is
            # the API maximum. We stop scheduling no new work after all names are found.
            ids=gw2_api('items')
            pages=(len(ids)+199)//200
            def fetch_page(page):
                return gw2_api(f'items?page={page}&page_size=200')
            with ThreadPoolExecutor(max_workers=10) as pool:
                futures={pool.submit(fetch_page,p):p for p in range(pages)}
                for fut in as_completed(futures):
                    try: rows=fut.result()
                    except Exception as e:
                        print(f'WARN item page {futures[fut]} failed: {e}'); continue
                    for item in rows:
                        name=item.get('name','')
                        if name in missing:
                            meta={'id':item.get('id'),'name':name,'icon':item.get('icon',''),'type':item.get('type',''),'details':item.get('details') or {}}
                            found[name]=meta; cache[name]=meta; missing.discard(name)
                    if not missing:
                        for f in futures:
                            if not f.done(): f.cancel()
                        break
        except Exception as e:
            print('WARN official item resolution failed:',e)

    # Localize icons. Cached local files are reused and never downloaded again.
    for name,meta in list(found.items()):
        try:
            local=meta.get('local_icon','')
            if local and (ROOT/local).exists():
                pass
            elif meta.get('icon') and meta.get('id'):
                meta['local_icon']=download_icon(meta['id'],meta['icon'])
            cache[name]=meta
        except Exception as e:
            print(f'WARN icon download failed for {name}: {e}')
    save_item_cache(cache)
    print(f'Official GW2 items: resolved {len(found)}/{len(wanted)} names; local icons cached in assets/gw2/items')
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

def equipment_from(preload,db,profession=""):
    profession=str(profession or "").strip().lower()
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

    # Weapon identity is NOT stored in eq.weapon.w11/w12/... . GW2Skills keeps
    # it in preload.weapon, ordered as w11,w12,w21,w22,w31,w32. Resolve those
    # IDs only against db.weapon; IDs in other DB tables are unrelated and can
    # overlap (the old cross-table heuristic caused every slot to become GS).
    weapon_labels={
        'axe':'Axe','dagger':'Dagger','focus':'Focus','greatsword':'Greatsword',
        'hammer':'Hammer','longbow':'Longbow','mace':'Mace','pistol':'Pistol',
        'rifle':'Rifle','scepter':'Scepter','shield':'Shield','shortbow':'Shortbow',
        'spear':'Spear','landspear':'Spear','staff':'Staff','sword':'Sword',
        'torch':'Torch','warhorn':'Warhorn','harpoon_gun':'Harpoon Gun',
        'harpoongun':'Harpoon Gun','harpoon':'Harpoon Gun','speargun':'Harpoon Gun',
        'trident':'Trident'
    }
    weapon_table=db.get('weapon') or {}
    wdesc=weapon_table.get('desc') or []
    wid_i=wdesc.index('id') if 'id' in wdesc else -1
    wkey_i=wdesc.index('key') if 'key' in wdesc else -1
    wtype_i=wdesc.index('type') if 'type' in wdesc else -1
    weapon_db={}
    if wid_i >= 0 and wkey_i >= 0:
        for row in weapon_table.get('rows') or []:
            if not isinstance(row,list) or len(row) <= max(wid_i,wkey_i): continue
            key=str(row[wkey_i] or '').strip().lower()
            typ=row[wtype_i] if wtype_i >= 0 and len(row)>wtype_i else None
            weapon_db[row[wid_i]]={'key':key,'type':typ,'name':weapon_labels.get(key, key.replace('_',' ').title())}

    preload_weapon_ids=(preload or {}).get('weapon') or []
    weapon_slot_keys=['w11','w12','w21','w22','w31','w32']
    weapon_types={}
    weapon_kinds={}
    for i,weapon_id in enumerate(preload_weapon_ids):
        if i >= len(weapon_slot_keys) or not weapon_id: continue
        meta=weapon_db.get(weapon_id)
        if not meta: continue
        slot=weapon_slot_keys[i]
        is_offhand=slot in ('w12','w22')
        is_aquatic=slot in ('w31','w32')
        typ=meta.get('type')
        # GW2Skills weapon table: 0=offhand, 1=1H, 2=2H, 3=underwater.
        # Validate slot compatibility so malformed/stale quicklinks cannot label
        # a terrestrial slot with an aquatic weapon (or vice versa).
        if is_aquatic and typ != 3: continue
        if not is_aquatic and typ == 3: continue
        if is_offhand and typ == 2: continue
        if not is_offhand and not is_aquatic and typ == 0: continue
        weapon_types[slot]=meta['name']
        weapon_kinds[slot]=typ

    def piece_data(piece,kind):
        if not piece:return None
        item=piece.get('item') or []; out={'stat':stat(first(item))}
        ups=piece.get('up') or []; inf=piece.get('inf') or []
        if kind=='armor': out['rune']=upgrade(first(first(ups,[])))
        if kind=='weapon':
            out['sigils']=[upgrade(first(x)) for x in ups if first(x)]
            # Filled by the slot-aware preload.weapon mapping below.
        out['infusions']=[upgrade(x) for x in inf if x]
        return {k:v for k,v in out.items() if v not in ('',[],None)}
    # Aquatic weapon identity is not carried in preload.weapon. GW2Skills keeps
    # separate underwater equipment slots (w31/w32), while the profession itself
    # determines which aquatic weapon families can occupy them. Every profession
    # currently has one or two aquatic families, so this mapping is unambiguous.
    aquatic_by_profession={
        'guardian':['Spear','Trident'],
        'warrior':['Harpoon Gun','Spear'],
        'revenant':['Spear','Trident'],
        'engineer':['Harpoon Gun'],
        'ranger':['Harpoon Gun','Spear'],
        'thief':['Harpoon Gun','Spear'],
        'elementalist':['Trident'],
        'mesmer':['Spear','Trident'],
        'necromancer':['Spear','Trident'],
    }
    aquatic=aquatic_by_profession.get(profession,[])
    if aquatic:
        weapon_types['w31']=aquatic[0]
        if len(aquatic)>1: weapon_types['w32']=aquatic[1]

    result={'armor':[],'weapons':[],'trinkets':[]}
    for key,label in ARMOR.items():
        d=piece_data((eq.get('armor') or {}).get(key),'armor')
        if d: result['armor'].append({'slot':label,**d})
    for key,label in WEAPONS.items():
        # GW2Skills mirrors a two-handed weapon's second sigil/infusion into the
        # paired off-hand equipment object. That does NOT mean an off-hand weapon
        # exists. Suppress the phantom card when the main-hand is type 2 (2H).
        if key=='w12' and weapon_kinds.get('w11')==2: continue
        if key=='w22' and weapon_kinds.get('w21')==2: continue
        # Professions with only one aquatic family have no second aquatic weapon.
        if key=='w32' and len(aquatic)<2: continue
        d=piece_data((eq.get('weapon') or {}).get(key),'weapon')
        if d:
            if weapon_types.get(key): d['weaponType']=weapon_types[key]
            else: print(f'WARN weapon type unresolved for {key}; slot data kept without guessing')
            result['weapons'].append({'slot':label,**d})
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
        return {'name':v,'id':m.get('id'),'icon':m.get('local_icon') or m.get('icon',''),'type':m.get('type','')} if m else {'name':v}
    out=json.loads(json.dumps(eq))
    for group in ('armor','weapons','trinkets'):
        for x in out.get(group,[]):
            if x.get('rune'):x['rune']=obj(x['rune'])
            if x.get('sigils'):x['sigils']=[obj(v) for v in x['sigils']]
            if x.get('infusions'):x['infusions']=[obj(v) for v in x['infusions']]
    for k in ('relic','enrichment','food','utility'):
        if out.get(k):out[k]=obj(out[k])
    return out


def specialization_mechanics_from(preload, db, specialization=""):
    """Resolve GW2Skills-only Evoker/Amalgam quicklink selections.

    GW2Skills' quicklink decoder does not expose these selections under stable,
    human-readable preload keys.  Resolve selected scalar IDs against DB rows
    whose metadata identifies them as Familiar/Morph content instead of guessing
    from the preload key name.
    """
    spec=str(specialization or '').strip().lower()
    if spec not in ('evoker','amalgam') or not isinstance(preload,dict): return None
    needle='familiar' if spec=='evoker' else 'morph'

    # All scalar values carried by the decoded quicklink, with their paths.
    scalars=[]
    def walk(v,path=''):
        if isinstance(v,dict):
            for k,x in v.items(): walk(x, f'{path}.{k}' if path else str(k))
        elif isinstance(v,list):
            for i,x in enumerate(v): walk(x, f'{path}[{i}]')
        elif isinstance(v,(str,int,float)) and not isinstance(v,bool):
            if v not in ('',0,'0',-1,'-1',None): scalars.append((path,v))
    walk(preload)

    # Build an index of DB rows that are unmistakably mechanic-related.  This
    # intentionally requires textual Familiar/Morph evidence in table/column/row
    # metadata, preventing the overlapping-ID bug we previously hit with weapons.
    candidates={}
    for tn,table in (db or {}).items():
        if not isinstance(table,dict): continue
        desc=table.get('desc') or []
        if 'id' not in desc: continue
        ii=desc.index('id')
        table_hint=needle in str(tn).lower() or any(needle in str(x).lower() for x in desc)
        for row in table.get('rows') or []:
            if not isinstance(row,list) or len(row)<=ii: continue
            text=' '.join(str(x) for x in row if isinstance(x,str)).lower()
            if not table_hint and needle not in text: continue
            rid=row[ii]
            # Prefer a readable name/key/title field; otherwise first useful text.
            name=None
            for field in ('name','title','key','skill_name','label'):
                if field in desc:
                    j=desc.index(field)
                    if j<len(row) and row[j] not in (None,''): name=str(row[j]); break
            if not name:
                texts=[str(x) for x in row if isinstance(x,str) and x and needle not in x.lower()]
                name=texts[0] if texts else str(rid)
            candidates.setdefault(str(rid), {'id':rid,'name':name.replace('_',' ').strip(),'source_table':tn})

    # Selected quicklink IDs are values present in preload and in the scoped DB
    # candidate set. Preserve preload order and de-duplicate.
    picked=[]; seen=set()
    for path,v in scalars:
        key=str(v)
        if key in candidates and key not in seen:
            item=dict(candidates[key]); item['source_path']=path
            picked.append(item); seen.add(key)

    # Some GW2Skills revisions use a mechanic-specific object whose values are
    # already readable strings rather than DB IDs. Keep that explicit fallback.
    if not picked:
        def named(v,path=''):
            out=[]
            if isinstance(v,dict):
                for k,x in v.items():
                    p=f'{path}.{k}' if path else str(k)
                    if needle in str(k).lower(): out.append((p,x))
                    out.extend(named(x,p))
            elif isinstance(v,list):
                for i,x in enumerate(v): out.extend(named(x,f'{path}[{i}]'))
            return out
        for path,v in named(preload):
            vals=v if isinstance(v,list) else [v]
            for x in vals:
                if isinstance(x,str) and x.strip() and not x.strip().isdigit():
                    key=x.strip()
                    if key not in seen: picked.append({'id':key,'name':key.replace('_',' ').title(),'source_path':path}); seen.add(key)

    if not picked:return None
    limit=1 if spec=='evoker' else 3
    return {'type':'familiar' if spec=='evoker' else 'morphs','selections':picked[:limit]}

def main():
    builds=json.loads(BUILDS.read_text(encoding='utf-8'))
    try: old=json.loads(OUT.read_text(encoding='utf-8'))
    except Exception: old={}
    result={}; failures=[]; dbcache={}; mech_debug={}
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
                eq=equipment_from(preload,dbcache[dbid],b.get('profession',''))
                if eq: entry['equipment']=eq
                mechanics=specialization_mechanics_from(preload,dbcache[dbid],b.get('specialization',''))
                if mechanics: entry['mechanics']=mechanics
                # Temporary, deliberately scoped diagnostic for GW2Skills v9 mechanics.
                # Captures only decoded preload structure/scalars and relevant DB table
                # schemas; no HTML, cookies, tokens, or unrelated build data.
                spec=str(b.get('specialization','')).strip().lower()
                if spec in ('evoker','amalgam'):
                    def compact(v, depth=0):
                        if depth > 5: return '<depth>'
                        if isinstance(v,dict): return {str(k):compact(x,depth+1) for k,x in v.items()}
                        if isinstance(v,list): return [compact(x,depth+1) for x in v[:40]]
                        if isinstance(v,(str,int,float,bool)) or v is None: return v
                        return str(v)
                    db=dbcache[dbid]
                    hints={}
                    # The v9 selections are already decoded into preload.extra. Capture
                    # the DB rows that reference those exact non-zero IDs, plus schemas
                    # for skill/mechanic-looking tables. This keeps the diagnostic small
                    # while exposing the lookup chain needed for names/icons.
                    extra_ids={x for x in ((preload or {}).get('extra') or []) if isinstance(x,int) and x>0}
                    for tn,t in db.items():
                        if not isinstance(t,dict): continue
                        desc=t.get('desc') or []
                        rows=t.get('rows') or []
                        matched=[]
                        for row in rows:
                            if not isinstance(row,list): continue
                            # Match the selected ID wherever GW2Skills references it;
                            # table-local IDs and foreign-key columns are both useful.
                            if any(isinstance(v,int) and v in extra_ids for v in row):
                                matched.append(row)
                        table_text=(str(tn)+' '+' '.join(map(str,desc))).lower()
                        schema_relevant=any(q in table_text for q in ('skill','familiar','morph','special','profession','rule'))
                        if matched or schema_relevant:
                            hints[tn]={
                                'desc':desc,
                                'matched_rows':matched[:80],
                                'sample_rows':rows[:12] if schema_relevant else []
                            }
                    mech_debug[bid]={
                        'specialization':spec,
                        'quicklink':normalize_url(url).split('?',1)[-1],
                        'selected_extra_ids':sorted(extra_ids),
                        'preload':compact(preload),
                        'db_tables':compact(hints)
                    }
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
    # Class icons are required homepage assets. Fail the sync if they cannot be generated.
    sync_class_icons()
    OUT.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    MECH_DEBUG.write_text(json.dumps(mech_debug,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(f'Mechanic debug snapshot: {MECH_DEBUG.relative_to(ROOT)} ({len(mech_debug)} build(s))')
    if failures:
        print('\nGW2Skills sync failed:'); [print(' -',x) for x in failures]; raise SystemExit(1)
    print(f'\nSynced {len(result)} GW2Skills builds.')
if __name__=='__main__':main()
