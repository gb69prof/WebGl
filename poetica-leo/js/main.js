
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth * 0.75 / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth * 0.75, window.innerHeight);
document.getElementById("scene-container").appendChild(renderer.domElement);

// Sky sphere
const textureLoader = new THREE.TextureLoader();
textureLoader.load('assets/horizon_360.png', function(texture) {
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const sky = new THREE.Mesh(geometry, material);
    scene.add(sky);
});

// Ground
const groundGeometry = new THREE.PlaneGeometry(200, 200);
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x228b22 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Hedge
const hedgeGeometry = new THREE.BoxGeometry(20, 5, 1);
const hedgeMaterial = new THREE.MeshBasicMaterial({ color: 0x2e8b57 });
const hedge = new THREE.Mesh(hedgeGeometry, hedgeMaterial);
hedge.position.set(0, 2.5, -10);
scene.add(hedge);

camera.position.set(0, 2, 5);

// Movement
const keys = {};
document.addEventListener("keydown", (e) => keys[e.key] = true);
document.addEventListener("keyup", (e) => keys[e.key] = false);

function updateImagination() {
    const z = camera.position.z;
    let imagination = 100;

    if (z > -9) imagination = 0;
    else if (z > -12) imagination = 50;

    document.getElementById("bar").style.width = imagination + "%";
    document.getElementById("percent").innerText = imagination + "%";

    const text = document.getElementById("dynamic-text");
    if (imagination === 100)
        text.innerText = "L’ostacolo apre lo spazio dell’infinito.";
    else if (imagination === 50)
        text.innerText = "L’immaginazione nasce dal limite.";
    else
        text.innerText = "Tutto è visibile. Nulla è oltre.";
}

function animate() {
    requestAnimationFrame(animate);

    if (keys["w"]) camera.position.z -= 0.1;
    if (keys["s"]) camera.position.z += 0.1;
    if (keys["a"]) camera.position.x -= 0.1;
    if (keys["d"]) camera.position.x += 0.1;

    updateImagination();
    renderer.render(scene, camera);
}

animate();
