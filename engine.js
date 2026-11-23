window.STATE = {
  day: 1,
  jobsCompleted: 0,
  cash: 65,
  stamina: 100,
  minutes: 345,
  zaps: 0,
  writeUps: 0,
  phase: "DISPATCH",
  zone: "HQ",
  headlampOn: false,
  helperAvailable: true,
  helperHangry: false,
  headlampBattery: 100,
  weather: "78°F CLEAR",
  debuffs: [],
  buffs: [],
  bestiary: [],
  ledger: [],
  collectedReadings: [],
  belt: [],
  vanStock: {
    meter_basic: 1, driver_11: 1, gauges_analog: 1,
    headlamp: 1, psychrometer: 1, batteries: 3,
    filter_std: 3, fuse_3a: 4, wire_box: 2,
    elec_tape: 2, cap_dual: 2, contactor: 2,
    schrader_core: 2, r410a_jug: 2, r22_jug: 1,
    wasp_spray: 2, dog_treats: 2
  },
  currentCase: null,
  jobFlags: {}
};

const WEATHER_TYPES = [
  { label: "78°F CLEAR", stamPenalty: 0 },
  { label: "96°F SCORCHER", stamPenalty: 6 },
  { label: "102°F HUMID SWAMP", stamPenalty: 10 },
  { label: "84°F LIGHT RAIN (WATCH 240V!)", stamPenalty: 4 }
];

function formatClock(totalMins) {
  const hrs24 = Math.floor(totalMins / 60) % 24;
  const mins = totalMins % 60;
  const ampm = hrs24 >= 12 ? "PM" : "AM";
  const hrs12 = hrs24 % 12 === 0 ? 12 : hrs24 % 12;
  return `${String(hrs12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${ampm}`;
}

function getCurrentRank() {
  const ranks = window.GAME_DATA.ranks;
  let current = ranks[0];
  for (const r of ranks) {
    if (STATE.jobsCompleted >= r.minJobs) current = r;
  }
  return current;
}

function getMaxBeltSlots() {
  return STATE.helperAvailable && !STATE.helperHangry ? 6 : 5;
}

function addLog(msg, cls = "good") {
  const feed = document.getElementById("field-log");
  if (!feed) return;
  const div = document.createElement("div");
  div.className = `log-entry ${cls}`;
  div.textContent = `[${formatClock(STATE.minutes)}] ${msg}`;
  feed.prepend(div);
}

function recordReading(line) {
  if (!STATE.collectedReadings.includes(line)) {
    STATE.collectedReadings.push(line);
  }
  const countEl = document.getElementById("readings-count");
  const bodyEl = document.getElementById("collected-readings-body");
  if (countEl) countEl.textContent = `[${STATE.collectedReadings.length} LOGGED]`;
  if (bodyEl) {
    bodyEl.innerHTML = STATE.collectedReadings.length === 0
      ? "No field measurements recorded on this ticket yet."
      : STATE.collectedReadings.map(r => `<div>• ${r}</div>`).join("");
  }
}

function updateHUD() {
  const rank = getCurrentRank();
  const maxBelt = getMaxBeltSlots();
  document.getElementById("company-subtitle").textContent = `${window.GAME_DATA.companyName} • DAY ${STATE.day}`;
  document.getElementById("hud-rank").textContent = `RANK: ${rank.title} (${STATE.jobsCompleted}/55)`;
  document.getElementById("hud-cash").textContent = `CASH: $${STATE.cash}`;
  document.getElementById("hud-stam").textContent = `STAM: ${Math.max(0, STATE.stamina)}%`;
  document.getElementById("hud-clock").textContent = formatClock(STATE.minutes);
  document.getElementById("hud-zaps").textContent = `ZAPS: ${STATE.zaps}/3`;
  document.getElementById("hud-wu").textContent = `WU: ${STATE.writeUps}/2`;
  document.getElementById("hud-belt").textContent = `BELT: ${STATE.belt.length}/${maxBelt}`;
  document.getElementById("hud-zone").textContent = `ZONE: ${STATE.zone}`;
  document.getElementById("weather-label").textContent = STATE.weather;

  const bar = document.getElementById("active-effects-bar");
  bar.innerHTML = "";
  const hTag = document.createElement("span");
  hTag.className = !STATE.helperAvailable || STATE.helperHangry ? "debuff-tag" : "buff-tag";
  hTag.textContent = !STATE.helperAvailable ? "SOLO SHIFT" : (STATE.helperHangry ? "TOBY: HANGRY" : "TOBY: READY");
  bar.appendChild(hTag);

  const lTag = document.createElement("span");
  lTag.className = STATE.headlampBattery <= 20 ? "debuff-tag" : "buff-tag";
  lTag.textContent = `LAMP:${STATE.headlampBattery}%${STATE.headlampOn ? "[ON]" : ""}`;
  bar.appendChild(lTag);

  STATE.buffs.forEach(b => {
    const s = document.createElement("span");
    s.className = "buff-tag";
    s.textContent = b;
    bar.appendChild(s);
  });
  STATE.debuffs.forEach(d => {
    const s = document.createElement("span");
    s.className = "debuff-tag";
    s.textContent = d;
    bar.appendChild(s);
  });

  renderBeltAndVan();
  updateModals();
}
function renderBeltAndVan() {
  const maxBelt = getMaxBeltSlots();
  const canSwap = STATE.phase === "VAN_PREP" || STATE.phase === "DRIVEWAY";
  document.getElementById("belt-capacity-text").textContent = `${STATE.belt.length} / ${maxBelt} SLOTS`;
  document.getElementById("van-location-status").textContent = canSwap ? "ACCESSIBLE" : "LOCKED AT JOB";

  const beltList = document.getElementById("belt-slots-list");
  beltList.innerHTML = "";
  for (let i = 0; i < maxBelt; i++) {
    const itemId = STATE.belt[i];
    const row = document.createElement("div");
    row.className = "slot-row";
    if (itemId) {
      const item = window.GAME_DATA.toolsAndParts[itemId];
      row.innerHTML = `<span>${i === 5 ? "[TOBY] " : ""}${item.name}</span>` +
        (canSwap ? `<span class="slot-remove" onclick="unequipFromBelt(${i})">[X]</span>` : "");
    } else {
      row.innerHTML = `<span>${i === 5 ? "[TOBY SLOT] Empty" : "[EMPTY SLOT]"}</span>`;
    }
    beltList.appendChild(row);
  }

  const vanList = document.getElementById("van-inventory-list");
  vanList.innerHTML = "";
  Object.keys(STATE.vanStock).forEach(id => {
    const qty = STATE.vanStock[id];
    if (qty <= 0) return;
    const item = window.GAME_DATA.toolsAndParts[id];
    const div = document.createElement("div");
    div.className = "inv-item";
    div.innerHTML = `<span>${item.name} (x${qty})</span>` +
      (canSwap ? `<button class="mini-btn" onclick="equipToBelt('${id}')">+BELT</button>` : "");
    vanList.appendChild(div);
  });
}

