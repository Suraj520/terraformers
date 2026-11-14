/** Transparent classroom-scale models. These are not engineering solvers. */
export function rocketModel({ massKg, thrustN, gravityMs2 }) {
  const weightN = massKg * gravityMs2;
  const netForceN = thrustN - weightN;
  return { weightN, netForceN, accelerationMs2: netForceN / massKg, liftsOff: netForceN > 0 };
}
export function orbitModel({ speed, gravity, radius }) {
  // A deliberately abstract stability index, not an orbital mechanics solver.
  const circularSpeedIndex = Math.sqrt(Math.max(0, gravity * radius));
  const ratio = circularSpeedIndex === 0 ? 0 : speed / circularSpeedIndex;
  return { circularSpeedIndex, ratio, status: ratio < 0.82 ? 'falling' : ratio > 1.18 ? 'escaping' : 'orbit-like' };
}
export function solarModel({ sunlightPct, panelArea, demand }) {
  const collected = sunlightPct / 100 * panelArea * 10;
  return { collected, surplus: collected - demand, powered: collected >= demand };
}
export function heatModel({ insulation, outsideTemp, insideTemp, timeSteps = 1 }) {
  const transfer = (outsideTemp - insideTemp) * (1 - insulation / 100) * 0.08 * timeSteps;
  return { nextTemp: insideTemp + transfer, transfer };
}
export function structureModel({ supportCount, load }) {
  const capacity = supportCount * 12;
  return { capacity, safe: load <= capacity, margin: capacity - load };
}
export function roverModel({ massKg, motorForceN, slopeDegrees, gravityMs2 }) {
  const uphillForce = massKg * gravityMs2 * Math.sin((slopeDegrees * Math.PI) / 180);
  return { uphillForce, netForce: motorForceN - uphillForce, canClimb: motorForceN > uphillForce };
}
export function momentumModel({ massKg, velocityMs }) {
  return { momentum: massKg * velocityMs, impulseForStop: massKg * velocityMs };
}
