/**
 * touchbytiha — Admin app
 */

import { $, $$ } from '../utils/dom.js';
import { watchAuth, signIn, signOutAdmin, authErrorMessage } from './auth.js';
import { configured } from './firebase.js';
import { ADMIN_UID } from '../firebase-config.js';
import {
  loadAdminContent,
  getState,
  getKnownUpdatedAt,
  fetchRemoteUpdatedAt,
  saveCollection,
  saveMeta,
  restoreSnapshot,
  uploadImage,
  deleteStorageObject,
  findOrphans,
  deleteOrphans,
  storeErrorMessage
} from './store.js';
import { compressImage, formatBytes } from './upload.js';
import { openEditor, confirmAction, showToast, hideToast, createRow, renderEmpty } from './ui.js';

const loginScreen = $('#login-screen');
const adminShell = $('#admin-shell');
const loginForm = $('#login-form');
const loginError = $('#login-error');
const loginSubmit = $('#login-submit');
const saveStatus = $('#save-status');

const lists = {
  portfolio: $('#list-portfolio'),
  testimonials: $('#list-testimonials'),
  'services-main': $('#list-services-main'),
  'services-addon': $('#list-services-addon')
};

const CATEGORY_SUGGESTIONS = ['Bridal', 'Engagement', 'Event', 'Editorial', 'Creative', 'Natural'];

const SERVICE_ICON_OPTIONS = [
  { value: 'bridal', label: 'Bridal (heart)' },
  { value: 'engagement', label: 'Engagement (globe)' },
  { value: 'event', label: 'Event (calendar)' },
  { value: 'default', label: 'Default (sun)' },
  { value: 'addon', label: 'Add-on (plus)' }
];

let ready = false;

/* ------------------------------------------------------------------ */
/* Deferred storage deletion                                           */
/*                                                                     */
/* A removed/replaced file must survive the undo window, otherwise    */
/* "Undo" would restore a DB row pointing at a deleted image.          */
/* ------------------------------------------------------------------ */

const pendingDeletes = new Map();

function scheduleStorageDelete(path) {
  if (!path) return;
  const existing = pendingDeletes.get(path);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pendingDeletes.delete(path);
    deleteStorageObject(path).catch(error => console.error(error));
  }, 9000);

  pendingDeletes.set(path, timer);
}

function cancelStorageDelete(path) {
  const timer = pendingDeletes.get(path);
  if (!timer) return;
  clearTimeout(timer);
  pendingDeletes.delete(path);
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

if (!configured) {
  showLoginError('Firebase is not configured yet. Fill in js/firebase-config.js.');
  loginSubmit.disabled = true;
}

$('.password-toggle').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const input = $('input[name="password"]', loginForm);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  button.textContent = show ? 'Hide' : 'Show';
  button.setAttribute('aria-pressed', String(show));
  button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!configured) return;

  const data = new FormData(loginForm);
  const email = String(data.get('email') || '');
  const password = String(data.get('password') || '');

  showLoginError('');
  loginSubmit.disabled = true;
  loginSubmit.textContent = 'Signing in…';

  try {
    await signIn(email, password);
  } catch (error) {
    showLoginError(authErrorMessage(error));
  } finally {
    loginSubmit.disabled = false;
    loginSubmit.textContent = 'Sign in';
  }
});

$('#logout-btn').addEventListener('click', async () => {
  hideToast();
  await signOutAdmin();
});

watchAuth(async (user) => {
  if (!user) {
    ready = false;
    adminShell.hidden = true;
    loginScreen.hidden = false;
    return;
  }

  if (ADMIN_UID && ADMIN_UID !== 'REPLACE_WITH_TIHA_UID' && user.uid !== ADMIN_UID) {
    showLoginError('This account is not the site admin.');
    await signOutAdmin();
    return;
  }

  loginScreen.hidden = true;
  adminShell.hidden = false;

  if (ready) return;

  try {
    setStatus('Loading…');
    await loadAdminContent();
    renderAll();
    ready = true;
    setStatus('');
  } catch (error) {
    console.error(error);
    setStatus('');
    const message = storeErrorMessage(error);
    showLoginError(message);
    if (message.includes('Permission denied')) {
      adminShell.hidden = true;
      loginScreen.hidden = false;
    }
  }
});