window.equipToBelt = function(id) {
  if (STATE.belt.length >= getMaxBeltSlots()) {
    addLog("Carry belt is full! Unequip an item first.", "warn");
    return;
  }
  if (!STATE.vanStock[id] || STATE.vanStock[id] <= 0) return;
  STATE.vanStock[id]--;
  STATE.belt.push(id);
  addLog(`Loaded ${window.GAME_DATA.toolsAndParts[id].name} onto carry belt.`, "info");
  updateHUD();
};

window.unequipFromBelt = function(index) {
  const id = STATE.belt[index];
  if (!id) return;
  STATE.belt.splice(index, 1);
  STATE.vanStock[id] = (STATE.vanStock[id] || 0) + 1;
  addLog(`Returned ${window.GAME_DATA.toolsAndParts[id].name} to van rack.`, "info");
  updateHUD();
};

let typeTimer = null;
function setDialogue(speaker, locationTag, text) {
  document.getElementById("speaker-name").textContent = speaker;
  document.getElementById("location-tag").textContent = locationTag;
  const box = document.getElementById("dialogue-box");
  if (typeTimer) clearInterval(typeTimer);
  box.textContent = "";
  let idx = 0;
  typeTimer = setInterval(() => {
    box.textContent += text.charAt(idx);
    idx++;
    if (idx >= text.length) clearInterval(typeTimer);
  }, 14);
}

function updateModals() {
  const bestiaryDiv = document.getElementById("bestiary-list");
  bestiaryDiv.innerHTML = STATE.bestiary.length === 0
    ? "No Phantom Hack-Tech violations logged yet."
    : STATE.bestiary.map(b => `<div style="margin-bottom:4px; border-bottom:1px dashed #1f8a0c;">• ${b}</div>`).join("");

  const ledgerDiv = document.getElementById("ledger-body");
  ledgerDiv.innerHTML = STATE.ledger.length === 0
    ? `<p>Starting Cash: $65 | Jobs: 0 / 55</p>`
    : `<p style="color:var(--amber);">Balance: $${STATE.cash} | Jobs: ${STATE.jobsCompleted}/55</p>` +
      STATE.ledger.slice().reverse().map(l => `<div>${l}</div>`).join("");
}

function addDebuff(name) {
  if (!STATE.debuffs.includes(name)) {
    STATE.debuffs.push(name);
    addLog(`DEBUFF: ${name}!`, "bad");
  }
}

function removeDebuff(name) {
  STATE.debuffs = STATE.debuffs.filter(d => d !== name);
}

function triggerStrikeOrWriteUp(type, reason) {
  if (type === "ZAP") {
    STATE.zaps++;
    STATE.stamina = Math.max(5, STATE.stamina - 25);
    addLog(`⚡ SHOCK (${STATE.zaps}/3): ${reason}`, "bad");
    if (STATE.zaps >= 3) {
      triggerGameOver("TERMINATED: 3 high-voltage shocks. Boss Man revoked your meter.");
      return true;
    }
  } else if (type === "WU") {
    STATE.writeUps++;
    addLog(`📋 WRITE-UP (${STATE.writeUps}/2): ${reason}`, "bad");
    if (STATE.writeUps >= 2) {
      triggerGameOver("FIRED BY BOSS MAN: 2 official write-ups! Turn in your van keys.");
      return true;
    }
  } else if (type === "EPA") {
    triggerGameOver("INSTANT TERMINATION & FEDERAL FINE: Vented refrigerant! EPA Section 608 violation.");
    return true;
  }
  updateHUD();
  return false;
}

function triggerMargeBanter(contextLabel = "DESK") {
  const pool = window.GAME_DATA.margeBanter;
  const roll = Math.random();
  const c = STATE.currentCase;
  STATE.minutes += 5;

  if (roll < 0.36) {
    const line = pool.helpful[Math.floor(Math.random() * pool.helpful.length)];
    STATE.stamina = Math.min(100, STATE.stamina + 15);
    STATE.jobFlags.margeTipBonus = true;
    const hintText = c ? `\n[SECRET HINT: ${c.diagnosisHint}]` : "";
    addLog("Marge slipped you a grandma clue & +15% stamina!", "good");
    setDialogue("MARGE (DISPATCH)", `${contextLabel} // SECRET GRANDMA`, `${line}${hintText}`);
  } else if (roll < 0.68) {
    const line = pool.harsh[Math.floor(Math.random() * pool.harsh.length)];
    addLog("Marge snapped at you to get back to work.", "warn");
    setDialogue("MARGE (DISPATCH)", `${contextLabel} // ASH TRAY`, line);
  } else {
    const line = pool.roast[Math.floor(Math.random() * pool.roast.length)];
    addLog("Marge roasted you mercilessly over comms.", "info");
    setDialogue("MARGE (DISPATCH)", `${contextLabel} // ROASTED`, line);
  }
  updateHUD();
}
function setButtons(btnConfigs, isDarkBlind = false) {
  const container = document.getElementById("action-buttons");
  container.innerHTML = "";
  if (isDarkBlind) {
    container.classList.add("dark-blind");
  } else {
    container.classList.remove("dark-blind");
  }
  btnConfigs.forEach(cfg => {
    const btn = document.createElement("button");
    btn.className = `term-btn ${cfg.cls || ""}`;
    btn.disabled = !!cfg.disabled;
    btn.innerHTML = `<span>${cfg.label}</span><span>${cfg.tag || ""}</span>`;
    btn.onclick = cfg.onClick;
    container.appendChild(btn);
  });
}

function renderWorkOrderCard(show) {
  const card = document.getElementById("work-order-card");
  if (!show || !STATE.currentCase) {
    card.style.display = "none";
    return;
  }
  card.style.display = "flex";
  const c = STATE.currentCase;
  document.getElementById("wo-id").textContent = `[+] WO #${String(STATE.jobsCompleted + 1).padStart(3, "0")} • ${c.tier}${c.isBoss ? " ★BOSS★" : ""}`;
  document.getElementById("wo-cust").textContent = `${c.customer} (${c.archetype})`;
  document.getElementById("wo-sys").textContent = `${c.system} [${c.indoorLoc}]`;
  document.getElementById("wo-complaint").textContent = c.complaint;
  document.getElementById("wo-notes").textContent = c.margeNote;
}

