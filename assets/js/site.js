
const GuildBuildPortal={
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
     GuildBuildPortal.json("data/professions.json"),
     GuildBuildPortal.json(buildData),
     GuildBuildPortal.gw2Icons()
   ]);

   const cards=(list)=>list.map(b=>`
     <a class="matrix-build-item" href="build.html?id=${encodeURIComponent(b.id)}&source=${buildSource}">
       ${GuildBuildPortal.iconForBuild(b,icons)?`<img class="spec-icon" src="${GuildBuildPortal.esc(GuildBuildPortal.iconForBuild(b,icons))}" alt="" loading="lazy">`:`<span class="spec-icon spec-icon-placeholder" aria-hidden="true"></span>`}
       <span class="build-label"><strong>${GuildBuildPortal.esc(b.name)}</strong><small>${GuildBuildPortal.esc(b.specialization||"")}</small></span>
     </a>`).join("");

   // Shared with /squad/: each support build can occupy more than one role.
   const supportRoles=b=>{
     const raw=[b.supportRole,b.squadRoles].flatMap(v=>Array.isArray(v)?v:[v]);
     return [...new Set(raw.flatMap(v=>typeof v==="string"?v.split(","):[])
       .map(v=>v.trim().toLowerCase()).filter(v=>["first","second","third"].includes(v)))];
   };
   const cell=(p,role)=>{
     const list=builds.filter(b=>b.profession===p.id&&(
       role==="damage" ? b.category==="damage" :
       b.category==="support"&&supportRoles(b).includes(role)
     ));
     if(!list.length)return `<div class="matrix-cell matrix-empty" data-role="${role}"><span>—</span></div>`;
     return `<div class="matrix-cell matrix-list build-count-${Math.min(list.length,6)}" data-role="${role}">${cards(list)}</div>`;
   };

   const roamingCell=(p)=>{
     const list=builds.filter(x=>x.profession===p.id).slice(0,12);
     if(!list.length)return `<div class="matrix-cell matrix-empty roaming-cell"><span>—</span></div>`;
     return `<div class="matrix-cell matrix-list roaming-cell roaming-count-${list.length}">${cards(list)}</div>`;
   };

   matrix.innerHTML=isRoaming?`
     <div class="matrix-head profession-col">Profession</div>
     <div class="matrix-head">Roaming Builds</div>
     ${professions.map(p=>`
       <div class="matrix-profession" style="--profession:${p.color}">
         <div class="profession-glyph">${icons.professions[p.id]?`<img src="${GuildBuildPortal.esc(icons.professions[p.id])}" alt="" loading="lazy">`:GuildBuildPortal.esc(p.glyph)}</div><strong>${GuildBuildPortal.esc(p.name)}</strong>
       </div>
       ${roamingCell(p)}
     `).join("")}`:`
     <div class="matrix-head profession-col">Profession</div>
     <div class="matrix-head">Damage</div>
     <div class="matrix-head">First Support (Stability)</div>\n     <div class="matrix-head">Second Support (Heal/Cleans)</div>\n     <div class="matrix-head">Third Support (Boons/Utility)</div>
     ${professions.map(p=>`
       <div class="matrix-profession" style="--profession:${p.color}">
         <div class="profession-glyph">${icons.professions[p.id]?`<img src="${GuildBuildPortal.esc(icons.professions[p.id])}" alt="" loading="lazy">`:GuildBuildPortal.esc(p.glyph)}</div><strong>${GuildBuildPortal.esc(p.name)}</strong>
       </div>
       ${cell(p,"damage")}${cell(p,"first")}${cell(p,"second")}${cell(p,"third")}
     `).join("")}`;
 }catch(err){
   console.error(err);
   matrix.innerHTML=`<div class="data-error">
     <strong>Build data could not be loaded.</strong>
     <span>${GuildBuildPortal.esc(err.message)}</span>
     <small>Make sure the entire data folder was uploaded to GitHub Pages.</small>
   </div>`;
 }
})();
