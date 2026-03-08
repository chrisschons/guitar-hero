/**
 * Load and convert ChatGPT-generated riff JSON files to our format.
 */

import { convertChatRiffToRiff } from './convertChatRiff.js';

import riff01 from './riff_01_basic_chug.json';
import riff02 from './riff_02_classic_gallop.json';
import riff03 from './riff_03_reverse_gallop.json';
import riff04 from './riff_04_thrash_downpick.json';
import riff05 from './riff_05_gallop_power_move.json';
import riff06 from './riff_06_string_jump_chug.json';
import riff07 from './riff_07_tremolo_burst.json';

const jsonRiffs = [
  riff01,
  riff02,
  riff03,
  riff04,
  riff05,
  riff06,
  riff07,
].map((json, i) => {
  const id = json.name?.replace(/_/g, '-') ?? `riff-${i + 1}`;
  const { riff } = convertChatRiffToRiff(json, id);
  return riff;
});

export { jsonRiffs };