function enterDispatchPhase() {
  STATE.phase = "DISPATCH";
  STATE.zone = "HQ";
  STATE.headlampOn = false;
  STATE.collectedReadings = [];
  recordReading("No field measurements recorded on this ticket yet.");
  STATE.collectedReadings = [];
  document.getElementById("readings-count").textContent = "[0 LOGGED]";
  document.getElementById("success-banner").classList.remove("show");
  document.getElementById("phase-label").textContent = "DISPATCH DESK // MARGE";

  const cases = window.GAME_DATA.cases;
  let nextCase;
  if (STATE.jobsCompleted + 1 >= window.GAME_DATA.bossRetirementJob) {
    nextCase = cases[cases.length - 1];
  } else if (STATE.jobsCompleted < cases.length - 1) {
    nextCase = cases[STATE.jobsCompleted];
  } else {
    // Late career (Jobs 35-54): pull higher-tier Journeyman/Senior Lead calls
    const highTier = cases.slice(20, cases.length - 1);
    nextCase = highTier[(STATE.jobsCompleted - 34) % highTier.length];
  }

  STATE.currentCase = nextCase;
  STATE.jobFlags = {
    disconnectPulled: false, verifiedDead: false, tstatChecked: false,
    airflowChecked: false, gaugesHooked: false, leakChecked: false,
    snifferBonus: false, hazardCleared: false, filterDone: false,
    wireFixed: false, capDone: false, drainFixed: false,
    repaired: false, awaitingPartsTagged: false, redTagged: false,
    usedTapeShortcut: false, margeTipBonus: false, distractionTip: 0
  };

  renderWorkOrderCard(true);
  setDialogue(
    "MARGE (DISPATCH)",
    `HQ // BAY ${STATE.day}`,
    `*coughs into coffee mug* Ticket #${STATE.jobsCompleted + 1}: ${nextCase.customer}.\n"${nextCase.margeNote}"\nTap [+] WO above for specs, or gear up in your van.`
  );

  setButtons([
    {
      label: "GO TO VAN (GEAR UP CARRY BELT)",
      tag: "[VAN]",
      cls: "amber-btn",
      onClick: () => enterVanPrepPhase()
    },
    {
      label: "SHOOT THE BREEZE WITH MARGE (RNG BANTER)",
      tag: "[+5 MIN]",
      cls: "cyan-btn",
      onClick: () => triggerMargeBanter("HQ DESK")
    },
    {
      label: "CHUG 'VOLT-ACID 24V' ENERGY DRINK (+45 STAM)",
      tag: "[$4]",
      disabled: STATE.cash < 4,
      onClick: () => {
        STATE.cash -= 4;
        STATE.stamina = Math.min(100, STATE.stamina + 45);
        addDebuff("JITTERS");
        addLog("Chugged VOLT-ACID 24V! Stamina +45%, hands shaking.", "warn");
        updateHUD();
      }
    }
  ]);
  updateHUD();
}

function enterVanPrepPhase() {
  STATE.phase = "VAN_PREP";
  STATE.zone = "VAN";
  document.getElementById("phase-label").textContent = "SERVICE VAN // BAY LOADING";

  if (STATE.vanStock.cap_dual > 0 && Math.random() < 0.12) {
    STATE.vanStock.cap_dual--;
    addLog("Night shift swiped a Turbo-Boost Dual Cap from your van!", "warn");
  }

  setDialogue(
    "VAN #31 // LOADOUT",
    "HQ PARKING LOT",
    `Switch to [VAN & BELT] tab to load up to ${getMaxBeltSlots()} items.\nIndoor Loc: ${STATE.currentCase.indoorLoc}`
  );

  const actions = [
    {
      label: "DRIVE TO JOB SITE",
      tag: "[+20 MIN]",
      cls: "amber-btn",
      onClick: () => {
        STATE.minutes += 20;
        enterDrivewayPhase();
      }
    }
  ];

  if (STATE.debuffs.some(d => ["DRAIN SLIME FACE", "SOOT FACE", "ATTIC ITCH"].includes(d))) {
    actions.push({
      label: "SCRUB UP WITH GOJO WIPES AT VAN",
      tag: "[CLEAN]",
      onClick: () => {
        removeDebuff("DRAIN SLIME FACE");
        removeDebuff("SOOT FACE");
        removeDebuff("ATTIC ITCH");
        addLog("Washed face & arms clean at the van!", "good");
        enterVanPrepPhase();
      }
    });
  }

  if (STATE.headlampBattery < 100 && STATE.vanStock.batteries > 0) {
    actions.push({
      label: "SWAP FRESH AAs INTO HEADLAMP",
      tag: "[1 PACK]",
      onClick: () => {
        STATE.vanStock.batteries--;
        STATE.headlampBattery = 100;
        addLog("Headlamp batteries replaced (100%).", "good");
        enterVanPrepPhase();
      }
    });
  }

  setButtons(actions);
  updateHUD();
}

function enterDrivewayPhase() {
  STATE.phase = "DRIVEWAY";
  STATE.zone = "DRIVEWAY";
  STATE.headlampOn = false;
  document.getElementById("phase-label").textContent = "CURBSIDE // CHECK BELT";
  const c = STATE.currentCase;

  setDialogue(
    "ARRIVED AT SITE",
    c.customer.toUpperCase(),
    `Parked curbside. Belt: ${STATE.belt.length}/${getMaxBeltSlots()} items.\nIndoor Equipment: ${c.indoorLoc}`
  );

  setButtons([
    {
      label: "KNOCK ON DOOR & ENTER INDOOR ZONE",
      tag: "[INDOOR]",
      cls: "amber-btn",
      onClick: () => enterJobSitePhase("INDOOR", true)
    },
    {
      label: "WALK STRAIGHT TO OUTDOOR CONDENSER",
      tag: "[OUTDOOR]",
      cls: "cyan-btn",
      onClick: () => enterJobSitePhase("OUTDOOR", true)
    }
  ]);
  updateHUD();
}
function hasBeltItem(id) {
  if (id === "gauges_analog" && STATE.belt.includes("gauges_digital")) return true;
  return STATE.belt.includes(id);
}

function consumeBeltOrVanPart(id) {
  const bIdx = STATE.belt.indexOf(id);
  if (bIdx !== -1) {
    STATE.belt.splice(bIdx, 1);
    return true;
  }
  return false;
}

function isDarkBlinded() {
  const c = STATE.currentCase;
  if (!c) return false;
  return STATE.zone === "INDOOR" && c.darkIndoor && (!STATE.headlampOn || STATE.headlampBattery <= 0 || !hasBeltItem("headlamp"));
}

