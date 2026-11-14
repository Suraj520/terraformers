import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { PhysicsWorld } from "./PhysicsWorld";
import { createRoverScene } from "./RoverScene";

import "./mars-scene.css";

export default function MarsScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x160f18);
    scene.fog = new THREE.Fog(0x160f18, 30, 100);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );

    camera.position.set(7, 6, 10);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
    });

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2)
    );

    renderer.setSize(
      container.clientWidth,
      container.clientHeight
    );

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.appendChild(renderer.domElement);

    // Camera controls
    const controls = new OrbitControls(
      camera,
      renderer.domElement
    );

    controls.enableDamping = true;
    controls.target.set(0, 0.7, 0);

    // Lighting
    scene.add(
      new THREE.HemisphereLight(
        0xffd6b0,
        0x39252b,
        2
      )
    );

    const sunlight = new THREE.DirectionalLight(
      0xffd2a1,
      3
    );

    sunlight.position.set(-8, 15, 9);
    sunlight.castShadow = true;
    scene.add(sunlight);

    // Mars terrain
    const terrainGeometry = new THREE.PlaneGeometry(
      100, 100, 100, 100
    );

    const positions = terrainGeometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);

      const height =
        Math.sin(x * 0.11) *
        Math.cos(y * 0.09) *
        0.55 +
        Math.sin(x * 0.42 + y * 0.18) * 0.12;

      positions.setZ(i, height);
    }

    terrainGeometry.computeVertexNormals();

    const terrain = new THREE.Mesh(
      terrainGeometry,
      new THREE.MeshStandardMaterial({
        color: 0x9d4932,
        roughness: 1,
      })
    );

    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;

    scene.add(terrain);

    // Rocks
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x684033,
      roughness: 1,
    });

    for (let i = 0; i < 35; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(
          0.3 + Math.random() * 0.8,
          0
        ),
        rockMaterial
      );

      rock.position.set(
        (Math.random() - 0.5) * 35,
        0.3,
        (Math.random() - 0.5) * 35
      );

      rock.castShadow = true;
      scene.add(rock);
    }

    // Rover
    const physics = new PhysicsWorld();
    const rover = createRoverScene();

    scene.add(rover.group);

    // Keyboard controls
    const keys: Record<string, boolean> = {};

    const onKeyDown = (event: KeyboardEvent) => {
      keys[event.key.toLowerCase()] = true;
    };

    const onKeyUp = (event: KeyboardEvent) => {
      keys[event.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Animation
    const clock = new THREE.Clock();
    let animationFrame = 0;

    function animate() {
      if (disposed) return;

      animationFrame = requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.05);

      const forward =
        (keys.w || keys.arrowup ? 1 : 0) -
        (keys.s || keys.arrowdown ? 1 : 0);

      const turn =
        (keys.a || keys.arrowleft ? 1 : 0) -
        (keys.d || keys.arrowright ? 1 : 0);

      physics.drive(forward, turn);
      physics.step(delta);

      const body = physics.roverBody;

      rover.group.position.set(
        body.position.x,
        body.position.y - 0.35,
        body.position.z
      );

      rover.group.quaternion.set(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w
      );

      rover.update(body.velocity.length(), delta);

      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    // Responsive canvas
    const resizeObserver = new ResizeObserver(() => {
      if (!container || disposed) return;

      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
    });

    resizeObserver.observe(container);

    // Cleanup
    return () => {
      disposed = true;

      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();

      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);

      controls.dispose();
      physics.dispose();

      scene.traverse(object => {
        const mesh = object as THREE.Mesh;

        if (mesh.geometry) mesh.geometry.dispose();

        if (mesh.material) {
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];

          materials.forEach(material => material.dispose());
        }
      });

      renderer.dispose();

      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <section className="mars-visualizer">
      <div className="mars-visualizer__header">
        <h2>Mars Surface Explorer</h2>
        <span>SIMULATION LIVE</span>
      </div>

      <div
        ref={mountRef}
        className="mars-visualizer__viewport"
      >
        <div className="mars-visualizer__hint">
          Drive: W A S D or arrow keys · Orbit: drag · Zoom: scroll
        </div>
      </div>
    </section>
  );
}