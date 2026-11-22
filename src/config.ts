/**
 * The canvas fills the browser window. Pixel art is drawn at a whole-number zoom
 * chosen so roughly this many world pixels fit top to bottom; wider screens see more
 * to the sides. (1080p → 3×, 1440p → 4×.)
 */
export const TARGET_VIEW_HEIGHT = 360;

/** Size of one world tile in pixels. */
export const TILE_SIZE = 16;

/** Every character has exactly this many tactic rows. */
export const MAX_TACTIC_ROWS = 10;
