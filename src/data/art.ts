/**
 * ART — replacing placeholder art.
 *
 * Every image in the game has a key. By default each one is a generated placeholder (BootScene).
 * To use real art: put the PNG in `public/art/` and add a line below, key → file.
 * Anything not listed keeps its placeholder, so art can be replaced one piece at a time.
 *
 * Keys and expected sizes (pixels):
 *   char-<id>        party member in the world        12×16 (yasmi, hyne, oxleth, arthur, telara)
 *   portrait-<id>    party portrait (HUD, editor)     18×18 (party ids)
 *   headshot-<id>    face in the dialogue box         40×40 (party ids, NPC ids, 'stranger')
 *   npc-<id>         NPC in the world                 12×16 (ids from src/data/npcs.ts)
 *   enemy-<id>       enemy in the world               wolf 14×10, bandit/banditArcher/acolyte 12×16, stranger 14×20
 *   tiles            all map tiles in one strip       16px tiles side by side, in the order of src/world/tiles.ts
 *   proj-<id>        projectiles                      wand, bow, firebolt, shadowBolt
 *   frame, frame-leader, leader-marker, click-marker  UI bits
 *
 * Sizes can change once real art arrives; the code positions sprites by their feet.
 */
export const ART_FILES: Record<string, string> = {
  // 'char-yasmi': 'art/yasmi.png',
  // 'tiles': 'art/tiles.png',
};
