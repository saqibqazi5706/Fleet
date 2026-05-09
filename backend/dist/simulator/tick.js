"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initFleet = initFleet;
exports.getFleet = getFleet;
exports.updateFleet = updateFleet;
const ships_1 = require("./ships");
let fleet = [];
function initFleet(ships) {
    fleet = ships.map(ship => ({ ...ship }));
    console.log(`Fleet initialized with ${fleet.length} ships`);
}
function getFleet() {
    return fleet;
}
function updateFleet(deltaMs) {
    fleet = fleet.map(ship => (0, ships_1.advanceShip)(ship, deltaMs));
    return fleet;
}
