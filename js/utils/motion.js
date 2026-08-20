/**
 * touchbytiha — Motion Utilities
 * Respect user motion preferences
 */

/**
 * Whether the user prefers reduced motion
 * @returns {boolean}
 */
export const prefersReducedMotion = () => 
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Listen for changes to motion preference
 * @param {Function} callback
 */
export const onMotionChange = (callback) => {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handler = (e) => callback(e.matches);
  query.addEventListener('change', handler);
  return () => query.removeEventListener('change', handler);
};