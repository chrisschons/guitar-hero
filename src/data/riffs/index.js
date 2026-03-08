/**
 * Riff library — public API.
 */

import { demo44Riff, demo68Riff } from './demos.js';
import { riffToTab } from '../../core/exercise/riffToTab.js';

/** @type {import('./gallops.js').Riff[]} */
export const RIFFS = [demo44Riff, demo68Riff];

/**
 * @param {string} id
 * @returns {import('./gallops.js').Riff | undefined}
 */
export function getRiff(id) {
  return RIFFS.find((r) => r.id === id);
}

export { demo44Riff, demo68Riff } from './demos.js';
