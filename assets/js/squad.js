"use strict";
const squadProfessions={guardian:"Guardian",revenant:"Revenant",warrior:"Warrior",engineer:"Engineer",ranger:"Ranger",thief:"Thief",elementalist:"Elementalist",mesmer:"Mesmer",necromancer:"Necromancer"};
// Accept both legacy supportRole and newer squadRoles, as strings or arrays.
const validSupportRoles=new Set(["first","second","third"]);
const rolesFor=build=>{
  const values=[build.supportRole,build.squadRoles].flatMap(value=>Array.isArray(value)?value:[value]);
  return [...new Set(values.flatMap(value=>typeof value==="string"?value.split(","):[]).map(value=>value.trim().toLowerCase()).filter(value=>validSupportRoles.has(value)))];
};
let classIcons={professions:{},specializations:{}};
const iconFor=build=>{
  const spec=String(build.specialization||"").trim().toLowerCase();
  const profession=String(build.profession||"").trim().toLowerCase();
  const path=classIcons.specializations?.[spec]||classIcons.professions?.[profession];
  return typeof path==="string"&&path.startsWith("assets/gw2/classes/")?"../"+path:"";
};
const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const professionName=b=>squadProfessions[String(b.profession||"").toLowerCase()]||String(b.profession||"Unknown");
const buildLink=b=>{
  const icon=iconFor(b);
  return `<a class="squad-build-link" href="../build.html?id=${encodeURIComponent(String(b.id))}">${icon?`<img class="squad-build-icon" src="${escapeHTML(icon)}" alt="" loading="lazy">`:""}<span class="squad-build-label"><span class="squad-build-spec">${escapeHTML(b.specialization||b.name||"Build")}</span><small>${escapeHTML(professionName(b))}</small></span></a>`;
};
const sortBuilds=(a,b)=>professionName(a).localeCompare(professionName(b))||String(a.specialization||"").localeCompare(String(b.specialization||""));
document.getElementById("year").textContent=new Date().getFullYear();
Promise.all([fetch("../data/builds.json").then(r=>{if(!r.ok)throw Error("Could not load ZERG builds");return r.json();}),fetch("../data/gw2-class-icons.json").then(r=>{if(!r.ok)throw Error("Could not load icons");return r.json();}).catch(()=>({}))]).then(([builds,icons])=>{
  classIcons=icons;
  if(!Array.isArray(builds))throw Error("Unexpected build data");
  const supports=builds.filter(b=>String(b.category).toLowerCase()==="support");
  for(const role of ["first","second","third"]){
    const entries=supports.filter(b=>rolesFor(b).includes(role)).sort(sortBuilds);
    document.getElementById("squad-"+role).innerHTML=entries.map(buildLink).join("")||'<span class="squad-loading">No builds assigned</span>';
  }
  const unassigned=supports.filter(b=>rolesFor(b).length===0);
  if(unassigned.length){
    const box=document.createElement("div");box.className="squad-unassigned";
    box.innerHTML=`<strong>Unassigned support builds</strong><div class="squad-builds">${unassigned.sort(sortBuilds).map(buildLink).join("")}</div>`;
    document.querySelector(".squad-columns").after(box);
  }
  const damage=builds.filter(b=>String(b.category).toLowerCase()==="damage").sort(sortBuilds);
  document.getElementById("squad-damage").innerHTML=damage.map(buildLink).join("")||'<span class="squad-loading">No damage builds listed</span>';
  document.getElementById("squad-damage-count").textContent=`(${damage.length})`;
}).catch(error=>{console.warn("Squad build list unavailable",error);for(const id of ["first","second","third","damage"])document.getElementById("squad-"+id).textContent="Build list unavailable";});