function applyDarkHeadBumpIfNeeded() {
  if (isDarkBlinded()) {
    STATE.stamina = Math.max(5, STATE.stamina - 8);
    addLog("THUD! Pitch-black attic/basement—you bumped your head! (-8% STAM. Turn Headlamp ON!)", "bad");
    return true;
  }
  return false;
}

function maybeTriggerCustomerDistraction(nextCallback) {
  if (Math.random() > 0.32) {
    nextCallback();
    return;
  }
  const pool = window.GAME_DATA.customerDistractions;
  const dist = pool[Math.floor(Math.random() * pool.length)];
  setDialogue(dist.speaker, `DISTRACTION // ${STATE.zone}`, `"${dist.text}"`);
  setButtons([
    {
      label: dist.focusLabel,
      tag: "[FOCUS]",
      cls: "amber-btn",
      onClick: () => {
        addLog("Stayed focused on SOP.", "info");
        nextCallback();
      }
    },
    {
      label: dist.chatLabel,
      tag: "[+10M]",
      cls: "cyan-btn",
      onClick: () => {
        STATE.minutes += 10;
        STATE.jobFlags.distractionTip += dist.tipBonus;
        addLog(dist.chatResult, "warn");
        nextCallback();
      }
    }
  ], isDarkBlinded());
}

