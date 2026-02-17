
/**
 * Leopardi — poetica del vago e dell'indefinito
 * WebGL/Three.js single-file logic.
 * Touch-first (iPad): drag to look, joystick to move.
 */

const wrap = document.getElementById("scene-wrap");
const holder = document.getElementById("scene-container");

/* ------------------------
   Renderer / Scene / Camera
------------------------- */
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0f1216, 0.0012);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(holder.clientWidth, holder.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
holder.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(70, holder.clientWidth / holder.clientHeight, 0.1, 1200);
camera.position.set(0, 2.0, 8);

/* ------------------------
   Lights
------------------------- */
const hemi = new THREE.HemisphereLight(0x9fb8d6, 0x111216, 0.85);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.05);
sun.position.set(40, 60, 20);
sun.castShadow = false;
scene.add(sun);

/* ------------------------
   Sky (equirectangular)
------------------------- */
const texLoader = new THREE.TextureLoader();
texLoader.load("assets/horizon_360.png", (tex) => {
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(600, 64, 48);
  geo.scale(-1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const sky = new THREE.Mesh(geo, mat);
  scene.add(sky);
});

/* ------------------------
   Terrain (procedural gentle hill)
------------------------- */
function smoothstep(edge0, edge1, x){
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Simple value noise (fast, enough for our hill)
function hash2(x, y){
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function lerp(a,b,t){ return a + (b - a) * t; }
function noise2(x, y){
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const n00 = hash2(xi, yi);
  const n10 = hash2(xi+1, yi);
  const n01 = hash2(xi, yi+1);
  const n11 = hash2(xi+1, yi+1);
  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
}
function fbm(x, y){
  let f = 0, amp = 0.55, freq = 0.08;
  for(let i=0;i<5;i++){
    f += amp * noise2(x*freq, y*freq);
    amp *= 0.5;
    freq *= 2.0;
  }
  return f;
}

const terrainSize = 200;
const terrainSeg = 180;
const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSeg, terrainSeg);
terrainGeo.rotateX(-Math.PI / 2);

const pos = terrainGeo.attributes.position;
const colors = [];
const col = new THREE.Color();

for(let i=0;i<pos.count;i++){
  const x = pos.getX(i);
  const z = pos.getZ(i);

  // broad hill centered near hedge
  const hill = 3.6 * Math.exp(-((x*x) / (2*38*38) + ((z+12)*(z+12)) / (2*30*30)));
  const ripples = (fbm(x, z) - 0.5) * 0.9;
  const y = hill + ripples;

  pos.setY(i, y);

  // subtle color variation with height (grass -> sunlit)
  const t = smoothstep(0.0, 4.0, y);
  col.setRGB(0.10 + 0.05*t, 0.30 + 0.25*t, 0.12 + 0.07*t); // green-ish without shouting
  colors.push(col.r, col.g, col.b);
}

terrainGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
terrainGeo.computeVertexNormals();

const terrainMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 1.0,
  metalness: 0.0
});

const terrain = new THREE.Mesh(terrainGeo, terrainMat);
terrain.receiveShadow = false;
scene.add(terrain);

/* ------------------------
   Hedge (organic-ish)
------------------------- */
const hedge = new THREE.Group();
const hedgeCenterZ = -12.0;
const hedgeLength = 26;
const hedgeHeight = 3.2;

const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6f4f, roughness: 1.0, metalness: 0.0 });
const stemMat = new THREE.MeshStandardMaterial({ color: 0x244b37, roughness: 1.0, metalness: 0.0 });

// base volume
const baseGeo = new THREE.BoxGeometry(hedgeLength, hedgeHeight, 1.3);
const base = new THREE.Mesh(baseGeo, stemMat);
base.position.set(0, hedgeHeight*0.5, hedgeCenterZ);
hedge.add(base);

// leafy bumps
const bumpGeo = new THREE.SphereGeometry(1.25, 14, 12);
for(let i=0;i<60;i++){
  const m = new THREE.Mesh(bumpGeo, leafMat);
  const px = (Math.random() - 0.5) * hedgeLength * 0.95;
  const py = 1.0 + Math.random() * (hedgeHeight * 0.9);
  const pz = hedgeCenterZ + (Math.random() - 0.5) * 1.4;
  m.position.set(px, py, pz);
  const s = 0.7 + Math.random() * 1.2;
  m.scale.set(s, 0.7 + Math.random()*0.8, s);
  hedge.add(m);
}
scene.add(hedge);

