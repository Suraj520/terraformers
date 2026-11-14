import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

type Props = { planet: string; onMove?: (message: string) => void };

const worlds: Record<string, { color: number; ground: number; haze: number; gravity: number; label: string }> = {
  Mars: { color: 0xb64d2d, ground: 0x9d482f, haze: 0xe18a58, gravity: 3.71, label: 'RED PLANET' },
  Moon: { color: 0x929ca7, ground: 0x727b83, haze: 0x9ca8b4, gravity: 1.62, label: 'LUNAR SURFACE' },
  Earth: { color: 0x2679b8, ground: 0x4d8d62, haze: 0x75bce8, gravity: 9.81, label: 'BLUE PLANET' },
  Venus: { color: 0xd39a43, ground: 0xa97837, haze: 0xf0c36e, gravity: 8.87, label: 'CLOUD WORLD' },
  Jupiter: { color: 0xc18b61, ground: 0x98765f, haze: 0xe4b88d, gravity: 24.79, label: 'GIANT WORLD' },
};

export default function PlanetScene({ planet, onMove }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [driveCount, setDriveCount] = useState(0);
  const [habitatDeployed, setHabitatDeployed] = useState(false);
  const [telemetry, setTelemetry] = useState({ speed: 0, battery: 100, distance: 0 });
  const habitatDeployedRef = useRef(false);
  const roverBodyRef = useRef<CANNON.Body | null>(null);
  const keys = useRef({ forward: false, back: false, left: false, right: false });
  const drag = useRef({ active: false, x: 0, y: 0, theta: 0.25, phi: 1.18 });
  const zoomRef = useRef(1);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const worldInfo = worlds[planet] || worlds.Mars;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch {
      host.innerHTML = '<div class="webgl-fallback">This device could not start WebGL. Try a newer browser or enable hardware acceleration.</div>';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.className = 'webgl-scene';
    renderer.domElement.setAttribute('aria-label', `Animated interactive 3D ${planet} rover environment. Drag to orbit and use the rover controls.`);
    host.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(planet === 'Earth' ? 0x8ac6e8 : 0x101c32);
    scene.fog = new THREE.FogExp2(planet === 'Moon' ? 0x8795a5 : worldInfo.haze, 0.012);
    const camera = new THREE.PerspectiveCamera(48, host.clientWidth / host.clientHeight, 0.1, 180);
    const cameraTarget = new THREE.Vector3(0, 1.15, 0);
    const updateCamera = () => {
      const d = 10 / zoomRef.current;
      const p = drag.current.phi;
      camera.position.set(d * Math.sin(p) * Math.sin(drag.current.theta), d * Math.cos(p) + 1.4, d * Math.sin(p) * Math.cos(drag.current.theta));
      camera.lookAt(cameraTarget);
    };
    updateCamera();

    const hemi = new THREE.HemisphereLight(0xc8e5ff, 0x593b2c, 2.0);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe0b0, 3.3);
    sun.position.set(-7, 12, 7); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -18; sun.shadow.camera.right = 18; sun.shadow.camera.top = 18; sun.shadow.camera.bottom = -18; scene.add(sun);

    // Star field and cinematic distant planetary disc.
    const starGeo = new THREE.BufferGeometry();
    const starPositions: number[] = [];
    for (let i = 0; i < 1100; i++) {
      const r = 55 + Math.random() * 45, a = Math.random() * Math.PI * 2, y = (Math.random() - 0.15) * 55;
      starPositions.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xeaf5ff, size: 0.11, transparent: true, opacity: 0.8 })); scene.add(stars);
    const distant = new THREE.Mesh(new THREE.SphereGeometry(3.1, 48, 32), new THREE.MeshStandardMaterial({ color: planet === 'Mars' ? 0x315d92 : worldInfo.color, roughness: 0.92, emissive: planet === 'Mars' ? 0x0b1a33 : 0x24160c, emissiveIntensity: 0.25 }));
    distant.position.set(-13, 7.5, -30); scene.add(distant);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(3.22, 48, 32), new THREE.MeshBasicMaterial({ color: worldInfo.haze, transparent: true, opacity: 0.12, side: THREE.BackSide })); halo.position.copy(distant.position); scene.add(halo);

    // Rolling terrain with procedural low hills and a warm horizon.
    const terrainGeo = new THREE.PlaneGeometry(100, 100, 100, 100);
    const pos = terrainGeo.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const base = new THREE.Color(worldInfo.ground), high = new THREE.Color(planet === 'Moon' ? 0xb4bbc1 : 0xd48b61);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const h = Math.sin(x * 0.22) * 0.12 + Math.cos(y * 0.19) * 0.1 + Math.sin((x + y) * 0.11) * 0.16;
      pos.setZ(i, h);
      const c = base.clone().lerp(high, Math.max(0, h + 0.08) * 0.75); colors.push(c.r, c.g, c.b);
    }
    terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); terrainGeo.computeVertexNormals();
    const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); terrain.rotation.x = -Math.PI / 2; terrain.position.y = -0.04; terrain.receiveShadow = true; scene.add(terrain);
    const duneMat = new THREE.MeshStandardMaterial({ color: worldInfo.haze, roughness: 1 });
    for (let i = 0; i < 13; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + Math.random() * 0.75, 0), new THREE.MeshStandardMaterial({ color: i % 2 ? worldInfo.ground : worldInfo.haze, roughness: 1 }));
      rock.position.set((Math.random() - 0.5) * 28, 0.05, -4 - Math.random() * 25); rock.scale.y = 0.35 + Math.random() * 0.45; rock.rotation.set(Math.random(), Math.random(), Math.random()); rock.castShadow = true; scene.add(rock);
    }
    for (let i = 0; i < 4; i++) {
      const dune = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), duneMat);
      dune.scale.set(6 + i * 2, 0.65 + i * 0.12, 2.4); dune.position.set((i - 1.5) * 8, -0.15, -14 - i * 3); scene.add(dune);
    }

    // Physical sandbox: a dynamic rover chassis, gravity, damping, ground contact and applied motor forces.
    const physics = new CANNON.World({ gravity: new CANNON.Vec3(0, -worldInfo.gravity / 9.81 * 9.81, 0) });
    physics.broadphase = new CANNON.SAPBroadphase(physics); physics.allowSleep = true;
    const groundMat = new CANNON.Material('terrain'); const roverMat = new CANNON.Material('rover');
    physics.addContactMaterial(new CANNON.ContactMaterial(groundMat, roverMat, { friction: 0.82, restitution: 0.02 }));
    const floor = new CANNON.Body({ mass: 0, material: groundMat, shape: new CANNON.Plane() }); floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0); physics.addBody(floor);
    const chassis = new CANNON.Body({ mass: 8, material: roverMat, position: new CANNON.Vec3(0, 0.82, 0), linearDamping: 0.42, angularDamping: 0.78, allowSleep: false });
    chassis.addShape(new CANNON.Box(new CANNON.Vec3(0.72, 0.22, 0.48))); chassis.fixedRotation = true; chassis.updateMassProperties(); physics.addBody(chassis); roverBodyRef.current = chassis;

    // Rover body: animated suspension, six chunky wheels, sensor mast and glowing camera eye.
    const rover = new THREE.Group(); scene.add(rover);
    const metal = new THREE.MeshStandardMaterial({ color: 0xe6b95f, metalness: 0.55, roughness: 0.38 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x172632, metalness: 0.25, roughness: 0.72 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x4bc4d4, emissive: 0x167b94, emissiveIntensity: 1.4, metalness: 0.35 });
    const chassisMesh = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.42, 0.94), metal); chassisMesh.castShadow = true; rover.add(chassisMesh);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.32, 0.62), new THREE.MeshStandardMaterial({ color: 0x53717c, metalness: 0.6, roughness: 0.3 })); top.position.set(-0.1, 0.32, 0); top.castShadow = true; rover.add(top);
    const mast = new THREE.Group(); mast.position.set(0.3, 0.48, -0.12); rover.add(mast);
    const mastPole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.58, 12), dark); mastPole.position.y = 0.27; mast.add(mastPole);
    const cameraHead = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 16), blue); cameraHead.position.set(0, 0.59, 0); mast.add(cameraHead);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 16), new THREE.MeshBasicMaterial({ color: 0xd9ffff })); lens.position.set(0.12, 0.59, -0.04); mast.add(lens);
    const wheels: THREE.Mesh[] = [];
    for (const x of [-0.48, 0, 0.48]) for (const z of [-0.55, 0.55]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.17, 24), dark); wheel.rotation.x = Math.PI / 2; wheel.position.set(x, -0.18, z); wheel.castShadow = true; rover.add(wheel); wheels.push(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.19, 16), metal); hub.rotation.x = Math.PI / 2; hub.position.copy(wheel.position); rover.add(hub);
    }
    // Fold-out solar wings with a gentle opening animation.
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x174d83, metalness: 0.65, roughness: 0.28, emissive: 0x09274c });
    const wingLeft = new THREE.Group(); wingLeft.position.set(0, 0.18, 0); rover.add(wingLeft);
    const wingRight = new THREE.Group(); wingRight.position.set(0, 0.18, 0); rover.add(wingRight);
    for (const [wing, side] of [[wingLeft, -1], [wingRight, 1]] as const) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.045, 0.48), wingMat); panel.position.set(0, 0, side * 0.52); wing.add(panel);
      for (let k = 0; k < 4; k++) { const line = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.05, 0.46), new THREE.MeshBasicMaterial({ color: 0x5ca9dc })); line.position.set(-0.31 + k * 0.2, 0.025, side * 0.52); wing.add(line); }
    }

    // Habitat prop with glowing windows and animated deployment.
    const habitat = new THREE.Group(); habitat.position.set(3.5, 0, -1.2); scene.add(habitat); habitat.scale.setScalar(0.001);
    const habBody = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.45, 32), new THREE.MeshStandardMaterial({ color: 0xd8e3df, metalness: 0.3, roughness: 0.45 })); habBody.rotation.z = Math.PI / 2; habBody.position.y = 0.88; habBody.castShadow = true; habitat.add(habBody);
    const habDome = new THREE.Mesh(new THREE.SphereGeometry(0.84, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x72c8d2, transparent: true, opacity: 0.85, roughness: 0.18, metalness: 0.2 })); habDome.position.set(0.78, 1.15, 0); habitat.add(habDome);
    for (let i = 0; i < 4; i++) { const win = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.28, 0.25), new THREE.MeshBasicMaterial({ color: 0xffdc8b })); win.position.set(-0.48 + i * 0.31, 0.95, 0.84); habitat.add(win); }
    const habPanel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.8), wingMat); habPanel.position.set(-1.2, 1.5, 0); habitat.add(habPanel);

    // Dust motes drift through the sunbeams.
    const dustCount = 280; const dustGeo = new THREE.BufferGeometry(); const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) { dustPos[i * 3] = (Math.random() - 0.5) * 26; dustPos[i * 3 + 1] = Math.random() * 4; dustPos[i * 3 + 2] = (Math.random() - 0.5) * 30; }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3)); const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffd5a5, size: 0.045, transparent: true, opacity: 0.5 })); scene.add(dust);

    let raf = 0; let last = performance.now(); let elapsed = 0; let lastTelemetry = 0;
    const animate = (now: number) => {
      raf = requestAnimationFrame(animate); const dt = Math.min((now - last) / 1000, 0.033); last = now; elapsed += dt;
      // WASD / touch controls apply real forces to the Cannon body.
      const forward = keys.current.forward || keys.current.back; const steer = keys.current.left || keys.current.right;
      const direction = keys.current.forward ? -1 : keys.current.back ? 1 : 0;
      const steerDir = keys.current.left ? 1 : keys.current.right ? -1 : 0;
      if (forward) { const f = new CANNON.Vec3(0, 0, direction * 54); chassis.applyLocalForce(f, new CANNON.Vec3(0, 0, 0)); }
      if (steer) chassis.angularVelocity.y += steerDir * dt * 0.8;
      physics.step(1 / 60, dt, 3);
      // Keep the learning rover in its play area and upright.
      chassis.position.x = THREE.MathUtils.clamp(chassis.position.x, -5.5, 5.5); chassis.position.z = THREE.MathUtils.clamp(chassis.position.z, -5.5, 5.5);
      chassis.position.y = Math.max(0.62, chassis.position.y);
      rover.position.set(chassis.position.x, chassis.position.y, chassis.position.z); rover.quaternion.set(chassis.quaternion.x, chassis.quaternion.y, chassis.quaternion.z, chassis.quaternion.w);
      cameraTarget.lerp(new THREE.Vector3(chassis.position.x, 1.15, chassis.position.z), 1 - Math.exp(-dt * 1.8));
      const speed = Math.hypot(chassis.velocity.x, chassis.velocity.z); wheels.forEach(w => { w.rotation.z += speed * dt * 2.2; });
      mast.rotation.y = Math.sin(elapsed * 0.7) * 0.14; cameraHead.scale.setScalar(1 + Math.sin(elapsed * 3) * 0.035);
      wingLeft.rotation.y = THREE.MathUtils.damp(wingLeft.rotation.y, -0.08, 2, dt); wingRight.rotation.y = THREE.MathUtils.damp(wingRight.rotation.y, 0.08, 2, dt);
      const habTarget = habitatDeployedRef.current ? 1 : 0.001;
      habitat.scale.lerp(new THREE.Vector3(habTarget, habTarget, habTarget), 1 - Math.exp(-dt * 3));
      habitat.rotation.y = Math.sin(elapsed * 0.22) * 0.025;
      stars.rotation.y += dt * 0.002; distant.rotation.y += dt * 0.025; dust.rotation.y += dt * 0.012;
      const arr = dustGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < dustCount; i++) { const y = arr.getY(i) + dt * (0.12 + (i % 5) * 0.035); arr.setY(i, y > 4 ? 0 : y); }
      arr.needsUpdate = true;
      updateCamera(); renderer.render(scene, camera);
      if (now - lastTelemetry > 180) { lastTelemetry = now; setTelemetry({ speed: Math.round(speed * 10) / 10, battery: Math.max(0, Math.round(100 - elapsed * 0.12 - speed * 1.3)), distance: Math.round((Math.abs(chassis.position.x) + Math.abs(chassis.position.z)) * 10) / 10 }); }
    };
    raf = requestAnimationFrame(animate);
    const resize = () => { const w = host.clientWidth, h = host.clientHeight; camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); renderer.setSize(w, h); };
    const pointerDown = (e: PointerEvent) => { drag.current.active = true; drag.current.x = e.clientX; drag.current.y = e.clientY; renderer.domElement.setPointerCapture(e.pointerId); };
    const pointerMove = (e: PointerEvent) => { if (!drag.current.active) return; const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y; drag.current.x = e.clientX; drag.current.y = e.clientY; drag.current.theta -= dx * 0.006; drag.current.phi = THREE.MathUtils.clamp(drag.current.phi + dy * 0.006, 0.38, 1.48); };
    const pointerUp = () => { drag.current.active = false; };
    const wheelZoom = (e: WheelEvent) => { e.preventDefault(); setZoom(v => THREE.MathUtils.clamp(v - e.deltaY * 0.001, 0.65, 1.65)); };
    renderer.domElement.addEventListener('pointerdown', pointerDown); renderer.domElement.addEventListener('pointermove', pointerMove); renderer.domElement.addEventListener('pointerup', pointerUp); renderer.domElement.addEventListener('pointercancel', pointerUp); renderer.domElement.addEventListener('wheel', wheelZoom, { passive: false });
    const observer = new ResizeObserver(resize); observer.observe(host);
    const onKeyDown = (e: KeyboardEvent) => { if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(e.key.toLowerCase())) { e.preventDefault(); if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') keys.current.forward = true; if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') keys.current.back = true; if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') keys.current.left = true; if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') keys.current.right = true; } };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') keys.current.forward = false; if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') keys.current.back = false; if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') keys.current.left = false; if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') keys.current.right = false; };
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp);
    const cleanup = () => { cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); renderer.domElement.removeEventListener('pointerdown', pointerDown); renderer.domElement.removeEventListener('pointermove', pointerMove); renderer.domElement.removeEventListener('pointerup', pointerUp); renderer.domElement.removeEventListener('pointercancel', pointerUp); renderer.domElement.removeEventListener('wheel', wheelZoom); physics.bodies.forEach(b => physics.removeBody(b)); renderer.dispose(); scene.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const mats = Array.isArray(o.material) ? o.material : [o.material]; mats.forEach(m => m.dispose()); } }); starGeo.dispose(); dustGeo.dispose(); renderer.domElement.remove(); };
    (host as HTMLDivElement & { __cleanup?: () => void }).__cleanup = cleanup;
    return cleanup;
  }, [planet]);

  // Keep camera zoom independent from the renderer lifecycle.
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  const drive = (key: keyof typeof keys.current, down: boolean) => { keys.current[key] = down; if (down) { setDriveCount(v => v + 1); onMove?.('Rover motor force applied in the physics playground.'); } };
  const deploy = () => { setHabitatDeployed(v => { const next = !v; habitatDeployedRef.current = next; onMove?.(next ? 'Habitat deployment animation started.' : 'Habitat packed away.'); return next; }); };


  return <div className="webgl-scene-wrap" ref={hostRef}>
    <div className="webgl-overlay-label"><span className="scene-live-dot"/> LIVE 3D · {worlds[planet]?.label || 'PLANET SURFACE'} · CANNON PHYSICS</div>
    <div className="scene-telemetry"><span>ROVER SPEED <b>{telemetry.speed.toFixed(1)}</b></span><span>BATTERY <b>{telemetry.battery}%</b></span><span>TRAVEL <b>{telemetry.distance.toFixed(1)} m*</b></span></div>
    <div className="webgl-drive-controls"><span>DRIVE THE ROVER · HOLD TO MOVE</span><div>
      <button onPointerDown={() => drive('forward', true)} onPointerUp={() => drive('forward', false)} onPointerLeave={() => drive('forward', false)} aria-label="Drive forward">↑</button>
      <button onPointerDown={() => drive('left', true)} onPointerUp={() => drive('left', false)} onPointerLeave={() => drive('left', false)} aria-label="Steer left">←</button>
      <button onPointerDown={() => drive('back', true)} onPointerUp={() => drive('back', false)} onPointerLeave={() => drive('back', false)} aria-label="Drive backward">↓</button>
      <button onPointerDown={() => drive('right', true)} onPointerUp={() => drive('right', false)} onPointerLeave={() => drive('right', false)} aria-label="Steer right">→</button>
    </div><small>OR USE W A S D / ARROW KEYS · {driveCount} INPUTS</small><button className="habitat-toggle" onClick={deploy}>{habitatDeployed ? 'Retract habitat' : '🚀 Deploy habitat'}</button></div>
    <div className="webgl-controls"><button onClick={() => setZoom(v => Math.min(1.65, v + 0.1))} aria-label="Zoom in">＋</button><button onClick={() => setZoom(v => Math.max(0.65, v - 0.1))} aria-label="Zoom out">−</button><button onClick={() => { drag.current.theta = 0.25; drag.current.phi = 1.18; setZoom(1); }}>Reset view</button></div>
    <div className="scene-hint">DRAG TO EXPLORE THE LANDSCAPE</div>
  </div>;
}

