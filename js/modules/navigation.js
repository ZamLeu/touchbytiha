/**
 * touchbytiha — Navigation
 * Mobile menu, scroll effects, active link tracking
 */

import { $, $$ } from '../utils/dom.js';
import { scrollLock } from '../utils/dom.js';

/**
 * Initialize mobile menu
 */
export function initMobileMenu() {
  const btn = $('.mobile-menu-btn');
  const nav = $('.nav');
  if (!btn || !nav) return;

  function open() {
    nav.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'Close menu');
    scrollLock(true);
  }

  function close() {
    nav.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Open menu');
    scrollLock(false);
  }

  btn.addEventListener('click', () => {
    if (nav.classList.contains('open')) {
      close();
    } else {
      open();
    }
  });

  // Close on link click
  nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', close);
  });
}

/**
 * Initialize header scroll effect
 */
export function initHeaderScroll() {
  const header = $('.header');
  if (!header) return;

  function update() {
    const scrollY = window.scrollY;
    
    // Scrolled state
    header.classList.toggle('scrolled', scrollY > 50);
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
}

/**
 * Initialize active link tracking
 * Highlights the nav link corresponding to the current scroll position
 */
export function initActiveLink() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  if (!sections.length || !navLinks.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
        });
      }
    });
  }, {
    rootMargin: '-40% 0px -55% 0px',
    threshold: 0
  });

  sections.forEach(section => observer.observe(section));
}