function enterJobSitePhase(targetZone = "INDOOR", isFirst = false) {
  STATE.phase = "JOB_SITE";
  STATE.zone = targetZone;
  const c = STATE.currentCase;
  if (targetZone === "OUTDOOR") STATE.headlampOn = false;

  document.getElementById("phase-label").textContent =
    targetZone === "INDOOR" ? `INDOOR // ${c.indoorLoc.toUpperCase()}` : "OUTDOOR // CONDENSER";

  if (c.hackLore && !STATE.bestiary.includes(c.hackLore)) {
    STATE.bestiary.push(c.hackLore);
    addLog("NEW ENTRY IN HACK-TECH BESTIARY!", "warn");
  }

  let msg = isFirst ? `${c.customer}: "${c.doorGreeting}"\n` : `Moved to ${targetZone} zone.\n`;
  if (targetZone === "INDOOR" && c.darkIndoor) {
    msg += isDarkBlinded()
      ? "🌑 PITCH BLACK! Turn Dumbacell Headlamp ON before moving or bump your head!"
      : "🔦 Dumbacell Headlamp lighting workspace.";
  }
  if (c.hazard && !STATE.jobFlags.hazardCleared) {
    msg += `\n⚠️ HAZARD: ${c.hazard.text}`;
  }

  setDialogue(targetZone === "INDOOR" ? "INDOOR ZONE" : "OUTDOOR ZONE", c.system, msg);
  renderJobActions();
  updateHUD();
}
function renderJobActions() {
  const c = STATE.currentCase;
  const actions = [];
  const darkBlind = isDarkBlinded();

  if (STATE.zone === "INDOOR" && c.darkIndoor) {
    const hasLamp = hasBeltItem("headlamp");
    actions.push({
      label: !hasLamp
        ? "NO HEADLAMP ON BELT! (GET FROM VAN)"
        : (STATE.headlampOn ? "TURN HEADLAMP OFF" : "CLICK HEADLAMP ON (ILLUMINATE)"),
      tag: hasLamp ? `[${STATE.headlampBattery}%]` : "[NONE]",
      cls: STATE.headlampOn ? "cyan-btn" : "amber-btn lamp-rescue",
      disabled: !hasLamp || STATE.headlampBattery <= 0,
      onClick: () => {
        STATE.headlampOn = !STATE.headlampOn;
        addLog(STATE.headlampOn ? "Headlamp clicked ON." : "Headlamp turned OFF.", "info");
        enterJobSitePhase("INDOOR", false);
      }
    });
  }

  if (c.hazard && !STATE.jobFlags.hazardCleared) {
    if (c.hazard.type === "wasps_and_dog" && (hasBeltItem("wasp_spray") || hasBeltItem("dog_treats"))) {
      actions.push({
        label: "USE WASP SPRAY / DOG TREATS",
        tag: "[CLEAR]",
        cls: "amber-btn",
        onClick: () => {
          consumeBeltOrVanPart("wasp_spray");
          consumeBeltOrVanPart("dog_treats");
          STATE.jobFlags.hazardCleared = true;
          addLog("Cleared wasps & calmed dog!", "good");
          enterJobSitePhase(STATE.zone, false);
        }
      });
    }
    actions.push({
      label: "PUSH PAST HAZARD",
      tag: `[-${c.hazard.stamCost}%]`,
      cls: "danger-btn",
      onClick: () => {
        applyDarkHeadBumpIfNeeded();
        STATE.stamina = Math.max(5, STATE.stamina - c.hazard.stamCost);
        STATE.jobFlags.hazardCleared = true;
        if (c.hazard.type === "attic_fiberglass") addDebuff("ATTIC ITCH");
        if (c.hazard.type === "soot_puffback") addDebuff("SOOT FACE");
        addLog(`Braved hazard (-${c.hazard.stamCost}% stam).`, "warn");
        enterJobSitePhase(STATE.zone, false);
      }
    });
  }

  if (STATE.zone === "INDOOR") {
    actions.push({
      label: "1. CHECK THERMOSTAT CONTROLS",
      tag: "[+5M]",
      onClick: () => {
        applyDarkHeadBumpIfNeeded();
        STATE.minutes += 5;
        if (STATE.headlampOn) STATE.headlampBattery = Math.max(0, STATE.headlampBattery - 5);
        STATE.jobFlags.tstatChecked = true;
        const txt = c.readings.tstat || "Thermostat calling normally.";
        recordReading(`T-Stat: ${txt}`);
        addLog(`T-Stat: ${txt}`, "info");
        maybeTriggerCustomerDistraction(() => {
          setDialogue("INDOOR // T-STAT", c.system, txt);
          renderJobActions();
          updateHUD();
        });
      }
    });

    actions.push({
      label: "2. CHECK FILTER, COIL, DRAIN & DELTA-T",
      tag: "[+10M]",
      onClick: () => {
        applyDarkHeadBumpIfNeeded();
        STATE.minutes += 10;
        if (STATE.headlampOn) STATE.headlampBattery = Math.max(0, STATE.headlampBattery - 8);
        STATE.jobFlags.airflowChecked = true;
        const dt = c.readings.deltaT !== undefined ? `${c.readings.deltaT}°F` : "N/A";
        const extra = c.readings.filter || c.readings.coil || c.readings.drain || c.readings.staticPressure || c.readings.indoor || c.readings.sequence || c.readings.co_ppm || "Indoor cabinet & drain clean.";
        recordReading(`Indoor (${dt}): ${extra}`);
        addLog(`Indoor (${dt}): ${extra}`, "info");
        maybeTriggerCustomerDistraction(() => {
          setDialogue("INDOOR // AIR HANDLER", c.indoorLoc, `Delta-T: ${dt}\n${extra}`);
          renderJobActions();
          updateHUD();
        });
      }
    });
    actions.push({
      label: "3. TEST INDOOR BOARD / 24V / FLAME SENSOR",
      tag: "[METER]",
      disabled: !hasBeltItem("meter_basic"),
      onClick: () => {
        applyDarkHeadBumpIfNeeded();
        STATE.minutes += 8;
        if (STATE.headlampOn) STATE.headlampBattery = Math.max(0, STATE.headlampBattery - 6);
        const elec = c.readings.board || c.readings.sequence || c.readings.co_ppm || c.readings.indoor || "Indoor 24V circuit verified.";
        recordReading(`Indoor Meter: ${elec}`);
        addLog(`Indoor Meter: ${elec}`, "info");
        setDialogue("INDOOR // METER", c.indoorLoc, elec);
        updateHUD();
      }
    });

    actions.push({
      label: "STEP OUTSIDE TO CONDENSER >>",
      tag: "[OUTDOOR]",
      cls: "cyan-btn",
      onClick: () => enterJobSitePhase("OUTDOOR", false)
    });
  } else {
    actions.push({
      label: STATE.jobFlags.disconnectPulled ? "1. PLUG DISCONNECT IN (240V LIVE)" : "1. PULL DISCONNECT (LOTO)",
      tag: "[LOTO]",
      cls: STATE.jobFlags.disconnectPulled ? "amber-btn" : "",
      onClick: () => {
        STATE.jobFlags.disconnectPulled = !STATE.jobFlags.disconnectPulled;
        if (!STATE.jobFlags.disconnectPulled) STATE.jobFlags.verifiedDead = false;
        addLog(STATE.jobFlags.disconnectPulled ? "Pulled disconnect (OFF)." : "Plugged disconnect in (LIVE).", "info");
        renderJobActions();
      }
    });

    actions.push({
      label: "2. TEST OUTDOOR VOLTS / OHMS / CAP",
      tag: "[METER]",
      disabled: !hasBeltItem("meter_basic"),
      onClick: () => {
        STATE.minutes += 10;
        if (STATE.jobFlags.disconnectPulled) STATE.jobFlags.verifiedDead = true;
        const elec = c.readings.l1_l2 || c.readings.cap_mf || c.readings.contactor || c.readings.ohms || c.readings.outdoor_24v || c.readings.disconnect || c.readings.amps || "240V L1-L2 & contactor verified.";
        recordReading(`Outdoor Meter: ${elec}`);
        addLog(`Outdoor Meter: ${elec}`, "info");
        maybeTriggerCustomerDistraction(() => {
          setDialogue("OUTDOOR // METER", "CONDENSER", elec);
          renderJobActions();
          updateHUD();
        });
      }
    });

    actions.push({
      label: "3. HOOK UP MANIFOLD GAUGES",
      tag: "[GAUGES]",
      disabled: !hasBeltItem("gauges_analog"),
      onClick: () => {
        STATE.minutes += 10;
        STATE.jobFlags.gaugesHooked = true;
        if (!STATE.jobFlags.airflowChecked && (c.faultType === "clogged_filter" || c.faultType === "frozen_coil_airflow")) {
          addLog("⚠️ TRAP: Gauges hooked BEFORE checking airflow! Low suction is airflow—DO NOT add gas!", "warn");
        }
        if (c.readings.coil) recordReading(`Condenser Coil: ${c.readings.coil}`);
        openGaugeModal(c);
        updateHUD();
      }
    });

    actions.push({
      label: "<< GO INSIDE TO T-STAT & AIR HANDLER",
      tag: "[INDOOR]",
      cls: "cyan-btn",
      onClick: () => enterJobSitePhase("INDOOR", false)
    });
  }

  actions.push({
    label: "OPEN REPAIR / TAG-OUT MENU >>",
    tag: "[FIX]",
    cls: "amber-btn",
    onClick: () => renderRepairMenu()
  });

  setButtons(actions, darkBlind);
}
function openGaugeModal(c) {
  const isDigital = hasBeltItem("gauges_digital");
  const hasSniffer = hasBeltItem("sniffer");
  const titleEl = document.getElementById("tool-modal-title");
  const bodyEl = document.getElementById("tool-modal-body");

  titleEl.textContent = isDigital ? "SMAC-MANIFOLD DIGITAL" : "YELL-O-JACKET ANALOG";
  const sPsi = c.readings.suctionPsi || 0;
  const hPsi = c.readings.headPsi || 0;
  const sTemp = c.readings.suctionTemp || "--";
  const lTemp = c.readings.liquidTemp || "--";

  let digitalBonus = "";
  if (isDigital && sPsi > 0) {
    const isR22 = c.system.includes("R-22");
    const satEvap = isR22 ? Math.round(30 + (sPsi - 55) * 0.68) : Math.round(30 + (sPsi - 97) * 0.43);
    const satCond = isR22 ? Math.round(95 + (hPsi - 182) * 0.31) : Math.round(95 + (hPsi - 296) * 0.2);
    const sh = typeof sTemp === "number" ? `${sTemp - satEvap}°F` : "N/A";
    const sc = typeof lTemp === "number" ? `${satCond - lTemp}°F` : "N/A";
    recordReading(`Gauges: ${sPsi}/${hPsi} PSIG | SH:${sh} SC:${sc}`);
    digitalBonus = `<div style="margin-top:4px; padding:4px; border:1px solid var(--amber); color:var(--amber);">
      AUTO-CALC: Evap ${satEvap}°F | Cond ${satCond}°F | <strong>SH: ${sh}</strong> | <strong>SC: ${sc}</strong>
    </div>`;
  } else {
    recordReading(`Gauges: ${sPsi}/${hPsi} PSIG (S:${sTemp}°F L:${lTemp}°F)`);
    digitalBonus = `<div style="margin-top:4px; color:var(--cyan);">
      Analog: Tap [PT] at top to calculate SH &amp; SC!
    </div>`;
  }

  const leakBtn = hasSniffer
    ? "[HISS-SNIFFER LEAK SWEEP (+$15)]"
    : "[SOAP BUBBLE LEAK CHECK]";

  bodyEl.innerHTML = `
    <div class="gauge-dial-grid">
      <div class="gauge-dial">
        <div>SUCTION</div>
        <div class="gauge-psi" style="color:var(--cyan);">${sPsi} PSIG</div>
        <div>Line: ${sTemp}°F</div>
      </div>
      <div class="gauge-dial high-side">
        <div>LIQUID</div>
        <div class="gauge-psi" style="color:var(--danger);">${hPsi} PSIG</div>
        <div>Line: ${lTemp}°F</div>
      </div>
    </div>
    ${digitalBonus}
    <div style="margin-top:6px; display:flex; flex-direction:column; gap:4px;">
      <button class="term-btn" onclick="STATE.jobFlags.leakChecked=true; if(hasBeltItem('sniffer')){STATE.jobFlags.snifferBonus=true; addLog('Hiss-Sniffer found trace (+$15 bonus)!','good');}else{addLog('Checked joints with soap bubbles.','info');} closeModal('modal-tool');">
        <span>${leakBtn}</span><span>[LEAK]</span>
      </button>
      <button class="term-btn danger-btn" onclick="closeModal('modal-tool'); triggerStrikeOrWriteUp('EPA', 'You vented refrigerant to the atmosphere!');">
        <span>VENT REFRIGERANT TO AIR (ILLEGAL)</span><span>[EPA]</span>
      </button>
    </div>
  `;
  openModal("modal-tool");
}

