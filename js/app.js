/**
 * touchbytiha — Main Application
 * Initialization orchestration
 */

import { initTheme } from './modules/theme.js';
import { initMobileMenu, initHeaderScroll, initActiveLink } from './modules/navigation.js';
import { renderPortfolio, initLightbox } from './modules/gallery.js';
import { renderServices } from './modules/services.js';
import { initHeroAnimation, initRevealObserver } from './modules/animations.js';
import { initTestimonials } from './modules/testimonials.js';
import { loadContent } from './utils/content.js';

/**
 * Normalize featured flags so only one portfolio item can be featured.
 * @param {Object[]} items
 */
function withSingleFeatured(items) {
  let featuredSeen = false;
  return items.map(item => {
    if (!item.featured) return item;
    if (featuredSeen) return { ...item, featured: false };
    featuredSeen = true;
    return item;
  });
}

/**
 * Render everything the site needs. Never throws so the page is never blank.
 * @param {{portfolio: Object[], services: Object[], testimonials: Object[], meta: Object}} content
 */
function render(content) {
  renderPortfolio(withSingleFeatured(content.portfolio));
  renderServices(content.services, content.meta?.note);
  initTestimonials(content.testimonials);
}

/**
 * Bootstrap the application
 */
async function bootstrap() {
  let content = { portfolio: [], services: [], testimonials: [], meta: {} };

  try {
    content = await loadContent();
  } catch (error) {
    console.error('Content load failed:', error);
  }

  // Render first — reveal observers must see the injected DOM
  render(content);

  // Initialize UI modules (order matters)
  initTheme();
  initHeaderScroll();
  initMobileMenu();
  initActiveLink();
  initLightbox();

  // Initialize animations last
  initHeroAnimation();
  initRevealObserver();

  console.log(
    `✨ touchbytiha — ready (${content.portfolio.length} portfolio, ` +
    `${content.services.length} services, ${content.testimonials.length} testimonials; source: ${content.source})`
  );
}

document.addEventListener('DOMContentLoaded', bootstrap);
