/**
 * touchbytiha — Admin UI primitives
 * Editor dialog, confirm dialog, toast, list rows.
 *
 * User data is always written with textContent, never innerHTML.
 */

import { $ } from '../utils/dom.js';

const editorDialog = $('#editor-dialog');
const editorForm = $('#editor-form');
const editorFields = $('#editor-fields');
const editorTitle = $('#editor-title');
const editorError = $('#editor-error');
const editorSave = $('#editor-save');
const editorCancel = $('#editor-cancel');
const editorClose = $('#editor-close');
const editorProgress = $('#editor-progress');
const editorProgressFill = $('.editor-progress-fill', editorProgress);
const editorProgressLabel = $('#editor-progress-label');

const confirmDialog = $('#confirm-dialog');
const confirmTitle = $('#confirm-title');
const confirmMessage = $('#confirm-message');
const confirmOk = $('#confirm-ok');
const confirmForm = $('form', confirmDialog);

const toast = $('#toast');
const toastText = $('.toast-text', toast);
const toastUndo = $('#toast-undo');

let toastTimer = null;
let editorSession = 0;
let toastUndoHandler = null;

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

/**
 * @param {string} message
 * @param {{undo?: () => void|Promise<void>, duration?: number}} [options]
 */
export function showToast(message, { undo, duration = 8000 } = {}) {
  clearTimeout(toastTimer);
  toastText.textContent = message;
  toastUndoHandler = undo || null;
  toastUndo.hidden = !undo;
  toast.hidden = false;

  toastTimer = setTimeout(hideToast, duration);
  return { hide: hideToast };
}

/* ------------------------------------------------------------------ */
/* Editor progress                                                     */
/* ------------------------------------------------------------------ */

/**
 * Drive the in-dialog progress bar.
 *
 * `onSubmit` receives this object, so a save can report real upload bytes
 * instead of leaving the user staring at a static "Saving…".
 *
 *   progress.start('Preparing photo…');
 *   progress.set(0.4, 'Uploading… 40%');
 *   progress.indeterminate('Saving…');
 *   progress.stop();
 */
export function createProgress() {
  let visible = false;

  const reset = () => {
    editorProgress.classList.remove('is-indeterminate');
    editorProgressFill.style.width = '0%';
  };

  return {
    start(label = 'Saving…') {
      visible = true;
      reset();
      editorProgress.hidden = false;
      editorProgressLabel.textContent = label;
    },

    /** @param {number} fraction 0..1 */
    set(fraction, label) {
      if (!visible) this.start();
      editorProgress.classList.remove('is-indeterminate');
      const pct = Math.max(0, Math.min(1, fraction)) * 100;
      editorProgressFill.style.width = `${pct}%`;
      if (label) editorProgressLabel.textContent = label;
    },

    indeterminate(label) {
      if (!visible) this.start();
      editorProgressFill.style.width = '';
      editorProgress.classList.add('is-indeterminate');
      if (label) editorProgressLabel.textContent = label;
    },

    stop() {
      visible = false;
      editorProgress.hidden = true;
      editorProgressLabel.textContent = '';
      reset();
    }
  };
}

export function hideToast() {
  clearTimeout(toastTimer);
  toast.hidden = true;
  toastUndoHandler = null;
}

toastUndo.addEventListener('click', () => {
  const handler = toastUndoHandler;
  hideToast();
  if (handler) Promise.resolve(handler()).catch(error => console.error(error));
});

$('.toast-close', toast).addEventListener('click', hideToast);

/* ------------------------------------------------------------------ */
/* Confirm                                                             */
/* ------------------------------------------------------------------ */

/**
 * @param {{title?: string, message: string, confirmLabel?: string, danger?: boolean}} options
 * @returns {Promise<boolean>}
 */
