import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// CognosCore3D — the cognitive-core visualization.
// A three.js scene: radiant central nexus, wireframe humanoid above, six
// distinct low-poly module objects arranged hexagonally firing colored beams
// to the core, on a holographic-grid charcoal background. UnrealBloom glow,
// OrbitControls (drag to orbit, tap a node to navigate to its surface).

const MODULES = [
  { label: 'Chat',      path: '/',          color: 0x3b82f6, shape: 'wave',    angle: 30 },
  { label: 'Insights',  path: '/insights',  color: 0xec4899, shape: 'icosa',   angle: 90 },
  { label: 'Memory',    path: '/memory',    color: 0x22d3ee, shape: 'gem',    angle: 150 },
  { label: 'Dynamics',  path: '/dynamics',  color: 0xf59e0b, shape: 'pyramid',angle: 210 },
  { label: 'Documents', path: '/documents', color: 0x10b981, shape: 'shield', angle: 270 },
  { label: 'Beliefs',   path: '/beliefs',   color: 0xa855f7, shape: 'crystal',angle: 330 }
];

const NEXUS_Y = 0.3;
const RING_R = 4;

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function fillMat(color) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false });
}
function edgeMat(color) {
  return new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
}

function buildShape(kind, color) {
  const g = new THREE.Group();
  if (kind === 'crystal') {
    const geo = new THREE.OctahedronGeometry(0.7, 0);
    geo.scale(1, 1.7, 1);
    g.add(new THREE.Mesh(geo, fillMat(color)));
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat(color)));
  } else if (kind === 'wave') {
    const geo = new THREE.TorusKnotGeometry(0.5, 0.16, 72, 8, 2, 3);
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.6 })));
  } else if (kind === 'icosa') {
    const geo = new THREE.IcosahedronGeometry(0.78, 0);
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat(color)));
    g.add(new THREE.Mesh(geo, fillMat(color)));
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.07, transparent: true, opacity: 0.9 })));
  } else if (kind === 'gem') {
    const geo = new THREE.DodecahedronGeometry(0.7, 0);
    g.add(new THREE.Mesh(geo, fillMat(color)));
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat(color)));
  } else if (kind === 'pyramid') {
    const tiers = [{ r: 0.7, h: 0.4, y: -0.4 }, { r: 0.54, h: 0.34, y: -0.06 }, { r: 0.38, h: 0.28, y: 0.24 }, { r: 0.22, h: 0.22, y: 0.48 }];
    tiers.forEach(t => {
      const geo = new THREE.ConeGeometry(t.r, t.h, 4, 1);
      const m = new THREE.Mesh(geo, fillMat(color)); m.position.y = t.y;
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat(color)); e.position.y = t.y;
      g.add(m, e);
    });
  } else if (kind === 'shield') {
    const s = new THREE.Shape();
    s.moveTo(0, 0.7);
    s.lineTo(0.5, 0.58);
    s.lineTo(0.5, 0.1);
    s.quadraticCurveTo(0.5, -0.22, 0, -0.7);
    s.quadraticCurveTo(-0.5, -0.22, -0.5, 0.1);
    s.lineTo(-0.5, 0.58);
    s.lineTo(0, 0.7);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: false });
    geo.center();
    g.add(new THREE.Mesh(geo, fillMat(color)));
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat(color)));
  }
  return g;
}

function buildHumanoid() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.45 });
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), mat); head.position.y = 0.95;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.28), mat); torso.position.y = 0.2;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), mat); armL.position.set(-0.36, 0.25, 0); armL.rotation.z = 0.32;
  const armR = armL.clone(); armR.position.x = 0.36; armR.rotation.z = -0.32;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), mat); legL.position.set(-0.15, -0.45, 0);
  const legR = legL.clone(); legR.position.x = 0.15;
  g.add(head, torso, armL, armR, legL, legR);
  return g;
}

function circleLine(r) {
  const pts = [];
  const segs = 96;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: 0x2a2a40, transparent: true, opacity: 0.5 }));
}

function makeBeam(start, end, color) {
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(0.03, 0.03, len, 8, 1, true);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(start).add(end).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return m;
}

