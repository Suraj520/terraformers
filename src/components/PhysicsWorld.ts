import * as CANNON from "cannon-es";

export class PhysicsWorld {
  world: CANNON.World;
  roverBody: CANNON.Body;

  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;

    const groundMaterial = new CANNON.Material("ground");
    const roverMaterial = new CANNON.Material("rover");

    this.world.addContactMaterial(
      new CANNON.ContactMaterial(groundMaterial, roverMaterial, {
        friction: 0.85,
        restitution: 0.02,
      })
    );

    const ground = new CANNON.Body({
      mass: 0,
      material: groundMaterial,
      shape: new CANNON.Plane(),
    });

    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(ground);

    this.roverBody = new CANNON.Body({
      mass: 18,
      material: roverMaterial,
      position: new CANNON.Vec3(0, 1.15, 0),
      linearDamping: 0.35,
      angularDamping: 0.8,
    });

    this.roverBody.addShape(
      new CANNON.Box(new CANNON.Vec3(0.78, 0.28, 1.05))
    );

    this.world.addBody(this.roverBody);
  }

  drive(forward: number, turn: number) {
    if (forward !== 0) {
      this.roverBody.applyLocalForce(
        new CANNON.Vec3(0, 0, -forward * 75),
        new CANNON.Vec3(0, 0, 0)
      );
    }

    if (turn !== 0) {
      this.roverBody.applyTorque(
        new CANNON.Vec3(0, turn * 15, 0)
      );
    }
  }

  step(delta: number) {
    this.world.step(1 / 60, Math.min(delta, 0.05), 3);
  }

  reset() {
    this.roverBody.position.set(0, 1.15, 0);
    this.roverBody.velocity.set(0, 0, 0);
    this.roverBody.angularVelocity.set(0, 0, 0);
    this.roverBody.quaternion.set(0, 0, 0, 1);
    this.roverBody.wakeUp();
  }

  dispose() {
    this.world.bodies.slice().forEach(body => {
      this.world.removeBody(body);
    });
  }
}