export function confirmAction({ title = 'Are you sure?', message, confirmLabel = 'Confirm', danger = true }) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmOk.textContent = confirmLabel;
  confirmOk.className = danger ? 'btn btn-danger' : 'btn btn-primary';

  return new Promise(resolve => {
    const finish = (result) => {
      confirmForm.removeEventListener('submit', onSubmit);
      confirmDialog.removeEventListener('cancel', onCancel);
      if (confirmDialog.open) confirmDialog.close();
      resolve(result);
    };

    const onSubmit = (event) => {
      event.preventDefault();
      const value = /** @type {HTMLButtonElement} */ (event.submitter)?.value;
      finish(value === 'ok');
    };

    const onCancel = (event) => {
      event.preventDefault();
      finish(false);
    };

    confirmForm.addEventListener('submit', onSubmit);
    confirmDialog.addEventListener('cancel', onCancel);

    if (!confirmDialog.open) confirmDialog.showModal();
    confirmOk.focus();
  });
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

/**
 * Open the shared editor dialog and run an async submit handler.
 *
 * The dialog stays open while `onSubmit` runs, so failed saves (expired
 * session, network) keep the user's input intact.
 *
 * Field types: text | textarea | select | datalist | checkbox | image
 *
 * @param {{
 *   title: string,
 *   fields: Array<{
 *     name: string, label: string, type?: string, required?: boolean,
 *     options?: (string|{value: string, label: string})[],
 *     placeholder?: string, hint?: string, rows?: number,
 *     visibleWhen?: {name: string, value: string}
 *   }>,
 *   values?: Object,
 *   submitLabel?: string,
 *   onSubmit: (values: Object) => Promise<any>
 * }} config
 * @returns {Promise<Object|null>} submitted values, or null if cancelled
 */
export function openEditor({ title, fields, values = {}, submitLabel = 'Save', onSubmit }) {
  editorTitle.textContent = title;
  editorSave.textContent = submitLabel;
  editorSave.disabled = false;
  editorCancel.disabled = false;
  showEditorError('');
  editorFields.textContent = '';

  const media = { file: null, previewUrl: null };

  const wrappers = new Map();

  fields.forEach(field => {
    const wrapper = buildField(field, values[field.name], media);
    wrappers.set(field.name, wrapper);
    editorFields.appendChild(wrapper);
  });

  const syncVisibility = () => {
    fields.forEach(field => {
      if (!field.visibleWhen) return;
      const controller = editorFields.querySelector(`[name="${field.visibleWhen.name}"]`);
      const wrapper = wrappers.get(field.name);
      if (!controller || !wrapper) return;
      wrapper.hidden = controller.value !== field.visibleWhen.value;
    });
  };

  fields.forEach(field => {
    if (!field.visibleWhen) return;
    const controller = editorFields.querySelector(`[name="${field.visibleWhen.name}"]`);
    if (controller) controller.addEventListener('change', syncVisibility);
  });
  syncVisibility();

  return new Promise(resolve => {
    let settled = false;
    const token = ++editorSession;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      editorForm.removeEventListener('submit', handleSubmit);
      editorDialog.removeEventListener('cancel', handleCancel);
      editorClose.removeEventListener('click', handleCancelClick);
      editorCancel.removeEventListener('click', handleCancelClick);
      editorSave.disabled = false;
      editorCancel.disabled = false;
      editorSave.classList.remove('is-busy');
      if (media.previewUrl) URL.revokeObjectURL(media.previewUrl);
      editorFields.textContent = '';
      resolve(result);
    };

    // Escape and the dialog's own controls are the only cancel paths. We do
    // not rely on the bubbling `close` event, which can arrive after the next
    // editor has already opened and clear its freshly built fields.
    const handleCancel = (event) => {
      event.preventDefault();
      if (token !== editorSession) return;
      editorDialog.close();
      finish(null);
    };

    const handleCancelClick = () => {
      if (token !== editorSession) return;
      editorDialog.close();
      finish(null);
    };

    const handleSubmit = async (event) => {
      event.preventDefault();
      showEditorError('');

      const result = {};
      for (const field of fields) {
        if (field.type === 'image') continue;

        const el = editorFields.querySelector(`[name="${field.name}"]`);
        if (!el) continue;

        if (field.visibleWhen) {
          const controller = editorFields.querySelector(`[name="${field.visibleWhen.name}"]`);
          if (controller && controller.value !== field.visibleWhen.value) continue;
        }

        if (field.type === 'checkbox') {
          result[field.name] = el.checked;
          continue;
        }

        const value = el.value.trim();
        if (field.required && !value) {
          showEditorError(`${field.label} is required.`);
          el.focus();
          return;
        }
        result[field.name] = value;
      }

      if (fields.some(field => field.type === 'image') && !media.file && !values.img) {
        showEditorError('Choose an image first.');
        return;
      }

      result.__file = media.file;

      editorSave.disabled = true;
      editorCancel.disabled = true;
      editorSave.classList.add('is-busy');
      const label = editorSave.textContent;
      editorSave.textContent = 'Saving';

      const progress = createProgress();
      progress.start('Preparing photo…');
      result.__progress = progress;

      try {
        await onSubmit(result);
        progress.stop();
        finish(result);
        editorDialog.close();
      } catch (error) {
        progress.stop();
        console.error(error);
        showEditorError(error?.message || 'Save failed. Try again.');
        editorSave.disabled = false;
        editorCancel.disabled = false;
        editorSave.classList.remove('is-busy');
        editorSave.textContent = label;
      }
    };

    editorForm.addEventListener('submit', handleSubmit);
    editorDialog.addEventListener('cancel', handleCancel);
    editorClose.addEventListener('click', handleCancelClick);
    editorCancel.addEventListener('click', handleCancelClick);
    editorDialog.returnValue = '';
    editorDialog.showModal();
  });
}

