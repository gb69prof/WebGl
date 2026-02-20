// ui.js — wires DOM controls to simulation & app state
export function bindUI(app){
  const $ = (id)=>document.getElementById(id);

  const presetSelect = $("presetSelect");
  const bodySelect = $("bodySelect");
  const modeSelect = $("modeSelect");

  const timeScale = $("timeScale");
  const dt = $("dt");
  const gScale = $("gScale");
  const damping = $("damping");
  const trail = $("trail");
  const trailLen = $("trailLen");

  const btnPause = $("btnPause");
  const btnReset = $("btnReset");
  const btnPreset = $("btnPreset");

  const status = $("status");

  const timeScaleVal = $("timeScaleVal");
  const dtVal = $("dtVal");
  const gScaleVal = $("gScaleVal");
  const dampingVal = $("dampingVal");
  const trailVal = $("trailVal");
  const trailLenVal = $("trailLenVal");

  const overlay = $("gestureOverlay");
  const gestureTitle = $("gestureTitle");
  const gestureSub = $("gestureSub");
  const btnCancelGesture = $("btnCancelGesture");

  function fmt(x, digits=4){
    const s = x.toFixed(digits);
    return s.replace(/\.?0+$/,"");
  }

  function refreshPresetList(){
    presetSelect.innerHTML = "";
    for (const p of app.presets){
      const opt = document.createElement("option");
      opt.value = p.key;
      opt.textContent = p.name;
      presetSelect.appendChild(opt);
    }
    presetSelect.value = app.activePresetKey;
  }

  function refreshBodyList(){
    bodySelect.innerHTML = "";
    for (const b of app.sim.state.bodies){
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = b.name;
      bodySelect.appendChild(opt);
    }
    bodySelect.value = app.selectedBodyId ?? (app.sim.state.bodies[0]?.id ?? "");
  }

  function syncSlidersToSim(){
    timeScale.value = String(app.sim.state.timeScale);
    dt.value = String(app.sim.state.dt);
    gScale.value = String(app.sim.state.gScale);
    damping.value = String(app.sim.state.damping);
    trail.value = app.trailsEnabled ? "1" : "0";
    trailLen.value = String(app.trailMaxPoints);

    timeScaleVal.textContent = fmt(app.sim.state.timeScale,1) + "×";
    dtVal.textContent = fmt(app.sim.state.dt,3) + " d";
    gScaleVal.textContent = fmt(app.sim.state.gScale,2) + "×";
    dampingVal.textContent = fmt(app.sim.state.damping,4);
    trailVal.textContent = app.trailsEnabled ? "ON" : "OFF";
    trailLenVal.textContent = String(app.trailMaxPoints);
  }

  function updateStatus(){
    const e = app.sim.totalEnergy();
    const b = app.getSelectedBody();
    const focusName = b ? b.name : "—";
    status.innerHTML = [
      `<b>t</b> = ${fmt(app.sim.state.tDays,2)} giorni`,
      `<b>Corpi</b> = ${app.sim.state.bodies.length}`,
      `<b>Focus</b> = ${focusName}`,
      `<b>Energia</b> = K ${fmt(e.K,5)} • U ${fmt(e.U,5)} • E ${fmt(e.E,5)}`
    ].join("<br/>");
  }

  presetSelect.addEventListener("change", ()=>{
    app.loadPreset(presetSelect.value);
    refreshBodyList();
    updateStatus();
  });

  bodySelect.addEventListener("change", ()=>{
    app.selectBody(bodySelect.value);
    updateStatus();
  });

  modeSelect.addEventListener("change", ()=>{
    app.mode = modeSelect.value;
    updateStatus();
  });

  timeScale.addEventListener("input", ()=>{
    app.sim.state.timeScale = parseFloat(timeScale.value);
    syncSlidersToSim();
  });

  dt.addEventListener("input", ()=>{
    app.sim.state.dt = parseFloat(dt.value);
    syncSlidersToSim();
  });

  gScale.addEventListener("input", ()=>{
    app.sim.state.gScale = parseFloat(gScale.value);
    syncSlidersToSim();
  });

  damping.addEventListener("input", ()=>{
    app.sim.state.damping = parseFloat(damping.value);
    syncSlidersToSim();
  });

  trail.addEventListener("input", ()=>{
    app.trailsEnabled = trail.value === "1";
    syncSlidersToSim();
  });

  trailLen.addEventListener("input", ()=>{
    app.trailMaxPoints = parseInt(trailLen.value,10);
    syncSlidersToSim();
  });

  btnPause.addEventListener("click", ()=>{
    app.sim.state.paused = !app.sim.state.paused;
    btnPause.textContent = app.sim.state.paused ? "Riprendi" : "Pausa";
    updateStatus();
  });

  btnReset.addEventListener("click", ()=>{
    app.reset();
    refreshBodyList();
    btnPause.textContent = "Pausa";
    updateStatus();
  });

  btnPreset.addEventListener("click", ()=>{
    // cycles presets quickly
    const keys = app.presets.map(p=>p.key);
    const i = keys.indexOf(app.activePresetKey);
    const next = keys[(i+1) % keys.length];
    presetSelect.value = next;
    app.loadPreset(next);
    refreshBodyList();
    btnPause.textContent = app.sim.state.paused ? "Riprendi" : "Pausa";
    updateStatus();
  });

  btnCancelGesture.addEventListener("click", ()=>{
    app.cancelGesture();
    overlay.classList.add("hidden");
  });

  function showGesture(title, sub){
    gestureTitle.textContent = title;
    gestureSub.textContent = sub;
    overlay.classList.remove("hidden");
  }
  function hideGesture(){
    overlay.classList.add("hidden");
  }

  app.ui = { refreshPresetList, refreshBodyList, syncSlidersToSim, updateStatus, showGesture, hideGesture, presetSelect, bodySelect, modeSelect };
  refreshPresetList();
  refreshBodyList();
  syncSlidersToSim();
  updateStatus();
}
