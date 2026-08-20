/**
 * touchbytiha — Contact Form
 * Validation, submission simulation, success toast
 */

import { $, $$ } from '../utils/dom.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Initialize contact form
 */
export function initForm() {
  const form = $('.contact-form');
  if (!form) return;

  const toast = $('.form-success');
  const inputs = $$('.form-input', form);

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateAll(form)) return;
    
    const submitBtn = $('.form-submit', form);
    const originalHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner"></span> Sending…';
    submitBtn.disabled = true;
    
    // Simulate network request
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      showToast(toast);
      form.reset();
      
      // Reset floating labels
      inputs.forEach(input => {
        input.classList.remove('error');
      });
    } catch {
      // Handle error gracefully
      console.error('Form submission failed');
    } finally {
      submitBtn.innerHTML = originalHTML;
      submitBtn.disabled = false;
    }
  });
  
  // Live validation on blur/input
  inputs.forEach(input => {
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => {
      if (input.classList.contains('error')) {
        validateField(input);
      }
    });
  });
}

/**
 * Validate all form fields
 * @param {HTMLFormElement} form
 * @returns {boolean}
 */
function validateAll(form) {
  let valid = true;
  $$('.form-input', form).forEach(input => {
    if (!validateField(input)) valid = false;
  });
  return valid;
}

/**
 * Validate a single field
 * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} input
 * @returns {boolean}
 */
function validateField(input) {
  const errorEl = document.getElementById(`${input.id}-error`);
  let valid = true;

  if (input.required && !input.value.trim()) {
    valid = false;
  }
  
  if (input.type === 'email' && input.value) {
    valid = EMAIL_REGEX.test(input.value);
  }

  input.classList.toggle('error', !valid);
  if (errorEl) {
    errorEl.classList.toggle('visible', !valid);
  }
  
  return valid;
}

/**
 * Show success toast
 * @param {HTMLElement} toast
 */
function showToast(toast) {
  if (!toast) return;
  
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('show'));
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.hidden = true;
    }, 400);
  }, 4000);
}