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
    enableUserScroll(wrapper, track, testimonials.length);

  } catch (error) {
    console.error('Testimonials error:', error);
    container.innerHTML = '<p class="text-muted">Unable to load testimonials at this time.</p>';
  }
}

/**
 * Enable user drag/swipe scrolling while keeping auto-scroll
 * @param {HTMLElement} wrapper - .testimonials-wrapper
 * @param {HTMLElement} track - .testimonials-track
 * @param {number} originalCount - number of original (non-clone) items
 */
function enableUserScroll(wrapper, track, originalCount) {
  let isDragging = false;
  let startX = 0;
  let startTranslateX = 0;
  let dragStartX = 0;
  let dragStartTranslateX = 0;
  let autoScrollPaused = false;
  let velocity = 0;
  let lastX = 0;
  let lastTime = 0;
  const DRAG_THRESHOLD = 5; // pixels

  // Get current translateX from transform
  function getTranslateX() {
    const style = getComputedStyle(track);
    const matrix = style.transform.match(/matrix\((.+)\)/);
    if (matrix) {
      return parseFloat(matrix[1].split(', ')[4]) || 0;
    }
    return 0;
  }

  // Set translateX
  function setTranslateX(x) {
    track.style.transform = `translateX(${x}px)`;
  }

  // Pause auto-scroll animation
  function pauseAutoScroll() {
    if (!autoScrollPaused) {
      track.style.animationPlayState = 'paused';
      autoScrollPaused = true;
    }
  }

  // Resume auto-scroll animation
  function resumeAutoScroll() {
    if (autoScrollPaused) {
      track.style.animationPlayState = 'running';
      autoScrollPaused = false;
    }
  }

  // Snap to nearest valid position (prevent getting stuck between items)
  function snapToValidPosition() {
    const cardWidth = 300 + 24; // card width + gap (var(--space-lg) = 24px)
    const maxShift = cardWidth * originalCount; // 50% of duplicated track
    let currentX = getTranslateX();
    
    // Normalize to 0 to -maxShift range
    while (currentX > 0) currentX += maxShift;
    while (currentX < -maxShift) currentX -= maxShift;
    
    // Snap to nearest card boundary
    const snapped = Math.round(currentX / cardWidth) * cardWidth;
    const clamped = Math.max(-maxShift, Math.min(0, snapped));
    
    setTranslateX(clamped);
  }

  // Pointer/mouse down
  function onPointerDown(e) {
    // Record initial position but don't start drag yet
    // We'll start drag only after movement threshold (prevents click interception)
    const card = e.target.closest('.testimonial-card');
    const isOriginalCard = card && card.hasAttribute('tabindex') !== false;
    
    startX = e.clientX || (e.touches?.[0]?.clientX ?? 0);
    startTranslateX = getTranslateX();
    lastX = startX;
    lastTime = performance.now();
    velocity = 0;
    
    track.style.transition = 'none';
    track.style.cursor = 'grabbing';
    
    // Don't preventDefault on original cards - let click work
    if (!isOriginalCard) {
      e.preventDefault();
    }
    
    // Mark potential drag
    isDragging = false;
    dragStartX = startX;
    dragStartTranslateX = startTranslateX;
  }

  // Pointer/mouse move
  function onPointerMove(e) {
    if (!isDragging) {
      // Check if movement exceeds threshold
      const currentX = e.clientX || (e.touches?.[0]?.clientX ?? 0);
      if (Math.abs(currentX - dragStartX) > DRAG_THRESHOLD) {
        isDragging = true;
        pauseAutoScroll();
        startX = dragStartX;
        startTranslateX = dragStartTranslateX;
      } else {
        return;
      }
    }
    
    const currentX = e.clientX || (e.touches?.[0]?.clientX ?? 0);
    const deltaX = currentX - startX;
    const newX = startTranslateX + deltaX;
    
    // Calculate velocity for momentum
    const now = performance.now();
    const dt = now - lastTime;
    if (dt > 0) {
      velocity = (currentX - lastX) / dt; // px per ms
    }
    lastX = currentX;
    lastTime = now;
    
    setTranslateX(newX);
  }

  // Pointer/mouse up
  function onPointerUp() {
    if (!isDragging) {
      // Was a click, not a drag - let click handler work
      track.style.transition = '';
      track.style.cursor = 'grab';
      return;
    }
    
    isDragging = false;
    
    track.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    track.style.cursor = 'grab';
    
    // Apply momentum scrolling
    if (Math.abs(velocity) > 0.1) {
      const momentumX = getTranslateX() + velocity * 300; // project ~300ms
      setTranslateX(momentumX);
      
      // Snap after momentum
      setTimeout(() => {
        snapToValidPosition();
        resumeAutoScroll();
      }, 500);
    } else {
      snapToValidPosition();
      resumeAutoScroll();
    }
    
    // Restore transition for auto-scroll
    setTimeout(() => {
      track.style.transition = '';
    }, 500);
  }

  // Mouse events
  wrapper.addEventListener('mousedown', onPointerDown);
  document.addEventListener('mousemove', onPointerMove);
  document.addEventListener('mouseup', onPointerUp);
  document.addEventListener('mouseleave', onPointerUp);

  // Touch events
  wrapper.addEventListener('touchstart', onPointerDown, { passive: false });
  wrapper.addEventListener('touchmove', onPointerMove, { passive: false });
  wrapper.addEventListener('touchend', onPointerUp);
  wrapper.addEventListener('touchcancel', onPointerUp);

  // Wheel scroll (horizontal)
  let wheelResumeTimer = null;
  wrapper.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      pauseAutoScroll();
      track.style.transition = 'none';
      setTranslateX(getTranslateX() + e.deltaX);
      
      // Debounce resume
      clearTimeout(wheelResumeTimer);
      wheelResumeTimer = setTimeout(() => {
        track.style.transition = 'transform 0.3s ease';
        snapToValidPosition();
        resumeAutoScroll();
      }, 150);
    }
  }, { passive: false });

  // Keyboard navigation
  wrapper.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      pauseAutoScroll();
      track.style.transition = 'transform 0.3s ease';
      const cardWidth = 300 + 24;
      const direction = e.key === 'ArrowLeft' ? -1 : 1;
      setTranslateX(getTranslateX() + direction * cardWidth);
      
      setTimeout(() => {
        snapToValidPosition();
        resumeAutoScroll();
      }, 300);
    }
  });

  // Pause auto-scroll on hover/focus (existing CSS handles this too)
  wrapper.addEventListener('mouseenter', pauseAutoScroll);
  wrapper.addEventListener('focusin', pauseAutoScroll);
  wrapper.addEventListener('mouseleave', resumeAutoScroll);
  wrapper.addEventListener('focusout', resumeAutoScroll);

  // Ensure cursor style
  wrapper.style.cursor = 'grab';
  wrapper.style.userSelect = 'none';
}

function createTestimonialCard(testimonial, isClone = false) {
  const article = document.createElement('article');
  article.className = 'testimonial-card';
  article.setAttribute('role', 'listitem');

  if (!isClone) {
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
  }

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
