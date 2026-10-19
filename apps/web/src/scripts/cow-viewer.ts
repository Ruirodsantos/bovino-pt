// Visualizador 3D do bovino (protótipo). Só o Modo 1 («O animal») está implementado.
// Os modos 2 («Os cortes») e 3 («Peças separadas») estão previstos em MODES mas desligados,
// à espera de referências portuguesas validadas. Nada aqui define cortes, nomes ou posições.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type ViewerMode = "animal" | "cortes" | "pecas";
export const MODES: Record<ViewerMode, { enabled: boolean }> = { animal: { enabled: true }, cortes: { enabled: false }, pecas: { enabled: false } };

export type Manifest = { file: string; title: string; author: string; license: string; license_url?: string; source_url: string; notes?: string };
type Opts = { root: HTMLElement; base: string; model?: string; onProgress?: (p: number) => void; onState?: (s: "loading" | "ready" | "missing" | "error", msg?: string) => void };

export async function startViewer({ root, base, model, onProgress, onState }: Opts) {
  const canvas = root.querySelector("canvas")!;
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  if (!gl) { onState?.("error", "WebGL"); return null; }
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const mobile = matchMedia("(pointer: coarse)").matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.75 : 2));

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; // iluminação por imagem (IBL) para materiais PBR
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
  const sun = new THREE.DirectionalLight(0xfff1de, 2.2); sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
  scene.add(sun, sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.22 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.07; controls.enablePan = false; controls.rotateSpeed = 0.7; controls.zoomSpeed = 0.7;
  controls.maxPolarAngle = Math.PI / 2 - 0.02; controls.minPolarAngle = 0.25;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.9;
  controls.addEventListener("start", () => { controls.autoRotate = false; });

  const draco = new DRACOLoader(); draco.setDecoderPath(`${base}draco/`);
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco); loader.setMeshoptDecoder(MeshoptDecoder);

  let url = model; let manifest: Manifest | null = null;
  if (!url) {
    try { const r = await fetch(`${base}models/cow.json`, { cache: "no-cache" }); if (!r.ok) throw 0; manifest = await r.json(); url = `${base}models/${manifest!.file}`; }
    catch { onState?.("missing"); }
  }
  let content: THREE.Object3D | null = null; let radius = 3;
  const frame = (obj: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(obj); const size = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
    obj.position.sub(new THREE.Vector3(c.x, box.min.y, c.z)); // pousa no chão, centrado
    radius = Math.max(size.x, size.z) * 0.5; const h = size.y;
    controls.target.set(0, h * 0.42, 0);
    const dist = (Math.max(size.x, size.y) * 0.62) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(-dist * 0.78, h * 0.62, dist * 0.82);
    controls.minDistance = dist * 0.28; controls.maxDistance = dist * 1.7; controls.update();
    sun.position.set(radius * 2.2, h * 3.2, radius * 1.6); sun.target.position.set(0, h * 0.3, 0);
    const s = radius * 2.6; Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: .1, far: h * 8 }); sun.shadow.camera.updateProjectionMatrix();
    camera.near = dist * 0.02; camera.far = dist * 20; camera.updateProjectionMatrix();
  };
  if (url) {
    onState?.("loading");
    try {
      const gltf = await loader.loadAsync(url, (e) => { if (e.total) onProgress?.(e.loaded / e.total); });
      content = gltf.scene; content.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material?.map) o.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy(); } });
      scene.add(content); frame(content); onState?.("ready");
      if (gltf.animations?.length) { const mix = new THREE.AnimationMixer(content); mix.clipAction(gltf.animations[0]).play(); (renderer as any)._mix = mix; }
    } catch (e) {
      // Metadados presentes mas ficheiro GLB ainda por colocar: tratar como «falta o modelo», não como erro.
      const exists = await fetch(url, { method: "HEAD", cache: "no-cache" }).then((r) => r.ok).catch(() => false);
      if (!exists) onState?.("missing"); else { console.error(e); onState?.("error", String(e)); }
    }
  }

  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; const pr = renderer.getPixelRatio(); if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } };
  let visible = true; new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(root);
  const clock = new THREE.Clock(); let frames = 0, t0 = performance.now(), fps = 0;
  const tick = () => { requestAnimationFrame(tick); if (!visible || document.hidden) return; resize(); const dt = clock.getDelta(); (renderer as any)._mix?.update(dt); controls.update(); renderer.render(scene, camera);
    frames++; const now = performance.now(); if (now - t0 > 1000) { fps = Math.round((frames * 1000) / (now - t0)); frames = 0; t0 = now; (window as any).__fps = fps; } };
  tick();
  return {
    manifest, renderer, controls, camera, THREE,
    reset: () => { if (content) frame(content); },
    info: () => ({ fps, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries }),
  };
}
