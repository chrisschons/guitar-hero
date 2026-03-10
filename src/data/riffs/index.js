/**
 * Riff library — public API. User riffs in localStorage override/supplement built-in.
 */

/** @typedef {import('../../types/riff').Riff} Riff */

import { demo44Riff, demo68Riff } from './demos.js';
import {
  gallopBeginnerRiff,
  gallopIntermediateRiff,
  powerChordBeginnerRiff,
  powerChordIntermediateRiff,
} from './gallops.js';
import { loadUserRiffs } from './userRiffsStorage.js';

/** @type {Riff[]} */
export const RIFFS = [
  demo44Riff,
  demo68Riff,
  gallopBeginnerRiff,
  gallopIntermediateRiff,
  powerChordBeginnerRiff,
  powerChordIntermediateRiff,
];

/**
 * @param {string} id
 * @returns {Riff | undefined}
 */
export function getRiff(id) {
  const user = loadUserRiffs()[id];
  if (user) return user;
  return RIFFS.find((r) => r.id === id);
}

/** Merged list for dropdowns: built-in first, then user-only. Each item { id, name }. */
export function getMergedRiffList() {
  const builtIn = RIFFS.map((r) => ({ id: r.id, name: r.name }));
  const userIds = Object.keys(loadUserRiffs()).filter((id) => !RIFFS.some((r) => r.id === id));
  const user = userIds.map((id) => {
    const r = loadUserRiffs()[id];
    return { id, name: r?.name ?? id };
  });
  return [...builtIn, ...user];
}

export { demo44Riff, demo68Riff } from './demos.js';
export {
  gallopBeginnerRiff,
  gallopIntermediateRiff,
  powerChordBeginnerRiff,
  powerChordIntermediateRiff,
} from './gallops.js';

