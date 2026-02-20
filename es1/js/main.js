import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { makeSim } from "./sim.js";
import { bindUI } from "./ui.js";

const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 5000);
camera.position.set(0, 60, 120);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.5;
controls.zoomSpeed = 0.9;
controls.panSpeed = 0.2;
controls.minDistance = 6;
controls.maxDistance = 800;
controls.target.set(0, 0, 0);

// Lights
const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
keyLight.position.set(50, 80, 40);
scene.add(keyLight);

const fill = new THREE.DirectionalLight(0xffffff, 0.35);
fill.position.set(-60, 30, -20);
scene.add(fill);

const amb = new THREE.AmbientLight(0xffffff, 0.18);
scene.add(amb);

// Starfield (simple)
const starGeo = new THREE.BufferGeometry();
const starCount = 2600;
const starPos = new Float32Array(starCount * 3);
for (let i=0;i<starCount;i++){
  const r = 1200 * (0.2 + 0.8*Math.random());
  const u = Math.random();
  const v = Math.random();
  const theta = 2*Math.PI*u;
  const phi = Math.acos(2*v - 1);
  starPos[i*3+0] = r*Math.sin(phi)*Math.cos(theta);
  starPos[i*3+1] = r*Math.cos(phi);
  starPos[i*3+2] = r*Math.sin(phi)*Math.sin(theta);
}
starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0.75 });
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// Ecliptic plane helper (subtle grid)
const grid = new THREE.GridHelper(800, 64, 0x22304f, 0x111727);
grid.position.y = 0;
grid.material.opacity = 0.25;
grid.material.transparent = true;
scene.add(grid);

// App state
const sim = makeSim();

const app = {
  sim,
  presets: [],
  activePresetKey: "solarLite",
  selectedBodyId: null,
  mode: "inspect",     // inspect | kick | add
  trailsEnabled: true,
  trailMaxPoints: 1400,
  ui: null,

  getSelectedBody(){
    return sim.state.bodies.find(b => b.id === this.selectedBodyId) || null;
  },

  selectBody(id){
    this.selectedBodyId = id;
    const b = this.getSelectedBody();
    if (b){
      controls.target.set(b.pos[0]*WORLD.scale, b.pos[1]*WORLD.scale, b.pos[2]*WORLD.scale);
    }
  },

  loadPreset(key){
    const preset = this.presets.find(p=>p.key===key) || this.presets[0];
    this.activePresetKey = preset.key;
    sim.setBodies(preset.makeBodies());
    this.selectedBodyId = sim.state.bodies[0]?.id ?? null;
    this.selectBody(this.selectedBodyId);
    this.clearTrails();
  },

  reset(){
    this.loadPreset(this.activePresetKey);
    sim.state.paused = false;
  },

  clearTrails(){
    for (const b of sim.state.bodies) b.trail = [];
    for (const line of trailLines.values()){
      line.geometry.setFromPoints([]);
    }
  },

  cancelGesture(){
    gesture.active = false;
    gesture.mode = null;
    gesture.startNDC = null;
    gesture.endNDC = null;
    this.ui?.hideGesture();
  }
};

// Visual scale: AU to world units
const WORLD = {
  scale: 60, // 1 AU = 60 units
  // Visual radius scaling: show planets bigger but bounded
  radiusVisual(b){
    const r = b.radiusAU * WORLD.scale;
    return Math.max(0.55, Math.min(10.0, r * 480)); // exaggerate, clamp
  }
};

