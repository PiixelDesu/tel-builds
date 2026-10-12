
(async function(){
  const id=TEL.qs("p")||"guardian";
  const [professions,builds]=await Promise.all([TEL.json("./data/professions.json"),TEL.json("./data/builds.json")]);
  const p=professions.find(x=>x.id===id);
  if(!p){ location.href="./404.html"; return; }
  document.title=`${p.name} · TEL Builds`;
  const mine=builds.filter(b=>b.profession===id);

  document.querySelector("#profession-head").innerHTML=`
    <div class="profession-title">
      <div class="profession-glyph" style="--profession:${p.color};color:${p.color}">${p.glyph}</div>
      <div><p class="eyebrow">PROFESSION</p><h1>${p.name}</h1></div>
    </div>
    <p class="summary">${p.blurb}</p>`;

  const roles=[
    ["damage","Damage","Organized squad damage build"],
    ["support","Support","Organized squad support build"]
  ];

  document.querySelector("#slot-grid").innerHTML=roles.map(([role,label,desc])=>{
    const b=mine.find(x=>x.category===role);
    if(!b||b.placeholder) return `
      <div class="slot-card empty role-card" style="--profession:${p.color}">
        <span class="slot-name">${label}</span>
        <h3>${label}</h3>
        <p class="spec">${desc}</p>
        <p class="empty-note">TEL build not assigned yet.</p>
      </div>`;
    return `
      <a class="slot-card role-card" style="--profession:${p.color}" href="./build.html?id=${b.id}">
        <span class="slot-name">${label}</span>
        <h3>${b.title}</h3>
        <div class="spec">${p.name} · ${b.specialization}</div>
        <div class="weapons">${b.weapons.join(" · ")}</div>
        <div class="mini-stats">${TEL.tags([...(b.damage||[]),...(b.range||[])])}</div>
        <span class="card-link">Open ${label} build →</span>
      </a>`;
  }).join("");
})().catch(console.error);