function showEditorError(message) {
  editorError.textContent = message;
  editorError.hidden = !message;
}

function buildField(field, value, media) {
  const wrapper = document.createElement(field.type === 'image' ? 'div' : 'label');
  wrapper.className = 'field';

  if (field.visibleWhen) wrapper.hidden = true;

  if (field.type !== 'checkbox' && field.type !== 'image') {
    const label = document.createElement('span');
    label.className = 'field-label';
    label.textContent = field.label;
    wrapper.appendChild(label);
  }

  switch (field.type) {
    case 'textarea': {
      const el = document.createElement('textarea');
      el.className = 'input';
      el.name = field.name;
      el.rows = field.rows || 3;
      el.value = value || '';
      if (field.placeholder) el.placeholder = field.placeholder;
      if (field.required) el.required = true;
      wrapper.appendChild(el);
      break;
    }

    case 'select': {
      const el = document.createElement('select');
      el.className = 'input';
      el.name = field.name;
      (field.options || []).forEach(option => {
        const opt = document.createElement('option');
        opt.value = typeof option === 'string' ? option : option.value;
        opt.textContent = typeof option === 'string' ? option : option.label;
        el.appendChild(opt);
      });
      el.value = value || '';
      wrapper.appendChild(el);
      break;
    }

    case 'datalist': {
      const listId = `datalist-${field.name}`;
      const el = document.createElement('input');
      el.className = 'input';
      el.name = field.name;
      el.type = 'text';
      el.value = value || '';
      el.setAttribute('list', listId);
      el.autocomplete = 'off';
      if (field.placeholder) el.placeholder = field.placeholder;
      if (field.required) el.required = true;

      const list = document.createElement('datalist');
      list.id = listId;
      (field.options || []).forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        list.appendChild(opt);
      });

      wrapper.appendChild(el);
      wrapper.appendChild(list);
      break;
    }

    case 'checkbox': {
      wrapper.className = 'checkbox-field';
      if (field.visibleWhen) wrapper.hidden = true;

      const el = document.createElement('input');
      el.type = 'checkbox';
      el.name = field.name;
      el.checked = Boolean(value);

      const text = document.createElement('span');
      text.className = 'field-label';
      text.textContent = field.label;

      wrapper.appendChild(el);
      wrapper.appendChild(text);
      break;
    }

    case 'image': {
      const box = document.createElement('div');
      box.className = 'upload-preview';

      const preview = document.createElement('img');
      preview.alt = 'Selected image preview';
      preview.src = value || '';
      preview.hidden = !value;

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.className = 'file-input-hidden';
      fileInput.name = field.name;

      const pickBtn = document.createElement('button');
      pickBtn.type = 'button';
      pickBtn.className = 'btn btn-secondary btn-sm';
      pickBtn.textContent = value ? 'Change image' : 'Choose image';

      const note = document.createElement('p');
      note.textContent = value
        ? 'Choose a new photo to replace it.'
        : 'Full-quality upload: resized to 2400px long edge, WebP at ~92% quality.';

      pickBtn.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        media.file = file;

        if (media.previewUrl) URL.revokeObjectURL(media.previewUrl);
        media.previewUrl = URL.createObjectURL(file);
        preview.src = media.previewUrl;
        preview.hidden = false;
        pickBtn.textContent = 'Change image';
        note.textContent = `${file.name} (${Math.round(file.size / 1024)} KB) — optimized on save.`;
      });

      box.appendChild(preview);
      box.appendChild(pickBtn);
      box.appendChild(fileInput);
      box.appendChild(note);
      wrapper.appendChild(box);
      break;
    }

    default: {
      const el = document.createElement('input');
      el.className = 'input';
      el.name = field.name;
      el.type = 'text';
      el.value = value || '';
      if (field.placeholder) el.placeholder = field.placeholder;
      if (field.required) el.required = true;
      wrapper.appendChild(el);
      break;
    }
  }

  if (field.hint) {
    const hint = document.createElement('span');
    hint.className = 'hint-inline';
    hint.textContent = field.hint;
    wrapper.appendChild(hint);
  }

  return wrapper;
}