// Presets: realistic-ish values (simplified) in AU/day/Msun
function presets(){
  const Msun = 1.0;
  const Mearth = 3.003e-6;
  const Mmoon = 3.694e-8;
  const Mmars = 3.227e-7;
  const Mjup = 9.545e-4;

  const R_sun_AU = 0.00465047; // solar radius in AU
  const R_earth_AU = 4.2635e-5;
  const R_moon_AU = 1.1614e-5;
  const R_mars_AU = 2.266e-5;
  const R_jup_AU = 0.0004779;

  // Circular orbit speed around central mass at radius r:
  // v = sqrt(G*M/r) in AU/day
  // Use base G from sim.G0, scaled by gScale later.
  const G = sim.G0;

  const makeSunEarthMoon = () => {
    const sun = body("sun","Sole", Msun, R_sun_AU, [0,0,0], [0,0,0], 0xfff2b2, true);

    const rE = 1.0;
    const vE = Math.sqrt(G*Msun/rE);
    const earth = body("earth","Terra", Mearth, R_earth_AU, [rE,0,0], [0,0,vE], 0x6aa8ff);

    const rM = 0.00257; // moon distance in AU (~384,400 km)
    const vM = Math.sqrt(G*Mearth/rM);
    const moon = body("moon","Luna", Mmoon, R_moon_AU, [rE + rM,0,0], [0,0, vE + vM], 0xd9deea);

    return [sun, earth, moon];
  };

  const makeSolarLite = () => {
    const bodies = makeSunEarthMoon();
    const sun = bodies[0];

    const rMars = 1.524;
    const vMars = Math.sqrt(G*Msun/rMars);
    bodies.push(body("mars","Marte", Mmars, R_mars_AU, [rMars,0,0], [0,0,vMars], 0xff8a6a));

    const rJ = 5.204;
    const vJ = Math.sqrt(G*Msun/rJ);
    bodies.push(body("jupiter","Giove", Mjup, R_jup_AU, [rJ,0,0], [0,0,vJ], 0xffd29a));

    // Give the Sun a tiny compensating velocity so total momentum ~0 (more physical)
    const P = totalMomentum(bodies);
    sun.vel[0] = -P[0] / sun.mass;
    sun.vel[1] = -P[1] / sun.mass;
    sun.vel[2] = -P[2] / sun.mass;

    return bodies;
  };

  const makeThreeBodyChaos = () => {
    // Equal masses in a triangle with small perturbation -> chaos
    const m = 0.9;
    const r = 1.0;
    const a = 2*Math.PI/3;
    const b1 = body("a","A", m, 0.002, [ r,0,0], [0,0, 0.19], 0x6aa8ff);
    const b2 = body("b","B", m, 0.002, [ r*Math.cos(a),0,r*Math.sin(a)], [0.03,0,-0.13], 0xff8a6a);
    const b3 = body("c","C", m, 0.002, [ r*Math.cos(-a),0,r*Math.sin(-a)], [-0.03,0,-0.06], 0xfff2b2);
    // Momentum balance
    const P = totalMomentum([b1,b2,b3]);
    b1.vel[0] -= P[0]/(3*m);
    b1.vel[2] -= P[2]/(3*m);
    b2.vel[0] -= P[0]/(3*m);
    b2.vel[2] -= P[2]/(3*m);
    b3.vel[0] -= P[0]/(3*m);
    b3.vel[2] -= P[2]/(3*m);
    return [b1,b2,b3];
  };

  const makeSlingshot = () => {
    const sun = body("sun","Sole", Msun, R_sun_AU, [0,0,0], [0,0,0], 0xfff2b2, true);
    const rJ = 5.2;
    const vJ = Math.sqrt(G*Msun/rJ);
    const j = body("jupiter","Giove", Mjup, R_jup_AU, [rJ,0,0], [0,0,vJ], 0xffd29a);

    // Probe coming in fast for gravity assist
    const probe = body("probe","Sonda", 1e-12, 8e-6, [-8.0,0, 3.5], [0.045,0, -0.02], 0x58f0b3);
    // Balance momentum with tiny sun kick
    const P = totalMomentum([sun,j,probe]);
    sun.vel[0] = -P[0]/sun.mass;
    sun.vel[2] = -P[2]/sun.mass;
    return [sun,j,probe];
  };

  return [
    { key:"solarLite", name:"Sistema Solare (lite)", makeBodies: makeSolarLite },
    { key:"sunEarthMoon", name:"Sole–Terra–Luna", makeBodies: makeSunEarthMoon },
    { key:"threeBody", name:"Tre corpi (caos)", makeBodies: makeThreeBodyChaos },
    { key:"slingshot", name:"Fionda gravitazionale", makeBodies: makeSlingshot },
  ];
}

