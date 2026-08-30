(function () {
  "use strict";

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statHtml(raw) {
    var parts = raw.split("|");
    return '<div class="stat ' + esc(parts[2] || "") + '"><label>' + esc(parts[0]) + '</label><b>' + esc(parts[1]) + "</b></div>";
  }

  function screenHtml(feature, deck) {
    var screen = feature.screen || ["Qubere", deck.promise, [], ["Object", "Status", "Action"], []];
    if (feature.screenshot) {
      return '<div class="browser-frame"><div class="browser-bar"><i class="browser-dot"></i><i class="browser-dot"></i><i class="browser-dot"></i><div class="browser-url">demo-app.qubere.ai</div></div><div class="app-bar"><div class="app-logo-mini"><i>Q</i> Qubere</div><div class="app-user">ABC Customs Brokers · Demo user</div></div><img class="product-image" src="' + esc(feature.screenshot) + '" alt="' + esc(screen[0]) + ' product screenshot"></div>';
    }

    var stats = (screen[2] || []).map(statHtml).join("");
    var headings = (screen[3] || []).map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("");
    var rows = (screen[4] || []).map(function (row) {
      return "<tr>" + row.map(function (cell, index) {
        return "<td>" + (index === row.length - 1 ? '<span class="pill">' + esc(cell) + "</span>" : esc(cell)) + "</td>";
      }).join("") + "</tr>";
    }).join("");

    return '<div class="browser-frame">' +
      '<div class="browser-bar"><i class="browser-dot"></i><i class="browser-dot"></i><i class="browser-dot"></i><div class="browser-url">demo-app.qubere.ai</div></div>' +
      '<div class="app-bar"><div class="app-logo-mini"><i>Q</i> Qubere</div><div class="app-user">ABC Customs Brokers · Demo user</div></div>' +
      '<div class="product-body">' +
        '<aside class="mock-sidebar"><div class="ask">✦ Ask Qubere</div><div class="mock-nav-label">Operations</div><div class="mock-nav">Actions</div><div class="mock-nav">Command Center</div><div class="mock-nav active">' + esc(deck.name) + '</div><div class="mock-nav-label">Data & Tooling</div><div class="mock-nav">Trade Docs</div><div class="mock-nav">Trade Data</div><div class="mock-nav-label">Management</div><div class="mock-nav">Settings & Audit</div></aside>' +
        '<main class="mock-main"><div class="screen-head"><div><div class="screen-title">' + esc(screen[0]) + '</div><div class="screen-subtitle">' + esc(screen[1]) + '</div></div><div class="primary-button">Open action</div></div><div class="stats">' + stats + '</div><table class="product-table"><thead><tr>' + headings + '</tr></thead><tbody>' + rows + "</tbody></table></main>" +
      "</div></div>";
  }

  function renderCover(deck) {
    return '<section class="sales-slide dark cover">' +
      '<div><div class="brand-lockup"><span class="brand-mark">Q</span><span>Qubere</span></div><div class="cover-kicker">Sales Product Deck · ' + esc(deck.name) + '</div><h1>' + esc(deck.name) + '</h1><div class="cover-copy">' + esc(deck.promise) + '</div><div class="cover-meta"><span>' + esc(deck.audience) + '</span><span>' + deck.features.length + ' major capabilities</span></div></div>' +
      '<div class="cover-visual"><div class="cover-orbit"></div><div class="cover-orbit"></div><div class="cover-orbit"></div><div class="cover-icon">' + esc(deck.icon) + "</div></div></section>";
  }

  function renderFeature(feature, deck, index) {
    var availability = feature.availability || "Available now";
    var availabilityClass = /^roadmap/i.test(availability) ? " roadmap" : (/^(partial|architecture)/i.test(availability) ? " partial" : "");
    return '<section class="sales-slide light feature">' +
      '<div class="feature-copy"><div class="eyebrow">' + esc(deck.name) + " · Feature " + (index + 1) + '</div><h2>' + esc(feature.title) + '</h2><div class="pain-label">Customer pain</div><p>' + esc(feature.pain) + '</p><div class="benefit-label">How Qubere helps</div><p>' + esc(feature.benefit) + '</p><div class="demo-path"><strong>How to demo</strong><span>' + esc(feature.demo) + "</span></div></div>" +
      '<div class="feature-product"><div class="product-caption"><h3>Product view</h3><span class="status' + availabilityClass + '">' + esc(availability) + '</span></div>' + screenHtml(feature, deck) + "</div></section>";
  }

  function renderClose(deck) {
    return '<section class="sales-slide dark close"><div class="close-inner"><div class="eyebrow">Demo outcome</div><h2>Make the pain visible. Then resolve it live.</h2><p>' + esc(deck.promise) + '</p><div class="close-actions"><a class="primary" href="/deck/index.html">Choose another deck</a><a href="/app">Return to Qubere</a></div></div></section>';
  }

  function init() {
    var key = document.body.getAttribute("data-deck");
    var deck = window.QUBERE_SALES_DECKS && window.QUBERE_SALES_DECKS[key];
    if (!deck) {
      document.body.innerHTML = '<main style="padding:48px;color:white;font-family:Inter,sans-serif"><h1>Deck not found</h1><a style="color:#47a3ff" href="/deck/index.html">Return to deck library</a></main>';
      return;
    }

    document.title = "Qubere — " + deck.name + " Sales Deck";
    var root = document.getElementById("sales-deck");
    var slideHtml = renderCover(deck) + deck.features.map(function (f, i) { return renderFeature(f, deck, i); }).join("") + renderClose(deck);
    var total = deck.features.length + 2;
    root.innerHTML = '<div class="sales-slides" id="sales-slides">' + slideHtml + '</div><a class="deck-home" href="/deck/index.html">All decks</a><nav class="sales-nav" aria-label="Slide navigation"><span id="sales-dots"></span><span class="sales-counter" id="sales-counter">1 / ' + total + "</span></nav>";

    var slides = document.getElementById("sales-slides");
    var dotsRoot = document.getElementById("sales-dots");
    var counter = document.getElementById("sales-counter");
    var current = 0;
    var dots = [];

    function go(next) {
      current = Math.max(0, Math.min(total - 1, next));
      slides.style.transform = "translateY(-" + (current * 100) + "vh)";
      dots.forEach(function (dot, i) { dot.classList.toggle("active", i === current); });
      counter.textContent = (current + 1) + " / " + total;
    }

    for (var i = 0; i < total; i += 1) {
      var dot = document.createElement("button");
      dot.setAttribute("aria-label", "Slide " + (i + 1));
      (function (target) { dot.addEventListener("click", function (event) { event.stopPropagation(); go(target); }); })(i);
      dotsRoot.appendChild(dot);
      dots.push(dot);
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === " " || event.key === "PageDown") go(current + 1);
      if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") go(current - 1);
      if (event.key === "Home") go(0);
      if (event.key === "End") go(total - 1);
    });

    document.addEventListener("click", function (event) {
      if (event.target.closest("a, button")) return;
      go(current + 1);
    });

    var touchStart = null;
    document.addEventListener("touchstart", function (event) { touchStart = event.touches[0].clientY; }, { passive: true });
    document.addEventListener("touchend", function (event) {
      if (touchStart == null) return;
      var delta = touchStart - event.changedTouches[0].clientY;
      if (Math.abs(delta) > 45) go(current + (delta > 0 ? 1 : -1));
      touchStart = null;
    }, { passive: true });

    go(0);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
