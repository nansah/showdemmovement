/**
 * Showdem Movement Foundation — Admin Content Manager
 *
 * Activation : click the site footer 5× within 3 seconds
 * Password   : showdem2025
 *
 * Saves content.json and media/ files directly to the GitHub repo
 * so every visitor sees updated content without localStorage.
 *
 * Required: a GitHub Personal Access Token with Contents write
 * permission on nansah/showdemmovement. The token is stored in
 * sessionStorage (cleared when the tab closes — never in the repo).
 */
(function () {
  'use strict';

  /* ── Repo config ─────────────────────────────── */
  var GH = {
    owner  : 'nansah',
    repo   : 'showdemmovement',
    branch : 'main',
    content: 'content.json',
    media  : 'media'
  };

  var ADMIN_PASS   = 'showdem2025';
  var TOKEN_KEY    = 'showdem_gh_token';   // sessionStorage key

  /* ══════════════════════════════════════════════
     UTILITIES
  ══════════════════════════════════════════════ */

  function ghUrl(path) {
    return 'https://api.github.com/repos/' + GH.owner + '/' + GH.repo + '/contents/' + path;
  }

  function rawUrl(path) {
    return 'https://raw.githubusercontent.com/' + GH.owner + '/' + GH.repo + '/' + GH.branch + '/' + path;
  }

  function b64Encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  }

  function ghHeaders(token) {
    return {
      'Authorization' : 'Bearer ' + (token || getToken()),
      'Accept'        : 'application/vnd.github+json',
      'Content-Type'  : 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  function isAdminMode() {
    return new URLSearchParams(window.location.search).get('admin') === '1';
  }

  function getYouTubeEmbedUrl(url) {
    var m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? 'https://www.youtube.com/embed/' + m[1] + '?rel=0' : null;
  }

  function mediaKey(cardId, idx) { return 'card-' + cardId + '-' + idx; }

  function showToast(msg, type) {
    var t = document.getElementById('admin-toast');
    if (!t) { t = document.createElement('div'); t.id = 'admin-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.className = type === 'error' ? 'is-error' : 'is-success';
    t.classList.add('visible');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove('visible'); }, 4000);
  }

  /* ══════════════════════════════════════════════
     MEDIA RENDERING  (shared: load + admin upload)
  ══════════════════════════════════════════════ */

  function renderMedia(el, media) {
    if (!media || !media.src) return;
    el.innerHTML = '';
    el.className = 'ftl-media-rendered';
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
      inner.title = 'Video';
    }
    if (inner) { inner._mediaRef = media; el.appendChild(inner); }
    el._mediaRef = media;
  }

  /* ══════════════════════════════════════════════
     LOAD CONTENT FROM content.json  (every visit)
  ══════════════════════════════════════════════ */

  function loadContent() {
    fetch(rawUrl(GH.content) + '?t=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { if (data) applyContent(data); })
      .catch(function () {
        // Fallback: try relative path (works when served from GitHub Pages)
        fetch('content.json?t=' + Date.now())
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) { if (data) applyContent(data); })
          .catch(function () {});
      });
  }

  function applyContent(data) {
    var text  = data.text  || {};
    var media = data.media || {};

    Object.keys(text).forEach(function (id) {
      var card = document.querySelector('.ftl-card[data-card="' + id + '"]');
      if (!card) return;
      var t = text[id];
      var ew = card.querySelector('.ftl-card-eyebrow');
      var h  = card.querySelector('.ftl-card-h');
      var p  = card.querySelector('.ftl-card-p');
      if (ew && t.eyebrow) ew.textContent = t.eyebrow;
      if (h  && t.title)   h.textContent  = t.title;
      if (p  && t.body)    p.textContent  = t.body;
    });

    Object.keys(media).forEach(function (key) {
      var parts  = key.split('-');   // "card-{id}-{slot}"
      var cardId = parts[1];
      var slotIdx = parseInt(parts[2]);
      var card = document.querySelector('.ftl-card[data-card="' + cardId + '"]');
      if (!card) return;
      var slots = card.querySelectorAll('.ftl-media-ph');
      if (slots[slotIdx]) renderMedia(slots[slotIdx], media[key]);
    });
  }

  /* ══════════════════════════════════════════════
     GITHUB API  —  read / write content.json
  ══════════════════════════════════════════════ */

  function ghGetFileSha(path, token) {
    return fetch(ghUrl(path), { headers: ghHeaders(token) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (info) { return info ? info.sha : undefined; });
  }

  function ghPutFile(path, base64Content, commitMsg, sha, token) {
    var body = { message: commitMsg, content: base64Content, branch: GH.branch };
    if (sha) body.sha = sha;
    return fetch(ghUrl(path), {
      method : 'PUT',
      headers: ghHeaders(token),
      body   : JSON.stringify(body)
    });
  }

  /* ── Upload a media file to /media/ in the repo ── */
  function uploadMediaFile(filename, base64Data, token) {
    var filePath = GH.media + '/' + filename;
    return ghGetFileSha(filePath, token).then(function (sha) {
      return ghPutFile(filePath, base64Data, 'Upload media: ' + filename, sha, token);
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw new Error(e.message); });
      return rawUrl(filePath) + '?t=' + Date.now();
    });
  }

  /* ── Collect current card content into a data object ── */
  function collectContent() {
    var text  = {};
    var media = {};

    document.querySelectorAll('.ftl-card[data-card]').forEach(function (card) {
      var id = card.dataset.card;
      var ew = card.querySelector('.ftl-card-eyebrow');
      var h  = card.querySelector('.ftl-card-h');
      var p  = card.querySelector('.ftl-card-p');
      text[id] = {
        eyebrow: ew ? ew.textContent.trim() : '',
        title:   h  ? h.textContent.trim()  : '',
        body:    p  ? p.textContent.trim()  : ''
      };

      // Collect from admin upload slots
      var slots = card._adminMediaSlots || {};
      Object.keys(slots).forEach(function (idx) {
        media[mediaKey(id, idx)] = slots[idx];
      });

      // Also carry forward already-rendered media
      card.querySelectorAll('.ftl-media-rendered').forEach(function (el, idx) {
        var k = mediaKey(id, idx);
        if (!media[k] && el._mediaRef) media[k] = el._mediaRef;
      });
    });

    return { text: text, media: media, updatedAt: new Date().toISOString() };
  }

  /* ── Main save function ── */
  function saveContent() {
    var token = getToken();
    if (!token) { showTokenModal(saveContent); return; }

    var btn = document.getElementById('atbSave');
    if (btn) { btn.textContent = '⏳ Saving…'; btn.disabled = true; }

    var data    = collectContent();
    var encoded = b64Encode(JSON.stringify(data, null, 2));

    ghGetFileSha(GH.content, token)
      .then(function (sha) {
        return ghPutFile(GH.content, encoded, 'Update site content via admin panel', sha, token);
      })
      .then(function (r) {
        if (btn) { btn.textContent = '💾 Save'; btn.disabled = false; }
        if (r.ok) {
          showToast('Saved! Live site updates in ~1 minute.', 'success');
        } else {
          return r.json().then(function (e) {
            if (r.status === 401 || r.status === 403) {
              sessionStorage.removeItem(TOKEN_KEY);
              showToast('Token invalid or expired — re-enter it.', 'error');
              setTimeout(function () { showTokenModal(saveContent); }, 1500);
            } else {
              showToast('Save failed: ' + (e.message || r.status), 'error');
            }
          });
        }
      })
      .catch(function (e) {
        if (btn) { btn.textContent = '💾 Save'; btn.disabled = false; }
        showToast('Network error: ' + e.message, 'error');
      });
  }

  /* ── Export JSON ── */
  function exportJSON() {
    var data = collectContent();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'showdem-content-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
  }

  /* ── Reset (re-save empty content.json) ── */
  function resetContent() {
    if (!confirm('Reset all content to original HTML? This will clear all edits and media.')) return;
    var token = getToken();
    if (!token) { showTokenModal(resetContent); return; }
    var encoded = b64Encode(JSON.stringify({ text: {}, media: {}, updatedAt: null }, null, 2));
    ghGetFileSha(GH.content, token)
      .then(function (sha) { return ghPutFile(GH.content, encoded, 'Reset site content', sha, token); })
      .then(function (r) {
        if (r.ok) { showToast('Reset! Reloading…', 'success'); setTimeout(function () { window.location.reload(); }, 1200); }
        else showToast('Reset failed', 'error');
      })
      .catch(function (e) { showToast('Network error: ' + e.message, 'error'); });
  }

  /* ══════════════════════════════════════════════
     GITHUB TOKEN MODAL
  ══════════════════════════════════════════════ */

  function showTokenModal(callback) {
    var existing = document.getElementById('admin-token-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'admin-token-modal';
    modal.innerHTML = [
      '<div class="alm-backdrop"></div>',
      '<div class="alm-box">',
        '<div class="alm-icon">🔑</div>',
        '<h2 class="alm-title">GitHub Token</h2>',
        '<p class="alm-sub">Enter a Personal Access Token with <strong>Contents: Write</strong> permission on the <em>nansah/showdemmovement</em> repo. It will be remembered for this browser session only.</p>',
        '<input type="password" class="alm-input" id="tokenInput" placeholder="github_pat_…" autocomplete="off">',
        '<p class="alm-error" id="tokenError">Could not verify token — check it and try again.</p>',
        '<button class="alm-btn" id="tokenSubmit">Connect &amp; Continue</button>',
        '<button class="alm-cancel" id="tokenCancel">Cancel</button>',
        '<p class="alm-hint-link">',
          '<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">',
            'Create a token on GitHub &rarr;</a><br>',
          '<small>Scopes needed: Repository → Contents → Read &amp; Write</small>',
        '</p>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    var input    = modal.querySelector('#tokenInput');
    var errorEl  = modal.querySelector('#tokenError');
    var submitBtn = modal.querySelector('#tokenSubmit');

    input.focus();

    function tryToken() {
      var tok = input.value.trim();
      if (!tok) return;
      submitBtn.textContent = 'Verifying…';
      submitBtn.disabled = true;

      // Verify by reading the repo
      fetch('https://api.github.com/repos/' + GH.owner + '/' + GH.repo, { headers: ghHeaders(tok) })
        .then(function (r) {
          if (r.ok) {
            sessionStorage.setItem(TOKEN_KEY, tok);
            modal.remove();
            if (callback) callback();
          } else {
            errorEl.classList.add('visible');
            submitBtn.textContent = 'Connect & Continue';
            submitBtn.disabled = false;
          }
        })
        .catch(function () {
          errorEl.textContent = 'Network error — check your connection.';
          errorEl.classList.add('visible');
          submitBtn.textContent = 'Connect & Continue';
          submitBtn.disabled = false;
        });
    }

    submitBtn.addEventListener('click', tryToken);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryToken(); });
    modal.querySelector('#tokenCancel').addEventListener('click', function () { modal.remove(); });
    modal.querySelector('.alm-backdrop').addEventListener('click', function () { modal.remove(); });
  }

  /* ══════════════════════════════════════════════
     MEDIA MODAL  (per card slot)
  ══════════════════════════════════════════════ */

  function openMediaModal(cardEl, phEl, slotIndex) {
    var existing = document.getElementById('admin-media-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'admin-media-modal';
    modal.innerHTML = [
      '<div class="amm-backdrop"></div>',
      '<div class="amm-box">',
        '<button class="amm-close">&times;</button>',
        '<h3 class="amm-title">Add Media</h3>',
        '<div class="amm-tabs">',
          '<button class="amm-tab active" data-tab="upload">Upload Photo / Video</button>',
          '<button class="amm-tab" data-tab="url">Image URL</button>',
          '<button class="amm-tab" data-tab="youtube">YouTube Video</button>',
        '</div>',

        '<div class="amm-panel" data-panel="upload">',
          '<label class="amm-drop-zone" id="ammDropZone">',
            '<input type="file" id="ammFileInput" accept="image/*,video/mp4,video/webm" style="display:none">',
            '<div class="amm-drop-icon">📁</div>',
            '<p class="amm-drop-text">Click to choose a photo or video<span>Uploads directly to your GitHub repo</span></p>',
          '</label>',
          '<div id="ammUploadPreview" class="amm-preview"></div>',
          '<p id="ammUploadStatus" class="amm-hint" style="display:none"></p>',
        '</div>',

        '<div class="amm-panel hidden" data-panel="url">',
          '<label class="amm-label">Image URL</label>',
          '<input type="url" id="ammUrlInput" class="amm-input" placeholder="https://example.com/photo.jpg">',
          '<div id="ammUrlPreview" class="amm-preview"></div>',
        '</div>',

        '<div class="amm-panel hidden" data-panel="youtube">',
          '<label class="amm-label">YouTube URL</label>',
          '<input type="url" id="ammYtInput" class="amm-input" placeholder="https://www.youtube.com/watch?v=…">',
          '<p class="amm-hint">Paste any YouTube watch or youtu.be link.</p>',
          '<div id="ammYtPreview" class="amm-preview"></div>',
        '</div>',

        '<div class="amm-actions">',
          '<button class="amm-btn-cancel">Cancel</button>',
          '<button class="amm-btn-apply" id="ammApply" disabled>Apply</button>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    var applyBtn    = modal.querySelector('#ammApply');
    var pendingMedia = null;

    function setPending(m) { pendingMedia = m; applyBtn.disabled = !m; }

    /* Tabs */
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

    /* ── Upload tab ── */
    var fileInput = modal.querySelector('#ammFileInput');
    var dropZone  = modal.querySelector('#ammDropZone');
    var uploadPrev = modal.querySelector('#ammUploadPreview');
    var uploadStatus = modal.querySelector('#ammUploadStatus');

    dropZone.addEventListener('click', function () { fileInput.click(); });

    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      if (!file) return;

      if (file.size > 50 * 1024 * 1024) {
        uploadStatus.textContent = 'File too large (max 50 MB). Use YouTube for videos.';
        uploadStatus.style.display = 'block';
        uploadStatus.style.color = '#b91c1c';
        return;
      }

      var isImage = file.type.startsWith('image/');
      var isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) return;

      uploadStatus.textContent = '⏳ Uploading to GitHub…';
      uploadStatus.style.color = '#888';
      uploadStatus.style.display = 'block';
      applyBtn.disabled = true;

      var reader = new FileReader();
      reader.onload = function (e) {
        var dataUrl   = e.target.result;
        var base64    = dataUrl.split(',')[1];
        var ext       = file.name.split('.').pop();
        var timestamp = Date.now();
        var filename  = 'img-' + timestamp + '.' + ext;
        if (isVideo) filename = 'vid-' + timestamp + '.' + ext;

        var token = getToken();

        function doUpload(tok) {
          uploadMediaFile(filename, base64, tok)
            .then(function (liveUrl) {
              if (isImage) {
                uploadPrev.innerHTML = '<img src="' + liveUrl + '" alt="">';
                setPending({ type: 'image', src: liveUrl, alt: file.name });
              } else {
                uploadPrev.innerHTML = '<video src="' + liveUrl + '" controls></video>';
                setPending({ type: 'video-file', src: liveUrl });
              }
              uploadStatus.textContent = '✅ Uploaded to GitHub!';
              uploadStatus.style.color = '#16a34a';
            })
            .catch(function (err) {
              uploadStatus.textContent = '❌ Upload failed: ' + err.message;
              uploadStatus.style.color = '#b91c1c';
            });
        }

        if (!token) {
          showTokenModal(function () { doUpload(getToken()); });
        } else {
          doUpload(token);
        }
      };
      reader.readAsDataURL(file);
    });

    /* ── Image URL tab ── */
    var urlInput  = modal.querySelector('#ammUrlInput');
    var urlPrev   = modal.querySelector('#ammUrlPreview');
    var urlTimer;
    urlInput.addEventListener('input', function () {
      clearTimeout(urlTimer);
      var src = urlInput.value.trim();
      if (!src) { urlPrev.innerHTML = ''; setPending(null); return; }
      urlTimer = setTimeout(function () {
        var img = new Image();
        img.onload  = function () { urlPrev.innerHTML = '<img src="' + src + '" alt="">'; setPending({ type: 'image', src: src, alt: '' }); };
        img.onerror = function () { urlPrev.innerHTML = '<p class="amm-preview-error">Could not load that URL.</p>'; setPending(null); };
        img.src = src;
      }, 500);
    });

    /* ── YouTube tab ── */
    var ytInput = modal.querySelector('#ammYtInput');
    var ytPrev  = modal.querySelector('#ammYtPreview');
    ytInput.addEventListener('input', function () {
      var embed = getYouTubeEmbedUrl(ytInput.value.trim());
      if (!embed) { ytPrev.innerHTML = ''; setPending(null); return; }
      ytPrev.innerHTML = '<iframe src="' + embed + '" allowfullscreen title="Preview"></iframe>';
      setPending({ type: 'youtube', src: embed });
    });

    /* ── Apply ── */
    applyBtn.addEventListener('click', function () {
      if (!pendingMedia) return;
      renderMedia(phEl, pendingMedia);
      if (!cardEl._adminMediaSlots) cardEl._adminMediaSlots = {};
      cardEl._adminMediaSlots[slotIndex] = pendingMedia;
      if (isAdminMode()) makeSlotEditable(cardEl, phEl, slotIndex);
      modal.remove();
    });

    function closeModal() { modal.remove(); }
    modal.querySelector('.amm-close').addEventListener('click', closeModal);
    modal.querySelector('.amm-btn-cancel').addEventListener('click', closeModal);
    modal.querySelector('.amm-backdrop').addEventListener('click', closeModal);
  }

  /* ══════════════════════════════════════════════
     ADMIN  —  wire editable slot
  ══════════════════════════════════════════════ */

  function makeSlotEditable(cardEl, slotEl, slotIndex) {
    slotEl.classList.add('admin-upload-zone');
    var fresh = slotEl.cloneNode(true);
    fresh._mediaRef = slotEl._mediaRef;
    slotEl.parentNode.replaceChild(fresh, slotEl);
    fresh.addEventListener('click', function (e) {
      e.stopPropagation();
      openMediaModal(cardEl, fresh, slotIndex);
    });
  }

  /* ══════════════════════════════════════════════
     ADMIN MODE  —  toolbar + editable cards
  ══════════════════════════════════════════════ */

  function initAdminMode() {
    /* Toolbar */
    var toolbar = document.createElement('div');
    toolbar.id = 'admin-toolbar';
    toolbar.innerHTML = [
      '<div class="atb-inner">',
        '<span class="atb-badge">🔧 Admin Mode</span>',
        '<span class="atb-hint">Click text to edit · Click photo/video zones to upload</span>',
        '<div class="atb-actions">',
          '<button id="atbSave">💾 Save to Live Site</button>',
          '<button id="atbExport">📤 Export JSON</button>',
          '<button id="atbToken">🔑 Token</button>',
          '<button id="atbReset" class="atb-danger">↺ Reset</button>',
          '<button id="atbExit">✕ Exit</button>',
        '</div>',
      '</div>'
    ].join('');
    document.body.prepend(toolbar);
    document.body.style.paddingTop = '56px';

    document.getElementById('atbSave').addEventListener('click', saveContent);
    document.getElementById('atbExport').addEventListener('click', exportJSON);
    document.getElementById('atbReset').addEventListener('click', resetContent);
    document.getElementById('atbToken').addEventListener('click', function () { showTokenModal(null); });
    document.getElementById('atbExit').addEventListener('click', function () {
      var url = new URL(window.location.href);
      url.searchParams.delete('admin');
      window.location.href = url.toString();
    });

    /* Wire each card */
    document.querySelectorAll('.ftl-card[data-card]').forEach(function (card) {
      /* Editable text */
      ['.ftl-card-eyebrow', '.ftl-card-h', '.ftl-card-p'].forEach(function (sel) {
        var el = card.querySelector(sel);
        if (!el) return;
        el.contentEditable = 'true';
        el.spellcheck = true;
        el.classList.add('admin-editable');
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });
      });

      /* Media slots */
      card.querySelectorAll('.ftl-media-ph, .ftl-media-rendered').forEach(function (slot, idx) {
        makeSlotEditable(card, slot, idx);
      });
    });

    /* Prompt for token if not already stored */
    if (!getToken()) showTokenModal(null);
  }

  /* ══════════════════════════════════════════════
     ADMIN LOGIN  (password modal)
  ══════════════════════════════════════════════ */

  function showLoginModal() {
    var modal = document.createElement('div');
    modal.id = 'admin-login-modal';
    modal.innerHTML = [
      '<div class="alm-backdrop"></div>',
      '<div class="alm-box">',
        '<div class="alm-icon">🔒</div>',
        '<h2 class="alm-title">Admin Access</h2>',
        '<p class="alm-sub">Enter the admin password to edit content on the live site</p>',
        '<input type="password" class="alm-input" id="almPassInput" placeholder="Password" autocomplete="current-password">',
        '<p class="alm-error" id="almError">Incorrect password. Try again.</p>',
        '<button class="alm-btn" id="almSubmit">Enter Admin Mode</button>',
        '<button class="alm-cancel" id="almCancel">Cancel</button>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    var input = modal.querySelector('#almPassInput');
    var errEl = modal.querySelector('#almError');
    input.focus();

    function tryLogin() {
      if (input.value.trim() === ADMIN_PASS) {
        var url = new URL(window.location.href);
        url.searchParams.set('admin', '1');
        window.location.href = url.toString();
      } else {
        errEl.classList.add('visible');
        input.value = '';
        input.focus();
        setTimeout(function () { errEl.classList.remove('visible'); }, 2500);
      }
    }

    modal.querySelector('#almSubmit').addEventListener('click', tryLogin);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryLogin(); });
    modal.querySelector('#almCancel').addEventListener('click', function () { modal.remove(); });
    modal.querySelector('.alm-backdrop').addEventListener('click', function () { modal.remove(); });
  }

  /* ══════════════════════════════════════════════
     SECRET FOOTER CLICK TRIGGER
  ══════════════════════════════════════════════ */

  var clicks = 0, clickTimer = null;
  document.addEventListener('click', function (e) {
    if (!e.target.closest('footer')) return;
    clicks++;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(function () { clicks = 0; }, 3000);
    if (clicks >= 5) { clicks = 0; if (!isAdminMode()) showLoginModal(); }
  });

  /* ══════════════════════════════════════════════
     BOOTSTRAP
  ══════════════════════════════════════════════ */

  loadContent();
  if (isAdminMode()) initAdminMode();

})();
