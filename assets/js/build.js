(async function(){
 const view=document.querySelector("#build-view");
 const safeGw2=/^https:\/\/([a-z]{2}\.)?gw2skills\.(net|com)\//i;
 const decodeBuildCode=(code)=>{
   const m=String(code||"").trim().match(/^\[&([A-Za-z0-9+/=]+)\]$/); if(!m) return null;
   try{
     const raw=atob(m[1]), a=Uint8Array.from(raw,c=>c.charCodeAt(0));
     if(a[0]!==0x0d||a.length<28) return null;
     const specs=[]; for(let i=0;i<3;i++){const id=a[2+i*2],bits=a[3+i*2]; specs.push({id,choices:[bits&3,(bits>>2)&3,(bits>>4)&3]});}
     const palettes=[]; let o=8; for(let i=0;i<10;i++,o+=2) palettes.push(a[o]|(a[o+1]<<8));
     return {professionCode:a[1],specs,palettes,landPalettes:[palettes[0],palettes[2],palettes[4],palettes[6],palettes[8]]};
   }catch(_){return null;}
 };
 const api=async path=>{const r=await fetch(`https://api.guildwars2.com${path}`);if(!r.ok)throw new Error(`GW2 API ${r.status}`);return r.json();};
 const renderOfficialBuild=async(b)=>{
   const host=document.querySelector("#official-build"); if(!host)return;
   const parsed=decodeBuildCode(b.buildCode);
   if(!b.buildCode){host.innerHTML=`<div class="build-code-empty"><strong>Visual build preview</strong><span>Add the in-game build template code as <code>"buildCode": "[&amp;...=]"</code> in <code>data/builds.json</code> to show traits and skills here.</span></div>`;return;}
   if(!parsed){host.innerHTML=`<div class="build-code-empty"><strong>Build code could not be read</strong><span>Use the complete Guild Wars 2 build template copied from the in-game Build panel.</span></div>`;return;}
   host.innerHTML=`<div class="build-preview-loading">Loading build preview…</div>`;
   try{
     const professions=await api('/v2/professions?ids=all&v=latest');
     const prof=professions.find(x=>x.code===parsed.professionCode);
     if(!prof)throw new Error('Profession not found');
     const specIds=parsed.specs.map(x=>x.id).filter(Boolean);
     const specs=specIds.length?await api(`/v2/specializations?ids=${specIds.join(',')}`):[];
     const traitIds=[...new Set(specs.flatMap(s=>[...(s.major_traits||[]),...(s.minor_traits||[])]))];
     const traits=traitIds.length?await api(`/v2/traits?ids=${traitIds.join(',')}`):[];
     const traitMap=new Map(traits.map(t=>[t.id,t]));
     const specHtml=parsed.specs.map(ps=>{
       const s=specs.find(x=>x.id===ps.id); if(!s)return '';
       const majors=(s.major_traits||[]).map(id=>traitMap.get(id)).filter(Boolean);
       const selected=ps.choices.map((choice,row)=>choice?majors[row*3+(choice-1)]:null);
       return `<div class="trait-line"><div class="trait-spec"><img src="${TEL.esc(s.icon||'')}" alt=""><span><strong>${TEL.esc(s.name)}</strong><small>${s.elite?'Elite specialization':'Specialization'}</small></span></div><div class="trait-picks">${selected.map(t=>t?`<div class="trait-pick"><img src="${TEL.esc(t.icon||'')}" alt=""><span>${TEL.esc(t.name)}</span></div>`:`<div class="trait-pick empty">—</div>`).join('')}</div></div>`;
     }).join('');
     const paletteMap=new Map((prof.skills_by_palette||[]).map(x=>[x[0],x[1]]));
     const skillIds=parsed.landPalettes.map(id=>paletteMap.get(id)).filter(Boolean);
     const skills=skillIds.length?await api(`/v2/skills?ids=${skillIds.join(',')}`):[];
     const skillMap=new Map(skills.map(s=>[s.id,s]));
     const labels=['Heal','Utility','Utility','Utility','Elite'];
     const skillHtml=parsed.landPalettes.map((palette,i)=>{const sid=paletteMap.get(palette),s=skillMap.get(sid);return `<div class="skill-slot">${s?`<img src="${TEL.esc(s.icon||'')}" alt=""><strong>${TEL.esc(s.name)}</strong>`:`<span class="skill-placeholder">—</span><strong>Empty</strong>`}<small>${labels[i]}</small></div>`}).join('');
     host.innerHTML=`<section class="build-preview"><div class="preview-heading"><div><span class="eyebrow">IN-GAME BUILD TEMPLATE</span><h2>Traits & skills</h2></div><span class="preview-profession">${TEL.esc(prof.name)}</span></div><div class="trait-lines">${specHtml}</div><div class="skill-bar"><h3>Skills</h3><div class="skill-slots">${skillHtml}</div></div><details class="build-code-details"><summary>Build template code</summary><code>${TEL.esc(b.buildCode)}</code></details></section>`;
   }catch(e){console.error(e);host.innerHTML=`<div class="build-code-empty"><strong>Preview temporarily unavailable</strong><span>${TEL.esc(e.message)}. The GW2Skills link still works normally.</span></div>`;}
 };
 try{
   const id=TEL.qs("id");
   const [professions,builds,icons]=await Promise.all([
     TEL.json("data/professions.json"),
     TEL.json("data/builds.json"),
     TEL.gw2Icons()
   ]);
   const b=builds.find(x=>x.id===id);
   if(!b) throw new Error(`Build "${id||""}" was not found in data/builds.json.`);
   const p=professions.find(x=>x.id===b.profession);
   document.title=`${b.name} · TEL Builds`;

   const safeGw=/^https:\/\/([a-z]{2}\.)?gw2skills\.(net|com)\//i.test(b.gw2skills||"");
   const gw2=safeGw
    ? `<a class="button primary" href="${TEL.esc(b.gw2skills)}" target="_blank" rel="noopener noreferrer">Open full build on GW2Skills ↗</a>`
    : `<span class="button disabled" title="Add a GW2Skills QuickLink in data/builds.json">GW2Skills link not added</span>`;
   const gw2Embed=safeGw ? `
    <section class="gw2skills-panel">
      <div class="gw2skills-panel-head">
        <div><p class="eyebrow">INTERACTIVE BUILD</p><h2>GW2Skills build</h2></div>
        <a class="gw2skills-external" href="${TEL.esc(b.gw2skills)}" target="_blank" rel="noopener noreferrer">Open separately ↗</a>
      </div>
      <div class="gw2skills-frame-wrap">
        <iframe class="gw2skills-frame" src="${TEL.esc(b.gw2skills)}" title="${TEL.esc(b.name)} on GW2Skills" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </div>
      <p class="gw2skills-fallback">If the editor does not appear, GW2Skills may be blocking embedded pages in your browser. Use <a href="${TEL.esc(b.gw2skills)}" target="_blank" rel="noopener noreferrer">Open separately</a>.</p>
    </section>` : ``;

   view.innerHTML=`
    <div class="build-kicker"><span class="tag">${TEL.esc(p?.name||b.profession)}</span><span class="tag">${TEL.esc(b.specialization||"")}</span><span class="tag">${TEL.esc(b.category)}</span></div>
    <div class="build-title-row">${TEL.iconForBuild(b,icons)?`<img class="build-title-icon" src="${TEL.esc(TEL.iconForBuild(b,icons))}" alt="">`:``}<h1>${TEL.esc(b.name)}</h1></div>
    <p class="build-summary">${TEL.esc(b.description||"")}</p>
    <p class="build-meta">${TEL.esc(b.status||"")} ${b.updated?`· Updated ${TEL.esc(b.updated)}`:""}</p>
    <div class="build-actions">${gw2}<a class="button ghost" href="./">Back to matrix</a></div>
    <div id="official-build"></div>
    ${gw2Embed}
    <div class="detail-grid">
      <section class="detail-card"><h3>Build information</h3><div class="detail-list">
       <div class="detail-row"><span>Profession</span><strong>${TEL.esc(p?.name||b.profession)}</strong></div>
       <div class="detail-row"><span>Specialization</span><strong>${TEL.esc(b.specialization||"—")}</strong></div>
       <div class="detail-row"><span>Role</span><strong>${TEL.esc(b.category)}</strong></div>
      </div></section>
      <section class="detail-card wide"><h3>TEL notes</h3><div class="notes">${TEL.esc(b.notes||"No TEL notes yet.")}</div></section>
    </div>`;
   renderOfficialBuild(b);
 }catch(err){console.error(err);view.innerHTML=`<div class="data-error"><strong>Build could not be loaded.</strong><span>${TEL.esc(err.message)}</span><a class="button ghost" href="./">Back to matrix</a></div>`;}
})();
