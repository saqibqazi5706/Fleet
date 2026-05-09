"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDirective = createDirective;
function createDirective(input) {
    return {
        id: `directive:${input.shipId}:${Date.now()}`,
        fromCommand: true,
        sentAt: Date.now(),
        ...input,
    };
}
