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

/**
 * Bootstrap the application
 * Loads JSON data, initializes all modules
 */
async function bootstrap() {
  try {
    // Load content data concurrently
    const [portfolioRes, servicesRes] = await Promise.all([
      fetch('./data/portfolio.json'),
      fetch('./data/services.json')
    ]);

    const portfolio = (await portfolioRes.json()).portfolio;
    const services = (await servicesRes.json()).services;

    // Render dynamic content first (needs to exist before observers)
    renderPortfolio(portfolio);
    renderServices(services);

    // Initialize UI modules (order matters)
    initTheme();
    initHeaderScroll();
    initMobileMenu();
    initActiveLink();
    initLightbox();
    initTestimonials();

    // Initialize animations
    initHeroAnimation();
    initRevealObserver();

    console.log(`✨ touchbytiha — ready (${portfolio.length} portfolio items, ${services.length} services)`);
  } catch (error) {
    console.error('Failed to initialize application:', error);

    // Graceful fallback: still make core UI work
    initTheme();
    initHeaderScroll();
    initMobileMenu();
    initActiveLink();
    initRevealObserver();
  }
}

// Start the app
document.addEventListener('DOMContentLoaded', bootstrap);