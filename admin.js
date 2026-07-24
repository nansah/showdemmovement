/**
 * Showdem Movement — Content Loader
 * Fetches saved content from the server API and applies it to the page.
 * The admin panel lives at /admin — this file only handles display.
 */
(function () {
  'use strict';

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
    if (inner) el.appendChild(inner);
  }

  function applyContent(data) {
    var text  = data.text  || {};
    var media = data.media || {};

    Object.keys(text).forEach(function (id) {
      var card = document.querySelector('.ftl-card[data-card="' + id + '"]');
      if (!card) return;
      var t  = text[id];
      var ew = card.querySelector('.ftl-card-eyebrow');
      var h  = card.querySelector('.ftl-card-h');
      var p  = card.querySelector('.ftl-card-p');
      if (ew && t.eyebrow) ew.textContent = t.eyebrow;
      if (h  && t.title)   h.textContent  = t.title;
      if (p  && t.body)    p.textContent  = t.body;
    });

    Object.keys(media).forEach(function (key) {
      // key: "card-{id}-{slot}"
      var parts   = key.split('-');
      var cardId  = parts[1];
      var slotIdx = parseInt(parts[2]);
      var card    = document.querySelector('.ftl-card[data-card="' + cardId + '"]');
      if (!card) return;
      var slots = card.querySelectorAll('.ftl-media-ph');
      if (slots[slotIdx]) renderMedia(slots[slotIdx], media[key]);
    });

    // Hide empty placeholders for cards where admin turned them off.
    // Runs after media render so slots that received media are already
    // converted to .ftl-media-rendered and won't be affected.
    var placeholderMap = data.placeholder || {};
    Object.keys(placeholderMap).forEach(function (id) {
      if (placeholderMap[id] === false) {
        var card = document.querySelector('.ftl-card[data-card="' + id + '"]');
        if (!card) return;
        card.querySelectorAll('.ftl-media-ph').forEach(function (el) {
          el.style.display = 'none';
        });
      }
    });
  }

  fetch('/api/content')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) { if (data) applyContent(data); })
    .catch(function () {});

})();
