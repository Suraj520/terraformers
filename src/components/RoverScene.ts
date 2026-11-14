import * as THREE from "three";

export function createRoverScene() {
  const rover = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xd66a32,
    metalness: 0.4,
    roughness: 0.6,
  });

  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x252b32,
    roughness: 0.8,
  });

  const goldMaterial = new THREE.MeshStandardMaterial({
    color: 0xe4b85c,
    metalness: 0.5,
    roughness: 0.4,
  });

  // Main rover chassis
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.42, 1.95),
    bodyMaterial
  );

  chassis.position.y = 0.58;
  chassis.castShadow = true;
  rover.add(chassis);

  // Upper equipment deck
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, 0.12, 1.35),
    goldMaterial
  );

  deck.position.set(0, 0.85, 0);
  rover.add(deck);

  // Camera mast
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.06, 0.72, 12),
    darkMaterial
  );

  mast.position.set(0, 1.22, -0.55);
  rover.add(mast);

  // Camera head
  const cameraHead = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.24, 0.28),
    new THREE.MeshStandardMaterial({
      color: 0x73b7c9,
      metalness: 0.4,
      roughness: 0.2,
    })
  );

  cameraHead.position.set(0, 1.58, -0.55);
  rover.add(cameraHead);

  // Solar panel
  const solarPanel = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.045, 0.62),
    new THREE.MeshStandardMaterial({
      color: 0x174b70,
      metalness: 0.3,
      roughness: 0.3,
    })
  );

  solarPanel.position.set(0, 1.02, 0.48);
  rover.add(solarPanel);

  // Wheels
  const wheels: THREE.Mesh[] = [];

  const wheelGeometry = new THREE.CylinderGeometry(
    0.34, 0.34, 0.22, 20
  );

  const wheelPositions = [
    [-0.82, 0.36, -0.68],
    [0.82, 0.36, -0.68],
    [-0.82, 0.36, 0.68],
    [0.82, 0.36, 0.68],
  ];

  wheelPositions.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(
      wheelGeometry,
      darkMaterial
    );

    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    wheel.castShadow = true;

    rover.add(wheel);
    wheels.push(wheel);
  });

  return {
    group: rover,
    wheels,

    update(speed: number, delta: number) {
      wheels.forEach(wheel => {
        wheel.rotation.x += speed * delta * 1.8;
      });
    },
  };
}