
(async function(){
  const id=TEL.qs("p")||"guardian";
  const [professions,builds]=await Promise.all([TEL.json("./data/professions.json"),TEL.json("./data/builds.json")]);
  const p=professions.find(x=>x.id===id);
  if(!p){ location.href="./404.html"; return; }
  document.title=`${p.name} · TEL Builds`;
  const mine=builds.filter(b=>b.profession===id);
  const damage={Power:0,Condition:0,Heal:0}, range={Melee:0,Midrange:0,Ranged:0};
  mine.filter(x=>!x.placeholder).forEach(b=>{(b.damage||[]).forEach(x=>damage[x]=(damage[x]||0)+1);(b.range||[]).forEach(x=>range[x]=(range[x]||0)+1)});
  const max=Math.max(1,...Object.values(damage),...Object.values(range));
  const bars=o=>Object.entries(o).map(([k,v])=>`<div class="bar-row"><span>${k}</span><div class="bar"><i style="width:${v/max*100}%"></i></div><b>${v}</b></div>`).join("");
  document.querySelector("#profession-head").innerHTML=`<div class="profession-title"><div class="profession-glyph" style="--profession:${p.color};color:${p.color}">${p.glyph}</div><div><p class="eyebrow">PROFESSION</p><h1>${p.name}</h1></div></div><p class="summary">${p.blurb}</p><div class="stats-panels"><div class="stat-panel"><strong>Damage type</strong>${bars(damage)}</div><div class="stat-panel"><strong>Range type</strong>${bars(range)}</div></div>`;
  const order=["power","condi","utility","cloud","zerg","support","pick","bomb","specialist"];
  document.querySelector("#slot-grid").innerHTML=order.map(slot=>{
    const b=mine.find(x=>x.slot===slot);
    if(!b||b.placeholder) return `<div class="slot-card empty" style="--profession:${p.color}"><span class="slot-name">${slot}</span><h3>Open slot</h3><p class="empty-note">TEL build not assigned yet.</p></div>`;
    return `<a class="slot-card" style="--profession:${p.color}" href="./build.html?id=${b.id}">
      <span class="slot-name">${b.slot}</span><h3>${b.title}</h3><div class="spec">${p.name} · ${b.specialization}</div>
      <div class="weapons">${b.weapons.join(" · ")}</div>
      <div class="mini-stats">${TEL.tags([...(b.damage||[]),...(b.range||[])])}</div>
      <div class="mini-stats" style="margin-top:8px">${TEL.tags(b.scale||[])}</div>
      <span class="card-link">Open build →</span></a>`;
  }).join("");
})().catch(console.error);
