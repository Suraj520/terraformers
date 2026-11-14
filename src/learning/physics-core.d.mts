export function rocketModel(input: {massKg:number;thrustN:number;gravityMs2:number}): {weightN:number;netForceN:number;accelerationMs2:number;liftsOff:boolean};
export function orbitModel(input: {speed:number;gravity:number;radius:number}): {circularSpeedIndex:number;ratio:number;status:'falling'|'escaping'|'orbit-like'};
export function solarModel(input: {sunlightPct:number;panelArea:number;demand:number}): {collected:number;surplus:number;powered:boolean};
export function heatModel(input: {insulation:number;outsideTemp:number;insideTemp:number;timeSteps?:number}): {nextTemp:number;transfer:number};
export function structureModel(input: {supportCount:number;load:number}): {capacity:number;safe:boolean;margin:number};
export function roverModel(input: {massKg:number;motorForceN:number;slopeDegrees:number;gravityMs2:number}): {uphillForce:number;netForce:number;canClimb:boolean};
export function momentumModel(input: {massKg:number;velocityMs:number}): {momentum:number;impulseForStop:number};