function body(id, name, mass, radiusAU, pos, vel, color, fixed=false){
  return { id, name, mass, radiusAU, pos: pos.slice(), vel: vel.slice(), color, fixed, trail: [] };
}
function totalMomentum(bodies){
  let px=0,py=0,pz=0;
  for (const b of bodies){
    px += b.mass*b.vel[0];
    py += b.mass*b.vel[1];
    pz += b.mass*b.vel[2];
  }
  return [px,py,pz];
}

// Create meshes
const bodyGroup = new THREE.Group();
scene.add(bodyGroup);

const trailGroup = new THREE.Group();
scene.add(trailGroup);

const sphereGeo = new THREE.SphereGeometry(1, 48, 32);
const bodyMeshes = new Map();  // id -> mesh
const trailLines = new Map();  // id -> line

const ringGeo = new THREE.TorusGeometry(1.5, 0.08, 10, 64);
const ringMat = new THREE.MeshBasicMaterial({ color: 0x6aa8ff, transparent:true, opacity: 0.85 });
const selectionRing = new THREE.Mesh(ringGeo, ringMat);
selectionRing.visible = false;
scene.add(selectionRing);

// Arrow for velocity edits
const arrowMat = new THREE.MeshBasicMaterial({ color: 0x58f0b3, transparent:true, opacity: 0.9 });
const arrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), 10, 0x58f0b3);
arrow.cone.material.transparent = true;
arrow.line.material.transparent = true;
arrow.cone.material.opacity = 0.9;
arrow.line.material.opacity = 0.9;
arrow.visible = false;
scene.add(arrow);

// Gesture helper state
const gesture = {
  active: false,
  mode: null, // "kick" | "add"
  startNDC: null,
  endNDC: null,
  bodyId: null,
  addTemp: null, // {posAU, mass, radiusAU}
};

// Raycasting (selection)
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function rebuildSceneFromBodies(){
  // Remove existing
  for (const m of bodyMeshes.values()) bodyGroup.remove(m);
  for (const l of trailLines.values()) trailGroup.remove(l);
  bodyMeshes.clear();
  trailLines.clear();

  for (const b of sim.state.bodies){
    const mat = new THREE.MeshStandardMaterial({
      color: b.color,
      roughness: (b.id==="sun") ? 0.2 : 0.7,
      metalness: 0.05,
      emissive: (b.id==="sun") ? new THREE.Color(0xffe3a0) : new THREE.Color(0x000000),
      emissiveIntensity: (b.id==="sun") ? 0.75 : 0.0
    });
    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.userData.bodyId = b.id;
    bodyGroup.add(mesh);
    bodyMeshes.set(b.id, mesh);

    const lineMat = new THREE.LineBasicMaterial({ color: b.color, transparent:true, opacity: 0.75 });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([]);
    const line = new THREE.Line(lineGeo, lineMat);
    trailGroup.add(line);
    trailLines.set(b.id, line);
  }

  app.selectBody(app.selectedBodyId ?? sim.state.bodies[0]?.id ?? null);
  updateSelectionVisuals();
}

function updateMeshes(){
  for (const b of sim.state.bodies){
    const mesh = bodyMeshes.get(b.id);
    if (!mesh) continue;
    mesh.position.set(b.pos[0]*WORLD.scale, b.pos[1]*WORLD.scale, b.pos[2]*WORLD.scale);
    const rv = WORLD.radiusVisual(b);
    mesh.scale.set(rv, rv, rv);
  }
}

function updateTrails(){
  if (!app.trailsEnabled){
    trailGroup.visible = false;
    return;
  }
  trailGroup.visible = true;

  for (const b of sim.state.bodies){
    if (!b.trail) b.trail = [];
    b.trail.push([b.pos[0], b.pos[1], b.pos[2]]);
    if (b.trail.length > app.trailMaxPoints) b.trail.shift();

    const line = trailLines.get(b.id);
    if (!line) continue;
    const pts = b.trail.map(p => new THREE.Vector3(p[0]*WORLD.scale, p[1]*WORLD.scale, p[2]*WORLD.scale));
    line.geometry.setFromPoints(pts);
  }
}

