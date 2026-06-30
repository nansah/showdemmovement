/**
 * Showdem Movement Foundation — Admin Content Manager
 *
 * Activation: click the footer area 5× within 3 seconds
 * Default password: showdem2025
 *
 * Features:
 *  - Inline text editing for all timeline card text
 *  - Per-placeholder media upload (image file, image URL, YouTube)
 *  - Saves to localStorage (persists across page reloads on same device)
 *  - Export content as JSON backup
 *  - Reset to original HTML
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'showdem_content_v1';
  var ADMIN_PASS  = 'showdem2025';

  // ══════════════════════════════════════
  //  UTILITIES
  // ══════════════════════════════════════

  function getYouTubeEmbedUrl(url) {
    var match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return match ? 'https://www.youtube.com/embed/' + match[1] + '?rel=0' : null;
  }

  function showToast(msg, type) {
    var t = document.getElementById('admin-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'admin-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = type === 'error' ? 'is-error' : 'is-success';
    t.classList.add('visible');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove('visible'); }, 3000);
  }

  function isAdminMode() {
    return new URLSearchParams(window.location.search).get('admin') === '1';
  }

  // ══════════════════════════════════════
  //  MEDIA RENDERING  (used by both load & admin upload)
  // ══════════════════════════════════════

  function renderMedia(containerEl, media) {
    if (!media || !media.src) return;

    containerEl.innerHTML = '';
    containerEl.className = 'ftl-media-rendered';

    var inner;
    if (media.type === 'image') {
      inner = document.createElement('img');
      inner.src = media.src;
      inner.alt = media.alt || '';
    } else if (media.type === 'video-file') {
      inner = document.createElement('video');
      inner.src = media.src;
      inner.controls = true;
    } else if (media.type === 'youtube') {
      inner = document.createElement('iframe');
      inner.src = media.src;
      inner.setAttribute('allow', 'accelerometer;autoplay;clipboard-write;encrypted-media;picture-in-picture');
      inner.setAttribute('allowfullscreen', '');
      inner.title = 'YouTube video';
    }

    if (inner) containerEl.appendChild(inner);
  }

  // Unique key for each placeholder slot
  function mediaKey(cardId, slotIndex) {
    return 'card-' + cardId + '-' + slotIndex;
  }

  // ══════════════════════════════════════
  //  LOAD SAVED CONTENT  (runs on every page load)
  // ══════════════════════════════════════

  function loadSavedContent() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return; }

    // Restore text
    var textData = data.text || {};
    Object.keys(textData).forEach(function (cardId) {
      var cardEl = document.querySelector('.ftl-card[data-card="' + cardId + '"]');
      if (!cardEl) return;
      var t = textData[cardId];
      var eyebrow = cardEl.querySelector('.ftl-card-eyebrow');
      var title   = cardEl.querySelector('.ftl-card-h');
      var body    = cardEl.querySelector('.ftl-card-p');
      if (eyebrow && t.eyebrow !== undefined) eyebrow.textContent = t.eyebrow;
      if (title   && t.title   !== undefined) title.textContent   = t.title;
      if (body    && t.body    !== undefined) body.textContent    = t.body;
    });

    // Restore media
    var mediaData = data.media || {};
    Object.keys(mediaData).forEach(function (key) {
      // key format: "card-{id}-{slotIndex}"
      var parts = key.split('-');
      var cardId    = parts[1];
      var slotIndex = parseInt(parts[2]);
      var cardEl = document.querySelector('.ftl-card[data-card="' + cardId + '"]');
      if (!cardEl) return;
      var slots = cardEl.querySelectorAll('.ftl-media-ph');
      var target = slots[slotIndex];
      if (target) renderMedia(target, mediaData[key]);
    });
  }

  // ══════════════════════════════════════
  //  COLLECT & SAVE CONTENT
  // ══════════════════════════════════════

  function collectAndSave() {
    var textData  = {};
    var mediaData = {};

    document.querySelectorAll('.ftl-card[data-card]').forEach(function (cardEl) {
      var cardId  = cardEl.dataset.card;
      var eyebrow = cardEl.querySelector('.ftl-card-eyebrow');
      var title   = cardEl.querySelector('.ftl-card-h');
      var body    = cardEl.querySelector('.ftl-card-p');
      textData[cardId] = {
        eyebrow: eyebrow ? eyebrow.textContent.trim() : '',
        title:   title   ? title.textContent.trim()   : '',
        body:    body    ? body.textContent.trim()     : ''
      };

      // Collect per-slot media from stored references
      var mediaStore = cardEl._adminMediaSlots || {};
      Object.keys(mediaStore).forEach(function (slotIdx) {
        var key = mediaKey(cardId, slotIdx);
        mediaData[key] = mediaStore[slotIdx];
      });

      // Also preserve already-loaded media (from previous saves)
      cardEl.querySelectorAll('.ftl-media-rendered').forEach(function (rendered, idx) {
        var k = mediaKey(cardId, idx);
        if (!mediaData[k] && rendered._mediaRef) {
          mediaData[k] = rendered._mediaRef;
        }
      });
    });

    var payload = { text: textData, media: mediaData, savedAt: new Date().toISOString() };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      showToast('Changes saved!', 'success');
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        showToast('Storage full — try smaller images or use image URLs instead', 'error');
      } else {
        showToast('Save failed: ' + e.message, 'error');
      }
    }
  }

  function resetContent() {
    if (!confirm('Reset all content to original? This cannot be undone.')) return;
    localStorage.removeItem(STORAGE_KEY);
    showToast('Content reset — reloading…', 'success');
    setTimeout(function () { window.location.reload(); }, 800);
  }

  function exportJSON() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { showToast('Nothing saved yet — save first', 'error'); return; }
    var blob = new Blob([raw], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'showdem-content-' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
  }

  // ══════════════════════════════════════
  //  MEDIA MODAL
  // ══════════════════════════════════════

  function openMediaModal(cardEl, phEl, slotIndex) {
    var existing = document.getElementById('admin-media-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'admin-media-modal';
    modal.innerHTML = [
      '<div class="amm-backdrop"></div>',
      '<div class="amm-box">',
        '<button class="amm-close" title="Close">&times;</button>',
        '<h3 class="amm-title">Add Media</h3>',
        '<div class="amm-tabs">',
          '<button class="amm-tab active" data-tab="upload">Upload Photo</button>',
          '<button class="amm-tab" data-tab="url">Image URL</button>',
          '<button class="amm-tab" data-tab="youtube">YouTube Video</button>',
        '</div>',

        // Upload tab
        '<div class="amm-panel" data-panel="upload">',
          '<label class="amm-drop-zone" id="ammDropZone">',
            '<input type="file" id="ammFileInput" accept="image/*,video/mp4,video/webm" style="display:none">',
            '<div class="amm-drop-icon">📁</div>',
            '<p class="amm-drop-text">Click to choose a photo or video<span>JPG, PNG, GIF, MP4, WebM · max 8 MB recommended</span></p>',
          '</label>',
          '<div id="ammUploadPreview" class="amm-preview"></div>',
        '</div>',

        // URL tab
        '<div class="amm-panel hidden" data-panel="url">',
          '<label class="amm-label">Image URL</label>',
          '<input type="url" id="ammUrlInput" class="amm-input" placeholder="https://example.com/photo.jpg">',
          '<div id="ammUrlPreview" class="amm-preview"></div>',
        '</div>',

        // YouTube tab
        '<div class="amm-panel hidden" data-panel="youtube">',
          '<label class="amm-label">YouTube URL</label>',
          '<input type="url" id="ammYtInput" class="amm-input" placeholder="https://www.youtube.com/watch?v=…">',
          '<p class="amm-hint">Paste a YouTube watch URL or a short youtu.be link.</p>',
          '<div id="ammYtPreview" class="amm-preview"></div>',
        '</div>',

        '<div class="amm-actions">',
          '<button class="amm-btn-cancel">Cancel</button>',
          '<button class="amm-btn-apply" disabled>Apply</button>',
        '</div>',
      '</div>'
    ].join('');

    document.body.appendChild(modal);

    var pendingMedia = null;
    var applyBtn = modal.querySelector('.amm-btn-apply');

    function setPending(media) {
      pendingMedia = media;
      applyBtn.disabled = !media;
    }

    // ── Tabs ──
    modal.querySelectorAll('.amm-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        modal.querySelectorAll('.amm-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        modal.querySelectorAll('.amm-panel').forEach(function (p) {
          p.classList.toggle('hidden', p.dataset.panel !== tab.dataset.tab);
        });
        setPending(null);
      });
    });

    // ── File upload ──
    var fileInput       = modal.querySelector('#ammFileInput');
    var dropZone        = modal.querySelector('#ammDropZone');
    var uploadPreview   = modal.querySelector('#ammUploadPreview');

    dropZone.addEventListener('click', function () { fileInput.click(); });

    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      if (!file) return;
      var isImage = file.type.startsWith('image/');
      var isVideo = file.type.startsWith('video/');

      if (file.size > 20 * 1024 * 1024) {
        uploadPreview.innerHTML = '<p class="amm-preview-error">File is too large. Please use an image URL or YouTube link for large videos.</p>';
        setPending(null);
        return;
      }

      var reader = new FileReader();
      reader.onload = function (e) {
        var src = e.target.result;
        if (isImage) {
          uploadPreview.innerHTML = '<img src="' + src + '" alt="">';
          setPending({ type: 'image', src: src, alt: file.name });
        } else if (isVideo) {
          uploadPreview.innerHTML = '<video src="' + src + '" controls></video>';
          setPending({ type: 'video-file', src: src });
        }
      };
      reader.readAsDataURL(file);
    });

    // ── Image URL ──
    var urlInput   = modal.querySelector('#ammUrlInput');
    var urlPreview = modal.querySelector('#ammUrlPreview');
    var urlTimer;

    urlInput.addEventListener('input', function () {
      clearTimeout(urlTimer);
      var src = urlInput.value.trim();
      if (!src) { urlPreview.innerHTML = ''; setPending(null); return; }
      urlTimer = setTimeout(function () {
        var img = new Image();
        img.onload = function () {
          urlPreview.innerHTML = '<img src="' + src + '" alt="">';
          setPending({ type: 'image', src: src, alt: '' });
        };
        img.onerror = function () {
          urlPreview.innerHTML = '<p class="amm-preview-error">Could not load image from that URL.</p>';
          setPending(null);
        };
        img.src = src;
      }, 500);
    });

    // ── YouTube ──
    var ytInput   = modal.querySelector('#ammYtInput');
    var ytPreview = modal.querySelector('#ammYtPreview');

    ytInput.addEventListener('input', function () {
      var embedUrl = getYouTubeEmbedUrl(ytInput.value.trim());
      if (!embedUrl) {
        ytPreview.innerHTML = '';
        setPending(null);
        return;
      }
      ytPreview.innerHTML = '<iframe src="' + embedUrl + '" allowfullscreen title="YouTube preview"></iframe>';
      setPending({ type: 'youtube', src: embedUrl });
    });

    // ── Apply ──
    applyBtn.addEventListener('click', function () {
      if (!pendingMedia) return;

      // Render immediately
      renderMedia(phEl, pendingMedia);
      phEl._mediaRef = pendingMedia;

      // Store on card for collectAndSave
      if (!cardEl._adminMediaSlots) cardEl._adminMediaSlots = {};
      cardEl._adminMediaSlots[slotIndex] = pendingMedia;

      // Re-attach upload handler since the element's classes changed
      if (isAdminMode()) makeSlotEditable(cardEl, phEl, slotIndex);

      modal.remove();
    });

    // ── Close ──
    function closeModal() { modal.remove(); }
    modal.querySelector('.amm-close').addEventListener('click', closeModal);
    modal.querySelector('.amm-btn-cancel').addEventListener('click', closeModal);
    modal.querySelector('.amm-backdrop').addEventListener('click', closeModal);

    // Focus first input
    setTimeout(function () { modal.querySelector('.amm-input, #ammDropZone'); }, 50);
  }

  // ══════════════════════════════════════
  //  MAKE A SINGLE SLOT EDITABLE
  // ══════════════════════════════════════

  function makeSlotEditable(cardEl, slotEl, slotIndex) {
    slotEl.classList.add('admin-upload-zone');
    // Remove old listener by cloning
    var newSlot = slotEl.cloneNode(true);
    slotEl.parentNode.replaceChild(newSlot, slotEl);
    newSlot._mediaRef = slotEl._mediaRef;
    newSlot.addEventListener('click', function (e) {
      e.stopPropagation();
      openMediaModal(cardEl, newSlot, slotIndex);
    });
  }

  // ══════════════════════════════════════
  //  ADMIN MODE INIT
  // ══════════════════════════════════════

  function initAdminMode() {
    // ── Toolbar ──
    var toolbar = document.createElement('div');
    toolbar.id = 'admin-toolbar';
    toolbar.innerHTML = [
      '<div class="atb-inner">',
        '<span class="atb-badge">🔧 Admin Mode</span>',
        '<span class="atb-hint">Click any text to edit · Click photo/video zones to upload</span>',
        '<div class="atb-actions">',
          '<button id="atbSave">💾 Save</button>',
          '<button id="atbExport">📤 Export JSON</button>',
          '<button id="atbReset" class="atb-danger">↺ Reset</button>',
          '<button id="atbExit">✕ Exit</button>',
        '</div>',
      '</div>'
    ].join('');
    document.body.prepend(toolbar);
    document.body.style.paddingTop = '56px';

    document.getElementById('atbSave').addEventListener('click', collectAndSave);
    document.getElementById('atbExport').addEventListener('click', exportJSON);
    document.getElementById('atbReset').addEventListener('click', resetContent);
    document.getElementById('atbExit').addEventListener('click', function () {
      var url = new URL(window.location.href);
      url.searchParams.delete('admin');
      window.location.href = url.toString();
    });

    // ── Restore saved media references for already-rendered slots ──
    var raw = localStorage.getItem(STORAGE_KEY);
    var savedMedia = {};
    if (raw) {
      try { savedMedia = JSON.parse(raw).media || {}; } catch (e) {}
    }

    // ── Wire up each card ──
    document.querySelectorAll('.ftl-card[data-card]').forEach(function (cardEl) {
      var cardId = cardEl.dataset.card;

      // Make text fields editable
      ['.ftl-card-eyebrow', '.ftl-card-h', '.ftl-card-p'].forEach(function (sel) {
        var el = cardEl.querySelector(sel);
        if (!el) return;
        el.contentEditable = 'true';
        el.spellcheck = true;
        el.classList.add('admin-editable');
        // Prevent Enter from making new blocks
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); }
        });
      });

      // Wire up media slots — both placeholders and already-rendered
      var slots = cardEl.querySelectorAll('.ftl-media-ph, .ftl-media-rendered');
      slots.forEach(function (slotEl, idx) {
        // Restore media reference if previously saved
        var key = mediaKey(cardId, idx);
        if (savedMedia[key]) slotEl._mediaRef = savedMedia[key];

        makeSlotEditable(cardEl, slotEl, idx);
      });
    });
  }

  // ══════════════════════════════════════
  //  ADMIN LOGIN MODAL
  // ══════════════════════════════════════

  function showLoginModal() {
    var modal = document.createElement('div');
    modal.id = 'admin-login-modal';
    modal.innerHTML = [
      '<div class="alm-backdrop"></div>',
      '<div class="alm-box">',
        '<div class="alm-icon">🔒</div>',
        '<h2 class="alm-title">Admin Access</h2>',
        '<p class="alm-sub">Enter the admin password to edit site content</p>',
        '<input type="password" class="alm-input" id="almPassInput" placeholder="Password" autocomplete="current-password">',
        '<p class="alm-error" id="almError">Incorrect password. Try again.</p>',
        '<button class="alm-btn" id="almSubmit">Enter Admin Mode</button>',
        '<button class="alm-cancel" id="almCancel">Cancel</button>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    var input   = modal.querySelector('#almPassInput');
    var errMsg  = modal.querySelector('#almError');
    var submitBtn = modal.querySelector('#almSubmit');

    input.focus();

    function tryLogin() {
      if (input.value.trim() === ADMIN_PASS) {
        var url = new URL(window.location.href);
        url.searchParams.set('admin', '1');
        window.location.href = url.toString();
      } else {
        errMsg.classList.add('visible');
        input.value = '';
        input.focus();
        setTimeout(function () { errMsg.classList.remove('visible'); }, 3000);
      }
    }

    submitBtn.addEventListener('click', tryLogin);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryLogin(); });
    modal.querySelector('#almCancel').addEventListener('click', function () { modal.remove(); });
    modal.querySelector('.alm-backdrop').addEventListener('click', function () { modal.remove(); });
  }

  // ══════════════════════════════════════
  //  SECRET FOOTER CLICK TRIGGER
  // ══════════════════════════════════════

  var secretClicks = 0;
  var secretTimer  = null;

  document.addEventListener('click', function (e) {
    if (!e.target.closest('footer')) return;
    secretClicks++;
    clearTimeout(secretTimer);
    secretTimer = setTimeout(function () { secretClicks = 0; }, 3000);
    if (secretClicks >= 5) {
      secretClicks = 0;
      if (!isAdminMode()) showLoginModal();
    }
  });

  // ══════════════════════════════════════
  //  BOOTSTRAP
  // ══════════════════════════════════════

  // Always load saved content on every page visit
  loadSavedContent();

  // If URL has ?admin=1, activate admin mode
  if (isAdminMode()) initAdminMode();

})();