function showLoginError(message) {
  loginError.textContent = message;
  loginError.hidden = !message;
}

function setStatus(message) {
  saveStatus.textContent = message;
  saveStatus.classList.toggle('is-saving', Boolean(message));
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

const tabs = $$('.tab');

tabs.forEach(tab => {
  tab.addEventListener('click', () => selectTab(tab.dataset.tab));
});

function selectTab(name) {
  tabs.forEach(tab => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    const panel = $(`#panel-${tab.dataset.tab}`);
    if (panel) panel.hidden = !active;
  });
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function renderAll() {
  renderPortfolio();
  renderTestimonials();
  renderServices();
  renderNote();
}

function renderPortfolio() {
  const state = getState();
  const list = lists.portfolio;
  list.textContent = '';

  if (!state.portfolio.length) {
    renderEmpty(list, 'No portfolio images yet. Add one to get started.');
    return;
  }

  state.portfolio.forEach((item, index) => {
    list.appendChild(createRow({
      thumb: item.img,
      title: item.title || 'Untitled',
      subtitle: item.category,
      badge: item.featured ? 'Featured' : '',
      index,
      total: state.portfolio.length,
      onEdit: () => editPortfolio(item),
      onDelete: () => deleteItem('portfolio', item),
      onMove: (direction) => moveItem('portfolio', index, direction)
    }));
  });
}

function renderTestimonials() {
  const state = getState();
  const list = lists.testimonials;
  list.textContent = '';

  if (!state.testimonials.length) {
    renderEmpty(list, 'No testimonial screenshots yet.');
    return;
  }

  state.testimonials.forEach((item, index) => {
    list.appendChild(createRow({
      thumb: item.img,
      title: item.name || 'Untitled',
      subtitle: item.event,
      index,
      total: state.testimonials.length,
      onEdit: () => editTestimonial(item),
      onDelete: () => deleteItem('testimonials', item),
      onMove: (direction) => moveItem('testimonials', index, direction)
    }));
  });
}

function renderServices() {
  const state = getState();
  const main = state.services.filter(service => service.type !== 'addon');
  const addons = state.services.filter(service => service.type === 'addon');

  renderServiceList(lists['services-main'], main, 'Add your first main service.');
  renderServiceList(lists['services-addon'], addons, 'No add-ons yet.');
}

function renderServiceList(list, items, emptyMessage) {
  list.textContent = '';

  if (!items.length) {
    renderEmpty(list, emptyMessage);
    return;
  }

  items.forEach((service, index) => {
    list.appendChild(createRow({
      title: service.title || 'Untitled',
      subtitle: service.price,
      index,
      total: items.length,
      onEdit: () => editService(service),
      onDelete: () => deleteItem('services', service),
      onMove: (direction) => moveServiceInGroup(service, direction)
    }));
  });
}

function renderNote() {
  const state = getState();
  const form = $('#note-form');
  $('[name="note"]', form).value = state.meta?.note || '';
}

/* ------------------------------------------------------------------ */
/* Mutation helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Warn when another tab wrote after this session last synced.
 * @returns {Promise<boolean>} true when it is safe to continue
 */
async function guardConcurrentEdit() {
  const remote = await fetchRemoteUpdatedAt();
  if (!remote || remote <= getKnownUpdatedAt()) return true;

  return confirmAction({
    title: 'Content changed elsewhere',
    message: 'This data was changed in another tab or device. Saving now overwrites those changes. Continue?',
    confirmLabel: 'Overwrite',
    danger: false
  });
}

/**
 * Persist a collection, then show an undo toast.
 *
 * Storage files that are no longer referenced are deleted only after the
 * undo window closes, so "Undo" never restores a row with a dead image URL.
 *
 * @param {string} collection
 * @param {Object[]} items
 * @param {string} message
 * @param {string[]} [storagePathsToDelete]
 * @param {{guard?: Promise<boolean>}} [options] - pre-started concurrency check
 */
async function persist(collection, items, message, storagePathsToDelete = [], { guard } = {}) {
  const safe = await (guard || guardConcurrentEdit());
  if (!safe) {
    // Keep the editor open with its state so nothing typed is lost.
    throw new Error('Save cancelled — content changed in another tab.');
  }

  setStatus('Saving…');
  let snapshot;

  try {
    snapshot = await saveCollection(collection, items);
  } catch (error) {
    setStatus('');
    showToast(storeErrorMessage(error), { duration: 10000 });
    throw error;
  }

  setStatus('');
  renderAll();
  storagePathsToDelete.filter(Boolean).forEach(scheduleStorageDelete);

  showToast(message, {
    undo: async () => {
      setStatus('Undoing…');
      storagePathsToDelete.filter(Boolean).forEach(cancelStorageDelete);
      try {
        await restoreSnapshot(snapshot);
        renderAll();
        showToast('Reverted.', { duration: 3000 });
      } catch (error) {
        showToast(storeErrorMessage(error));
      } finally {
        setStatus('');
      }
    }
  });
}

function moveItem(collection, index, direction) {
  const state = getState();
  const items = [...state[collection]];
  const target = index + direction;
  if (target < 0 || target >= items.length) return;

  [items[index], items[target]] = [items[target], items[index]];
  persist(collection, items, direction < 0 ? 'Moved up' : 'Moved down')
    .catch(() => {});
}

/**
 * Reorder inside the main/add-on group while preserving the other group's
 * relative order and the overall list integrity.
 */
function moveServiceInGroup(service, direction) {
  const state = getState();
  const items = [...state.services];
  const isAddon = service.type === 'addon';
  const groupIndexes = items
    .map((item, index) => ({ item, index }))
    .filter(entry => (entry.item.type === 'addon') === isAddon)
    .map(entry => entry.index);

  const position = groupIndexes.findIndex(index => items[index].id === service.id);
  const swapPosition = position + direction;
  if (position < 0 || swapPosition < 0 || swapPosition >= groupIndexes.length) return;

  const from = groupIndexes[position];
  const to = groupIndexes[swapPosition];
  [items[from], items[to]] = [items[to], items[from]];

  persist('services', items, direction < 0 ? 'Moved up' : 'Moved down')
    .catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Portfolio                                                           */
/* ------------------------------------------------------------------ */

async function editPortfolio(item) {
  const isNew = !item;

  await openEditor({
    title: isNew ? 'Add portfolio image' : 'Edit portfolio image',
    submitLabel: isNew ? 'Add' : 'Save',
    values: item || {},
    fields: [
      { name: 'image', label: 'Image', type: 'image' },
      { name: 'title', label: 'Title', required: true, placeholder: 'Timeless Elegance' },
      { name: 'alt', label: 'Alt text', required: true, hint: 'Describes the photo for screen readers.' },
      { name: 'category', label: 'Category', type: 'datalist', required: true, options: CATEGORY_SUGGESTIONS },
      { name: 'featured', label: 'Featured (large tile)', type: 'checkbox' }
    ],
    onSubmit: async (payload) => {
      const state = getState();
      const items = state.portfolio.map(entry => ({ ...entry }));
      const record = item ? { ...item } : { featured: false };
      const stalePaths = [];
      const progress = payload.__progress;

      // Start the concurrency check now so it overlaps the upload instead of
      // adding another round trip after it.
      const guard = guardConcurrentEdit();

      if (payload.__file) {
        setStatus('Uploading…');
        try {
          progress?.indeterminate('Optimising photo…');
          const compressed = await compressImage(payload.__file, { kind: 'portfolio' });

          const uploaded = await uploadImage(
            compressed.blob,
            'portfolio',
            record.id,
            fraction => progress?.set(fraction, `Uploading… ${Math.round(fraction * 100)}%`)
          );

          if (record.storagePath) stalePaths.push(record.storagePath);
          record.id = uploaded.id;
          record.img = uploaded.img;
          record.storagePath = uploaded.storagePath;
        } finally {
          setStatus('');
        }
      }

      progress?.indeterminate('Saving details…');

      record.title = payload.title;
      record.alt = payload.alt;
      record.category = payload.category;

      const wantsFeatured = Boolean(payload.featured);
      if (wantsFeatured) {
        // Clear every other flag in the same write: exactly one featured item.
        items.forEach(entry => { entry.featured = false; });
      }
      record.featured = wantsFeatured;

      if (item) {
        const index = items.findIndex(entry => entry.id === item.id);
        items[index] = record;
      } else {
        items.push(record);
      }

      await persist('portfolio', items, isNew ? 'Image added' : 'Image updated', stalePaths, { guard });
    }
  });
}

async function editTestimonial(item) {
  const isNew = !item;

  await openEditor({
    title: isNew ? 'Add testimonial' : 'Edit testimonial',
    submitLabel: isNew ? 'Add' : 'Save',
    values: item || {},
    fields: [
      { name: 'image', label: 'Screenshot', type: 'image' },
      { name: 'name', label: 'Client name', required: true, placeholder: 'Sarah M.' },
      { name: 'event', label: 'Service', required: true, placeholder: 'Bridal Makeup' },
      { name: 'alt', label: 'Alt text', required: true }
    ],
    onSubmit: async (payload) => {
      const state = getState();
      const items = [...state.testimonials];
      const record = item ? { ...item } : {};
      const stalePaths = [];
      const progress = payload.__progress;

      const guard = guardConcurrentEdit();

      if (payload.__file) {
        setStatus('Uploading…');
        try {
          progress?.indeterminate('Optimising screenshot…');
          const compressed = await compressImage(payload.__file, { kind: 'screenshot' });

          const uploaded = await uploadImage(
            compressed.blob,
            'testimonials',
            record.id,
            fraction => progress?.set(fraction, `Uploading… ${Math.round(fraction * 100)}%`)
          );

          if (record.storagePath) stalePaths.push(record.storagePath);
          record.id = uploaded.id;
          record.img = uploaded.img;
          record.storagePath = uploaded.storagePath;
        } finally {
          setStatus('');
        }
      }

      progress?.indeterminate('Saving details…');

      record.name = payload.name;
      record.event = payload.event;
      record.alt = payload.alt;

      if (item) {
        const index = items.findIndex(entry => entry.id === item.id);
        items[index] = record;
      } else {
        items.push(record);
      }

      await persist('testimonials', items, isNew ? 'Testimonial added' : 'Testimonial updated', stalePaths, { guard });
    }
  });
}

/* ------------------------------------------------------------------ */
/* Services                                                            */
/* ------------------------------------------------------------------ */

async function editService(service) {
  const isNew = !service;

  await openEditor({
    title: isNew ? 'Add service' : 'Edit service',
    submitLabel: isNew ? 'Add' : 'Save',
    values: service || { type: 'main', icon: 'default' },
    fields: [
      { name: 'title', label: 'Title', required: true, placeholder: 'Bridal' },
      { name: 'price', label: 'Price', required: true, placeholder: 'RM200', hint: 'Free text — keep the RM prefix, add-ons use +RM5.' },
      {
        name: 'type',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'main', label: 'Main service' },
          { value: 'addon', label: 'Add-on' }
        ]
      },
      { name: 'icon', label: 'Icon', type: 'select', options: SERVICE_ICON_OPTIONS },
      {
        name: 'desc',
        label: 'Description',
        type: 'textarea',
        rows: 3,
        visibleWhen: { name: 'type', value: 'main' },
        hint: 'Main services show a description; add-ons do not.'
      }
    ],
    onSubmit: async (payload) => {
      const state = getState();
      const items = [...state.services];
      const record = service ? { ...service } : {};

      record.title = payload.title;
      record.price = payload.price;
      record.type = payload.type === 'addon' ? 'addon' : 'main';
      record.icon = record.type === 'addon' ? 'addon' : payload.icon;
      record.desc = record.type === 'addon' ? '' : (payload.desc || '');

      if (service) {
        const index = items.findIndex(entry => entry.id === service.id);
        items[index] = record;
      } else {
        items.push(record);
      }

      await persist('services', items, isNew ? 'Service added' : 'Service updated');
    }
  });
}

