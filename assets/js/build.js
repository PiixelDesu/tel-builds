(async function(){
 const view=document.querySelector("#build-view");
 const API="https://api.guildwars2.com/v2/";
 const weaponNames={5:"Axe",35:"Longbow",47:"Dagger",49:"Focus",50:"Greatsword",51:"Hammer",53:"Mace",54:"Pistol",85:"Rifle",86:"Scepter",87:"Shield",89:"Staff",90:"Sword",102:"Torch",103:"Warhorn",107:"Shortbow",265:"Spear"};
 const profByCode={1:"Guardian",2:"Warrior",3:"Engineer",4:"Ranger",5:"Thief",6:"Elementalist",7:"Mesmer",8:"Necromancer",9:"Revenant"};
 const esc=TEL.esc;
 async function api(path){const r=await fetch(API+path);if(!r.ok)throw new Error(`GW2 API ${r.status}`);return r.json()}
 async function optionalJson(path){try{return await TEL.json(path)}catch(_){return {}}}
 function decodeChat(code){
   const raw=code.replace(/^\[&|\]$/g,"");
   const bytes=Uint8Array.from(atob(raw.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
   if(bytes[0]!==13)throw new Error("Not a GW2 build-template code");
   const out={profession:profByCode[bytes[1]]||"Unknown",specs:[],palettes:[],weapons:[]};
   let o=2;
   for(let i=0;i<3;i++){const id=bytes[o++],bits=bytes[o++];out.specs.push({id,choices:[bits&3,(bits>>2)&3,(bits>>4)&3]})}
   for(let i=0;i<10;i++){out.palettes.push(bytes[o]|(bytes[o+1]<<8));o+=2}
   o+=16; // Ranger/Revenant profession-specific block; overview does not need it.
   if(o<bytes.length){const n=Math.min(bytes[o++]||0,8);for(let i=0;i<n&&o+1<bytes.length;i++){out.weapons.push(bytes[o]|(bytes[o+1]<<8));o+=2}}
   return out;
 }
 function traitId(spec,tier,choice){return choice?spec.major_traits?.[tier*3+choice-1]:null}
 async function renderOverview(b,sync){
   const target=document.querySelector("#native-build-overview");
   const entry=sync[b.id];
   if(!entry?.chat_code){
     target.innerHTML=`<div class="overview-state"><strong>Build overview not synced</strong><span>Run the “Sync GW2Skills build data” Action. The sync now fails visibly if GW2Skills cannot be decoded, instead of silently publishing an empty overview.</span></div>`;return;
   }
   try{
     const d=decodeChat(entry.chat_code);
     const specIds=d.specs.map(x=>x.id).filter(Boolean);
     const [specs,prof]=await Promise.all([api(`specializations?ids=${specIds.join(",")}`),api(`professions/${encodeURIComponent(d.profession)}?v=latest`)]);
     const specMap=Object.fromEntries(specs.map(x=>[x.id,x]));
     const traitIds=[]; d.specs.forEach(s=>{const sp=specMap[s.id];if(sp)s.choices.forEach((c,t)=>{const id=traitId(sp,t,c);if(id)traitIds.push(id)})});
     const paletteMap=new Map((prof.skills_by_palette||[]).map(([p,id])=>[p,id]));
     const terrestrial=[d.palettes[0],d.palettes[2],d.palettes[4],d.palettes[6],d.palettes[8]].map(x=>paletteMap.get(x)).filter(Boolean);
     const [traits,skills]=await Promise.all([
       traitIds.length?api(`traits?ids=${traitIds.join(",")}`):[],
       terrestrial.length?api(`skills?ids=${terrestrial.join(",")}`):[]
     ]);
     const tm=Object.fromEntries(traits.map(x=>[x.id,x])), sm=Object.fromEntries(skills.map(x=>[x.id,x]));
     const rows=d.specs.map(s=>{const sp=specMap[s.id];if(!sp)return "";return `<div class="trait-line"><div class="trait-line-name"><img src="${esc(sp.icon)}" alt=""><span>${esc(sp.name)}</span></div><div class="trait-picks">${s.choices.map((c,t)=>{const tr=tm[traitId(sp,t,c)];return tr?`<div class="trait-pick" title="${esc(tr.name)}"><img src="${esc(tr.icon)}" alt=""><span>${esc(tr.name)}</span></div>`:`<div class="trait-pick empty">—</div>`}).join("")}</div></div>`}).join("");
     const skillSlots=[d.palettes[0],d.palettes[2],d.palettes[4],d.palettes[6],d.palettes[8]].map(p=>sm[paletteMap.get(p)]).filter(Boolean);
     const skillHtml=skillSlots.map((s,i)=>`<div class="skill-pick"><img src="${esc(s.icon)}" alt=""><span>${esc(s.name)}</span><small>${i===0?"Heal":i===4?"Elite":"Utility"}</small></div>`).join("");
     const decodedWeaponTypes=d.weapons.map(id=>weaponNames[id]||`Weapon ${id}`);
     const weapons=[...new Set(decodedWeaponTypes)];
     const eq=entry.equipment||{};
     // GW2's extended build template carries the selected weapon types in slot order.
     // Attach them to the synced GW2Skills equipment cards so the page says what to equip.
     if(eq.weapons?.length&&decodedWeaponTypes.length){
       let wi=0;
       eq.weapons=eq.weapons.map(x=>({...x,weaponType:x.weaponType||decodedWeaponTypes[wi++]||"Weapon"}));
     }
     const slotIcon=(slot)=>{const s=String(slot||"").toLowerCase();
       if(s.includes("head"))return "♜"; if(s.includes("shoulder"))return "◆"; if(s.includes("chest"))return "▣"; if(s.includes("hand"))return "✦"; if(s.includes("leg"))return "▥"; if(s.includes("feet"))return "⌁";
       if(s.includes("amulet"))return "◇"; if(s.includes("ring"))return "○"; if(s.includes("accessory"))return "◈"; if(s.includes("back"))return "♢"; if(s.includes("weapon"))return "⚔"; return "◆"};
     const initials=(name)=>String(name||"?").replace(/^(Superior |Relic of |Mighty |WvW )/i,"").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();
     const iconImg=(meta,alt)=>meta?.icon?`<img class="real-item-icon" src="${esc(meta.icon)}" alt="${esc(alt||meta.name||"")}" loading="lazy">`:"";
     const gearIcon=(label,name,kind="gear",meta=null)=>`<div class="gear-icon ${esc(kind)}">${iconImg(meta,name)}${!meta?.icon?`<span class="gear-slot-mark">${esc(slotIcon(label))}</span>`:""}${name&&!meta?.icon?`<small>${esc(initials(name))}</small>`:""}</div>`;
     const upgradeChip=(value,kind)=>{const name=typeof value==="string"?value:value?.name;if(!name)return "";const meta=typeof value==="object"?value:null;return `<div class="gear-upgrade ${esc(kind)}">${meta?.icon?`<img class="upgrade-real-icon" src="${esc(meta.icon)}" alt="${esc(name)}" loading="lazy">`:`<div class="upgrade-icon">${esc(initials(name))}</div>`}<div><small>${esc(kind)}</small><strong>${esc(name)}</strong></div></div>`};
     const piece=(x,kind="gear")=>{const type=x.weaponType||"";return `<article class="gear-card ${kind==="weapon"?"weapon-card":""}"><div class="gear-card-main">${gearIcon(x.slot,type||x.stat,kind,x.item)}<div class="gear-copy"><span class="gear-slot">${esc(x.slot)}</span>${type?`<strong class="weapon-type">${esc(type)}</strong>`:""}<strong>${esc(x.stat||"No stat selected")}</strong></div></div>${x.rune?upgradeChip(x.rune,"Rune"):""}${(x.sigils||[]).map(v=>upgradeChip(v,"Sigil")).join("")}${(x.infusions||[]).length?`<div class="gear-infusions"><span>Infusions</span><div class="infusion-icons">${x.infusions.map(v=>upgradeChip(v,"Infusion")).join("")}</div></div>`:""}</article>`};
     const extra=(label,value,kind)=>{if(!value)return "";const name=typeof value==="string"?value:value.name;const meta=typeof value==="object"?value:null;return `<article class="gear-extra">${gearIcon(label,name,kind,meta)}<div><span>${esc(label)}</span><strong>${esc(name)}</strong></div></article>`};
     const equipmentHtml=(eq.armor?.length||eq.weapons?.length||eq.trinkets?.length||eq.relic||eq.food||eq.utility||eq.enrichment)?`<section class="overview-block equipment-overview"><div class="equipment-heading"><div><span class="eyebrow">Recommended setup</span><h3>Equipment</h3></div><span>Synced from GW2Skills</span></div>${eq.armor?.length?`<div class="gear-section"><h4>Armor</h4><div class="equipment-grid armor-grid">${eq.armor.map(x=>piece(x,"armor")).join("")}</div></div>`:""}${eq.trinkets?.length?`<div class="gear-section"><h4>Trinkets</h4><div class="equipment-grid trinket-grid">${eq.trinkets.map(x=>piece(x,"trinket")).join("")}</div></div>`:""}${eq.weapons?.length?`<div class="gear-section weapon-section"><h4>Weapon sets</h4><div class="equipment-grid weapon-grid">${eq.weapons.map(x=>piece(x,"weapon")).join("")}</div></div>`:""}${(eq.relic||eq.enrichment||eq.food||eq.utility)?`<div class="gear-section"><h4>Relic & consumables</h4><div class="equipment-extras">${extra("Relic",eq.relic,"relic")}${extra("Enrichment",eq.enrichment,"enrichment")}${extra("Food",eq.food,"food")}${extra("Utility",eq.utility,"utility")}</div></div>`:""}</section>`:"";
     target.innerHTML=`<div class="overview-head"><div><span class="eyebrow">Decoded from GW2Skills</span><h2>Build overview</h2></div><span class="overview-source">Official GW2 template data</span></div><section class="overview-block"><h3>Specializations & traits</h3><div class="trait-lines">${rows}</div></section><section class="overview-block"><h3>Skills</h3><div class="skill-bar">${skillHtml||'<span class="muted">No terrestrial skills resolved.</span>'}</div></section>${weapons.length?`<section class="overview-block"><h3>Weapons in template</h3><div class="weapon-list">${weapons.map(w=>`<span class="tag">${esc(w)}</span>`).join("")}</div></section>`:""}${equipmentHtml}`;
   }catch(e){console.warn(e);target.innerHTML=`<div class="overview-state"><strong>Build overview unavailable</strong><span>${esc(e.message)}. You can still open the authoritative build on GW2Skills.</span></div>`}
 }
 try{
   const id=TEL.qs("id");
   const [professions,builds,icons,sync]=await Promise.all([TEL.json("data/professions.json"),TEL.json("data/builds.json"),TEL.gw2Icons(),optionalJson("data/gw2-build-codes.json")]);
   const b=builds.find(x=>x.id===id);if(!b)throw new Error(`Build "${id||""}" was not found in data/builds.json.`);
   const p=professions.find(x=>x.id===b.profession);document.title=`${b.name} · TEL Builds`;
   const safeGw=/^https:\/\/([a-z]{2}\.)?gw2skills\.(net|com)\//i.test(b.gw2skills||"");
   const gw2=safeGw?`<a class="button primary" href="${esc(b.gw2skills)}" target="_blank" rel="noopener noreferrer">Open full build on GW2Skills ↗</a>`:`<span class="button disabled">GW2Skills link not added</span>`;
   view.innerHTML=`<div class="build-kicker"><span class="tag">${esc(p?.name||b.profession)}</span><span class="tag">${esc(b.specialization||"")}</span><span class="tag">${esc(b.category)}</span></div><div class="build-title-row">${TEL.iconForBuild(b,icons)?`<img class="build-title-icon" src="${esc(TEL.iconForBuild(b,icons))}" alt="">`:``}<h1>${esc(b.name)}</h1></div><p class="build-summary">${esc(b.description||"")}</p><p class="build-meta">${esc(b.status||"")} ${b.updated?`· Updated ${esc(b.updated)}`:""}</p><div class="build-source-actions">${gw2}</div><div id="native-build-overview" class="native-build-overview"><div class="overview-state">Loading build overview…</div></div><div class="build-actions"><a class="button ghost" href="./">Back to matrix</a></div><div class="detail-grid"><section class="detail-card"><h3>Build information</h3><div class="detail-list"><div class="detail-row"><span>Profession</span><strong>${esc(p?.name||b.profession)}</strong></div><div class="detail-row"><span>Specialization</span><strong>${esc(b.specialization||"—")}</strong></div><div class="detail-row"><span>Role</span><strong>${esc(b.category)}</strong></div></div></section><section class="detail-card wide"><h3>TEL notes</h3><div class="notes">${esc(b.notes||"No TEL notes yet.")}</div></section></div>`;
   renderOverview(b,sync);
 }catch(err){console.error(err);view.innerHTML=`<div class="data-error"><strong>Build could not be loaded.</strong><span>${esc(err.message)}</span><a class="button ghost" href="./">Back to matrix</a></div>`}
})();
