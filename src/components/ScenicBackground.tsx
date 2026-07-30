/**
 * Back-compat shim. The rotating scene "reel" was replaced by AppBackground
 * (a single stable photoreal scene per screen with Ken Burns + bokeh), which
 * matches the other CodeAscent apps. Old imports keep working.
 */
export { AppBackground as ScenicBackground } from './AppBackground';