function checkMultiStepCompletion(c) {
  if (c.faultType === "stacked_filter_and_cap" && STATE.jobFlags.filterDone && STATE.jobFlags.capDone) {
    STATE.jobFlags.repaired = true;
    addLog("MULTI-STEP COMPLETE: Filter AND capacitor replaced!", "good");
  } else if (c.faultType === "hack_jumper_and_cap" && STATE.jobFlags.wireFixed && STATE.jobFlags.capDone) {
    STATE.jobFlags.repaired = true;
    addLog("MULTI-STEP COMPLETE: Jumper removed & fan cap replaced!", "good");
  } else if (c.faultType === "boss_vape_dungeon" && STATE.jobFlags.drainFixed && STATE.jobFlags.wireFixed && STATE.jobFlags.capDone) {
    STATE.jobFlags.repaired = true;
    addLog("BOSS MULTI-STEP COMPLETE: Drain, 24V wire, and fuse fixed!", "good");
  } else if (c.faultType === "boss_bunker_multi" && STATE.jobFlags.drainFixed && STATE.jobFlags.capDone) {
    STATE.jobFlags.repaired = true;
    addLog("BUNKER BOSS COMPLETE: Contactor, fuse, and P-trap fixed!", "good");
  }
}
function renderRepairMenu() {
  const c = STATE.currentCase;
  const darkBlind = isDarkBlinded();
  setDialogue(
    "REPAIR & TAG-OUT MENU",
    `${STATE.zone} // ${c.system}`,
    `Pick the exact repair for ${c.customer}. Pull disconnect before 240V work—plug back in before finishing!`
  );

  const repairs = [
    {
      label: "T-STAT SETTINGS / DUMBACELL AAs / O-B WIRE",
      tag: "[T-STAT]",
      onClick: () => {
        applyDarkHeadBumpIfNeeded();
        if (c.faultType === "tstat_batteries") {
          if (!consumeBeltOrVanPart("batteries")) {
            addLog("Need Dumbacell AA Pack on belt!", "bad");
            return;
          }
          STATE.jobFlags.repaired = true;
          addLog("Installed fresh Dumbacell AAs!", "good");
        } else if (c.faultType === "tstat_wrong_mode" || c.faultType === "fan_on_not_auto") {
          STATE.jobFlags.repaired = true;
          addLog("Set T-Stat to COOL & FAN to AUTO!", "good");
        } else if (c.faultType === "reversing_valve_o_b") {
          STATE.jobFlags.repaired = true;
          addLog("Rewired reversing valve O to B!", "good");
        } else {
          addLog("T-Stat checked, root fault still present.", "warn");
        }
        renderRepairMenu();
      }
    },
    {
      label: "FILTER / THAW COIL / CLEAR DRAIN / CLEAN FLAME ROD",
      tag: "[AIR/HEAT]",
      onClick: () => {
        applyDarkHeadBumpIfNeeded();
        if (["float_switch_clog", "clogged_ptrap_drain", "boss_vape_dungeon", "boss_bunker_multi"].includes(c.faultType)) {
          if (!STATE.jobFlags.airflowChecked) {
            addDebuff("DRAIN SLIME FACE");
            addLog("SPLASH! Pulled float cap without checking pressure—slime sprayed your face!", "bad");
          }
          STATE.jobFlags.drainFixed = true;
          if (!["boss_vape_dungeon", "boss_bunker_multi"].includes(c.faultType)) {
            STATE.jobFlags.repaired = true;
          }
          addLog("Cleared condensate drain & reset switch!", "good");
          checkMultiStepCompletion(c);
        } else if (["clogged_filter", "frozen_coil_airflow", "stacked_filter_and_cap"].includes(c.faultType)) {
          if (!consumeBeltOrVanPart("filter_std")) {
            addLog("Need MERV-8 Filter on belt!", "bad");
            return;
          }
          STATE.jobFlags.filterDone = true;
          if (c.faultType !== "stacked_filter_and_cap") STATE.jobFlags.repaired = true;
          addLog("Thawed coil & installed fresh MERV-8 filter!", "good");
          checkMultiStepCompletion(c);
        } else if (c.faultType === "dirty_flame_sensor") {
          STATE.jobFlags.repaired = true;
          addLog("Buffed flame sensor rod with emery cloth (3.8 μA DC)!", "good");
        } else if (["dirty_condenser_coil", "high_static_choked_return"].includes(c.faultType)) {
          STATE.jobFlags.repaired = true;
          addLog("Cleared coil / return airflow restriction!", "good");
        } else {
          addLog("Airflow & burners inspected.", "info");
        }
        renderRepairMenu();
      }
    },
    {
      label: "SPLICE WIRES WITH WIRE BOX (OR ELEC TAPE)",
      tag: "[WIRING]",
      onClick: () => {
        applyDarkHeadBumpIfNeeded();
        if (consumeBeltOrVanPart("wire_box")) {
          if (["chewed_tstat_wire", "hack_jumper_and_cap", "rubbed_whip_short", "boss_vape_dungeon"].includes(c.faultType)) {
            STATE.jobFlags.wireFixed = true;
            if (["chewed_tstat_wire", "rubbed_whip_short"].includes(c.faultType)) STATE.jobFlags.repaired = true;
            addLog("Spliced 24V wires cleanly with wire nuts!", "good");
            checkMultiStepCompletion(c);
          }
        } else if (consumeBeltOrVanPart("elec_tape")) {
          STATE.jobFlags.wireFixed = true;
          STATE.jobFlags.usedTapeShortcut = true;
          if (["chewed_tstat_wire", "rubbed_whip_short"].includes(c.faultType)) STATE.jobFlags.repaired = true;
          addLog("Wrapped bare wires in elec tape (callback risk)!", "warn");
          checkMultiStepCompletion(c);
        } else {
          addLog("Need Wire Box or Elec Tape on belt!", "bad");
        }
        renderRepairMenu();
      }
    },
    {
      label: "SWAP CAPACITOR / CONTACTOR / FUSE / BREAKER",
      tag: "[240V/24V]",
      onClick: () => {
        applyDarkHeadBumpIfNeeded();
        const hvFaults = ["bad_dual_cap", "ant_contactor", "shorted_contactor_coil", "blower_cap_dead", "hack_jumper_and_cap", "stacked_filter_and_cap", "boss_bunker_multi", "boss_finale_rooftop"];
        if (hvFaults.includes(c.faultType) && !STATE.jobFlags.disconnectPulled) {
          if (triggerStrikeOrWriteUp("ZAP", "Grabbed 240V capacitor/contactor without pulling disconnect!")) return;
          return;
        }
        if (c.requiredPart && ["cap_dual", "contactor", "fuse_3a"].includes(c.requiredPart)) {
          if (!consumeBeltOrVanPart(c.requiredPart)) {
            addLog(`Missing ${window.GAME_DATA.toolsAndParts[c.requiredPart].name} on belt!`, "bad");
            return;
          }
        }
        if (c.extraPart === "fuse_3a" && !consumeBeltOrVanPart("fuse_3a")) {
          addLog("Missing 3A Blade Fuse on belt!", "bad");
          return;
        }
        if (c.extraPart === "cap_dual" && !consumeBeltOrVanPart("cap_dual")) {
          addLog("Missing Dual Capacitor on belt!", "bad");
          return;
        }
        STATE.jobFlags.capDone = true;
        if (!["stacked_filter_and_cap", "hack_jumper_and_cap", "boss_vape_dungeon", "boss_bunker_multi"].includes(c.faultType)) {
          STATE.jobFlags.repaired = true;
        }
        addLog("Electrical component / fuse / breaker restored!", "good");
        checkMultiStepCompletion(c);
        renderRepairMenu();
      }
    },
    {
      label: "REPAIR LEAK / WEIGH IN GAS / RECOVER EXCESS",
      tag: "[REFRIG]",
      onClick: () => {
        if (["clogged_filter", "frozen_coil_airflow"].includes(c.faultType)) {
          triggerStrikeOrWriteUp("WU", "Dumped refrigerant into an airflow-starved system!");
          return;
        }
        if (c.requiredPart === "r410a_jug" && !consumeBeltOrVanPart("r410a_jug")) {
          addLog("Need Rose-410A Jug on belt!", "bad");
          return;
        }
        if (c.extraPart === "r410a_jug" && !consumeBeltOrVanPart("r410a_jug")) {
          addLog("Need Rose-410A Jug on belt!", "bad");
          return;
        }
        if (c.requiredPart === "schrader_core" && !consumeBeltOrVanPart("schrader_core")) {
          addLog("Need Schrader Core + Tool on belt!", "bad");
          return;
        }
        STATE.jobFlags.repaired = true;
        addLog("Refrigerant circuit serviced & weighed to target SH/SC!", "good");
        renderRepairMenu();
      }
    },
    {
      label: "TAG 'AWAITING PARTS' OR 'RED TAG UNSAFE FURNACE'",
      tag: "[TAG-OUT]",
      cls: "amber-btn",
      onClick: () => {
        if (c.awaitingParts) {
          STATE.jobFlags.awaitingPartsTagged = true;
          STATE.jobFlags.repaired = true;
          addLog("Logged special-order part as AWAITING PARTS!", "good");
        } else if (c.mustRedTag) {
          STATE.jobFlags.redTagged = true;
          STATE.jobFlags.repaired = true;
          addLog("RED-TAGGED cracked heat exchanger & locked out gas!", "good");
        } else {
          addLog("Repairable on-site—don't falsely tag out!", "warn");
        }
        renderRepairMenu();
      }
    },
    { label: "<< BACK TO DIAGNOSTICS", onClick: () => renderJobActions() },
    { label: "COMPLETE WORK ORDER >>", tag: "[FINISH]", cls: "amber-btn", onClick: () => attemptCompleteWorkOrder() }
  ];

  setButtons(repairs, darkBlind);
}
function attemptCompleteWorkOrder() {
  const c = STATE.currentCase;

  if (STATE.jobFlags.disconnectPulled && !c.mustRedTag) {
    STATE.minutes += 20;
    STATE.jobFlags.disconnectPulled = false;
    triggerStrikeOrWriteUp("WU", `CALLBACK! Marge radioed: "${c.customer}'s AC is dead—you left the disconnect pulled!"`);
    return;
  }

  if (!STATE.jobFlags.repaired) {
    triggerStrikeOrWriteUp("WU", `INCOMPLETE REPAIR! Closed ${c.customer}'s ticket without fixing: ${c.diagnosisHint}`);
    return;
  }

  if (STATE.jobFlags.usedTapeShortcut && Math.random() < 0.5) {
    triggerStrikeOrWriteUp("WU", "CALLBACK! Your electrical tape splice melted loose in the afternoon heat!");
    return;
  }

  STATE.jobsCompleted++;
  STATE.minutes += 25;
  STATE.headlampOn = false;
  const weatherObj = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
  STATE.weather = weatherObj.label;
  STATE.stamina = Math.max(10, STATE.stamina - (10 + weatherObj.stamPenalty));

  const hasFaceDebuff = STATE.debuffs.includes("DRAIN SLIME FACE") || STATE.debuffs.includes("SOOT FACE");
  const baseTip = hasFaceDebuff ? 0 : (c.tip || 0) + (STATE.jobFlags.distractionTip || 0);
  const snifferExtra = STATE.jobFlags.snifferBonus ? 15 : 0;
  const margeExtra = STATE.jobFlags.margeTipBonus ? 10 : 0;
  const rankBonus = Math.round(getCurrentRank().payPerJob * 0.25);
  const totalEarned = c.reward + baseTip + snifferExtra + margeExtra + rankBonus;

  STATE.cash += totalEarned;
  STATE.ledger.push(`Job #${STATE.jobsCompleted} (${c.customer}): +$${totalEarned}`);

  if (STATE.jobsCompleted >= window.GAME_DATA.bossRetirementJob || c.isFinale) {
    triggerVictoryFinale(totalEarned);
    return;
  }

  document.getElementById("success-title").textContent = `SUCCESS! TICKET #${STATE.jobsCompleted} (+$${totalEarned})`;
  document.getElementById("success-summary").textContent = `${c.diagnosisHint} | Tip: +$${baseTip}${snifferExtra ? " | Sniffer: +$15" : ""}`;
  document.getElementById("success-banner").classList.add("show");
  addLog(`SUCCESS! Closed ${c.customer}'s ticket (+$${totalEarned}).`, "good");

  window.nextAfterSuccess = () => {
    document.getElementById("success-banner").classList.remove("show");
    if (STATE.minutes >= 690 && STATE.minutes <= 810 && !STATE.hadLunchToday) {
      STATE.hadLunchToday = true;
      enterLunchAndSupplyPhase();
    } else if (STATE.minutes >= 1020) {
      STATE.day++;
      STATE.minutes = 345;
      STATE.stamina = 100;
      STATE.hadLunchToday = false;
      STATE.helperHangry = false;
      removeDebuff("JITTERS");
      addLog(`SHIFT OVER! Starting Day ${STATE.day} at 05:45 AM.`, "info");
      enterDispatchPhase();
    } else {
      enterDispatchPhase();
    }
  };
  updateHUD();
}