export default function CognosCore3D() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const labelRefs = useRef([]);
  const nexusLabelRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const w = container.clientWidth || 600;
    const h = container.clientHeight || 460;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07070b);
    scene.fog = new THREE.Fog(0x07070b, 10, 22);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 2.2, 9.5);

    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(w, h);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 1.1, 0.6, 0.0);
    composer.addPass(bloom);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.target.set(0, 0.5, 0);

    const glowTex = makeGlowTexture();

    // --- central nexus ---
    const nexus = new THREE.Group();
    const coreGeo = new THREE.IcosahedronGeometry(0.32, 0);
    nexus.add(new THREE.LineSegments(new THREE.EdgesGeometry(coreGeo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })));
    nexus.add(new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false })));
    const nexusGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xcfeeff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    nexusGlow.scale.set(2.6, 2.6, 1);
    nexus.add(nexusGlow);
    nexus.position.set(0, NEXUS_Y, 0);
    scene.add(nexus);

    // --- humanoid above ---
    const humanoid = buildHumanoid();
    humanoid.position.set(0, 2.4, 0);
    scene.add(humanoid);

    // --- module nodes + beams + hit spheres ---
    const clickables = [];
    const beams = [];
    const moduleState = [];
    const nexusPos = new THREE.Vector3(0, NEXUS_Y, 0);

    MODULES.forEach((mod) => {
      const a = (mod.angle * Math.PI) / 180;
      const pos = new THREE.Vector3(RING_R * Math.cos(a), 0.15, RING_R * Math.sin(a));

      const group = buildShape(mod.shape, mod.color);
      group.position.copy(pos);
      scene.add(group);

      const mGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: mod.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      mGlow.scale.set(1.7, 1.7, 1);
      mGlow.position.copy(pos);
      scene.add(mGlow);

      const beam = makeBeam(new THREE.Vector3(pos.x, pos.y + 0.1, pos.z), nexusPos, mod.color);
      scene.add(beam);
      beams.push(beam);

      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 12, 12),
        new THREE.MeshBasicMaterial({ visible: true, transparent: true, opacity: 0, depthWrite: false })
      );
      hit.position.copy(pos);
      scene.add(hit);
      clickables.push({ mesh: hit, path: mod.path });

      moduleState.push({ pos: pos.clone() });
    });

    // --- holographic grid + scattered data markers ---
    [3, 5, 7, 9].forEach(r => {
      const ring = circleLine(r);
      ring.position.y = -1.0;
      scene.add(ring);
    });
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x3a4a7a, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 5.5 + Math.random() * 3.5;
      const y = -0.6 + Math.random() * 3.2;
      const bw = 0.1 + Math.random() * 0.35;
      const bh = 0.1 + Math.random() * 0.5;
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.02), markerMat);
      m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      m.lookAt(0, y, 0);
      scene.add(m);
    }

    // --- interaction ---
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickables.map(c => c.mesh));
      canvas.style.cursor = hits.length ? 'pointer' : 'grab';
    };
    const onDown = () => { canvas.style.cursor = 'grabbing'; };
    const onClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickables.map(c => c.mesh));
      if (hits.length) {
        const match = clickables.find(c => c.mesh === hits[0].object);
        if (match) navigate(match.path);
      }
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('click', onClick);

    // --- labels projection ---
    const tmp = new THREE.Vector3();
    const project = (world) => {
      tmp.copy(world).project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h, behind: tmp.z > 1 };
    };

    let raf;
    const animate = (t) => {
      raf = requestAnimationFrame(animate);
      humanoid.rotation.y += 0.004;
      moduleState.forEach(() => {});
      const pulse = 0.35 + 0.15 * Math.sin(t * 0.0018);
      beams.forEach(b => b.material.opacity = pulse);
      nexusGlow.scale.setScalar(2.5 + 0.18 * Math.sin(t * 0.0022));
      controls.update();

      moduleState.forEach((m, i) => {
        const el = labelRefs.current[i];
        if (!el) return;
        const p = project(m.pos);
        if (p.behind) { el.style.opacity = 0; return; }
        el.style.left = p.x + 'px';
        el.style.top = p.y + 'px';
        el.style.opacity = 0.92;
      });
      const nl = nexusLabelRef.current;
      if (nl) {
        const p = project(nexusPos);
        if (p.behind) nl.style.opacity = 0;
        else { nl.style.left = p.x + 'px'; nl.style.top = (p.y + 30) + 'px'; nl.style.opacity = 0.85; }
      }

      composer.render();
    };
    raf = requestAnimationFrame(animate);

    // --- resize ---
    const resize = () => {
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      if (!nw || !nh) return;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
      composer.setSize(nw, nh);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('click', onClick);
      ro.disconnect();
      controls.dispose();
      composer.dispose();
      renderer.dispose();
      glowTex.dispose();
    };
  }, [navigate]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="block w-full h-full" style={{ cursor: 'grab' }} />
      <div
        ref={nexusLabelRef}
        className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 text-white/85 text-[12px] font-semibold tracking-[0.25em] whitespace-nowrap"
        style={{ textShadow: '0 0 8px rgba(207,238,255,0.8)' }}
      >
        COGNOS
      </div>
      {MODULES.map((m, i) => (
        <div
          key={i}
          ref={el => (labelRefs.current[i] = el)}
          className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 whitespace-nowrap px-2 py-0.5 rounded bg-black/50 backdrop-blur-sm border-l-2 text-white/90 text-[11px] font-medium"
          style={{ borderColor: '#' + m.color.toString(16).padStart(6, '0'), opacity: 0 }}
        >
          {m.label}
        </div>
      ))}
    </div>
  );
}