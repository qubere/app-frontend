/* ============================================================
   Qubere deck system — shared navigation
   Auto-builds the dot nav + counter from the number of .slide
   sections, so each category deck only authors slides.
   Markup expected:
     <div class="deck" id="deck">
       <div class="slides-wrapper" id="sw"> …sections.slide… </div>
     </div>
   ============================================================ */
(function () {
  var sw = document.getElementById('sw');
  if (!sw) return;
  var slides = sw.querySelectorAll('.slide');
  var N = slides.length;
  if (!N) return;

  // Build dot nav
  var nav = document.createElement('nav');
  nav.className = 'dots-nav';
  nav.id = 'dots';
  for (var i = 0; i < N; i++) {
    var b = document.createElement('button');
    b.className = 'dot';
    b.setAttribute('data-target', i + 1);
    b.setAttribute('aria-label', 'Slide ' + (i + 1));
    nav.appendChild(b);
  }
  var counter = document.createElement('div');
  counter.className = 'slide-counter';
  counter.id = 'counter';

  var home = document.createElement('a');
  home.className = 'deck-home';
  home.href = 'index.html';
  home.textContent = '← All decks';

  var deck = document.getElementById('deck') || document.body;
  deck.appendChild(nav);
  deck.appendChild(counter);
  deck.appendChild(home);

  var dots = nav.querySelectorAll('.dot');
  var cur = 1;

  function syncHomeColor() {
    // deck-home contrast handled in CSS via slide class; nothing needed here
  }

  function go(n) {
    cur = Math.max(1, Math.min(N, n));
    sw.style.transform = 'translateY(-' + (cur - 1) * 100 + 'vh)';
    dots.forEach(function (d, i) { d.classList.toggle('active', i + 1 === cur); });
    counter.textContent = cur + ' / ' + N;
    var active = slides[cur - 1];
    if (active) {
      var cls = active.classList.contains('slide-dark') ? 'slide-dark'
        : active.classList.contains('slide-light') ? 'slide-light' : 'slide-pale';
      home.className = 'deck-home ' + cls;
    }
    window.scrollTo(0, 0);
  }

  dots.forEach(function (d, i) {
    d.addEventListener('click', function (e) { e.stopPropagation(); go(i + 1); });
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest('button, a, input, textarea, select, .dots-nav')) return;
    if (window.getSelection && window.getSelection().toString().length > 0) return;
    go(cur + 1);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); go(cur + 1); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
    if (e.key === 'Home') go(1);
    if (e.key === 'End') go(N);
  });

  var ts = null;
  document.addEventListener('touchstart', function (e) { ts = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (ts === null) return;
    var dy = ts - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 50) go(dy > 0 ? cur + 1 : cur - 1);
    ts = null;
  });

  go(1);
})();