function updateSelectionVisuals(){
  const b = app.getSelectedBody();
  if (!b){
    selectionRing.visible = false;
    arrow.visible = false;
    return;
  }
  const mesh = bodyMeshes.get(b.id);
  if (mesh){
    selectionRing.visible = true;
    selectionRing.position.copy(mesh.position);
    const s = WORLD.radiusVisual(b) * 1.18;
    selectionRing.scale.set(s, s, s);
    selectionRing.rotation.x = Math.PI/2;
  }
  arrow.visible = (app.mode === "kick") && !sim.state.paused;
  if (arrow.visible){
    const v = new THREE.Vector3(b.vel[0], b.vel[1], b.vel[2]).normalize();
    if (v.lengthSq() < 1e-10) v.set(1,0,0);
    arrow.position.set(b.pos[0]*WORLD.scale, b.pos[1]*WORLD.scale, b.pos[2]*WORLD.scale);
    arrow.setDirection(new THREE.Vector3(v.x, v.y, v.z));
    arrow.setLength(16, 6, 3);
  }
}

function setPointerFromEvent(ev){
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) / rect.width;
  const y = (ev.clientY - rect.top) / rect.height;
  pointer.set(x*2-1, -(y*2-1));
}

function pickBody(ev){
  setPointerFromEvent(ev);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([...bodyMeshes.values()], false);
  if (hits.length){
    const id = hits[0].object.userData.bodyId;
    return id;
  }
  return null;
}

