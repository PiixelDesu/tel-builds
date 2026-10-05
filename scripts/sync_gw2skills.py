#!/usr/bin/env python3
"""Resolve GW2Skills quicklinks into official GW2 build-template chat codes.

GW2Skills embeds a preload payload in the editor HTML.  The exact JS/JSON wrapper has
changed over time, so this resolver deliberately does not depend on one variable name
or one textual '[&D...]' representation.  It scans decoded HTML/script strings for
base64 payloads and validates candidates by the official build-template type byte 0x0d.
"""
import base64, html, json, re, time, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BUILDS=ROOT/'data'/'builds.json'
OUT=ROOT/'data'/'gw2-build-codes.json'

UA='TEL-Builds/2.0 (+https://github.com/PiixelDesu/tel-builds)'
# Long enough to avoid ordinary JS identifiers, permissive enough for std/url-safe b64.
B64=re.compile(r'(?<![A-Za-z0-9+/_-])([A-Za-z0-9+/_-]{36,}={0,2})(?![A-Za-z0-9+/_-])')
BRACKETED=re.compile(r'\[\s*&\s*([A-Za-z0-9+/_=-]{20,})\s*\]')


def normalize_url(url):
    p=urllib.parse.urlsplit(url)
    if 'gw2skills.net' not in p.netloc.lower():
        raise ValueError('not a gw2skills.net URL')
    # Use a stable language endpoint; preserve the opaque quicklink query byte-for-byte.
    return urllib.parse.urlunsplit(('https','en.gw2skills.net','/editor/',p.query,''))


def fetch(url):
    req=urllib.request.Request(normalize_url(url),headers={
        'User-Agent':UA,
        'Accept':'text/html,application/xhtml+xml',
        'Accept-Language':'en-US,en;q=0.9',
        'Cache-Control':'no-cache',
    })
    with urllib.request.urlopen(req,timeout=30) as r:
        return r.read().decode('utf-8','replace')


def variants(text):
    """Yield common encodings used inside HTML and JavaScript string/preload data."""
    seen=set(); queue=[text]
    for _ in range(4):
        nxt=[]
        for value in queue:
            if value in seen: continue
            seen.add(value); yield value
            transforms=[
                html.unescape(value),
                urllib.parse.unquote(value),
                value.replace('\\u0026','&').replace('\\u005b','[').replace('\\u005d',']')
                     .replace('\\/','/').replace('\\u003d','=').replace('\\u002b','+'),
            ]
            # JSON string decoding handles escaped slashes/unicode when the text is a string body.
            try: transforms.append(json.loads('"'+value.replace('"','\\"')+'"'))
            except Exception: pass
            nxt.extend(x for x in transforms if x!=value)
        queue=nxt


def as_build_code(token):
    token=token.strip().replace(' ','')
    if token.startswith('&'): token=token[1:]
    token=token.replace('-','+').replace('_','/')
    token += '='*((4-len(token)%4)%4)
    try: raw=base64.b64decode(token,validate=True)
    except Exception: return None
    # 0x0d is the official GW2 Build Template chat-link type.
    if len(raw) < 20 or raw[0] != 0x0d: return None
    return '[&'+base64.b64encode(raw).decode('ascii')+']'


def extract(document):
    # Prefer explicit chat-link-shaped strings, then validate every plausible b64 token.
    for text in variants(document):
        for m in BRACKETED.finditer(text):
            code=as_build_code(m.group(1))
            if code: return code
        for m in B64.finditer(text):
            code=as_build_code(m.group(1))
            if code: return code
    return None


def main():
    builds=json.loads(BUILDS.read_text(encoding='utf-8'))
    try: old=json.loads(OUT.read_text(encoding='utf-8'))
    except Exception: old={}
    result={}; failures=[]
    for b in builds:
        bid=b.get('id'); url=b.get('gw2skills','')
        if not bid or 'gw2skills.net' not in url.lower(): continue
        try:
            doc=fetch(url)
            code=extract(doc)
            if not code:
                # This diagnostic is safe (no page content) and makes future format changes obvious.
                raise RuntimeError(f'no valid build-template payload found in {len(doc)} bytes of editor preload')
            result[bid]={'chat_code':code,'source':url}
            print(f'OK {bid}: {code}')
        except Exception as e:
            if bid in old and old[bid].get('chat_code'):
                result[bid]=old[bid]; print(f'KEEP {bid}: {e}')
            else:
                failures.append(f'{bid}: {e}'); print(f'ERROR {bid}: {e}')
        time.sleep(.15)
    OUT.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    if failures:
        print('\nGW2Skills sync failed for these builds:')
        for x in failures: print(' -',x)
        # Do not paint a green checkmark when every/any requested build is unresolved.
        raise SystemExit(1)
    print(f'\nSynced {len(result)} GW2Skills builds.')

if __name__=='__main__': main()
