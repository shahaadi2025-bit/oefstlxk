// WindDesk hero scene: low-poly dusk terrain, wind turbines and flowing wind streamlines.
// Plain JS on purpose: the same file also runs inside the Three.js chat viewer for previews.
import * as THREE from "three";

export const terrainHeight = (x, z) =>
  1.5 * Math.sin(x * 0.16 + 0.6) * Math.cos(z * 0.13) +
  0.8 * Math.sin(x * 0.07 + z * 0.1 + 1.3) +
  0.35 * Math.sin(x * 0.45) * Math.sin(z * 0.38);

const rand = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, "rgba(200,255,62,0.95)");
  grad.addColorStop(0.25, "rgba(200,255,62,0.32)");
  grad.addColorStop(1, "rgba(200,255,62,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createWindScene(canvas, opts = {}) {
  const { reduced = false, mobile = false } = opts;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.setClearColor(0x07090c, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x10232b, 0.016);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 260);

  // sky: vertical gradient on an inverted sphere
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(150, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color("#04060a") },
        mid: { value: new THREE.Color("#0b1824") },
        hor: { value: new THREE.Color("#1f4140") },
      },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader:
        "uniform vec3 top; uniform vec3 mid; uniform vec3 hor; varying vec3 vP;" +
        "void main(){ float h = clamp(vP.y,0.0,1.0); vec3 c = mix(hor, mid, smoothstep(0.0,0.22,h)); c = mix(c, top, smoothstep(0.18,0.85,h)); gl_FragColor = vec4(c,1.0); }",
    }),
  );
  scene.add(sky);

  // low sun / moon glow on the horizon
  const glowMap = glowTexture();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  glow.position.set(-16, 9, -90);
  glow.scale.set(70, 70, 1);
  scene.add(glow);

  // terrain
  const seg = mobile ? 70 : 110;
  const tGeo = new THREE.PlaneGeometry(110, 110, seg, seg);
  tGeo.rotateX(-Math.PI / 2);
  const pos = tGeo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const low = new THREE.Color("#0e1b24");
  const high = new THREE.Color("#2a5a62");
  const tint = new THREE.Color("#3f5f28");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const k = THREE.MathUtils.clamp((h + 1.5) / 4, 0, 1);
    const c = low.clone().lerp(high, k).lerp(tint, Math.max(0, k - 0.75) * 1.6);
    col.set([c.r, c.g, c.b], i * 3);
  }
  tGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  tGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, flatShading: true }));
  terrain.position.set(0, 0, -30);
  scene.add(terrain);

  // lights
  scene.add(new THREE.HemisphereLight(0x2c5164, 0x05070a, 0.95));
  const rim = new THREE.DirectionalLight(0xc8ff3e, 1.15);
  rim.position.set(-14, 10, -26);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0x5ad1ff, 0.6);
  fill.position.set(16, 9, 12);
  scene.add(fill);

  // turbines
  const towerGeo = new THREE.CylinderGeometry(0.06, 0.12, 1, 8);
  towerGeo.translate(0, 0.5, 0);
  const bladeGeo = new THREE.BoxGeometry(0.11, 1, 0.025);
  bladeGeo.translate(0, 0.5, 0);
  const hubGeo = new THREE.SphereGeometry(0.15, 12, 8);
  const nacGeo = new THREE.BoxGeometry(0.28, 0.2, 0.6);
  const beaconGeo = new THREE.SphereGeometry(0.06, 8, 6);
  const white = new THREE.MeshStandardMaterial({ color: 0xe3ebf2, emissive: 0x2a3f52, roughness: 0.45, metalness: 0.12 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xc8ff3e });
  const rotors = [];
  const beacons = [];
  const N_TURB = mobile ? 9 : 14;
  for (let i = 0; i < N_TURB; i++) {
    const x = -34 + (i / (N_TURB - 1)) * 68 + (rand(i + 1) - 0.5) * 6;
    const z = -6 - rand(i + 40) * 40;
    const s = 0.9 + rand(i + 90) * 0.7 + (z > -16 ? 0.25 : 0);
    const H = 5.2 * s;
    const g = new THREE.Group();
    g.position.set(x, terrainHeight(x, z + 30 - 30) + 0, z);
    g.position.y = terrainHeight(x, z + 30);
    const tower = new THREE.Mesh(towerGeo, white);
    tower.scale.set(s, H, s);
    const nac = new THREE.Mesh(nacGeo, white);
    nac.position.y = H;
    const rotor = new THREE.Group();
    rotor.position.set(0, H, 0.38 * s);
    rotor.add(new THREE.Mesh(hubGeo, white));
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(bladeGeo, white);
      blade.scale.set(s, 2.5 * s, s);
      blade.rotation.z = (b * Math.PI * 2) / 3;
      rotor.add(blade);
    }
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, H + 0.2 * s, -0.12);
    g.add(tower, nac, rotor, beacon);
    g.rotation.y = -0.32 + (rand(i + 7) - 0.5) * 0.25;
    scene.add(g);
    rotors.push({ rotor, speed: 0.9 + rand(i + 13) * 0.7, phase: rand(i) * 6 });
    beacons.push({ beacon, phase: rand(i + 3) * 6 });
  }

  // wind streamlines: each particle is a short line, bright head fading to a transparent tail
  const NP = mobile ? 650 : 1500;
  const head = new Float32Array(NP * 3);
  const linePos = new Float32Array(NP * 6);
  const lineCol = new Float32Array(NP * 6);
  const colA = new THREE.Color("#c8ff3e");
  const colB = new THREE.Color("#5ad1ff");
  const respawn = (i, anywhere) => {
    head[i * 3] = anywhere ? -38 + rand(i * 3.1) * 76 : -38 - rand(i + performance.now()) * 4;
    head[i * 3 + 1] = 0.6 + rand(i * 1.7) * 7.5;
    head[i * 3 + 2] = -48 + rand(i * 2.3) * 62;
    const c = colA.clone().lerp(colB, rand(i * 5.3));
    const b = 0.3 + rand(i * 9.1) * 0.55;
    lineCol.set([c.r * b, c.g * b, c.b * b, 0, 0, 0], i * 6);
  };
  for (let i = 0; i < NP; i++) respawn(i, true);
  const lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3).setUsage(THREE.DynamicDrawUsage));
  lGeo.setAttribute("color", new THREE.BufferAttribute(lineCol, 3));
  const lines = new THREE.LineSegments(lGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 }));
  lines.frustumCulled = false;
  scene.add(lines);

  const flow = (x, y, z, t) => [
    1 + 0.25 * Math.sin(z * 0.2 + t * 0.6),
    0.12 * Math.sin(x * 0.35 + t),
    0.22 * Math.sin(x * 0.22 + z * 0.1 + t * 0.4),
  ];

  let t = 0;
  let wind = 1;
  const stepParticles = (dt) => {
    for (let i = 0; i < NP; i++) {
      const o = i * 3;
      const [vx, vy, vz] = flow(head[o], head[o + 1], head[o + 2], t);
      head[o] += vx * dt * 7 * wind;
      head[o + 1] += vy * dt * 7 * wind;
      head[o + 2] += vz * dt * 7 * wind;
      if (head[o] > 38) respawn(i, false);
      const p = i * 6;
      linePos[p] = head[o];
      linePos[p + 1] = head[o + 1];
      linePos[p + 2] = head[o + 2];
      linePos[p + 3] = head[o] - vx * 1.05 * wind;
      linePos[p + 4] = head[o + 1] - vy * 1.05 * wind;
      linePos[p + 5] = head[o + 2] - vz * 1.05 * wind;
    }
    lGeo.attributes.position.needsUpdate = true;
  };

  // camera rig
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let scroll = 0;
  const look = new THREE.Vector3();
  const updateCamera = () => {
    pointer.sx += (pointer.x - pointer.sx) * 0.05;
    pointer.sy += (pointer.y - pointer.sy) * 0.05;
    camera.position.set(pointer.sx * 1.8, 5.4 + pointer.sy * 0.8 + scroll * 2.2, 17 - scroll * 13);
    look.set(pointer.sx * 0.6, 2.7 + scroll * 0.8, -12 - scroll * 6);
    camera.lookAt(look);
  };

  const render = () => renderer.render(scene, camera);
  const frame = (dt) => {
    t += dt;
    wind = 0.8 + 0.25 * Math.sin(t * 0.3);
    for (const r of rotors) r.rotor.rotation.z -= dt * r.speed * wind * 1.6;
    for (const b of beacons) b.beacon.visible = Math.sin(t * 2.4 + b.phase) > -0.2;
    stepParticles(dt);
    updateCamera();
    render();
  };

  let raf = 0;
  let last = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    frame(dt);
  };

  const api = {
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.fov = camera.aspect < 0.8 ? 64 : 48;
      camera.updateProjectionMatrix();
      if (reduced || !raf) { updateCamera(); render(); }
    },
    setPointer(x, y) { pointer.x = x; pointer.y = y; },
    setScroll(p) { scroll = Math.min(1, Math.max(0, p)); if (reduced) { updateCamera(); render(); } },
    start() {
      if (reduced) {
        for (let k = 0; k < 40; k++) {
          stepParticles(0.05);
          t += 0.05;
        }
        updateCamera();
        render();
        return;
      }
      if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
    },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    dispose() {
      api.stop();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      });
      glowMap.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
  return api;
}
