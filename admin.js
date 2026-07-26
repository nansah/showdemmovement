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
    } else if (media.type === 'tiktok') {
      inner = document.createElement('iframe');
      inner.src = media.src;
      inner.className = 'tt-embed';
      inner.setAttribute('allow', 'encrypted-media;picture-in-picture');
      inner.setAttribute('allowfullscreen', '');
      inner.title = 'TikTok video';
    }
    if (inner) el.appendChild(inner);
  }

  // Cards created in the admin panel (ids beyond the 7 built-in milestones)
  // have no matching .ftl-card/.ftl-dot in the static markup — build them
  // here so admin-added cards actually render on the timeline.
  function buildPlaceholder() {
    var ph = document.createElement('div');
    ph.className = 'ftl-media-ph';
    ph.innerHTML = '<span class="ftl-ph-icon">📸</span>' +
                    '<span class="ftl-ph-text">Add a photo or video</span>' +
                    '<span class="ftl-ph-tag">Add Media</span>';
    return ph;
  }

  function buildCard(cardDef, textMap) {
    var t       = textMap[cardDef.id] || {};
    var eyebrow = t.eyebrow || cardDef.defaultEyebrow || cardDef.label || '';
    var title   = t.title   || cardDef.defaultTitle   || '';
    var body    = t.body    || cardDef.defaultBody    || '';

    var card = document.createElement('div');
    card.className = 'ftl-card';
    card.setAttribute('data-card', cardDef.id);
    card.setAttribute('data-year', cardDef.year || '');

    var ew = document.createElement('span'); ew.className = 'ftl-card-eyebrow'; ew.textContent = eyebrow;
    var h  = document.createElement('h3');   h.className  = 'ftl-card-h';       h.textContent  = title;
    var p  = document.createElement('p');    p.className  = 'ftl-card-p';       p.textContent  = body;
    card.appendChild(ew);
    card.appendChild(h);
    card.appendChild(p);
    card.appendChild(buildPlaceholder());
    return card;
  }

  function buildMissingCards(data) {
    var cardsList = data.cards;
    if (!Array.isArray(cardsList) || !cardsList.length) return false;

    var cardsContainer = document.getElementById('ftlCards');
    var dotNav          = document.getElementById('ftlDotNav');
    if (!cardsContainer || !dotNav) return false;

    // The static markup has one extra decorative "Today" dot after the real
    // milestone dots — new dots must be inserted before it, not after, or
    // every card/dot index past this point would be off by one.
    var todayDot = dotNav.querySelector('.ftl-dot-today');
    var textMap  = data.text || {};
    var added    = false;

    cardsList.forEach(function (cardDef) {
      var existing = document.querySelector('.ftl-card[data-card="' + cardDef.id + '"]');
      if (existing) {
        if (cardDef.year) existing.setAttribute('data-year', cardDef.year);
        return;
      }
      cardsContainer.appendChild(buildCard(cardDef, textMap));
      var dot = document.createElement('button');
      dot.className = 'ftl-dot';
      dotNav.insertBefore(dot, todayDot || null);
      added = true;
    });

    return added;
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
    .then(function (data) {
      if (!data) return;
      var added = buildMissingCards(data);
      applyContent(data);
      // Rebuild the scroll-jacking state so newly-appended cards/dots are
      // included — the timeline script's querySelectorAll snapshots were
      // taken before these nodes existed.
      if (added && window.ftlSetupTimeline) window.ftlSetupTimeline();
    })
    .catch(function () {});

})();
