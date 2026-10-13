"use strict";
const squadNames = {guardian:"Guardian",revenant:"Revenant",warrior:"Warrior",engineer:"Engineer",ranger:"Ranger",thief:"Thief",elementalist:"Elementalist",mesmer:"Mesmer",necromancer:"Necromancer"};
document.getElementById("year").textContent = new Date().getFullYear();
const squadText = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
fetch("../data/builds.json").then(response => {if(!response.ok) throw new Error("Unable to load ZERG builds");return response.json();}).then(builds => {
  for (const role of ["damage","support"]) {
    const destination = document.getElementById("squad-"+role);
    const grouped = new Map();
    for (const build of builds) {
      if (String(build.category).toLowerCase() !== role) continue;
      const profession = String(build.profession||"").toLowerCase();
      const specialization = String(build.specialization||"").trim();
      if (!specialization) continue;
      if (!grouped.has(profession)) grouped.set(profession,new Map());
      if (!grouped.get(profession).has(specialization)) grouped.get(profession).set(specialization,build.id);
    }
    const entries = [...grouped].sort((a,b)=>(squadNames[a[0]]||a[0]).localeCompare(squadNames[b[0]]||b[0]));
    destination.innerHTML = entries.map(([profession,specs]) => `<div class="squad-profession"><h4>${squadText(squadNames[profession]||profession)}</h4><div class="squad-chips">${[...specs].sort((a,b)=>a[0].localeCompare(b[0])).map(([name,id])=>`<a href="../build.html?id=${encodeURIComponent(id)}">${squadText(name)}</a>`).join("")}</div></div>`).join("") || '<p class="muted">No builds listed yet.</p>';
  }
}).catch(() => {for(const role of ["damage","support"]) document.getElementById("squad-"+role).textContent="Build reference temporarily unavailable.";});