/* Row builder                                                         */
/* ------------------------------------------------------------------ */

/**
 * @param {{
 *   thumb?: string,
 *   title: string,
 *   subtitle?: string,
 *   badge?: string,
 *   index: number,
 *   total: number,
 *   onEdit: () => void,
 *   onDelete: () => void,
 *   onMove: (direction: -1|1) => void
 * }} config
 * @returns {HTMLLIElement}
 */
export function createRow({
  thumb, title, subtitle, badge, index, total, onEdit, onDelete, onMove
}) {
  const li = document.createElement('li');
  li.className = 'admin-row' + (thumb ? '' : ' no-thumb');

  if (thumb) {
    const img = document.createElement('img');
    img.className = 'admin-thumb';
    img.src = thumb;
    img.alt = '';
    img.loading = 'lazy';
    li.appendChild(img);
  }

  const text = document.createElement('div');
  text.className = 'admin-row-text';

  const titleRow = document.createElement('div');
  titleRow.className = 'admin-row-title';

  const titleEl = document.createElement('span');
  titleEl.textContent = title;
  titleRow.appendChild(titleEl);

  if (badge) {
    const badgeEl = document.createElement('span');
    badgeEl.className = 'badge';
    badgeEl.textContent = badge;
    titleRow.appendChild(badgeEl);
  }

  text.appendChild(titleRow);

  if (subtitle) {
    const sub = document.createElement('div');
    sub.className = 'admin-row-sub';
    sub.textContent = subtitle;
    text.appendChild(sub);
  }

  li.appendChild(text);

  const actions = document.createElement('div');
  actions.className = 'admin-row-actions';

  const upBtn = iconButton('Move up', '↑', () => onMove(-1));
  const downBtn = iconButton('Move down', '↓', () => onMove(1));
  const editBtn = iconButton('Edit', '✎', onEdit, 'action-edit');
  const deleteBtn = iconButton('Delete', '🗑', onDelete);

  upBtn.disabled = index === 0;
  downBtn.disabled = index === total - 1;

  actions.append(upBtn, downBtn, editBtn, deleteBtn);
  li.appendChild(actions);

  return li;
}

function iconButton(label, glyph, handler, extraClass = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `icon-btn ${extraClass}`.trim();
  button.setAttribute('aria-label', label);
  button.title = label;
  button.textContent = glyph;
  button.addEventListener('click', handler);
  return button;
}

/**
 * Render an empty-state message inside a list container.
 * @param {HTMLElement} list
 * @param {string} message
 */
export function renderEmpty(list, message) {
  const li = document.createElement('li');
  li.className = 'empty-state';
  li.textContent = message;
  list.appendChild(li);
}
