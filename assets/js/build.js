
(async function(){
  const id=TEL.qs("id");
  const [professions,builds]=await Promise.all([TEL.json("./data/professions.json"),TEL.json("./data/builds.json")]);
  const b=builds.find(x=>x.id===id && !x.placeholder);
  if(!b){ location.href="./404.html"; return; }
  const p=professions.find(x=>x.id===b.profession);
  document.title=`${b.title} · TEL Builds`;
  document.querySelector("#build-back").href=`./profession.html?p=${b.profession}`;
  const link=b.gw2skills?`<a class="button primary" href="${b.gw2skills}" target="_blank" rel="noopener">Open GW2Skills ↗</a>`:"";
  document.querySelector("#build-view").innerHTML=`
    <div class="build-kicker"><span class="tag">${p.name}</span><span class="tag">${b.specialization}</span><span class="tag">${b.category}</span></div>
    <h1>${b.title}</h1><p class="build-summary">${b.summary}</p><p class="build-meta">Updated ${b.updated||"—"}</p>
    <div class="build-actions">${link}<a class="button ghost" href="./profession.html?p=${b.profession}">Profession matrix</a></div>
    <div class="detail-grid">
      <section class="detail-card"><h3>Build</h3><div class="detail-list">
        <div class="detail-row"><span>Elite spec</span><strong>${b.specialization}</strong></div>
        <div class="detail-row"><span>Weapon set 1</span><strong>${b.weapons[0]||"—"}</strong></div>
        <div class="detail-row"><span>Weapon set 2</span><strong>${b.weapons[1]||"—"}</strong></div>
        <div class="detail-row"><span>Damage</span><strong>${(b.damage||[]).join(" · ")}</strong></div>
        <div class="detail-row"><span>Range</span><strong>${(b.range||[]).join(" · ")}</strong></div>
      </div></section>
      <section class="detail-card"><h3>Use case</h3><div class="detail-list">
        <div class="detail-row"><span>Scale</span><div>${TEL.tags(b.scale||[])}</div></div>
        <div class="detail-row"><span>Archetype</span><div>${TEL.tags(b.archetype||[])}</div></div>
        <div class="detail-row"><span>Status</span><strong>${b.status||"TEL draft"}</strong></div>
      </div></section>
      <section class="detail-card wide"><h3>TEL notes</h3><div class="notes">${b.notes||"Add guild-specific play notes here: positioning, cooldown calls, party role, swaps and commander expectations."}</div></section>
    </div>`;
})().catch(console.error);
