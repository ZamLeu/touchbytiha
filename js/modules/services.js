/**
 * touchbytiha — Services
 * Render service cards from JSON data
 */

import { $, $$, escape } from '../utils/dom.js';

const SERVICE_ICONS = {
  bridal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>',
  engagement: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
  event: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
  default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>',
  addon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>'
};

/**
 * Render service cards
 * @param {Object[]} services - Service data array, already sorted by order
 * @param {string} [note] - Optional note shown under the section header
 */
export function renderServices(services, note) {
  const grid = $('.services-grid');
  const accordion = $('.services-accordion');
  const addonsGrid = $('.services-addons');
  if (!grid) return;

  const noteEl = $('#services-note');
  if (noteEl) {
    if (note) {
      noteEl.textContent = note;
      noteEl.hidden = false;
    } else {
      noteEl.hidden = true;
    }
  }

  // Split into main services and add-ons
  const mainServices = services.filter(s => s.type === 'main');
  const addons = services.filter(s => s.type === 'addon');

  // Featured (first 3) as full cards, rest as accordion
  const featured = mainServices.slice(0, 3);
  const additional = mainServices.slice(3);

  // Find Event index in featured for "Most Popular" badge
  const primaryIndex = featured.findIndex(s => s.title.toLowerCase() === 'event');

  // Render featured services as full cards
  grid.innerHTML = featured.map((service, i) => {
    const iconKey = service.icon || (service.title.toLowerCase().includes('bridal') ? 'bridal' :
                    service.title.toLowerCase().includes('engagement') ? 'engagement' :
                    service.title.toLowerCase().includes('event') ? 'event' : 'default');
    const icon = SERVICE_ICONS[iconKey] || SERVICE_ICONS.default;
    const isPrimary = i === primaryIndex;

    return `
      <article 
        class="service-card reveal${isPrimary ? ' primary' : ''}" 
        style="transition-delay: ${i * 100}ms" 
        role="listitem"
        data-index="${i + 1}"
      >
        ${isPrimary ? '<span class="service-badge">Most Popular</span>' : ''}
        <div class="service-icon" aria-hidden="true">
          ${icon}
        </div>
        <h3 class="service-title">${escape(service.title)}</h3>
        <p class="service-desc">${escape(service.desc)}</p>
        <div class="service-footer">
          <span class="service-price">${escape(service.price)}</span>
          <a href="#contact" class="service-link">
            Book Now
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </a>
        </div>
      </article>
    `;
  }).join('');

  // Render additional services as accordion
  if (accordion && additional.length > 0) {
    accordion.innerHTML = additional.map((service, i) => `
      <div class="accordion-item reveal" style="transition-delay: ${i * 100}ms">
        <button 
          class="accordion-trigger" 
          type="button" 
          aria-expanded="false" 
          aria-controls="accordion-desc-${i}"
          data-index="${i}"
        >
          <span class="accordion-title">${escape(service.title)}</span>
          <span class="accordion-price">${escape(service.price)}</span>
        </button>
        <div 
          class="accordion-desc" 
          id="accordion-desc-${i}" 
          role="region" 
          aria-hidden="true"
        >
          <p>${escape(service.desc)}</p>
        </div>
      </div>
    `).join('');

    // Initialize accordion interactions
    initAccordion(accordion);
  } else if (accordion) {
    accordion.innerHTML = '';
  }

  // Render add-ons if container exists
  if (addonsGrid && addons.length > 0) {
    addonsGrid.innerHTML = addons.map((service, i) => {
      const icon = SERVICE_ICONS.addon;
      return `
        <article 
          class="service-card addon reveal" 
          style="transition-delay: ${i * 100}ms" 
          role="listitem"
        >
          <div class="service-icon" aria-hidden="true">
            ${icon}
          </div>
          <h3 class="service-title">${escape(service.title)}</h3>
          <div class="service-footer">
            <span class="service-price">${escape(service.price)}</span>
          </div>
        </article>
      `;
    }).join('');
  } else if (addonsGrid) {
    addonsGrid.innerHTML = '';
  }
}

/**
 * Initialize accordion toggle behavior
 * @param {Element} accordion - The accordion container element
 */
function initAccordion(accordion) {
  const triggers = $$('.accordion-trigger', accordion);
  
  triggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const index = trigger.dataset.index;
      const desc = $(`#accordion-desc-${index}`, accordion);
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';
      
      // Close all other accordion items
      triggers.forEach(t => {
        if (t !== trigger) {
          t.setAttribute('aria-expanded', 'false');
          const otherDesc = $(`#accordion-desc-${t.dataset.index}`, accordion);
          if (otherDesc) {
            otherDesc.classList.remove('open');
            otherDesc.setAttribute('aria-hidden', 'true');
          }
        }
      });
      
      // Toggle current
      trigger.setAttribute('aria-expanded', !isOpen);
      if (desc) {
        desc.classList.toggle('open');
        desc.setAttribute('aria-hidden', isOpen);
      }
    });
    
    // Keyboard support
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        trigger.click();
      }
    });
  });
}