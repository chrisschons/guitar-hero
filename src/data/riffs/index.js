/**
 * Riff library — public API.
 */

import { gallopRiff, alternatePickingRiff } from './gallops.js';
import { jsonRiffs } from './riffsFromJson.js';
import { riffToTab } from '../../core/exercise/riffToTab.js';

/** @type {import('./gallops.js').Riff[]} */
export const RIFFS = [gallopRiff, alternatePickingRiff, ...jsonRiffs];

/**
 * Pick n random riffs and concatenate their tabs.
 * Uses each riff's subdivisionsPerBeat when set, otherwise the passed subdivision.
 */
export function getRandomMixTab(subdivisionsPerBeat, count = 3) {
  const tabs = [];
  for (let i = 0; i < count; i++) {
    const riff = RIFFS[Math.floor(Math.random() * RIFFS.length)];
    const subDiv = riff.subdivisionsPerBeat ?? subdivisionsPerBeat;
    tabs.push(riffToTab(riff, subDiv));
  }
  return tabs.flat();
}

/**
 * @param {string} id
 * @returns {import('./gallops.js').Riff | undefined}
 */
export function getRiff(id) {
  return RIFFS.find((r) => r.id === id);
}

export { gallopRiff, alternatePickingRiff } from './gallops.js';
