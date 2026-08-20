/**
 * touchbytiha — DOM Utilities
 * Reusable DOM helpers
 */

/**
 * Select a single element
 * @param {string} selector - CSS selector
 * @param {ParentNode} [parent=document] - Parent element
 * @returns {Element}
 */
export const $ = (selector, parent = document) => parent.querySelector(selector);

/**
 * Select all matching elements
 * @param {string} selector - CSS selector
 * @param {ParentNode} [parent=document] - Parent element
 * @returns {NodeList}
 */
export const $$ = (selector, parent = document) => parent.querySelectorAll(selector);

/**
 * Create an element with attributes and children
 * @param {string} tag
 * @param {Object} [attrs={}]
 * @param {(string|Node|Node[])[]} [children=[]]
 * @returns {Element}
 */
export const create = (tag, attrs = {}, children = []) => {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  children.forEach(child => el.append(child));
  return el;
};

/**
 * Render HTML from a template string
 * @param {string} html
 * @returns {DocumentFragment}
 */
export const html = (strings, ...values) => {
  const template = document.createElement('template');
  template.innerHTML = strings.reduce((acc, str, i) => 
    acc + str + (values[i] !== undefined ? values[i] : ''), '');
  return template.content;
};

/**
 * Lock / unlock body scrolling
 * @param {boolean} lock
 */
export const scrollLock = (lock) => {
  document.body.style.overflow = lock ? 'hidden' : '';
};

/**
 * Check if the device is touch-capable
 * @returns {boolean}
 */
export const isTouchDevice = () => 
  window.matchMedia('(pointer: coarse)').matches;