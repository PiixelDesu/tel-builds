
const TEL = {
  async json(path){ const r=await fetch(path); if(!r.ok) throw new Error(`Could not load ${path}`); return r.json(); },
  qs(name){ return new URLSearchParams(location.search).get(name); },
  tags(items=[]){ return items.map(x=>`<span class="tag">${x}</span>`).join("") },
  esc(s=""){ const d=document.createElement("div"); d.textContent=s; return d.innerHTML; }
};
document.querySelectorAll("#year").forEach(x=>x.textContent=new Date().getFullYear());

(async function(){
  if(document.body.dataset.page!=="home") return;
  const professions=await TEL.json("./data/professions.json");
  const builds=await TEL.json("./data/builds.json");
  const grid=document.querySelector("#profession-grid");
  grid.innerHTML=professions.map(p=>{
    const filled=builds.filter(b=>b.profession===p.id && !b.placeholder).length;
    return `<a class="profession-card" style="--profession:${p.color}" href="./profession.html?p=${p.id}">
      <div class="profession-top"><div><p class="eyebrow">${filled}/9 SLOTS FILLED</p><h3>${p.name}</h3></div><div class="profession-glyph">${p.glyph}</div></div>
      <p>${p.blurb}</p>
      <div class="mini-stats">${TEL.tags(p.focus)}</div>
      <span class="card-link">Open matrix →</span>
    </a>`;
  }).join("");
})().catch(console.error);