/* ------------------------------------------------------------------ */
/* Delete                                                              */
/* ------------------------------------------------------------------ */

async function deleteItem(collection, item) {
  const isImage = collection !== 'services';
  const label = item.title || item.name || 'this item';

  const okay = await confirmAction({
    title: 'Remove item?',
    message: isImage
      ? `Remove "${label}"? The uploaded image is deleted too. You can undo for a few seconds.`
      : `Remove "${label}"? You can undo for a few seconds.`,
    confirmLabel: 'Remove'
  });

  if (!okay) return;

  const state = getState();
  const items = state[collection].filter(entry => entry.id !== item.id);

  // Legacy repo items have storagePath === null: DB-only removal, the file
  // stays in the repo untouched.
  await persist(collection, items, 'Removed', item.storagePath ? [item.storagePath] : [])
    .catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Add buttons                                                         */
/* ------------------------------------------------------------------ */

$$('[data-add]').forEach(button => {
  button.addEventListener('click', () => {
    switch (button.dataset.add) {
      case 'portfolio': editPortfolio(null); break;
      case 'testimonials': editTestimonial(null); break;
      case 'services': editService(null); break;
    }
  });
});

/* ------------------------------------------------------------------ */
/* Note                                                                */
/* ------------------------------------------------------------------ */

$('#note-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const note = $('[name="note"]', form).value.trim();

  setStatus('Saving…');
  try {
    if (!(await guardConcurrentEdit())) {
      setStatus('');
      return;
    }
    const snapshot = await saveMeta({ note });
    renderNote();
    showToast('Note saved', {
      undo: async () => {
        try {
          await restoreSnapshot(snapshot);
          renderNote();
          showToast('Reverted.', { duration: 3000 });
        } catch (error) {
          showToast(storeErrorMessage(error));
        }
      }
    });
  } catch (error) {
    showToast(storeErrorMessage(error), { duration: 10000 });
  } finally {
    setStatus('');
  }
});

