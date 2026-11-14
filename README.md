# Terraformers  — Project Details

Motivated by Transformers and their famous slogan - Autobots Re-unite by Optimus Prime.

Google Drive Link of BluePrint - https://drive.google.com/drive/folders/1-ESAb_DRuL0XJXbfHcwrXe-pG2FGNoCs?usp=sharing

Terraformers  is an interactive 3D educational simulation that demonstrates how autonomous, self-assembling swarm robots could prepare the infrastructure required for a future human settlement on Mars.
How it works: Players progress through seven mission chapters, starting with resource collection and robotic component assembly, followed by launch preparation, Mars arrival, autonomous deployment, solar power generation, charging infrastructure, maintenance, and the final vision of a human-ready Mars colony. Interactive challenges, 3D environments, animated sequences, physics simulations, and mission reports make the experience engaging and educational.
Benefits and intended impact: The project introduces students aged 9–15 to robotics, aerospace engineering, physics, renewable energy, resource management, and planetary science. Its intended impact is to inspire young learners to explore STEM fields and think creatively about sustainable space exploration.
Technology used: The application was developed using React, TypeScript, Vite, Three.js, and JavaScript. Blender was used to create 3D models and mission animations. Additional technologies include HTML, CSS, physics simulation tools, and NASA's educational resources and archived Mars weather data. The project is currently a software simulation rather than a deployed physical robot system.
Creativity and design considerations: Its creative approach combines swarm robotics, modular construction, autonomous systems, and storytelling into a playable Mars-colonization experience. Key considerations included scientific plausibility, educational accessibility, mission sequencing, environmental constraints, resource efficiency, renewable power, user engagement, and the technical feasibility of the simulation.

A browser-based, classroom-oriented space exploration game for learners aged 9–15. The app combines the original Mars Swarm mission campaign with a real-time WebGL planetary scene, conceptual physics experiments and a teacher-facing demo dashboard.

## Run locally

Requirements: Node.js 20 LTS (18.18+ should also work) and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## What is implemented

### Student experience

- The original six-chapter Mars Swarm campaign is retained: Resource Yard, VAB Robotics Lab, Launch Design, Mars Arrival, Power & Maintenance and Mission Report.
- **Interactive 3D planetary scene:** a custom WebGL 1 renderer draws a lit sphere, terrain and a modular rover from generated geometry. Learners can drag to orbit the camera, zoom, drive the rover across the local grid and deploy/pack a habitat. No remote 3D assets or runtime 3D library are required. If WebGL is unavailable, the scene displays a clear fallback message.
- **Five destinations:** Moon, Mars, Earth, Venus and Jupiter, with gravity facts. Jupiter is identified as a gas giant without a solid surface to land on.
- **Physics playground:** rocket thrust versus weight, rover uphill force, momentum, solar collection and demand, an orbital-speed *index*, insulation/heat transfer and a structural support/load model.
- **Age-banded prompts:** learners can switch between 9–11, 12–13 and 14–15 explanations/challenges. The age band also appears on the teacher's assignment preview.
- **Accessible interaction basics:** range controls, visible labels, keyboard-operable buttons, touch-friendly pointer camera control and reduced-motion CSS handling.

### Teacher command centre

- Demo class KPIs calculated from the included fictional sample learners.
- Learner progress, concept focus and support filtering.
- Concept-level class indicators, assignment prompt selection/copy, presentation styling and CSV export.
- All learner names and values are fictional and hard-coded demo data. No actual class roster is imported or persisted.

### Automated tests

```bash
npm test
```

The Node built-in test suite covers the pure physics models, chapter unlocking, mission progress and teacher summary calculations. No third-party test runner is required.

## Model accuracy and safety boundaries

This is a **conceptual learning game**, not a validated engineering simulator. The models deliberately simplify real systems:

- Rocket lift uses a basic thrust-minus-weight calculation. It omits atmosphere, changing mass, engine curves, aerodynamic forces, guidance, structural loads and staging.
- Rover climbing uses a simplified component of gravitational force along a slope and ignores wheel-ground traction, suspension, rolling resistance and terrain deformation.
- Momentum uses mass × velocity as a classroom relationship; it does not simulate collision dynamics or braking systems.
- The orbit experiment is a dimensionless speed-band teaching index, **not orbital mechanics** and not a trajectory predictor.
- Solar energy uses illustrative game units. Heat transfer is a one-step teaching model. Structural capacity is a made-up per-support score.
- All launch campaign performance values and Mars mission details remain fictional game units. Nothing here is flight-ready or suitable for real-world design, navigation, landing or safety decisions.

The 3D renderer is a real WebGL scene, but the rover, ground and planetary surfaces are visual teaching models, not high-fidelity terrain, robot kinematics or physical collision simulations.

## Architecture

- `src/App.tsx` — campaign UI, student learning hub and teacher demo dashboard.
- `src/learning/PlanetScene.tsx` — custom WebGL renderer, generated meshes, camera controls and fallback.
- `src/learning/physics-core.mjs` + `physics-core.d.mts` — pure, documented conceptual physics functions and TypeScript declarations.
- `src/learning/mission-rules.mjs` + `mission-rules.d.mts` — pure mission progression and teacher summary calculations.
- `src/platform-contracts.ts` — future API data contracts and authorization boundary; it is not a live backend.
- `docs/production-schema.sql` and `docs/API-CONTRACT.md` — proposed data model and server authorization contract; neither is deployed by this front-end demo.
- `src/engine/types.ts`, `initialState.ts`, `reducer.ts` — typed mission state, deterministic starting state and centralized mission transitions.
- `tests/` — Node built-in tests for physics and progression.

