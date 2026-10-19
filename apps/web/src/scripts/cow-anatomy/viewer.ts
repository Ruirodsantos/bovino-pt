// Demo (Fase 2): «O animal» + «Os cortes». O modelo e as texturas são os do visualizador público, sem alterações.
// As regiões são sub-malhas reais, feitas com os próprios triângulos da pele (mesmos vértices, normais e UV),
// por isso seguem a superfície exatamente. Cada região vive num grupo-pivô próprio: é o ponto de ligação do Modo 3.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { classifyTriangles, NONE, type Rule } from "./classify";
import rulesJson from "./rules.json";
import { CUTS } from "./cuts-data";

export type Piece = { id: string; pivot: THREE.Group; mesh: THREE.Mesh; triangles: number; centre: THREE.Vector3 };
type Opts = {
  root: HTMLElement; base: string; model?: string; embed?: boolean; reducedModel?: boolean;
  onProgress?: (p: number) => void; onState?: (s: "loading" | "ready" | "error", msg?: string) => void;
  onHover?: (id: string | null) => void; onSelect?: (id: string | null) => void;
};

const cutById = new Map(CUTS.map((c) => [c.id, c]));

export async function startCutsViewer({ root, base, model, embed, onProgress, onState, onHover, onSelect }: Opts) {
  const canvas = root.querySelector("canvas")!;
  if (!(canvas.getContext("webgl2") || canvas.getContext("webgl"))) { onState?.("error", "WebGL"); return null; }
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const mobile = matchMedia("(pointer: coarse)").matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.75 : 2));

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
  const sun = new THREE.DirectionalLight(0xfff1de, 2.2); sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
  scene.add(sun, sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.22 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  // Em páginas com scroll, a roda só aproxima com Ctrl/⌘ (senão a página deve continuar a rolar).
  if (embed) canvas.addEventListener("wheel", (e) => { if (!(e.ctrlKey || e.metaKey)) e.stopImmediatePropagation(); }, { capture: true });
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.07; controls.enablePan = false; controls.rotateSpeed = 0.7; controls.zoomSpeed = 0.7;
  controls.maxPolarAngle = Math.PI / 2 - 0.02; controls.minPolarAngle = 0.25;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.9;
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  const draco = new DRACOLoader(); draco.setDecoderPath(`${base}draco/`);
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco); loader.setMeshoptDecoder(MeshoptDecoder);

  let radius = 3, height = 1, home = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  const frame = (obj: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(obj); const size = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
    obj.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
    radius = Math.max(size.x, size.z) * 0.5; height = size.y;
    controls.target.set(radius * 0.08, height * 0.4, 0);
    const dist = (Math.max(size.x, size.y) * 0.76) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(-dist * 0.78, height * 0.62, dist * 0.82);
    controls.minDistance = dist * 0.28; controls.maxDistance = dist * 1.7; controls.update();
    sun.position.set(radius * 2.2, height * 3.2, radius * 1.6); sun.target.position.set(0, height * 0.3, 0);
    const s = radius * 2.6; Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: .1, far: height * 8 }); sun.shadow.camera.updateProjectionMatrix();
    camera.near = dist * 0.02; camera.far = dist * 20; camera.updateProjectionMatrix();
    home = { pos: camera.position.clone(), target: controls.target.clone() };
  };

  onState?.("loading");
  let gltf;
  try { gltf = await loader.loadAsync(model || `${base}models/cow.glb`, (e) => { if (e.total) onProgress?.(e.loaded / e.total); }); }
  catch (e) { console.error(e); onState?.("error", String(e)); return null; }
  const content = gltf.scene as THREE.Group;
  let skin: THREE.Mesh | null = null;
  content.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material?.map) o.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy(); if (!skin || o.geometry.attributes.position.count > skin.geometry.attributes.position.count) skin = o; } });
  scene.add(content); frame(content);
  const skinMesh = skin as unknown as THREE.Mesh;
  const sg = skinMesh.geometry as THREE.BufferGeometry;

  // ---- Regiões: classificação por triângulo (independente da ordem dos vértices, logo estável após a Draco)
  const tc0 = performance.now();
  const rules = (rulesJson as any).rules as Rule[];
  const idx = sg.index ? (sg.index.array as ArrayLike<number>) : (() => { const a = new Uint32Array(sg.attributes.position.count); for (let i = 0; i < a.length; i++) a[i] = i; return a; })();
  const { labels, ids } = classifyTriangles(sg.attributes.position.array as ArrayLike<number>, idx, rules, (rulesJson as any).xMid);
  const classifyMs = Math.round(performance.now() - tc0);
  const triCount = idx.length / 3;

  // Seleccionável = tem ficha no painel (cabeça e úbere são neutras).
  const regionOf = new Map<string, number[]>();
  for (let t = 0; t < triCount; t++) {
    const l = labels[t]; if (l === NONE) continue;
    const id = ids[l]; if (!cutById.has(id)) continue;
    let a = regionOf.get(id); if (!a) regionOf.set(id, (a = [])); a.push(t);
  }

  const mix = { v: 0, target: 0 };
  const overlayUniforms = { uMix: { value: 0 }, uSel: { value: 0 }, uHov: { value: 0 } };
  const pieces = new Map<string, Piece>();
  const group = new THREE.Group(); group.name = "cortes"; skinMesh.add(group);
  const baseNormal = (skinMesh.material as THREE.MeshStandardMaterial).normalMap ?? null;
  const pickMat = new Map<string, THREE.MeshBasicMaterial>();
  const pickId = new Map<number, string>(); let nextPick = 1;
  const states = new Map<string, { sel: number; hov: number; selT: number; hovT: number; mat: THREE.MeshStandardMaterial }>();

  for (const [id, tris] of regionOf) {
    const cut = cutById.get(id)!;
    const ind = new (sg.attributes.position.count > 65535 ? Uint32Array : Uint16Array)(tris.length * 3);
    tris.forEach((t, i) => { ind[i * 3] = idx[t * 3]; ind[i * 3 + 1] = idx[t * 3 + 1]; ind[i * 3 + 2] = idx[t * 3 + 2]; });
    const g = new THREE.BufferGeometry();
    for (const k of Object.keys(sg.attributes)) g.setAttribute(k, sg.attributes[k]); // partilha os buffers da pele
    g.setIndex(new THREE.BufferAttribute(ind, 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(cut.cor), roughness: 0.62, metalness: 0, normalMap: baseNormal, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0 });
    mat.normalScale = (skinMesh.material as any).normalScale?.clone?.() ?? new THREE.Vector2(1, 1);
    const mesh = new THREE.Mesh(g, mat); mesh.name = `corte:${id}`; mesh.renderOrder = 2; mesh.visible = false;
    const pivot = new THREE.Group(); pivot.name = `peca:${id}`; pivot.add(mesh); group.add(pivot);
    const centre = g.boundingBox!.getCenter(new THREE.Vector3());
    pieces.set(id, { id, pivot, mesh, triangles: tris.length, centre });
    states.set(id, { sel: 0, hov: 0, selT: 0, hovT: 0, mat });
    pickId.set(nextPick, id); pickMat.set(id, new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(nextPick / 255, 0, 0, THREE.NoColorSpace) })); nextPick++;
  }

  // ---- Limites entre regiões (linhas finas sobre a superfície, geradas dos mesmos triângulos)
  const pos = sg.attributes.position.array as ArrayLike<number>;
  const q = (i: number) => `${Math.round(pos[i * 3] * 5e3)},${Math.round(pos[i * 3 + 1] * 5e3)},${Math.round(pos[i * 3 + 2] * 5e3)}`;
  const edgeLabel = new Map<string, number>(); const seg: number[] = [];
  const triId = (t: number) => { const l = labels[t]; return l === NONE || !cutById.has(ids[l]) ? "" : ids[l]; };
  for (let t = 0; t < triCount; t++) {
    const me = triId(t); if (!me) continue;
    for (let e = 0; e < 3; e++) {
      const a = idx[t * 3 + e], b = idx[t * 3 + (e + 1) % 3]; const ka = q(a), kb = q(b); const key = ka < kb ? ka + "|" + kb : kb + "|" + ka;
      const prev = edgeLabel.get(key);
      if (prev === undefined) edgeLabel.set(key, t);
      else { const other = triId(prev); if (other !== me) seg.push(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2], pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]); }
    }
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0xf8f7f2, transparent: true, opacity: 0, depthWrite: false });
  const lines = new THREE.LineSegments(lg, lineMat); lines.renderOrder = 3; lines.visible = false; lines.frustumCulled = false;
  const lineOffset = new THREE.Vector3();
  skinMesh.add(lines);
  void lineOffset;

  // ---- Interação
  let hover: string | null = null, selected: string | null = null, mode: "animal" | "cortes" = "animal";
  const pickRT = new THREE.WebGLRenderTarget(1, 1, { colorSpace: THREE.NoColorSpace }); const px = new Uint8Array(4);
  const pickAt = (cx: number, cy: number): string | null => {
    if (mix.v < 0.2) return null;
    const rect = canvas.getBoundingClientRect(); const x = cx - rect.left, y = cy - rect.top;
    camera.setViewOffset(rect.width, rect.height, x, y, 1, 1);
    const prevBg = scene.background, prevEnv = scene.environment; scene.environment = null;
    const saved: [THREE.Mesh, any, boolean][] = [];
    const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
    content.traverse((o: any) => { if (o.isMesh) { saved.push([o, o.material, o.visible]); o.material = black; } });
    for (const [id, p] of pieces) { saved.push([p.mesh, p.mesh.material, p.mesh.visible]); p.mesh.material = pickMat.get(id)!; p.mesh.visible = true; }
    const sh = renderer.shadowMap.enabled, ta = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
    const gv = ground.visible, lv = lines.visible; ground.visible = false; lines.visible = false;
    const pr = renderer.getPixelRatio(); const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
    renderer.setRenderTarget(pickRT); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
    renderer.readRenderTargetPixels(pickRT, 0, 0, 1, 1, px);
    renderer.setRenderTarget(null); renderer.toneMapping = tm; renderer.setClearColor(0x000000, 0); void pr; void sh;
    renderer.shadowMap.autoUpdate = ta; ground.visible = gv; lines.visible = lv;
    for (let i = saved.length - 1; i >= 0; i--) { const [o, m, v] = saved[i]; o.material = m; o.visible = v; }
    black.dispose(); camera.clearViewOffset(); scene.background = prevBg; scene.environment = prevEnv;
    return pickId.get(px[0]) ?? null;
  };

  let pend: { x: number; y: number } | null = null; let down: { x: number; y: number; t: number } | null = null;
  canvas.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" && e.buttons === 0) pend = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener("pointerleave", () => { pend = null; setHover(null); });
  canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener("pointerup", (e) => {
    if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); const dt = performance.now() - down.t; down = null;
    if (moved > 6 || dt > 600 || mode !== "cortes") return;
    select(pickAt(e.clientX, e.clientY));
  });
  const setHover = (id: string | null) => { if (id === hover) return; if (hover) states.get(hover)!.hovT = 0; hover = id; if (id) states.get(id)!.hovT = 1; canvas.style.cursor = id ? "pointer" : ""; onHover?.(id); };

  // Foco: aproxima a câmara do corte escolhido, mantendo a distância confortável.
  let offT = 0;
  let tween: { t: number; fromP: THREE.Vector3; fromT: THREE.Vector3; toP: THREE.Vector3; toT: THREE.Vector3 } | null = null;
  const focus = (id: string | null) => {
    const fromP = camera.position.clone(), fromT = controls.target.clone();
    let toT = home.target.clone(), toP = home.pos.clone();
    if (id) {
      const p = pieces.get(id)!; const c = p.centre.clone(); skinMesh.localToWorld(c);
      const dir = camera.position.clone().sub(controls.target).normalize(); const dist = Math.min(fromP.distanceTo(fromT), home.pos.distanceTo(home.target) * 0.78);
      toT = c; toP = c.clone().add(dir.multiplyScalar(dist));
    } else { toP = fromP.clone().sub(fromT).add(home.target); toT = home.target.clone(); }
    tween = { t: 0, fromP, fromT, toP, toT };
  };
  const select = (id: string | null) => {
    if (id === selected) id = null; // clicar de novo desselecciona
    if (selected) states.get(selected)!.selT = 0; selected = id; if (id) states.get(id)!.selT = 1;
    controls.autoRotate = false; offT = id && innerWidth > 760 ? 7 : 0; focus(id); onSelect?.(id);
  };
  const setMode = (m: "animal" | "cortes") => {
    mode = m; mix.target = m === "cortes" ? 1 : 0;
    if (m === "animal") { if (selected) select(selected); setHover(null); }
    controls.autoRotate = false;
  };

  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; const pr = renderer.getPixelRatio(); if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } };
  let visible = true; new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(root);
  const clock = new THREE.Clock(); let frames = 0, t0 = performance.now(), fps = 0; let lastPick = 0;
  const ease = (t: number) => t * t * (3 - 2 * t);
  const tick = () => {
    requestAnimationFrame(tick); if (!visible || document.hidden) return; resize(); const dt = Math.min(clock.getDelta(), 0.05);
    mix.v += (mix.target - mix.v) * Math.min(1, dt * 6); if (Math.abs(mix.target - mix.v) < 0.002) mix.v = mix.target;
    const on = mix.v > 0.003;
    for (const [id, s] of states) {
      s.sel += (s.selT - s.sel) * Math.min(1, dt * 9); s.hov += (s.hovT - s.hov) * Math.min(1, dt * 12);
      const m = s.mat; const dim = selected && selected !== id ? 0.55 : 1;
      m.opacity = ease(mix.v) * (0.5 + 0.2 * s.hov + 0.3 * s.sel) * dim; m.emissiveIntensity = 0.12 * s.hov + 0.1 * s.sel;
      pieces.get(id)!.mesh.visible = on;
    }
    lines.visible = on; lineMat.opacity = ease(mix.v) * 0.55;
    if (pend && performance.now() - lastPick > 60 && !down) { lastPick = performance.now(); setHover(pickAt(pend.x, pend.y)); pend = null; }
    if (tween) { tween.t = Math.min(1, tween.t + dt / 0.8); const k = ease(tween.t); camera.position.lerpVectors(tween.fromP, tween.toP, k); controls.target.lerpVectors(tween.fromT, tween.toT, k); if (tween.t >= 1) tween = null; }
    camera.filmOffset += (offT - camera.filmOffset) * Math.min(1, dt * 5); camera.updateProjectionMatrix();
    controls.update(); renderer.render(scene, camera);
    frames++; const now = performance.now(); if (now - t0 > 1000) { fps = Math.round((frames * 1000) / (now - t0)); frames = 0; t0 = now; (window as any).__fps = fps; }
  };
  tick();
  onState?.("ready");
  return {
    THREE, renderer, camera, controls, pieces, scene,
    setMode, select, hover: setHover, getSelected: () => selected, getMode: () => mode,
    reset: () => { if (selected) select(selected); else focus(null); },
    cutIds: () => [...pieces.keys()],
    info: () => ({ fps, classifyMs, triangles: renderer.info.render.triangles, regions: pieces.size, regionTriangles: Object.fromEntries([...pieces].map(([k, v]) => [k, v.triangles])), unlabelled: (() => { let n = 0; for (let t = 0; t < triCount; t++) if (labels[t] === NONE) n++; return n; })() }),
    overlayUniforms,
  };
}
