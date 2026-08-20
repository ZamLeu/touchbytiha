/**
 * touchbytiha — Animations
 * Hero text reveal + scroll-triggered reveals
 */

import { $, $$ } from '../utils/dom.js';
import { prefersReducedMotion } from '../utils/motion.js';

/**
 * Hero title letter-by-letter animation
 */
export function initHeroAnimation() {
  const title = $('.hero-title');
  if (!title) return;

  const text = title.textContent.trim();
  title.innerHTML = '';

  text.split('').forEach((char, i) => {
    const span = document.createElement('span');
    span.className = 'word';
    span.textContent = char;
    span.style.transitionDelay = `${i * 80}ms`;
    title.appendChild(span);
  });

  // Animate after DOM update
  requestAnimationFrame(() => {
    title.querySelectorAll('.word').forEach((span, i) => {
      setTimeout(() => {
        span.style.opacity = '1';
        span.style.transform = 'translateY(0)';
      }, i * 80 + 200);
    });
  });
}

/**
 * Scroll-triggered reveal animations via IntersectionObserver
 */
export function initRevealObserver() {
  const reveals = $$('.reveal');
  if (!reveals.length) return;

  if (prefersReducedMotion()) {
    reveals.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: '0px 0px -8% 0px',
    threshold: 0.1
  });

  reveals.forEach(el => observer.observe(el));
}