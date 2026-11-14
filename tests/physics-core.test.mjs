import test from 'node:test';
import assert from 'node:assert/strict';
import { rocketModel, orbitModel, solarModel, heatModel, structureModel, roverModel, momentumModel } from '../src/learning/physics-core.mjs';

test('rocket lifts only when thrust exceeds weight', () => {
  assert.equal(rocketModel({massKg:2,thrustN:30,gravityMs2:9.81}).liftsOff, true);
  assert.equal(rocketModel({massKg:2,thrustN:10,gravityMs2:9.81}).liftsOff, false);
});
test('orbit index classifies low, middle and high speed bands', () => {
  assert.equal(orbitModel({speed:2,gravity:9,radius:1}).status,'falling');
  assert.equal(orbitModel({speed:3,gravity:9,radius:1}).status,'orbit-like');
  assert.equal(orbitModel({speed:5,gravity:9,radius:1}).status,'escaping');
});
test('solar collection responds to sunlight and area', () => {
  assert.equal(solarModel({sunlightPct:100,panelArea:2,demand:10}).powered,true);
  assert.equal(solarModel({sunlightPct:20,panelArea:2,demand:10}).powered,false);
});
test('insulation reduces the rate of temperature change', () => {
  const low=heatModel({insulation:0,outsideTemp:-50,insideTemp:20});
  const high=heatModel({insulation:90,outsideTemp:-50,insideTemp:20});
  assert.ok(Math.abs(high.transfer)<Math.abs(low.transfer));
});
test('supports increase a structure model capacity', () => {
  assert.equal(structureModel({supportCount:3,load:30}).safe,true);
  assert.equal(structureModel({supportCount:1,load:30}).safe,false);
});
test('steeper slopes need more climbing force', () => {
  const shallow=roverModel({massKg:5,motorForceN:20,slopeDegrees:10,gravityMs2:3.71});
  const steep=roverModel({massKg:5,motorForceN:20,slopeDegrees:45,gravityMs2:3.71});
  assert.ok(steep.uphillForce>shallow.uphillForce);
});

test('momentum increases with mass and velocity', () => {
  assert.equal(momentumModel({massKg:4,velocityMs:3}).momentum,12);
  assert.ok(momentumModel({massKg:4,velocityMs:6}).momentum > momentumModel({massKg:4,velocityMs:3}).momentum);
});
