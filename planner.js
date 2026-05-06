/**
 * 3D Room Planner — Three.js Engine
 * =====================================
 * Provides interactive 3D furniture placement, selection, movement,
 * rotation, color, scaling — similar to Planner5D / RoomGPT.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ─────────────────────────────────────────────────────────────────
// 1. FURNITURE CATALOG
// ─────────────────────────────────────────────────────────────────

const CATALOG = [
  // Seating
  { id:'sofa',        name:'3-Seat Sofa',     cat:'seating', icon:'🛋',  color:'#c2935e', build: buildSofa },
  { id:'loveseat',    name:'Loveseat',         cat:'seating', icon:'🛋',  color:'#a07850', build: buildLoveseat },
  { id:'armchair',    name:'Armchair',         cat:'seating', icon:'🪑',  color:'#8a6548', build: buildArmchair },
  { id:'ottoman',     name:'Ottoman',          cat:'seating', icon:'🟫',  color:'#b07d55', build: buildOttoman },
  // Tables
  { id:'coffee',      name:'Coffee Table',     cat:'tables',  icon:'📦',  color:'#7a5c3a', build: buildCoffeeTable },
  { id:'dining',      name:'Dining Table',     cat:'tables',  icon:'🍽',  color:'#5c3d22', build: buildDiningTable },
  { id:'diningchair', name:'Dining Chair',     cat:'tables',  icon:'🪑',  color:'#6e4c2a', build: buildDiningChair },
  { id:'sidetable',   name:'Side Table',       cat:'tables',  icon:'🟤',  color:'#7a5c3a', build: buildSideTable },
  // Bedroom
  { id:'bed-double',  name:'Double Bed',       cat:'bedroom', icon:'🛏',  color:'#8c7b6a', build: buildBedDouble },
  { id:'bed-single',  name:'Single Bed',       cat:'bedroom', icon:'🛏',  color:'#9c8878', build: buildBedSingle },
  { id:'nightstand',  name:'Nightstand',       cat:'bedroom', icon:'🪵',  color:'#7a5c3a', build: buildNightstand },
  { id:'dresser',     name:'Dresser',          cat:'bedroom', icon:'🗄',  color:'#8c7060', build: buildDresser },
  // Storage
  { id:'bookshelf',   name:'Bookshelf',        cat:'storage', icon:'📚',  color:'#4e3620', build: buildBookshelf },
  { id:'wardrobe',    name:'Wardrobe',         cat:'storage', icon:'🚪',  color:'#5e4830', build: buildWardrobe },
  { id:'tvstand',     name:'TV Stand',         cat:'storage', icon:'📺',  color:'#2a2a35', build: buildTvStand },
  // Decor
  { id:'plant',       name:'Floor Plant',      cat:'decor',   icon:'🌿',  color:'#2d6a2d', build: buildPlant },
  { id:'lamp-floor',  name:'Floor Lamp',       cat:'decor',   icon:'💡',  color:'#ccaa55', build: buildFloorLamp },
  { id:'lamp-table',  name:'Table Lamp',       cat:'decor',   icon:'🕯',  color:'#ddcc88', build: buildTableLamp },
  { id:'rug',         name:'Area Rug',         cat:'decor',   icon:'🟥',  color:'#c0392b', build: buildRug },
  { id:'painting',    name:'Wall Painting',    cat:'decor',   icon:'🖼',  color:'#3a5faa', build: buildPainting },
];

window.CATALOG = CATALOG; // expose for HTML handlers

// ─────────────────────────────────────────────────────────────────
// 2. SCENE SETUP
// ─────────────────────────────────────────────────────────────────

const canvas  = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141422);
scene.fog = new THREE.Fog(0x141422, 30, 60);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
camera.position.set(0, 12, 14);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xfff8e8, 1.8);
dirLight.position.set(8, 16, 8);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 80;
dirLight.shadow.camera.left = dirLight.shadow.camera.bottom = -20;
dirLight.shadow.camera.right = dirLight.shadow.camera.top = 20;
dirLight.shadow.bias = -0.001;
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x8898cc, 0.5);
fillLight.position.set(-8, 6, -8);
scene.add(fillLight);

// ─────────────────────────────────────────────────────────────────
// 3. ROOM (floor + walls + grid)
// ─────────────────────────────────────────────────────────────────

let roomW = 10, roomD = 10;
let floorMesh, wallMeshes = [], gridHelper;

function buildRoom() {
  // remove old
  if (floorMesh) scene.remove(floorMesh);
  wallMeshes.forEach(m => scene.remove(m));
  wallMeshes = [];
  if (gridHelper) scene.remove(gridHelper);

  const floorMat = new THREE.MeshStandardMaterial({ color: 0xc9b99a, roughness: 0.85, metalness: 0.0 });
  floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  floorMesh.name = '__floor__';
  scene.add(floorMesh);

  // Grid overlay
  gridHelper = new THREE.GridHelper(Math.max(roomW, roomD), Math.max(roomW, roomD), 0x888888, 0x444444);
  gridHelper.position.y = 0.001;
  gridHelper.material.opacity = 0.3;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  // Walls (3 walls — back, left, right; open front for camera)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xede8e0, roughness: 0.9, side: THREE.FrontSide });
  const wallH = 3.0;

  const makeWall = (w, h, d, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat.clone());
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    m.name = '__wall__';
    scene.add(m);
    wallMeshes.push(m);
  };

  // Back wall
  makeWall(roomW, wallH, 0.15, 0, wallH / 2, -roomD / 2, 0);
  // Left wall
  makeWall(roomD, wallH, 0.15, -roomW / 2, wallH / 2, 0, Math.PI / 2);
  // Right wall
  makeWall(roomD, wallH, 0.15, roomW / 2, wallH / 2, 0, Math.PI / 2);

  // Update shadow camera
  dirLight.shadow.camera.left = dirLight.shadow.camera.bottom = -(Math.max(roomW, roomD));
  dirLight.shadow.camera.right = dirLight.shadow.camera.top  =  (Math.max(roomW, roomD));
  dirLight.shadow.camera.updateProjectionMatrix();
}

buildRoom();

// ─────────────────────────────────────────────────────────────────
// 4. STATE
// ─────────────────────────────────────────────────────────────────

let furnitureObjects = []; // { group, def, id }
let selectedObj = null;
let isDragging = false;
let dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let dragOffset = new THREE.Vector3();
let history = []; // for undo

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const intersectPoint = new THREE.Vector3();

// ─────────────────────────────────────────────────────────────────
// 5. FURNITURE BUILDERS (Three.js geometry)
// ─────────────────────────────────────────────────────────────────

function mat(color, rough = 0.75, metal = 0) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, metalness: metal });
}

function box(w, h, d, color, rough) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, rough));
}

function cyl(rt, rb, h, color, segs = 12) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), mat(color));
}

function applyMesh(mesh, x, y, z, rx = 0, ry = 0, rz = 0) {
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildSofa(color) {
  const g = new THREE.Group();
  const c = color || '#c2935e';
  // seat
  g.add(applyMesh(box(2.0, 0.25, 0.85, c), 0, 0.25, 0));
  // back
  g.add(applyMesh(box(2.0, 0.65, 0.18, c), 0, 0.65, -0.33));
  // left arm
  g.add(applyMesh(box(0.18, 0.48, 0.85, c), -0.91, 0.45, 0));
  // right arm
  g.add(applyMesh(box(0.18, 0.48, 0.85, c),  0.91, 0.45, 0));
  // legs x4 (dark)
  [-0.8, 0.8].forEach(x => [-0.3, 0.3].forEach(z =>
    g.add(applyMesh(box(0.08, 0.14, 0.08, '#3a2a1a'), x, 0.07, z))
  ));
  return g;
}

function buildLoveseat(color) {
  const g = new THREE.Group();
  const c = color || '#a07850';
  g.add(applyMesh(box(1.4, 0.25, 0.80, c), 0, 0.25, 0));
  g.add(applyMesh(box(1.4, 0.60, 0.18, c), 0, 0.62, -0.31));
  g.add(applyMesh(box(0.18, 0.46, 0.80, c), -0.61, 0.43, 0));
  g.add(applyMesh(box(0.18, 0.46, 0.80, c),  0.61, 0.43, 0));
  return g;
}

function buildArmchair(color) {
  const g = new THREE.Group();
  const c = color || '#8a6548';
  g.add(applyMesh(box(0.90, 0.22, 0.80, c), 0, 0.22, 0));
  g.add(applyMesh(box(0.90, 0.55, 0.16, c), 0, 0.56, -0.32));
  g.add(applyMesh(box(0.16, 0.42, 0.80, c), -0.37, 0.40, 0));
  g.add(applyMesh(box(0.16, 0.42, 0.80, c),  0.37, 0.40, 0));
  [-0.35, 0.35].forEach(x => [-0.3, 0.3].forEach(z =>
    g.add(applyMesh(cyl(0.03, 0.03, 0.18, '#2e1e0e'), x, 0.09, z))
  ));
  return g;
}

function buildOttoman(color) {
  const g = new THREE.Group();
  const c = color || '#b07d55';
  g.add(applyMesh(box(0.9, 0.32, 0.65, c), 0, 0.32, 0));
  // small legs
  [-0.38, 0.38].forEach(x => [-0.26, 0.26].forEach(z =>
    g.add(applyMesh(box(0.07, 0.12, 0.07, '#3a2a1a'), x, 0.06, z))
  ));
  return g;
}

function buildCoffeeTable(color) {
  const g = new THREE.Group();
  const c = color || '#7a5c3a';
  g.add(applyMesh(box(1.2, 0.06, 0.65, c, 0.5), 0, 0.42, 0));
  // 4 legs
  [-0.52, 0.52].forEach(x => [-0.26, 0.26].forEach(z =>
    g.add(applyMesh(cyl(0.04, 0.04, 0.40, '#5a3c22'), x, 0.20, z))
  ));
  return g;
}

function buildDiningTable(color) {
  const g = new THREE.Group();
  const c = color || '#5c3d22';
  g.add(applyMesh(box(1.8, 0.07, 0.9, c, 0.5), 0, 0.74, 0));
  [-0.78, 0.78].forEach(x => [-0.36, 0.36].forEach(z =>
    g.add(applyMesh(cyl(0.04, 0.04, 0.72, '#4a2e12'), x, 0.36, z))
  ));
  return g;
}

function buildDiningChair(color) {
  const g = new THREE.Group();
  const c = color || '#6e4c2a';
  g.add(applyMesh(box(0.48, 0.06, 0.48, c, 0.5), 0, 0.44, 0));
  g.add(applyMesh(box(0.48, 0.50, 0.05, c), 0, 0.72, -0.22));
  [-0.20, 0.20].forEach(x => [-0.20, 0.20].forEach(z =>
    g.add(applyMesh(cyl(0.025, 0.025, 0.44, '#3a2010'), x, 0.22, z))
  ));
  return g;
}

function buildSideTable(color) {
  const g = new THREE.Group();
  const c = color || '#7a5c3a';
  g.add(applyMesh(box(0.55, 0.05, 0.55, c, 0.5), 0, 0.58, 0));
  g.add(applyMesh(cyl(0.06, 0.06, 0.56, '#5a3c22'), 0, 0.28, 0));
  g.add(applyMesh(box(0.45, 0.03, 0.45, '#5a3c22', 0.5), 0, 0.03, 0));
  return g;
}

function buildBedDouble(color) {
  const g = new THREE.Group();
  const c = color || '#8c7b6a';
  // frame
  g.add(applyMesh(box(1.8, 0.20, 2.2, '#5a3c22'), 0, 0.10, 0));
  // mattress
  g.add(applyMesh(box(1.65, 0.24, 1.90, '#ddd0c0'), 0, 0.32, 0.08));
  // headboard
  g.add(applyMesh(box(1.80, 0.80, 0.12, c), 0, 0.54, -1.04));
  // pillow x2
  g.add(applyMesh(box(0.55, 0.10, 0.32, '#f5f0ea'), -0.42, 0.47, -0.72));
  g.add(applyMesh(box(0.55, 0.10, 0.32, '#f5f0ea'),  0.42, 0.47, -0.72));
  // blanket
  g.add(applyMesh(box(1.60, 0.08, 1.10, c), 0, 0.45, 0.40));
  return g;
}

function buildBedSingle(color) {
  const g = new THREE.Group();
  const c = color || '#9c8878';
  g.add(applyMesh(box(0.98, 0.18, 2.0, '#5a3c22'), 0, 0.09, 0));
  g.add(applyMesh(box(0.90, 0.22, 1.76, '#ddd0c0'), 0, 0.29, 0.06));
  g.add(applyMesh(box(0.98, 0.72, 0.10, c), 0, 0.50, -0.96));
  g.add(applyMesh(box(0.60, 0.08, 0.30, '#f5f0ea'), 0, 0.42, -0.70));
  g.add(applyMesh(box(0.86, 0.07, 0.90, c), 0, 0.40, 0.40));
  return g;
}

function buildNightstand(color) {
  const g = new THREE.Group();
  const c = color || '#7a5c3a';
  g.add(applyMesh(box(0.50, 0.55, 0.40, c), 0, 0.275, 0));
  // drawer line
  g.add(applyMesh(box(0.48, 0.005, 0.38, '#3a2010'), 0, 0.35, 0));
  // knob
  g.add(applyMesh(cyl(0.02, 0.02, 0.04, '#ccaa55', 8), 0, 0.38, 0.21));
  // legs
  [-0.21, 0.21].forEach(x => [-0.17, 0.17].forEach(z =>
    g.add(applyMesh(cyl(0.025, 0.025, 0.06, '#3a2010'), x, 0.03, z))
  ));
  return g;
}

function buildDresser(color) {
  const g = new THREE.Group();
  const c = color || '#8c7060';
  g.add(applyMesh(box(1.1, 0.90, 0.50, c), 0, 0.45, 0));
  // 3 drawer lines
  [0.28, 0.02, -0.24].forEach(y =>
    g.add(applyMesh(box(1.08, 0.002, 0.48, '#3a2010'), 0, y + 0.45, 0.001))
  );
  // knobs (2 per drawer)
  [0.28, 0.02, -0.24].forEach(y =>
    [-0.22, 0.22].forEach(x =>
      g.add(applyMesh(cyl(0.02, 0.02, 0.03, '#ccaa55', 8), x, y + 0.45, 0.26))
    )
  );
  return g;
}

function buildBookshelf(color) {
  const g = new THREE.Group();
  const c = color || '#4e3620';
  // main box (sides + back)
  g.add(applyMesh(box(0.90, 1.80, 0.30, c), 0, 0.90, 0));
  // 3 shelves
  [0.35, 0.80, 1.25].forEach(y =>
    g.add(applyMesh(box(0.86, 0.02, 0.28, '#3a2010'), 0, y, 0))
  );
  // books decoration
  const bookColors = ['#c0392b','#2980b9','#27ae60','#e67e22','#8e44ad'];
  let bx = -0.30;
  bookColors.forEach((bc, i) => {
    const bw = 0.06 + Math.random() * 0.04;
    g.add(applyMesh(box(bw, 0.22, 0.22, bc), bx + i * 0.12, 0.46, 0));
    g.add(applyMesh(box(bw, 0.19, 0.22, bc), bx + i * 0.12, 0.91, 0));
  });
  return g;
}

function buildWardrobe(color) {
  const g = new THREE.Group();
  const c = color || '#5e4830';
  g.add(applyMesh(box(1.40, 2.10, 0.60, c), 0, 1.05, 0));
  // door split line
  g.add(applyMesh(box(0.006, 2.08, 0.58, '#2e1e0e'), 0, 1.05, 0));
  // handles
  g.add(applyMesh(cyl(0.02, 0.02, 0.20, '#ccaa55', 8), -0.12, 1.10, 0.31, Math.PI/2, 0, 0));
  g.add(applyMesh(cyl(0.02, 0.02, 0.20, '#ccaa55', 8),  0.12, 1.10, 0.31, Math.PI/2, 0, 0));
  return g;
}

function buildTvStand(color) {
  const g = new THREE.Group();
  const c = color || '#2a2a35';
  // cabinet
  g.add(applyMesh(box(1.80, 0.45, 0.45, c), 0, 0.225, 0));
  // legs
  [-0.84, 0.84].forEach(x =>
    g.add(applyMesh(box(0.06, 0.08, 0.40, '#1a1a22'), x, 0.04, 0))
  );
  // TV screen
  g.add(applyMesh(box(1.50, 0.85, 0.05, '#111116'), 0, 0.875, -0.10));
  g.add(applyMesh(box(1.40, 0.78, 0.01, '#0a0a12'), 0, 0.875, -0.13)); // screen surface
  // legs of TV
  g.add(applyMesh(box(0.06, 0.12, 0.06, '#222228'), 0, 0.465, -0.10));
  return g;
}

function buildPlant(color) {
  const g = new THREE.Group();
  // pot
  const potGeo = new THREE.CylinderGeometry(0.18, 0.13, 0.32, 16);
  const potMesh = new THREE.Mesh(potGeo, mat('#c0542a'));
  potMesh.position.y = 0.16;
  potMesh.castShadow = true;
  g.add(potMesh);
  // soil
  const soilMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 16), mat('#3a2010'));
  soilMesh.position.y = 0.32;
  g.add(soilMesh);
  // trunk
  g.add(applyMesh(cyl(0.03, 0.04, 0.60, '#5a3010'), 0, 0.62, 0));
  // foliage spheres
  const leafMat = mat(color || '#2d6a2d', 0.95);
  const addLeaf = (x, y, z, r) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), leafMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
  };
  addLeaf(0, 1.05, 0, 0.32);
  addLeaf(-0.18, 0.90, 0.10, 0.22);
  addLeaf(0.18, 0.92, -0.08, 0.20);
  addLeaf(0, 0.82, 0.18, 0.18);
  return g;
}

function buildFloorLamp(color) {
  const g = new THREE.Group();
  // base
  g.add(applyMesh(cyl(0.18, 0.20, 0.05, '#2a2a2a'), 0, 0.025, 0));
  // pole
  g.add(applyMesh(cyl(0.025, 0.025, 1.65, '#888888'), 0, 0.875, 0));
  // shade (cone)
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.14, 0.30, 16, 1, true),
    mat(color || '#ccaa55', 0.6)
  );
  shade.position.y = 1.80;
  shade.castShadow = true;
  g.add(shade);
  // bulb glow point
  const pl = new THREE.PointLight(0xffe8aa, 0.8, 3.5);
  pl.position.y = 1.72;
  g.add(pl);
  return g;
}

function buildTableLamp(color) {
  const g = new THREE.Group();
  g.add(applyMesh(cyl(0.10, 0.12, 0.04, '#2a2a2a'), 0, 0.02, 0));
  g.add(applyMesh(cyl(0.02, 0.02, 0.35, '#888888'), 0, 0.20, 0));
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.09, 0.20, 16, 1, true),
    mat(color || '#ddcc88', 0.6)
  );
  shade.position.y = 0.47;
  g.add(shade);
  const pl = new THREE.PointLight(0xffe8aa, 0.5, 2.5);
  pl.position.y = 0.42;
  g.add(pl);
  return g;
}

function buildRug(color) {
  const g = new THREE.Group();
  const rug = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.015, 1.5),
    mat(color || '#c0392b', 0.95)
  );
  rug.position.y = 0.008;
  rug.receiveShadow = true;
  // border
  const border = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.01, 1.6),
    mat('#8a1010', 0.95)
  );
  border.position.y = 0.005;
  g.add(border);
  g.add(rug);
  return g;
}

function buildPainting(color) {
  const g = new THREE.Group();
  // frame
  g.add(applyMesh(box(1.0, 0.75, 0.05, '#5a3c22'), 0, 0, 0));
  // canvas
  g.add(applyMesh(box(0.88, 0.63, 0.03, color || '#3a5faa', 0.5), 0, 0, 0.02));
  // art detail stripes
  g.add(applyMesh(box(0.30, 0.63, 0.01, '#f4c842', 0.8), -0.20, 0, 0.04));
  g.add(applyMesh(box(0.12, 0.63, 0.01, '#e74c3c', 0.8),  0.24, 0, 0.04));
  return g;
}

// ─────────────────────────────────────────────────────────────────
// 6. ADD FURNITURE TO SCENE
// ─────────────────────────────────────────────────────────────────

window.addFurniture = function(defId, x = null, z = null, ry = null) {
  const def = CATALOG.find(d => d.id === defId);
  if (!def) return;

  // Save undo snapshot
  pushUndo();

  const group = def.build(def.color);
  group.name = def.name;
  group.userData = {
    defId: def.id,
    defColor: def.color,
    rotation: ry || 0,
    scale: 1,
  };

  // Setup position
  let tx = x !== null ? x : (Math.random() - 0.5) * (roomW * 0.5);
  let tz = z !== null ? z : (Math.random() - 0.5) * (roomD * 0.5);

  // Paintings go on the back wall
  if (defId === 'painting') {
    group.position.set(tx, 1.2, -roomD / 2 + 0.1);
  } else {
    group.position.set(tx, 0, tz);
  }

  if (ry !== null) group.rotation.y = ry;

  group.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

  scene.add(group);
  const entry = { group, def, uid: Date.now() + Math.random() };
  furnitureObjects.push(entry);

  selectObject(entry);
  updateUI();
  setStatus(`Added ${def.name} — drag to position`);
};

// ─────────────────────────────────────────────────────────────────
// 7. SELECTION & DRAGGING
// ─────────────────────────────────────────────────────────────────

function getEventXY(e) {
  if (e.touches) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

function toNDC(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((clientX - rect.left) / rect.width)  * 2 - 1;
  mouse.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
}

function getClickedEntry(clientX, clientY) {
  toNDC(clientX, clientY);
  raycaster.setFromCamera(mouse, camera);
  const meshes = [];
  furnitureObjects.forEach(e => e.group.traverse(c => { if (c.isMesh) meshes.push(c); }));
  const hits = raycaster.intersectObjects(meshes, false);
  if (!hits.length) return null;
  const hitObj = hits[0].object;
  return furnitureObjects.find(e => {
    let found = false;
    e.group.traverse(c => { if (c === hitObj) found = true; });
    return found;
  });
}

function selectObject(entry) {
  // Clear previous highlight
  if (selectedObj) clearHighlight(selectedObj.group);
  selectedObj = entry;
  if (!entry) {
    document.getElementById('props-hud').classList.add('hidden');
    document.getElementById('stat-sel').textContent = '—';
    document.querySelectorAll('.item-list li').forEach(li => li.classList.remove('selected'));
    return;
  }
  applyHighlight(entry.group);
  // Update HUD
  const hud = document.getElementById('props-hud');
  hud.classList.remove('hidden');
  document.getElementById('props-name').textContent = entry.def.name;
  const rotDeg = Math.round((entry.group.userData.rotation || 0) * 180 / Math.PI) % 360;
  const posRot = rotDeg < 0 ? rotDeg + 360 : rotDeg;
  document.getElementById('prop-rotate').value = posRot;
  document.getElementById('prop-rotate-val').textContent = posRot + '°';
  document.getElementById('prop-scale').value = Math.round((entry.group.userData.scale || 1) * 100);
  document.getElementById('prop-scale-val').textContent = Math.round((entry.group.userData.scale || 1) * 100) + '%';
  document.getElementById('prop-color').value = entry.def.color;
  document.getElementById('stat-sel').textContent = entry.def.name;
  // Highlight item list
  document.querySelectorAll('.item-list li').forEach(li => li.classList.remove('selected'));
  const li = document.getElementById('li-' + entry.uid);
  if (li) li.classList.add('selected');
}

function applyHighlight(group) {
  group.traverse(c => {
    if (c.isMesh && c.material) {
      c.material = c.material.clone();
      c.material.emissive = new THREE.Color(0x2244ff);
      c.material.emissiveIntensity = 0.18;
    }
  });
}

function clearHighlight(group) {
  group.traverse(c => {
    if (c.isMesh && c.material && c.material.emissive) {
      c.material.emissive.set(0x000000);
      c.material.emissiveIntensity = 0;
    }
  });
}

// Mouse events
let pointerDownPos = null;

canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const { x, y } = getEventXY(e);
  pointerDownPos = { x, y };

  const entry = getClickedEntry(x, y);
  if (entry) {
    selectObject(entry);
    isDragging = true;
    controls.enabled = false;

    // Calculate drag offset on XZ plane
    toNDC(x, y);
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(dragPlane, intersectPoint);
    dragOffset.copy(intersectPoint).sub(entry.group.position);
  }
});

canvas.addEventListener('pointermove', e => {
  if (!isDragging || !selectedObj) return;
  const { x, y } = getEventXY(e);
  toNDC(x, y);
  raycaster.setFromCamera(mouse, camera);

  if (raycaster.ray.intersectPlane(dragPlane, intersectPoint)) {
    const newX = intersectPoint.x - dragOffset.x;
    const newZ = intersectPoint.z - dragOffset.z;
    // Clamp to room bounds
    const hw = roomW / 2 - 0.3, hd = roomD / 2 - 0.3;
    selectedObj.group.position.x = Math.max(-hw, Math.min(hw, newX));
    selectedObj.group.position.z = Math.max(-hd, Math.min(hd, newZ));
  }
});

canvas.addEventListener('pointerup', e => {
  if (isDragging) {
    isDragging = false;
    controls.enabled = true;
    setStatus('Object placed · Use controls to adjust');
  } else if (e.button === 0 && pointerDownPos) {
    // Click with no drag → deselect if clicking empty
    const { x, y } = getEventXY(e);
    const dist = Math.hypot(x - pointerDownPos.x, y - pointerDownPos.y);
    if (dist < 5) {
      const entry = getClickedEntry(x, y);
      if (!entry) selectObject(null);
    }
  }
  pointerDownPos = null;
});

// ─────────────────────────────────────────────────────────────────
// 8. PROPERTY CONTROLS (called from HTML)
// ─────────────────────────────────────────────────────────────────

window.rotateSelected = function(deg) {
  if (!selectedObj) return;
  const rad = deg * Math.PI / 180;
  selectedObj.group.rotation.y = rad;
  selectedObj.group.userData.rotation = rad;
  document.getElementById('prop-rotate-val').textContent = deg + '°';
};

window.scaleSelected = function(val) {
  if (!selectedObj) return;
  const s = val / 100;
  selectedObj.group.scale.setScalar(s);
  selectedObj.group.userData.scale = s;
  document.getElementById('prop-scale-val').textContent = val + '%';
};

window.colorSelected = function(hex) {
  if (!selectedObj) return;
  selectedObj.def.color = hex;
  // Rebuild the furniture with new color
  const entry = selectedObj;
  const pos = entry.group.position.clone();
  const rot = entry.group.rotation.y;
  const scl = entry.group.userData.scale || 1;
  scene.remove(entry.group);
  const newGroup = entry.def.build(hex);
  newGroup.name = entry.def.name;
  newGroup.position.copy(pos);
  newGroup.rotation.y = rot;
  newGroup.scale.setScalar(scl);
  newGroup.userData = { ...entry.group.userData, defColor: hex };
  newGroup.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  scene.add(newGroup);
  entry.group = newGroup;
  selectObject(entry);
};

window.deleteSelected = function() {
  if (!selectedObj) return;
  pushUndo();
  scene.remove(selectedObj.group);
  furnitureObjects = furnitureObjects.filter(e => e !== selectedObj);
  selectedObj = null;
  document.getElementById('props-hud').classList.add('hidden');
  document.getElementById('stat-sel').textContent = '—';
  updateUI();
  setStatus('Object deleted');
};

window.cloneSelected = function() {
  if (!selectedObj) return;
  pushUndo();
  const src = selectedObj;
  const newGroup = src.def.build(src.def.color);
  newGroup.name = src.def.name;
  newGroup.position.copy(src.group.position).add(new THREE.Vector3(0.5, 0, 0.5));
  newGroup.rotation.y = src.group.rotation.y;
  const s = src.group.userData.scale || 1;
  newGroup.scale.setScalar(s);
  newGroup.userData = { ...src.group.userData };
  newGroup.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  scene.add(newGroup);
  const entry = { group: newGroup, def: src.def, uid: Date.now() };
  furnitureObjects.push(entry);
  selectObject(entry);
  updateUI();
  setStatus(`Duplicated ${src.def.name}`);
};

// ─────────────────────────────────────────────────────────────────
// 9. ROOM CONTROLS
// ─────────────────────────────────────────────────────────────────

window.resizeRoom = function() {
  roomW = parseInt(document.getElementById('room-w').value) || 10;
  roomD = parseInt(document.getElementById('room-d').value) || 10;
  buildRoom();
  setStatus(`Room resized to ${roomW}m × ${roomD}m`);
};

window.updateWallColor = function(hex) {
  wallMeshes.forEach(m => { if (m.material) m.material.color.set(hex); });
};

window.updateFloorColor = function(hex) {
  if (floorMesh) floorMesh.material.color.set(hex);
};

// ─────────────────────────────────────────────────────────────────
// 10. UNDO / CLEAR / SAVE
// ─────────────────────────────────────────────────────────────────

function pushUndo() {
  // Snapshot current furniture positions
  history.push(furnitureObjects.map(e => ({
    defId: e.def.id,
    color: e.def.color,
    px: e.group.position.x,
    py: e.group.position.y,
    pz: e.group.position.z,
    ry: e.group.rotation.y,
    sc: e.group.userData.scale || 1,
    uid: e.uid,
  })));
  if (history.length > 30) history.shift();
}

document.getElementById('btn-undo').addEventListener('click', () => {
  if (!history.length) { setStatus('Nothing to undo'); return; }
  const snap = history.pop();
  // Clear scene furniture
  furnitureObjects.forEach(e => scene.remove(e.group));
  furnitureObjects = [];
  selectObject(null);

  snap.forEach(s => {
    const def = CATALOG.find(d => d.id === s.defId);
    if (!def) return;
    const group = def.build(s.color);
    group.name = def.name;
    group.position.set(s.px, s.py, s.pz);
    group.rotation.y = s.ry;
    group.scale.setScalar(s.sc);
    group.userData = { defId: s.defId, defColor: s.color, rotation: s.ry, scale: s.sc };
    group.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    scene.add(group);
    furnitureObjects.push({ group, def, uid: s.uid });
  });
  updateUI();
  setStatus('Undone');
});

document.getElementById('btn-clear').addEventListener('click', () => {
  if (!furnitureObjects.length) return;
  if (!confirm('Clear all furniture from the room?')) return;
  pushUndo();
  furnitureObjects.forEach(e => scene.remove(e.group));
  furnitureObjects = [];
  selectObject(null);
  updateUI();
  setStatus('Room cleared');
});

document.getElementById('btn-save').addEventListener('click', () => {
  const data = {
    savedAt: new Date().toISOString(),
    roomW, roomD,
    wallColor: document.getElementById('wall-color').value,
    floorColor: document.getElementById('floor-color').value,
    furniture: furnitureObjects.map(e => ({
      defId: e.def.id,
      name: e.def.name,
      color: e.def.color,
      position: { x: e.group.position.x, y: e.group.position.y, z: e.group.position.z },
      rotationY: e.group.rotation.y,
      scale: e.group.userData.scale || 1,
    })),
  };
  localStorage.setItem('room-planner-save', JSON.stringify(data));
  // Also download
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'room-layout.json'; a.click();
  URL.revokeObjectURL(url);
  setStatus('Room layout saved!');
});

document.getElementById('btn-ai').addEventListener('click', () => {
  if (!furnitureObjects.length) {
    if (!confirm('Your room is empty. Transform anyway?')) return;
  }
  
  // Deselect any active furniture to hide the selection box
  selectObject(null);
  updateUI();
  
  // Force a fresh render
  renderer.render(scene, camera);
  
  // Grab the base64 JPEG from the canvas
  const dataURL = renderer.domElement.toDataURL('image/jpeg', 0.85);
  
  // Save to sessionStorage and navigate
  sessionStorage.setItem('tf-initial-image', dataURL);
  window.location.href = '/room-transform';
});

// ─────────────────────────────────────────────────────────────────
// 11. TOP VIEW TOGGLE
// ─────────────────────────────────────────────────────────────────

let isTopView = false;
document.getElementById('btn-topview').addEventListener('click', () => {
  isTopView = !isTopView;
  const btn = document.getElementById('btn-topview');
  if (isTopView) {
    camera.position.set(0, 22, 0.01);
    camera.lookAt(0, 0, 0);
    controls.maxPolarAngle = 0.01;
    btn.textContent = '🌐 3D View';
  } else {
    camera.position.set(0, 12, 14);
    camera.lookAt(0, 0, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    btn.textContent = '📐 Top View';
  }
  setStatus(isTopView ? 'Top-down 2D view' : '3D perspective view');
});

// ─────────────────────────────────────────────────────────────────
// 12. CATALOG UI
// ─────────────────────────────────────────────────────────────────

let activeCat = 'all';

function renderCatalog(filter = '') {
  const list = document.getElementById('catalog-list');
  list.innerHTML = '';
  const q = filter.toLowerCase();
  CATALOG
    .filter(d => (activeCat === 'all' || d.cat === activeCat))
    .filter(d => !q || d.name.toLowerCase().includes(q))
    .forEach(def => {
      const el = document.createElement('div');
      el.className = 'catalog-item';
      el.innerHTML = `<span class="catalog-item-icon">${def.icon}</span>
        <div class="catalog-item-info">
          <div class="catalog-item-name">${def.name}</div>
          <div class="catalog-item-cat">${def.cat}</div>
        </div>`;
      el.addEventListener('click', () => addFurniture(def.id));
      list.appendChild(el);
    });
}

window.setCat = function(btn, cat) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeCat = cat;
  renderCatalog(document.getElementById('catalog-search').value);
};

window.filterCatalog = function(q) { renderCatalog(q); };

renderCatalog();

// ─────────────────────────────────────────────────────────────────
// 13. UI UPDATES
// ─────────────────────────────────────────────────────────────────

function updateUI() {
  document.getElementById('stat-count').textContent = furnitureObjects.length;
  const ul = document.getElementById('item-list');
  ul.innerHTML = '';
  furnitureObjects.forEach(e => {
    const li = document.createElement('li');
    li.id = 'li-' + e.uid;
    li.innerHTML = `${e.def.icon || '📦'} ${e.def.name}`;
    if (selectedObj === e) li.classList.add('selected');
    li.addEventListener('click', () => selectObject(e));
    ul.appendChild(li);
  });
}

function setStatus(msg) {
  document.getElementById('status-bar').textContent = msg;
}

// ─────────────────────────────────────────────────────────────────
// 14. RESIZE & RENDER LOOP
// ─────────────────────────────────────────────────────────────────

function onResize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

function animate() {
  requestAnimationFrame(animate);
  onResize();
  controls.update();
  renderer.render(scene, camera);
}

animate();

// ─────────────────────────────────────────────────────────────────
// 15. LOAD SAVED LAYOUT ON START
// ─────────────────────────────────────────────────────────────────

(function loadSaved() {
  const raw = localStorage.getItem('room-planner-save');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    roomW = data.roomW || 10;
    roomD = data.roomD || 10;
    document.getElementById('room-w').value = roomW;
    document.getElementById('room-d').value = roomD;
    if (data.wallColor) { document.getElementById('wall-color').value = data.wallColor; }
    if (data.floorColor) { document.getElementById('floor-color').value = data.floorColor; }
    buildRoom();
    if (data.wallColor) updateWallColor(data.wallColor);
    if (data.floorColor) updateFloorColor(data.floorColor);

    (data.furniture || []).forEach(s => {
      const def = CATALOG.find(d => d.id === s.defId);
      if (!def) return;
      const group = def.build(s.color || def.color);
      group.name = def.name;
      group.position.set(s.position.x, s.position.y, s.position.z);
      group.rotation.y = s.rotationY || 0;
      const sc = s.scale || 1;
      group.scale.setScalar(sc);
      group.userData = { defId: s.defId, defColor: s.color, rotation: s.rotationY, scale: sc };
      group.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
      scene.add(group);
      const entry = { group, def: { ...def, color: s.color || def.color }, uid: Date.now() + Math.random() };
      furnitureObjects.push(entry);
    });
    updateUI();
    setStatus(`Loaded saved layout with ${furnitureObjects.length} items`);
  } catch (e) {
    console.warn('Could not load saved layout:', e);
  }
})();

// ─────────────────────────────────────────────────────────────────
// 16. AI AUTO-ARRANGE CHATBOT
// ─────────────────────────────────────────────────────────────────

window.toggleChat = function() {
  document.getElementById('ai-chat-panel').classList.toggle('hidden');
  const input = document.getElementById('chat-input');
  if (!document.getElementById('ai-chat-panel').classList.contains('hidden')) {
    input.focus();
  }
};

const layouts = {
  modern: [
    { id: 'rug', x: 0, z: 0, ry: 0 },
    { id: 'sofa', x: 0, z: -1.2, ry: 0 },
    { id: 'coffee-table', x: 0, z: 0.2, ry: 0 },
    { id: 'tv-stand', x: 0, z: 2.5, ry: Math.PI }
  ],
  minimal: [
    { id: 'rug', x: 0, z: 0, ry: 0 },
    { id: 'loveseat', x: 0, z: -1.5, ry: 0 },
    { id: 'coffee-table', x: 0, z: 0.5, ry: 0 },
    { id: 'painting', x: 0, z: 0, ry: 0 }
  ],
  scandinavian: [
    { id: 'rug', x: 0, z: -0.2, ry: 0 },
    { id: 'sofa', x: -1.2, z: -1.0, ry: 0 },
    { id: 'armchair', x: 1.5, z: -0.5, ry: -Math.PI / 4 },
    { id: 'coffee-table', x: 0.2, z: 0.5, ry: 0 },
    { id: 'painting', x: 0, z: 0, ry: 0 }
  ]
};

window.sendChat = function() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  
  const body = document.getElementById('chat-body');
  body.innerHTML += `<div class="chat-msg user-msg">${text}</div>`;
  input.value = '';
  body.scrollTop = body.scrollHeight;
  
  // Show typing dot
  const tempId = 'typing-' + Date.now();
  body.innerHTML += `<div id="${tempId}" class="chat-msg ai-msg">...</div>`;
  body.scrollTop = body.scrollHeight;

  setTimeout(() => processAiChat(text, tempId), 800);
};

function processAiChat(text, tempId) {
  const lower = text.toLowerCase();
  const body = document.getElementById('chat-body');
  document.getElementById(tempId).remove();
  
  let response = "I'm still learning! Try asking me to 'Create a modern living room', 'make a scandinavian setup', or 'add a sofa'.";
  
  if (lower.includes('modern') || lower.includes('living room')) {
    applyLayout(layouts.modern);
    response = "I've arranged a full modern living room for you! Feel free to drag things around.";
  } else if (lower.includes('minimal')) {
    applyLayout(layouts.minimal);
    response = "Minimalism is great. I've set up a clean, minimal space.";
  } else if (lower.includes('scandinavian') || lower.includes('cozy')) {
    applyLayout(layouts.scandinavian);
    response = "I've arranged a cozy scandinavian layout with an armchair and rug.";
  } else if (lower.includes('sofa') || lower.includes('couch')) {
    addFurniture('sofa');
    response = "Added a sofa to the room! You can drag it to position.";
  } else if (lower.includes('table')) {
    addFurniture('coffee-table');
    response = "Added a coffee table! Drag it where you like.";
  } else if (lower.includes('clear')) {
    document.getElementById('btn-clear').click();
    response = "Cleared the room!";
  }

  body.innerHTML += `<div class="chat-msg ai-msg">${response}</div>`;
  body.scrollTop = body.scrollHeight;
}

function applyLayout(layout) {
  // Clear room
  if (furnitureObjects.length > 0) {
    furnitureObjects.forEach(e => scene.remove(e.group));
    furnitureObjects = [];
    selectObject(null);
  }
  
  // Stagger adding items for effect
  layout.forEach((item, i) => {
    setTimeout(() => {
      addFurniture(item.id, item.x, item.z, item.ry);
    }, i * 200);
  });
}