## Production architecture recommendation

The browser app is still a front-end prototype. The following contracts and boundaries are provided as a starting point, not a claim that production identity or cloud services exist.

1. **Identity and roles:** use a school-approved identity provider or teacher-managed invite flow. Server-verified roles should be `student`, `teacher` and `school_admin`. Never trust a role, school ID or class ID supplied by the browser.
2. **Tenant isolation:** every server query and mutation must enforce school and class membership. Teachers may only access classes assigned to them; students may only access their own progress and published class assignments.
3. **Suggested data entities:** `School`, `Teacher`, `Class`, `Learner`, `ClassMembership`, `MissionDefinition`, `MissionAssignment`, `LearnerMissionAttempt`, `ConceptEvidence`, `TeacherNote` and `AuditEvent`. Use opaque IDs; avoid collecting full birth dates, home addresses or unnecessary profile details.
4. **Persistence:** keep the current `localStorage` save as an offline/demo mode only. A production deployment should use an authenticated API, encrypted transport, encrypted database/storage, backups, retention/deletion controls and audited exports.
5. **Privacy for minors:** collect the minimum data needed; use school-controlled identifiers or pseudonyms; define school/guardian notice and consent workflows with local legal review; provide deletion/export processes; set short retention periods; do not add advertising, behavioural profiling or third-party trackers.
6. **Security:** add server-side authorization on every endpoint, rate limits, input validation, CSRF protections where cookie sessions are used, secure session handling, secrets management, dependency scanning and incident response procedures.
7. **Learning data:** treat mastery as evidence from completed activities, not a permanent label about a child. Show teachers the evidence and uncertainty behind a support flag; allow review and correction.

## Build and deployment

```bash
npm run build
npm run preview
```

Host the generated `dist/` directory on a static host with HTTPS. For a school deployment, use a managed domain and an approved data-processing arrangement before collecting any learner information.

## Verification status and known gaps

- `npm test` has been run successfully in this workspace.
- Dependency installation was attempted but timed out in the execution environment. Therefore the Vite production build and full React/TypeScript type-check have **not** been verified here. Run `npm install` and `npm run build` in a network-enabled development environment before deploying.
- The teacher dashboard is a static demo. There is no real authentication, authorization, database, class roster, assignment publishing, student account system, teacher notes or cloud sync.
- The current WebGL scene has a small hand-built mesh set and a basic camera. It does not yet include GLTF assets, real rover controls, physics-driven collisions, detailed planets, a 2D scene fallback, device capability profiling or GPU-performance telemetry.
- There is no formal child usability study, accessibility audit, localization, safeguarding review or school/legal privacy review yet.

## Recommended next milestones

1. Run dependency installation, production build and browser smoke tests; add CI on every change.
2. Add a proper WebGL scene graph and asset pipeline, adaptive quality settings, and an equivalent 2D accessible scene.
3. Add richer interactive construction, rover path planning, habitat assembly and mission event feedback.
4. Validate learning objectives and age-banded language with educators and supervised child usability sessions.
5. Implement the school-managed backend, authentication, role-based authorization, auditability, consent and data lifecycle controls before any real student data is entered.

## Visual simulation engine (0.3.0)

The planetary explorer now uses **Three.js** for real-time WebGL rendering and **cannon-es** for a small rigid-body physics sandbox. The scene is generated procedurally in code, so no external 3D model or texture downloads are required.

### 3D scene features

- Lit planetary sky, distant planetary disc and halo, star field, atmospheric fog, procedural rolling terrain, dunes, rocks and drifting dust particles.
- A detailed modular rover with chassis, six wheels, sensor mast, camera eye and fold-out solar wings.
- Animated habitat deployment with windows, dome and solar panel.
- Drag-to-orbit camera, zoom, rover follow camera, keyboard and touch drive controls, and live speed/battery/distance HUD.
- Five selectable planetary environments with different palettes and gravity values.

### Physics implementation

`src/learning/PlanetScene.tsx` uses cannon-es for a dynamic rover chassis, gravity, contact material, friction, damping, applied motor force, steering torque and fixed-step world integration. The wheels are animated visual parts rather than a full suspension/hinge drivetrain. The terrain collision plane is intentionally simplified and does not reproduce the procedural visual terrain height map. Telemetry distance and battery are game estimates, not calibrated physical measurements.

### Dependencies

- `three` — WebGL scene graph, meshes, lights, materials, camera and renderer.
- `cannon-es` — rigid-body world and rover motion.
- `@types/three` — TypeScript declarations.

Install in a network-enabled environment with `npm install`, then run `npm run dev`. For a classroom demo, use a modern browser with WebGL hardware acceleration. The scene caps device pixel ratio to reduce GPU load. If the school's devices are older, reduce the star and dust counts or renderer pixel ratio.

**Important:** The 3D scene is an educational arcade model. It is not a scientifically validated planetary rover dynamics simulator. The local gravity values are shown for learning, but the game chassis is not tuned as a real rover design.