/* ------------------------------------------------------------------ */
/* Tools — orphan cleanup                                              */
/* ------------------------------------------------------------------ */

let orphanFiles = [];

$('#scan-orphans').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const list = $('#orphan-list');
  const deleteButton = $('#delete-orphans');

  button.disabled = true;
  button.textContent = 'Scanning…';
  list.textContent = '';

  try {
    orphanFiles = await findOrphans();

    if (!orphanFiles.length) {
      const li = document.createElement('li');
      li.textContent = 'No orphans found. Storage is clean.';
      list.appendChild(li);
      deleteButton.hidden = true;
      return;
    }

    orphanFiles.forEach(file => {
      const li = document.createElement('li');
      li.textContent = `${file.path} (${formatBytes(file.size)})`;
      list.appendChild(li);
    });

    deleteButton.hidden = false;
    deleteButton.textContent = `Delete ${orphanFiles.length} file${orphanFiles.length === 1 ? '' : 's'}`;
  } catch (error) {
    const li = document.createElement('li');
    li.textContent = storeErrorMessage(error);
    list.appendChild(li);
  } finally {
    button.disabled = false;
    button.textContent = 'Scan for orphans';
  }
});

$('#delete-orphans').addEventListener('click', async (event) => {
  if (!orphanFiles.length) return;

  // Capture before awaiting: event.currentTarget is cleared once dispatch ends.
  const button = event.currentTarget;

  const okay = await confirmAction({
    title: 'Delete orphan files?',
    message: `${orphanFiles.length} file(s) will be permanently deleted from Storage. This cannot be undone.`,
    confirmLabel: 'Delete files'
  });

  if (!okay) return;

  button.disabled = true;
  button.textContent = 'Deleting…';

  try {
    await deleteOrphans(orphanFiles);
    orphanFiles = [];
    $('#orphan-list').textContent = '';
    button.hidden = true;
    showToast('Orphan files deleted.', { duration: 4000 });
  } catch (error) {
    showToast(storeErrorMessage(error), { duration: 10000 });
    button.disabled = false;
    button.textContent = 'Try again';
  }
});