function pickPlanePointAU(ev){
  // Intersect ray with y=0 plane (ecliptic)
  setPointerFromEvent(ev);
  raycaster.setFromCamera(pointer, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
  const out = new THREE.Vector3();
  const ok = raycaster.ray.intersectPlane(plane, out);
  if (!ok) return null;
  return [out.x / WORLD.scale, 0, out.z / WORLD.scale]; // AU
}

function beginKickGesture(bodyId){
  const b = sim.state.bodies.find(x=>x.id===bodyId);
  if (!b) return;
  gesture.active = true;
  gesture.mode = "kick";
  gesture.bodyId = bodyId;
  gesture.startNDC = null;
  gesture.endNDC = null;
  app.ui.showGesture("Modifica velocità", "Trascina sullo schermo: direzione e intensità del kick (Δv).");
}

function beginAddGesture(posAU){
  gesture.active = true;
  gesture.mode = "add";
  gesture.bodyId = null;
  gesture.startNDC = null;
  gesture.endNDC = null;
  gesture.addTemp = { posAU, mass: 1e-6, radiusAU: 3e-5 };
  app.ui.showGesture("Aggiungi corpo", "Trascina per impostare la velocità iniziale (v).");
}

function endGesture(ev){
  if (!gesture.active) return;
  const a = gesture.startNDC;
  const b = gesture.endNDC;
  if (!a || !b){
    app.cancelGesture();
    return;
  }
  const dx = (b.x - a.x);
  const dy = (b.y - a.y);
  // Map screen drag to velocity change in AU/day on xz plane.
  // This is an artistic mapping but consistent: longer drag = bigger speed.
  const gain = 0.22; // AU/day per NDC unit
  const dvx = dx * gain;
  const dvz = -dy * gain;

  if (gesture.mode === "kick"){
    const body = sim.state.bodies.find(x=>x.id===gesture.bodyId);
    if (body && !body.fixed){
      body.vel[0] += dvx;
      body.vel[2] += dvz;
    }
  } else if (gesture.mode === "add"){
    const p = gesture.addTemp.posAU;
    const id = "x" + Math.floor(Math.random()*1e9).toString(16);
    const name = "Corpo " + id.slice(1,5).toUpperCase();
    const mass = gesture.addTemp.mass;
    const radiusAU = gesture.addTemp.radiusAU;
    const vel = [dvx, 0, dvz];
    const color = 0x58f0b3;
    sim.state.bodies.push({ id, name, mass, radiusAU, pos: p.slice(), vel, color, fixed:false, trail: [] });
    rebuildSceneFromBodies();
    app.selectedBodyId = id;
    app.selectBody(id);
  }
  app.cancelGesture();
  app.ui.hideGesture();
  updateSelectionVisuals();
  app.ui.refreshBodyList();
  app.ui.updateStatus();
}

function updateGestureDrag(ev){
  if (!gesture.active) return;
  setPointerFromEvent(ev);
  if (!gesture.startNDC){
    gesture.startNDC = { x: pointer.x, y: pointer.y };
    gesture.endNDC = { x: pointer.x, y: pointer.y };
  } else {
    gesture.endNDC = { x: pointer.x, y: pointer.y };
  }
}

// Touch/pointer handling:
// - Tap body: select + focus
// - If mode kick: tap selected body => start gesture drag to set Δv
// - If mode add: tap plane => start gesture for new body velocity
let pointerDown = false;
let downTime = 0;
let downPos = {x:0,y:0};

canvas.addEventListener("pointerdown", (ev)=>{
  pointerDown = true;
  downTime = performance.now();
  downPos = {x: ev.clientX, y: ev.clientY};

  if (gesture.active){
    updateGestureDrag(ev);
    return;
  }

  // In kick/add mode we may intercept, but still allow orbit if user drags.
  // We'll decide on pointerup if it was a tap.
}, { passive: true });

canvas.addEventListener("pointermove", (ev)=>{
  if (!pointerDown) return;
  if (gesture.active){
    updateGestureDrag(ev);
  }
}, { passive: true });

canvas.addEventListener("pointerup", (ev)=>{
  pointerDown = false;

  if (gesture.active){
    endGesture(ev);
    return;
  }

  const dtMs = performance.now() - downTime;
  const move = Math.hypot(ev.clientX-downPos.x, ev.clientY-downPos.y);
  const isTap = (dtMs < 260) && (move < 10);

  if (!isTap) return;

  // Tap handling
  const hitId = pickBody(ev);
  if (hitId){
    app.selectedBodyId = hitId;
    app.selectBody(hitId);
    app.ui.bodySelect.value = hitId;
    updateSelectionVisuals();
    app.ui.updateStatus();

    if (app.mode === "kick" && !sim.state.paused){
      beginKickGesture(hitId);
    }
    return;
  }

  if (app.mode === "add" && !sim.state.paused){
    const pAU = pickPlanePointAU(ev);
    if (pAU){
      beginAddGesture(pAU);
      return;
    }
  }
}, { passive: true });

// Prevent page scrolling on touch when interacting
document.addEventListener("touchmove", (e)=> {
  if (e.target === canvas) e.preventDefault();
}, { passive:false });

// Resize
window.addEventListener("resize", ()=>{
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
  renderer.setSize(w,h,false);
});

// Build presets and UI
app.presets = presets();
app.activePresetKey = "solarLite";
app.loadPreset(app.activePresetKey);
rebuildSceneFromBodies();

bindUI(app);

// Sync UI after bindUI because loadPreset already called
app.ui.presetSelect.value = app.activePresetKey;
app.ui.refreshBodyList();
app.ui.syncSlidersToSim();
app.ui.updateStatus();

// Main loop
let last = performance.now();
function animate(now){
  requestAnimationFrame(animate);
  const dtSec = (now - last) / 1000;
  last = now;

  // Follow selected body gently
  const focus = app.getSelectedBody();
  if (focus){
    const tx = focus.pos[0]*WORLD.scale;
    const ty = focus.pos[1]*WORLD.scale;
    const tz = focus.pos[2]*WORLD.scale;
    controls.target.lerp(new THREE.Vector3(tx,ty,tz), 0.08);
  }

  // Physics steps
  if (!sim.state.paused){
    // Determine how many fixed steps this frame
    const steps = Math.max(1, Math.floor(sim.state.timeScale));
    const frac = sim.state.timeScale - steps;
    sim.step(steps);
    if (frac > 1e-6) sim.step(1); // small extra tick
  }

  updateMeshes();
  updateTrails();
  updateSelectionVisuals();

  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