// for raycasting: a simple collider box (slightly larger)
const hedgeColliderGeo = new THREE.BoxGeometry(hedgeLength + 1.6, hedgeHeight + 1.0, 2.6);
const hedgeColliderMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, visible: false });
const hedgeCollider = new THREE.Mesh(hedgeColliderGeo, hedgeColliderMat);
hedgeCollider.position.set(0, (hedgeHeight*0.5)+0.3, hedgeCenterZ);
scene.add(hedgeCollider);

/* ------------------------
   Controls: keyboard + touch look + joystick move
------------------------- */
let yaw = 0;
let pitch = 0;
const pitchLimit = Math.PI * 0.42;

function applyLook(){
  // set camera quaternion from yaw/pitch
  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), yaw);
  const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), pitch);
  camera.quaternion.copy(qYaw).multiply(qPitch);
}

applyLook();

// Touch drag to look (right side of canvas generally, but we accept anywhere)
let looking = false;
let lastX = 0, lastY = 0;

renderer.domElement.addEventListener("pointerdown", (e) => {
  // if pointerdown happens on joystick area, ignore (handled there)
  const joy = document.getElementById("joystick");
  const r = joy.getBoundingClientRect();
  if(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return;

  looking = true;
  lastX = e.clientX;
  lastY = e.clientY;
}, { passive: true });

window.addEventListener("pointermove", (e) => {
  if(!looking) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;

  const sens = 0.0042; // tuned for touch + mouse
  yaw -= dx * sens;
  pitch -= dy * sens;
  pitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));
  applyLook();
}, { passive: true });

window.addEventListener("pointerup", () => { looking = false; }, { passive: true });
window.addEventListener("pointercancel", () => { looking = false; }, { passive: true });

// Double tap / double click reset
let lastTap = 0;
renderer.domElement.addEventListener("pointerup", () => {
  const now = performance.now();
  if(now - lastTap < 280){
    // reset position and view
    camera.position.set(0, 2.0, 8);
    yaw = 0; pitch = 0;
    applyLook();
  }
  lastTap = now;
}, { passive: true });

