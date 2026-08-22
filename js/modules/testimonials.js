/**
 * touchbytiha — Testimonials Module
 * Auto-scrolling horizontal carousel with user drag/swipe support
 */

import { openLightbox } from './gallery.js';

export async function initTestimonials() {
  const container = document.querySelector('.testimonials-grid');
  if (!container) return;

  try {
    const response = await fetch('data/testimonials.json');
    if (!response.ok) throw new Error('Failed to load testimonials');

    const { testimonials } = await response.json();

    // Create wrapper and track structure
    const wrapper = document.createElement('div');
    wrapper.className = 'testimonials-wrapper';

    const track = document.createElement('div');
    track.className = 'testimonials-track';
    track.setAttribute('role', 'list');
    track.setAttribute('aria-label', 'Client testimonials');

    wrapper.appendChild(track);
    container.innerHTML = '';
    container.appendChild(wrapper);

    // Duplicate items for seamless loop (need at least 2x for smooth scroll)
    const items = [...testimonials, ...testimonials];

    items.forEach((testimonial, i) => {
      const card = createTestimonialCard(testimonial, i >= testimonials.length);
      track.appendChild(card);
    });

    // Enable user drag/swipe scrolling
    enableUserScroll(wrapper, track);

  } catch (error) {
    console.error('Testimonials error:', error);
    container.innerHTML = '<p class="text-muted">Unable to load testimonials at this time.</p>';
  }
}

/**
 * Enable user drag/swipe scrolling while keeping auto-scroll
 * @param {HTMLElement} wrapper - .testimonials-wrapper
 * @param {HTMLElement} track - .testimonials-track
 */
function enableUserScroll(wrapper, track) {
  const AUTO_SCROLL_SPEED = 40;
  const DRAG_THRESHOLD = 5;
  const CARD_WIDTH = 300 + 24;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let offset = 0;
  let activePointerId = null;
  let dragStartX = 0;
  let lastPointerX = 0;
  let hasDragged = false;
  let suppressClick = false;
  let clearClickSuppression = null;
  let lastFrameTime = null;

  function loopWidth() {
    return track.scrollWidth / 2;
  }

  function normalizeOffset() {
    const width = loopWidth();
    if (!width) return;
    offset = ((offset % width) + width) % width;
  }

  function render() {
    track.style.transform = `translateX(${-offset}px)`;
  }

  function autoScroll(timestamp) {
    if (lastFrameTime !== null && activePointerId === null && !reducedMotion) {
      offset += AUTO_SCROLL_SPEED * ((timestamp - lastFrameTime) / 1000);
      normalizeOffset();
      render();
    }
    lastFrameTime = timestamp;
    requestAnimationFrame(autoScroll);
  }

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;

    activePointerId = event.pointerId;
    dragStartX = event.clientX;
    lastPointerX = event.clientX;
    hasDragged = false;
    wrapper.setPointerCapture(event.pointerId);
    wrapper.classList.add('is-dragging');
  }

  function onPointerMove(event) {
    if (event.pointerId !== activePointerId) return;

    const distance = event.clientX - dragStartX;
    if (!hasDragged && Math.abs(distance) > DRAG_THRESHOLD) {
      hasDragged = true;
    }
    if (!hasDragged) return;

    event.preventDefault();
    offset -= event.clientX - lastPointerX;
    normalizeOffset();
    render();
    lastPointerX = event.clientX;
  }

  function onPointerUp(event) {
    if (event.pointerId !== activePointerId) return;

    // Only swallow the synthetic click emitted immediately after a drag.
    // A later, intentional tap must still open the full-size image.
    suppressClick = event.type === 'pointerup' && hasDragged;
    clearTimeout(clearClickSuppression);
    if (suppressClick) {
      clearClickSuppression = setTimeout(() => {
        suppressClick = false;
      }, 0);
    }
    activePointerId = null;
    wrapper.classList.remove('is-dragging');
    if (wrapper.hasPointerCapture(event.pointerId)) {
      wrapper.releasePointerCapture(event.pointerId);
    }
  }

  wrapper.addEventListener('pointerdown', onPointerDown);
  wrapper.addEventListener('pointermove', onPointerMove);
  wrapper.addEventListener('pointerup', onPointerUp);
  wrapper.addEventListener('pointercancel', onPointerUp);
  wrapper.addEventListener('click', (event) => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClick = false;
  }, true);

  wrapper.addEventListener('wheel', (event) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();
    offset += event.deltaX;
    normalizeOffset();
    render();
  }, { passive: false });

  wrapper.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    offset += event.key === 'ArrowLeft' ? -CARD_WIDTH : CARD_WIDTH;
    normalizeOffset();
    render();
  });

  wrapper.style.userSelect = 'none';
  requestAnimationFrame(autoScroll);
}

function createTestimonialCard(testimonial, isClone = false) {
  const article = document.createElement('article');
  article.className = 'testimonial-card';
  article.setAttribute('role', 'listitem');

  // Add click/keyboard handlers to ALL cards (including clones for infinite scroll)
  article.setAttribute('tabindex', '0');
  article.setAttribute('aria-label', `View full image of ${testimonial.name} — ${testimonial.event}`);
  article.addEventListener('click', () => {
    openLightbox({
      src: testimonial.img,
      alt: testimonial.alt,
      caption: `${testimonial.name} — ${testimonial.event}`
    });
  });
  article.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      article.click();
    }
  });

  article.innerHTML = `
    <img
      src="${testimonial.img}"
      alt="${testimonial.alt}"
      class="testimonial-img"
      loading="lazy"
    >
    <div class="testimonial-overlay">
      <div class="testimonial-badge" aria-label="Verified client">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div style="margin-top: auto;">
        <h3 class="testimonial-name">${testimonial.name}</h3>
        <p class="testimonial-event">${testimonial.event}</p>
      </div>
    </div>
  `;

  return article;
}
