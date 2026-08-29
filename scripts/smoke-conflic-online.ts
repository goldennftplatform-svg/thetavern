import assert from "node:assert/strict";
import { ConflicRoomManager, type ConflicRoomsSnapshot } from "../server/conflicRooms";
import type { ConflicPlacement } from "../src/net/conflicProtocol";

const fleetA: ConflicPlacement[] = [
  { type: "carrier", cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
  { type: "battleship", cells: [[0, 2], [1, 2], [2, 2], [3, 2]] },
  { type: "cruiser", cells: [[0, 4], [1, 4], [2, 4]] },
  { type: "submarine", cells: [[0, 6], [1, 6], [2, 6]] },
  { type: "destroyer", cells: [[0, 8], [1, 8]] },
];

const fleetB: ConflicPlacement[] = [
  { type: "carrier", cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
  { type: "battleship", cells: [[2, 0], [2, 1], [2, 2], [2, 3]] },
  { type: "cruiser", cells: [[4, 0], [4, 1], [4, 2]] },
  { type: "submarine", cells: [[6, 0], [6, 1], [6, 2]] },
  { type: "destroyer", cells: [[8, 0], [8, 1]] },
];

let snapshot: ConflicRoomsSnapshot | null = null;
function transaction<T>(operation: (manager: ConflicRoomManager) => T): T {
  const manager = new ConflicRoomManager(snapshot);
  const result = operation(manager);
  snapshot = manager.snapshot();
  return result;
}

const initial = transaction((manager) => manager.lobby());
assert.deepEqual(initial.map((room) => room.tableId), ["charter", "odyssey", "abyssal", "corsair", "voidwalker"]);

const joinA = transaction((manager) => manager.join({
  tableId: "charter", playerId: "a", name: "Captain A", clientId: "a",
}));
const joinB = transaction((manager) => manager.join({
  tableId: "charter", playerId: "b", name: "Captain B", clientId: "b",
}));
assert.equal(joinA.ok, true);
assert.equal(joinB.ok, true);
if (!joinA.ok || !joinB.ok) throw new Error("Join setup failed");
assert.notEqual(joinA.yourSeat, joinB.yourSeat);

const third = transaction((manager) => manager.join({
  tableId: "charter", playerId: "c", name: "Captain C", clientId: "c",
}));
assert.equal(third.ok, false);
if (!third.ok) assert.equal(third.error, "TABLE_FULL");

assert.equal(transaction((manager) => manager.submitFleet("charter", joinA.resumeToken, fleetA)).ok, true);
assert.equal(transaction((manager) => manager.submitFleet("charter", joinB.resumeToken, fleetB)).ok, true);

const manager = new ConflicRoomManager(snapshot);
const stateA = manager.viewForToken("charter", joinA.resumeToken)!;
const stateB = manager.viewForToken("charter", joinB.resumeToken)!;
assert.equal(stateA.phase, "playing");
assert.equal(stateA.turn, 0);
assert.equal(stateA.ownShips.length, 5);
assert.equal(stateA.enemyShips.some((ship) => "cells" in ship), false);
assert.equal(stateB.enemyShips.some((ship) => "cells" in ship), false);
assert.equal(JSON.stringify(stateA).includes(joinB.resumeToken), false);

const early = transaction((rooms) => rooms.fire("charter", joinB.resumeToken, 9, 9, "early"));
assert.equal(early.ok, false);
if (!early.ok) assert.equal(early.error, "OUT_OF_TURN");
assert.equal(transaction((rooms) => rooms.fire("charter", joinA.resumeToken, 9, 9, "shot-a")).ok, true);
const afterShot = new ConflicRoomManager(snapshot).viewForToken("charter", joinB.resumeToken)!;
assert.equal(afterShot.turn, 1);

const replay = transaction((rooms) => rooms.fire("charter", joinA.resumeToken, 9, 9, "shot-a"));
assert.equal(replay.ok, false);
if (!replay.ok) assert.equal(replay.error, "ACTION_REPLAY");

assert.equal(transaction((rooms) => rooms.leave("charter", joinA.resumeToken)).ok, true);
assert.equal(transaction((rooms) => rooms.leave("charter", joinB.resumeToken)).ok, true);
assert.equal(new ConflicRoomManager(snapshot).lobby().find((room) => room.tableId === "charter")?.status, "empty");

const expiryManager = new ConflicRoomManager();
const expiring = expiryManager.join({ tableId: "voidwalker", playerId: "idle", name: "Idle", clientId: "idle" });
assert.equal(expiring.ok, true);
assert.equal(expiryManager.expireStale(Date.now() + 6 * 60_000), 1);
assert.equal(expiryManager.lobby().find((room) => room.tableId === "voidwalker")?.status, "empty");

console.log("smoke-conflic-online: OK - persistence, privacy, seats, turns, dedupe, cleanup, expiry");