// Keyboard move
const keys = {};
window.addEventListener("keydown", (e)=> keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", (e)=> keys[e.key.toLowerCase()] = false);

// Joystick move
const joyBase = document.getElementById("joy-base");
const joyStick = document.getElementById("joy-stick");
let joyActive = false;
let joyVec = { x: 0, y: 0 };

function setStick(px, py){
  joyStick.style.left = px + "px";
  joyStick.style.top = py + "px";
}

function joyStart(e){
  joyActive = true;
  joyMove(e);
}
function joyEnd(){
  joyActive = false;
  joyVec.x = 0; joyVec.y = 0;
  setStick(joyBase.clientWidth/2, joyBase.clientHeight/2);
}
function joyMove(e){
  if(!joyActive) return;
  const rect = joyBase.getBoundingClientRect();
  const cx = rect.left + rect.width/2;
  const cy = rect.top + rect.height/2;

  const x = (e.clientX ?? (e.touches && e.touches[0].clientX)) - cx;
  const y = (e.clientY ?? (e.touches && e.touches[0].clientY)) - cy;

  const maxR = rect.width * 0.36;
  const len = Math.hypot(x,y);
  const nx = len > 0 ? x/len : 0;
  const ny = len > 0 ? y/len : 0;
  const cl = Math.min(len, maxR);

  const sx = rect.width/2 + nx * cl;
  const sy = rect.height/2 + ny * cl;
  setStick(sx, sy);

  joyVec.x = (nx * (cl / maxR));       // strafe
  joyVec.y = (-ny * (cl / maxR));      // forward
}

joyBase.addEventListener("pointerdown", (e)=>{ e.preventDefault(); joyStart(e); }, { passive:false });
window.addEventListener("pointermove", (e)=>{ joyMove(e); }, { passive:true });
window.addEventListener("pointerup", ()=>{ if(joyActive) joyEnd(); }, { passive:true });
window.addEventListener("pointercancel", ()=>{ if(joyActive) joyEnd(); }, { passive:true });

/* ------------------------
   Imagination model (continuous)
------------------------- */
const bar = document.getElementById("bar");
const glow = document.getElementById("glow");
const percentEl = document.getElementById("percent");
const stateEl = document.getElementById("state");
const textEl = document.getElementById("dynamic-text");

const raycaster = new THREE.Raycaster();
const tmpDir = new THREE.Vector3();

function clamp01(v){ return Math.max(0, Math.min(1, v)); }

function computeImagination(){
  // 1) are we behind the hedge?
  const behind = clamp01(smoothstep(hedgeCenterZ + 1.0, hedgeCenterZ - 3.0, camera.position.z)); 
  // 2) lateral exposure (left/right sidestep makes hedge less effective)
  const lateral = clamp01(Math.abs(camera.position.x) / (hedgeLength * 0.55)); 
  const lateralFactor = 1.0 - smoothstep(0.25, 1.0, lateral); // near center -> 1, far -> 0

  // 3) line of sight occlusion (raycast forward)
  camera.getWorldDirection(tmpDir);
  const origin = camera.position.clone();
  const targetDist = 200;
  raycaster.set(origin, tmpDir);
  raycaster.far = targetDist;
  const hit = raycaster.intersectObject(hedgeCollider, true);
  const occluded = hit.length > 0 ? 1 : 0;

  // If horizon isn't blocked, imagination is (almost) zero by design
  if(!occluded) return 0;

  // Combine: behind + centered = more imagination
  const val = 100 * behind * lateralFactor;

  // soften
  return Math.max(0, Math.min(100, val));
}

function updateText(im){
  // state
  let state = "visibile";
  if(im > 70) state = "oltre";
  else if(im > 30) state = "limite";
  else if(im > 0) state = "quasi";

  stateEl.textContent = state;

  // text (short + clear + leopardiano nel tono)
  if(im >= 85){
    textEl.textContent = "Dietro la siepe il mondo non finisce: comincia. Il limite costringe lo sguardo, e proprio per questo libera l’infinito.";
  }else if(im >= 55){
    textEl.textContent = "Vedi meno, immagini di più. L’ostacolo non toglie realtà: la trasforma in possibilità.";
  }else if(im >= 20){
    textEl.textContent = "L’indefinito nasce quando il reale non si consegna tutto. La mente completa ciò che gli occhi non possiedono.";
  }else if(im > 0){
    textEl.textContent = "Il limite è già quasi svanito: resta un’ombra di oltre, un margine sottile di possibilità.";
  }else{
    textEl.textContent = "Quando nulla ostacola lo sguardo, tutto è dato e nulla è da inventare. Il panorama pieno riduce l’immaginazione a silenzio.";
  }
}

function applyAtmosphere(im){
  const t = im / 100;
  // fog: more imagination -> more haze (indefinite)
  scene.fog.density = 0.0012 + t * 0.0082;

  // renderer exposure: slightly lower when imagination high (softer)
  renderer.toneMappingExposure = 1.05 - t * 0.12;

  // UI glow
  glow.style.opacity = (0.15 + t * 0.75).toFixed(3);
}

/* ------------------------
   Movement + collision-ish constraints
------------------------- */
function groundHeightAt(x, z){
  // approximate from the same height formula used on terrain
  const hill = 3.6 * Math.exp(-((x*x) / (2*38*38) + ((z+12)*(z+12)) / (2*30*30)));
  const ripples = (fbm(x, z) - 0.5) * 0.9;
  return hill + ripples;
}

function keepAboveGround(){
  const y = groundHeightAt(camera.position.x, camera.position.z);
  camera.position.y = Math.max(1.7, y + 1.6);
}

// world bounds
const bounds = 80;
function clampWorld(){
  camera.position.x = Math.max(-bounds, Math.min(bounds, camera.position.x));
  camera.position.z = Math.max(-bounds, Math.min(bounds, camera.position.z));
}

const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);

  const dt = Math.min(0.033, clock.getDelta());
  const speedBase = (keys["shift"] ? 7.5 : 4.2);
  const moveSpeed = speedBase * dt;

  // forward/right vectors from camera yaw only (so looking up doesn't fly)
  const forward = new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0), yaw).normalize();
  const right = new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0), yaw).normalize();

  let vx = 0, vz = 0;

  // keyboard
  if(keys["w"]) { vx += forward.x; vz += forward.z; }
  if(keys["s"]) { vx -= forward.x; vz -= forward.z; }
  if(keys["a"]) { vx -= right.x;   vz -= right.z; }
  if(keys["d"]) { vx += right.x;   vz += right.z; }

  // joystick
  if(Math.abs(joyVec.x) > 0.01 || Math.abs(joyVec.y) > 0.01){
    vx += right.x * joyVec.x + forward.x * joyVec.y;
    vz += right.z * joyVec.x + forward.z * joyVec.y;
  }

  const len = Math.hypot(vx, vz);
  if(len > 0){
    vx /= len; vz /= len;
    camera.position.x += vx * moveSpeed;
    camera.position.z += vz * moveSpeed;
  }

  clampWorld();
  keepAboveGround();

  const im = computeImagination();
  bar.style.width = im.toFixed(0) + "%";
  percentEl.textContent = im.toFixed(0) + "%";
  updateText(im);
  applyAtmosphere(im);

  renderer.render(scene, camera);
}

animate();

/* ------------------------
   Resize
------------------------- */
function resize(){
  const w = holder.clientWidth;
  const h = holder.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
