
(async function(){
 const view=document.querySelector("#build-view");
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

   // GW2Skills blocks framing, so the TEL page uses a read-only screenshot
   // service for a visual preview instead of an iframe. The original link
   // remains the authoritative interactive editor.
   const previewUrl=safeGw
    ? `https://image.thum.io/get/width/1400/crop/950/noanimate/${b.gw2skills.replace("?","%3F")}`
    : "";
   const preview=safeGw ? `
    <section class="build-visual" aria-labelledby="build-visual-title">
      <div class="build-visual-head">
        <div><span class="eyebrow">Build preview</span><h2 id="build-visual-title">GW2Skills setup</h2></div>
        <a class="visual-open" href="${TEL.esc(b.gw2skills)}" target="_blank" rel="noopener noreferrer">Open interactive build ↗</a>
      </div>
      <a class="build-snapshot-link" href="${TEL.esc(b.gw2skills)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${TEL.esc(b.name)} on GW2Skills">
        <img class="build-snapshot" src="${TEL.esc(previewUrl)}" alt="Read-only visual preview of ${TEL.esc(b.name)} from GW2Skills" loading="eager" referrerpolicy="no-referrer">
        <span class="snapshot-hint">Click the preview to open the interactive build on GW2Skills</span>
      </a>
      <p class="snapshot-note">This is a read-only snapshot, not an embedded GW2Skills page. If the preview is temporarily unavailable, use the GW2Skills button above.</p>
    </section>` : "";

   view.innerHTML=`
    <div class="build-kicker"><span class="tag">${TEL.esc(p?.name||b.profession)}</span><span class="tag">${TEL.esc(b.specialization||"")}</span><span class="tag">${TEL.esc(b.category)}</span></div>
    <div class="build-title-row">${TEL.iconForBuild(b,icons)?`<img class="build-title-icon" src="${TEL.esc(TEL.iconForBuild(b,icons))}" alt="">`:``}<h1>${TEL.esc(b.name)}</h1></div>
    <p class="build-summary">${TEL.esc(b.description||"")}</p>
    <p class="build-meta">${TEL.esc(b.status||"")} ${b.updated?`· Updated ${TEL.esc(b.updated)}`:""}</p>
    <div class="build-actions">${gw2}<a class="button ghost" href="./">Back to matrix</a></div>
    ${preview}
    <div class="detail-grid">
      <section class="detail-card"><h3>Build information</h3><div class="detail-list">
       <div class="detail-row"><span>Profession</span><strong>${TEL.esc(p?.name||b.profession)}</strong></div>
       <div class="detail-row"><span>Specialization</span><strong>${TEL.esc(b.specialization||"—")}</strong></div>
       <div class="detail-row"><span>Role</span><strong>${TEL.esc(b.category)}</strong></div>
      </div></section>
      <section class="detail-card wide"><h3>TEL notes</h3><div class="notes">${TEL.esc(b.notes||"No TEL notes yet.")}</div></section>
    </div>`;
 }catch(err){
   console.error(err);
   view.innerHTML=`<div class="data-error"><strong>Build could not be loaded.</strong><span>${TEL.esc(err.message)}</span><a class="button ghost" href="./">Back to matrix</a></div>`;
 }
})();
