
const TEL={
 async json(path){const r=await fetch(path);if(!r.ok)throw new Error(`Could not load ${path}`);return r.json();},
 qs(name){return new URLSearchParams(location.search).get(name);},
 tags(items=[]){return items.map(x=>`<span class="tag">${x}</span>`).join("")},
 esc(s=""){const d=document.createElement("div");d.textContent=s;return d.innerHTML;}
};
document.querySelectorAll("#year").forEach(x=>x.textContent=new Date().getFullYear());

(async function(){
 if(document.body.dataset.page!=="home")return;
 const [professions,builds]=await Promise.all([TEL.json("./data/professions.json"),TEL.json("./data/builds.json")]);
 const cell=(p,cat)=>{
   const b=builds.find(x=>x.profession===p.id&&x.category===cat);
   if(!b||b.placeholder)return `<div class="matrix-cell matrix-empty"><span>—</span></div>`;
   return `<a class="matrix-cell matrix-build" href="./build.html?id=${b.id}">
     <strong>${b.title}</strong><small>${b.specialization}</small>
     <span>${(b.weapons||[]).join(" · ")}</span>
   </a>`;
 };
 document.querySelector("#build-matrix").innerHTML=`
   <div class="matrix-head profession-col">Profession</div>
   <div class="matrix-head">Damage</div>
   <div class="matrix-head">Support</div>
   <div class="matrix-head">Additional</div>
   ${professions.map(p=>`
     <div class="matrix-profession" style="--profession:${p.color}">
       <div class="profession-glyph">${p.glyph}</div><strong>${p.name}</strong>
     </div>
     ${cell(p,"damage")}${cell(p,"support")}${cell(p,"additional")}
   `).join("")}`;
})().catch(console.error);