function enterLunchAndSupplyPhase() {
  STATE.phase = "LUNCH_SHOP";
  STATE.zone = "SUPPLY";
  document.getElementById("phase-label").textContent = "LUNCH & FERGIE'S SUPPLY";
  const helperForgotLunch = STATE.helperAvailable && Math.random() < 0.45;

  let text = "Midday stop outside FERGIE'S SUPPLY & CIRCLE-K.O.\n";
  text += helperForgotLunch
    ? "⚠️ TOBY: \"Uh, boss... I left my lunch on my Civic's hood. Spot me $9?\""
    : "Restock van parts, buy upgrades, or grab lunch!";

  setDialogue("MIDDAY BREAK // SUPPLY", "FERGIE'S SUPPLY", text);

  setButtons([
    {
      label: "BUY LUNCH FOR YOU & TOBY (+40% STAM)",
      tag: "[$14]",
      disabled: STATE.cash < 14,
      cls: "amber-btn",
      onClick: () => {
        STATE.cash -= 14;
        STATE.stamina = Math.min(100, STATE.stamina + 40);
        STATE.helperHangry = false;
        removeDebuff("JITTERS");
        addLog("Bought burgers for you & Toby! +40% Stamina.", "good");
        enterDispatchPhase();
      }
    },
    {
      label: "ROLLER DOG FOR YOURSELF ONLY (+25% STAM)",
      tag: "[$5]",
      disabled: STATE.cash < 5,
      onClick: () => {
        STATE.cash -= 5;
        STATE.stamina = Math.min(100, STATE.stamina + 25);
        if (helperForgotLunch) {
          STATE.helperHangry = true;
          addLog("Toby is HANGRY (-1 Carry Slot)!", "warn");
        }
        enterDispatchPhase();
      }
    },
    {
      label: "RESTOCK VAN PARTS (FILTER, FUSE, CAP, WIRE, GAS, AAs)",
      tag: "[$45]",
      disabled: STATE.cash < 45,
      onClick: () => {
        STATE.cash -= 45;
        STATE.vanStock.filter_std += 2;
        STATE.vanStock.fuse_3a += 2;
        STATE.vanStock.cap_dual += 1;
        STATE.vanStock.wire_box += 1;
        STATE.vanStock.r410a_jug += 1;
        STATE.vanStock.batteries += 2;
        addLog("Restocked van shelves at Fergie's!", "good");
        updateHUD();
      }
    },
    {
      label: "UPGRADE: SMAC-MANIFOLD DIGITAL GAUGES",
      tag: "[$180]",
      disabled: STATE.cash < 180 || (STATE.vanStock.gauges_digital || 0) > 0,
      onClick: () => {
        STATE.cash -= 180;
        STATE.vanStock.gauges_digital = 1;
        addLog("UNLOCKED: SMAC-Manifold Digital Gauges!", "good");
        updateHUD();
      }
    },
    {
      label: "UPGRADE: HISS-SNIFFER LEAK DETECTOR",
      tag: "[$140]",
      disabled: STATE.cash < 140 || (STATE.vanStock.sniffer || 0) > 0,
      onClick: () => {
        STATE.cash -= 140;
        STATE.vanStock.sniffer = 1;
        addLog("UNLOCKED: Hiss-Sniffer Leak Detector!", "good");
        updateHUD();
      }
    },
    {
      label: "SKIP & RETURN TO DISPATCH",
      tag: "[FREE]",
      onClick: () => {
        if (helperForgotLunch) STATE.helperHangry = true;
        enterDispatchPhase();
      }
    }
  ]);
  updateHUD();
}

