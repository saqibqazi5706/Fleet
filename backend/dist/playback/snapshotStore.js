"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maybeSaveSnapshot = maybeSaveSnapshot;
exports.getSnapshot = getSnapshot;
exports.getPlaybackWindow = getPlaybackWindow;
const snapshots = [];
const SNAPSHOT_INTERVAL_MS = 30000;
const MAX_SNAPSHOTS = 120;
let lastSnapshotAt = 0;
function maybeSaveSnapshot(ships, now = Date.now()) {
    if (now - lastSnapshotAt < SNAPSHOT_INTERVAL_MS)
        return null;
    lastSnapshotAt = now;
    const snapshot = {
        timestamp: now,
        ships: JSON.parse(JSON.stringify(ships)),
    };
    snapshots.push(snapshot);
    if (snapshots.length > MAX_SNAPSHOTS)
        snapshots.shift();
    return snapshot;
}
function getSnapshot(timestamp) {
    if (snapshots.length === 0)
        return null;
    return snapshots.reduce((closest, snapshot) => Math.abs(snapshot.timestamp - timestamp) < Math.abs(closest.timestamp - timestamp)
        ? snapshot
        : closest);
}
function getPlaybackWindow() {
    const end = snapshots[snapshots.length - 1]?.timestamp || Date.now();
    const start = snapshots[0]?.timestamp || end;
    return { start, end, count: snapshots.length };
}
