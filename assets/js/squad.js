"use strict";
const squadProfessions={guardian:"Guardian",revenant:"Revenant",warrior:"Warrior",engineer:"Engineer",ranger:"Ranger",thief:"Thief",elementalist:"Elementalist",mesmer:"Mesmer",necromancer:"Necromancer"};
// Each support build declares its own role in data/builds.json using supportRole.
// Missing/invalid assignments are visibly shown under Unassigned instead of guessed.
const validSupportRoles=new Set(["first","second","third"]);
const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const professionName=b=>squadProfessions[String(b.profession||"").toLowerCase()]||String(b.profession||"Unknown");
const buildLink=b=>`<a class="squad-build-link" href="../build.html?id=${encodeURIComponent(String(b.id))}"><span class="squad-build-spec">${escapeHTML(b.specialization||b.name||"Build")}</span><small>${escapeHTML(professionName(b))}</small></a>`;
const sortBuilds=(a,b)=>professionName(a).localeCompare(professionName(b))||String(a.specialization||"").localeCompare(String(b.specialization||""));
document.getElementById("year").textContent=new Date().getFullYear();
fetch("../data/builds.json").then(r=>{if(!r.ok)throw Error("Could not load ZERG builds");return r.json();}).then(builds=>{
  if(!Array.isArray(builds))throw Error("Unexpected build data");
  const supports=builds.filter(b=>String(b.category).toLowerCase()==="support");
  for(const role of ["first","second","third"]){
    const entries=supports.filter(b=>String(b.supportRole||"").toLowerCase()===role).sort(sortBuilds);
    document.getElementById("squad-"+role).innerHTML=entries.map(buildLink).join("")||'<span class="squad-loading">No builds assigned</span>';
  }
  const unassigned=supports.filter(b=>!validSupportRoles.has(String(b.supportRole||"").toLowerCase()));
  if(unassigned.length){
    const box=document.createElement("div");box.className="squad-unassigned";
    box.innerHTML=`<strong>Unassigned support builds</strong><div class="squad-builds">${unassigned.sort(sortBuilds).map(buildLink).join("")}</div>`;
    document.querySelector(".squad-columns").after(box);
  }
  const damage=builds.filter(b=>String(b.category).toLowerCase()==="damage").sort(sortBuilds);
  document.getElementById("squad-damage").innerHTML=damage.map(buildLink).join("")||'<span class="squad-loading">No damage builds listed</span>';
  document.getElementById("squad-damage-count").textContent=`(${damage.length})`;
}).catch(error=>{console.warn("Squad build list unavailable",error);for(const id of ["first","second","third","damage"])document.getElementById("squad-"+id).textContent="Build list unavailable";});