function triggerGameOver(reason) {
  STATE.phase = "GAME_OVER";
  document.getElementById("phase-label").textContent = "TERMINATED // SHIFT ENDED";
  setDialogue("BOSS MAN 'BUCK' MILLER", "TERMINATION NOTICE", `${reason}\n\nJobs: ${STATE.jobsCompleted} | Cash: $${STATE.cash}`);
  setButtons([{ label: "REBOOT TERMINAL (NEW CAREER)", tag: "[RESET]", cls: "danger-btn", onClick: () => location.reload() }]);
  updateHUD();
}

function triggerVictoryFinale(lastPayout) {
  STATE.phase = "VICTORY";
  document.getElementById("phase-label").textContent = "CAREER COMPLETE // NEW OWNER";
  document.getElementById("success-title").textContent = "CONGRATS! YOU OWN ARCTIC BLASTERS NOW!";
  document.getElementById("success-summary").textContent = `55 Jobs Conquered! Final Payout: +$${lastPayout} | Bankroll: $${STATE.cash}`;
  document.getElementById("success-banner").classList.add("show");
  setDialogue("BIG BOSS MAN 'BUCK' MILLER", "ROOFTOP HANDOVER", `"From ROOKIE TECH to Master Tech! My Boca Raton condo awaits—here are the keys to ARCTIC BLASTERS HVAC LLC!"`);
  window.nextAfterSuccess = () => location.reload();
  setButtons([{ label: "PLAY NEW GAME+", tag: "[REPLAY]", cls: "amber-btn", onClick: () => location.reload() }]);
  updateHUD();
}

window.nextAfterSuccess = () => enterDispatchPhase();
window.addEventListener("DOMContentLoaded", () => {
  addLog("P31 Field Terminal booted. Marge has your first work order.", "info");
  enterDispatchPhase();
});
