
(async function(){
 const id=TEL.qs("id");
 const [professions,builds]=await Promise.all([TEL.json("./data/professions.json"),TEL.json("./data/builds.json")]);
 const b=builds.find(x=>x.id===id);
 if(!b){location.href="./404.html";return;}
 const p=professions.find(x=>x.id===b.profession);
 document.title=`${b.name} · TEL Builds`;

 const gw2=b.gw2skills && /^https:\/\/([a-z]{2}\.)?gw2skills\.(net|com)\//i.test(b.gw2skills)
   ? `<a class="button primary" href="${TEL.esc(b.gw2skills)}" target="_blank" rel="noopener noreferrer">Open full build on GW2Skills ↗</a>`
   : `<span class="button disabled" title="Add a GW2Skills QuickLink in data/builds.json">GW2Skills link not added</span>`;

 document.querySelector("#build-view").innerHTML=`
   <div class="build-kicker">
     <span class="tag">${TEL.esc(p.name)}</span>
     <span class="tag">${TEL.esc(b.specialization||"")}</span>
     <span class="tag">${TEL.esc(b.category)}</span>
   </div>
   <h1>${TEL.esc(b.name)}</h1>
   <p class="build-summary">${TEL.esc(b.description||"")}</p>
   <p class="build-meta">${TEL.esc(b.status||"")} ${b.updated?`· Updated ${TEL.esc(b.updated)}`:""}</p>
   <div class="build-actions">${gw2}<a class="button ghost" href="./">Back to matrix</a></div>
   <div class="detail-grid">
     <section class="detail-card">
       <h3>Build information</h3>
       <div class="detail-list">
         <div class="detail-row"><span>Profession</span><strong>${TEL.esc(p.name)}</strong></div>
         <div class="detail-row"><span>Specialization</span><strong>${TEL.esc(b.specialization||"—")}</strong></div>
         <div class="detail-row"><span>Role</span><strong>${TEL.esc(b.category)}</strong></div>
       </div>
     </section>
     <section class="detail-card wide"><h3>TEL notes</h3><div class="notes">${TEL.esc(b.notes||"No TEL notes yet.")}</div></section>
   </div>`;
})().catch(console.error);
