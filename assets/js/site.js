
const TEL={
 async json(path){
   const r=await fetch(new URL(path, document.baseURI));
   if(!r.ok) throw new Error(`${path} returned HTTP ${r.status}`);
   return r.json();
 },
 qs(name){return new URLSearchParams(location.search).get(name);},
 tags(items=[]){return items.map(x=>`<span class="tag">${x}</span>`).join("")},
 esc(s=""){const d=document.createElement("div");d.textContent=String(s??"");return d.innerHTML;},
 async gw2Icons(){
   if(this._gw2Icons) return this._gw2Icons;
   this._gw2Icons=this.json("data/gw2-class-icons.json").catch(e=>{
     console.warn("Local GW2 class icons unavailable",e);
     return {professions:{},specializations:{}};
   });
   return this._gw2Icons;
 },
 iconForBuild(b,icons){
   const spec=String(b.specialization||"").trim().toLowerCase();
   return (spec && spec!=="core" ? icons.specializations[spec] : null) || icons.professions[String(b.profession||"").toLowerCase()] || "";
 }
};
document.querySelectorAll("#year").forEach(x=>x.textContent=new Date().getFullYear());

(async function(){
 if(!["home","roaming"].includes(document.body.dataset.page))return;
 const isRoaming=document.body.dataset.page==="roaming";
 const buildData=isRoaming?"data/roaming.json":"data/builds.json";
 const buildSource=isRoaming?"roaming":"zerg";
 const matrix=document.querySelector("#build-matrix");
 try{
   const [professions,builds,icons]=await Promise.all([
     TEL.json("data/professions.json"),
     TEL.json(buildData),
     TEL.gw2Icons()
   ]);

   const cell=(p,cat)=>{
     const list=builds.filter(x=>x.profession===p.id&&x.category===cat).slice(0,4);
     if(!list.length)return `<div class="matrix-cell matrix-empty"><span>—</span></div>`;
     return `<div class="matrix-cell matrix-list build-count-${list.length}">${list.map(b=>`
       <a class="matrix-build-item" href="build.html?id=${encodeURIComponent(b.id)}&source=${buildSource}">
         ${TEL.iconForBuild(b,icons)?`<img class="spec-icon" src="${TEL.esc(TEL.iconForBuild(b,icons))}" alt="" loading="lazy">`:`<span class="spec-icon spec-icon-placeholder" aria-hidden="true"></span>`}
         <span class="build-label"><strong>${TEL.esc(b.name)}</strong><small>${TEL.esc(b.specialization||"")}</small></span>
       </a>`).join("")}</div>`;
   };

   matrix.innerHTML=`
     <div class="matrix-head profession-col">Profession</div>
     <div class="matrix-head">Damage</div>
     <div class="matrix-head">Support</div>
     ${professions.map(p=>`
       <div class="matrix-profession" style="--profession:${p.color}">
         <div class="profession-glyph">${icons.professions[p.id]?`<img src="${TEL.esc(icons.professions[p.id])}" alt="" loading="lazy">`:TEL.esc(p.glyph)}</div><strong>${TEL.esc(p.name)}</strong>
       </div>
       ${cell(p,"damage")}${cell(p,"support")}
     `).join("")}`;
 }catch(err){
   console.error(err);
   matrix.innerHTML=`<div class="data-error">
     <strong>Build data could not be loaded.</strong>
     <span>${TEL.esc(err.message)}</span>
     <small>Make sure the entire data folder was uploaded to GitHub Pages.</small>
   </div>`;
 }
})();
