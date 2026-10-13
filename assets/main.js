(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Меню ----------
  document.addEventListener('click', function (e) {
    var burger = e.target.closest('.burger');
    if (burger) {
      var nav = burger.parentNode.querySelector('.nav');
      var open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', open);
      document.body.classList.toggle('menu-open', open);
      return;
    }
    var subBtn = e.target.closest('.has-sub > button');
    if (subBtn) {
      var li = subBtn.parentNode;
      subBtn.setAttribute('aria-expanded', li.classList.toggle('open'));
      return;
    }
    var top = e.target.closest('.to-top');
    if (top) { e.preventDefault(); window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); return; }
    if (e.target.closest('.nav a')) closeMenus(true);
    else if (!e.target.closest('.has-sub')) closeMenus();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenus(true); });
  function closeMenus(all) {
    document.querySelectorAll('.has-sub.open').forEach(function (el) { el.classList.remove('open'); el.querySelector('button').setAttribute('aria-expanded', 'false'); });
    if (all) { document.querySelectorAll('.nav.open').forEach(function (el) { el.classList.remove('open'); }); document.body.classList.remove('menu-open'); document.querySelectorAll('.burger').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); }); }
  }

  // ---------- Шапка, прогресс прокрутки ----------
  var progress = document.createElement('div');
  progress.className = 'progress';
  document.body.appendChild(progress);
  function onScroll() {
    var y = window.scrollY;
    document.querySelectorAll('.site-header').forEach(function (h) { h.classList.toggle('scrolled', y > 40); });
    var max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
    tocSpy();
    checkReveal();
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // ---------- Картинки-заглушки ----------
  document.querySelectorAll('.shot img').forEach(function (img) {
    function miss() { img.parentNode.classList.add('missing'); }
    if (img.complete && img.naturalWidth === 0) miss();
    img.addEventListener('error', miss);
  });
  document.querySelectorAll('.logo-img').forEach(function (img) {
    if (img.complete && img.naturalWidth === 0) img.closest('.logo').classList.add('no-img');
  });

  // ---------- Появление блоков при прокрутке ----------
  var REVEAL = 'main > section, .reveal, .card, .price, .doc, .contact, .table-wrap, .shot, .doc-body section, .comp, .stat, .notice, .marquee';
  var pending = [];
  function armReveal(scope) {
    scope.querySelectorAll(REVEAL).forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (reduce || r.top < window.innerHeight * 0.92) { countUp(el); return; } // уже на экране
      var idx = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.style.setProperty('--rd', Math.min(idx, 5) * 0.08 + 's');
      el.classList.add('reveal-pending');
      pending.push(el);
    });
  }
  function checkReveal() {
    if (!pending.length) return;
    var lim = window.innerHeight * 0.9;
    pending = pending.filter(function (el) {
      if (el.getBoundingClientRect().top < lim) {
        el.classList.add('reveal-on');
        el.classList.remove('reveal-pending');
        countUp(el);
        return false;
      }
      return true;
    });
  }

  // ---------- Счётчики ----------
  function fmt(n, plain) { return plain ? String(n) : n.toLocaleString('ru-RU'); }
  function countUp(scope) {
    var els = scope.hasAttribute && scope.hasAttribute('data-count') ? [scope] : scope.querySelectorAll('[data-count]');
    els.forEach(function (el) {
      if (el.dataset.done) return;
      el.dataset.done = 1;
      var end = +el.dataset.count, plain = !!el.dataset.plain;
      var start = plain && end > 1000 ? Math.floor(end * 0.97) : 0;
      if (reduce) { el.textContent = fmt(end, plain); return; }
      var t0 = null, dur = 1600;
      function step(t) {
        if (!t0) t0 = t;
        var k = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt(Math.round(start + (end - start) * e), plain);
        if (k < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  // ---------- Оглавление документации ----------
  function tocSpy() {
    var page = currentPage();
    var links = page.querySelectorAll('.toc a');
    if (!links.length) return;
    var active = null;
    links.forEach(function (a) {
      var t = document.getElementById(a.getAttribute('href').slice(1));
      if (t && t.getBoundingClientRect().top < 160) active = a;
    });
    links.forEach(function (a) { a.classList.toggle('active', a === active); });
  }


  // ---------- Звук (Web Audio, синтез без файлов; выключен по умолчанию) ----------
  var Sound = (function () {
    var ctx = null, master = null, amb = null, on = false, blipTimer = null, lastHover = 0;
    function noiseBuf(sec) {
      var b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }
    function tone(freq, t0, dur, vol, type, freqEnd) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.012, dur / 3));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.05);
    }
    function noise(t0, dur, vol, type, f1, f2, q) {
      var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf(dur + 0.1);
      f.type = type; f.Q.value = q || 1;
      f.frequency.setValueAtTime(f1, t0);
      if (f2) f.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + dur + 0.1);
    }
    function powerUp() {
      var t = ctx.currentTime;
      // нарастающий гул трансформатора
      var o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(38, t); o.frequency.exponentialRampToValueAtTime(100, t + 1.1);
      f.type = 'lowpass'; f.Q.value = 6;
      f.frequency.setValueAtTime(180, t); f.frequency.exponentialRampToValueAtTime(2200, t + 1.0); f.frequency.exponentialRampToValueAtTime(400, t + 1.6);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
      o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 1.8);
      noise(t + 0.95, 0.12, 0.08, 'highpass', 3000, 0, 0.7); // щелчок реле
      // «система в сети»: аккорд
      [1046.5, 1318.5, 1568, 2093].forEach(function (fr, i) { tone(fr, t + 1.05 + i * 0.09, 0.9, 0.05, 'sine'); });
    }
    function startAmbient() {
      var t = ctx.currentTime;
      amb = ctx.createGain(); amb.gain.setValueAtTime(0.0001, t); amb.gain.exponentialRampToValueAtTime(1, t + 3);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      amb.connect(master);
      // сетевой гул 50 Гц и гармоники
      [[50, 0.03], [100, 0.022], [150, 0.01], [200, 0.006]].forEach(function (h) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = h[0]; g.gain.value = h[1];
        o.connect(g); g.connect(lp); o.start();
      });
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 0.15; lg.gain.value = 120;
      lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
      lp.connect(amb);
      // тихий «воздух» линии
      var src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
      src.buffer = noiseBuf(4); src.loop = true;
      bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.6; ng.gain.value = 0.006;
      src.connect(bp); bp.connect(ng); ng.connect(amb); src.start();
      scheduleBlip();
    }
    function scheduleBlip() {
      blipTimer = setTimeout(function () {
        if (!on) return;
        var t = ctx.currentTime, base = [1760, 1975.5, 2349.3][(Math.random() * 3) | 0];
        tone(base, t, 0.12, 0.018); tone(base * 1.5, t + 0.08, 0.16, 0.012);
        scheduleBlip();
      }, 6000 + Math.random() * 9000);
    }
    function enable() {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      if (!ctx) {
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0.0001;
        var comp = ctx.createDynamicsCompressor();
        master.connect(comp); comp.connect(ctx.destination);
      }
      ctx.resume();
      on = true;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 0.05);
      powerUp();
      if (!amb) startAmbient(); else { amb.gain.cancelScheduledValues(ctx.currentTime); amb.gain.setValueAtTime(0.0001, ctx.currentTime); amb.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 3); scheduleBlip(); }
      return true;
    }
    function disable() {
      if (!ctx) return;
      on = false; clearTimeout(blipTimer);
      var t = ctx.currentTime;
      tone(660, t, 0.25, 0.05, 'sine', 220); // мягкое «выключение»
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      setTimeout(function () { if (!on) ctx.suspend(); }, 700);
    }
    function play(kind) {
      if (!on || !ctx) return;
      var t = ctx.currentTime;
      if (kind === 'hover') {
        var now = performance.now(); if (now - lastHover < 70) return; lastHover = now;
        tone(1480, t, 0.05, 0.022);
      } else if (kind === 'click') {
        noise(t, 0.03, 0.07, 'highpass', 2500, 0, 0.8); tone(520, t, 0.08, 0.06, 'triangle', 260);
      } else if (kind === 'toggle') {
        tone(880, t, 0.1, 0.05); tone(1320, t + 0.07, 0.16, 0.05);
      } else if (kind === 'page') {
        noise(t, 0.5, 0.05, 'bandpass', 350, 3200, 1.4); tone(220, t, 0.35, 0.03, 'sine', 440);
      }
    }
    return { enable: enable, disable: disable, play: play, get on() { return on; } };
  })();
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.ctl-sound');
    if (b) {
      var turnOn = !Sound.on;
      if (turnOn) { if (!Sound.enable()) return; } else Sound.disable();
      document.querySelectorAll('.ctl-sound').forEach(function (x) {
        x.setAttribute('aria-pressed', turnOn);
        x.setAttribute('aria-label', turnOn ? 'Выключить звук' : 'Включить звук');
      });
      hideHint();
      return;
    }
    if (e.target.closest('a, button')) Sound.play('click');
  });
  var lastEl = null;
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest('.btn, .comp, .card, .doc, .nav a, .nav button, .price, .contact, .ctl, .link-more, .cta-links a');
    if (el && el !== lastEl) Sound.play('hover');
    lastEl = el;
  });
  // подсказка о звуке — один раз за сессию
  var hint = document.createElement('div');
  hint.className = 'sound-hint';
  hint.textContent = 'На сайте есть звук. Включите его кнопкой с динамиком в шапке.';
  document.body.appendChild(hint);
  function hideHint() { hint.classList.remove('show'); }
  (function () {
    var seen = false;
    try { seen = sessionStorage.getItem('ai-hint') === '1'; sessionStorage.setItem('ai-hint', '1'); } catch (e) {}
    if (seen) return;
    setTimeout(function () { if (!Sound.on) hint.classList.add('show'); setTimeout(hideHint, 5000); }, 2500);
  })();

  // ---------- Тема ----------
  var pal = {};
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function isDark() {
    var t = root.getAttribute('data-theme');
    return t ? t === 'dark' : !!(mq && mq.matches);
  }
  function applyTheme() {
    var d = isDark();
    root.classList.toggle('is-dark', d);
    pal = d ? { rgb: '46,197,245', k: 1, node: '158,226,255', pulse: '120,220,255' }
            : { rgb: '29,107,255', k: 1.6, node: '29,107,255', pulse: '29,107,255' };
    if (reduce) canvases.forEach(function (g) { g.draw(0); });
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', applyTheme);
  new MutationObserver(applyTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.ctl-theme')) return;
    var next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('ai-theme', next); } catch (err) {}
    Sound.play('toggle');
  });

  // ---------- Анимированная энергосеть на canvas ----------
  var canvases = [];
  applyTheme();
  function Grid(cv) {
    var ctx = cv.getContext('2d'), w, h, dpr, nodes = [], edges = [], pulses = [], mouse = { x: -1e3, y: -1e3 };
    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodes = []; edges = []; pulses = [];
      var step = w < 700 ? 90 : 120, cols = Math.ceil(w / step) + 1, rows = Math.ceil(h / step) + 1;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        nodes.push({ x: c * step + (Math.random() - .5) * step * .55 + (r % 2 ? step / 2 : 0), y: r * step + (Math.random() - .5) * step * .55, s: Math.random() < .12 });
      }
      nodes.forEach(function (a, i) {
        nodes.forEach(function (b, j) {
          if (j <= i) return;
          var d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < step * 1.25 && Math.random() < .55) edges.push([a, b, d]);
        });
      });
      for (var k = 0; k < Math.min(26, edges.length); k++) spawn();
    }
    function spawn() {
      var e = edges[(Math.random() * edges.length) | 0];
      pulses.push({ e: e, t: Math.random(), v: (0.25 + Math.random() * .5) / e[2] * 60, dir: Math.random() < .5, hue: Math.random() < .2 });
    }
    function draw(dt) {
      ctx.clearRect(0, 0, w, h);
      var fade = ctx.createLinearGradient(0, 0, w, 0);
      fade.addColorStop(0, 'rgba(' + pal.rgb + ',' + (0.06 * pal.k) + ')'); fade.addColorStop(1, 'rgba(' + pal.rgb + ',' + (0.24 * pal.k) + ')');
      ctx.strokeStyle = fade; ctx.lineWidth = 1;
      ctx.beginPath();
      edges.forEach(function (e) { ctx.moveTo(e[0].x, e[0].y); ctx.lineTo(e[1].x, e[1].y); });
      ctx.stroke();
      nodes.forEach(function (n) {
        var md = Math.hypot(n.x - mouse.x, n.y - mouse.y), near = md < 160 ? 1 - md / 160 : 0;
        ctx.fillStyle = n.s ? 'rgba(255,138,31,' + (0.55 + near * .45) + ')' : 'rgba(' + pal.node + ',' + (0.25 + near * .7) + ')';
        ctx.beginPath(); ctx.arc(n.x, n.y, (n.s ? 2.6 : 1.6) + near * 2.5, 0, 6.283); ctx.fill();
      });
      pulses.forEach(function (p) {
        p.t += p.v * dt;
        if (p.t > 1) { p.t = 0; p.e = edges[(Math.random() * edges.length) | 0]; p.v = (0.25 + Math.random() * .5) / p.e[2] * 60; }
        var a = p.dir ? p.e[0] : p.e[1], b = p.dir ? p.e[1] : p.e[0];
        var x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t;
        var tx = a.x + (b.x - a.x) * Math.max(0, p.t - .25), ty = a.y + (b.y - a.y) * Math.max(0, p.t - .25);
        var g = ctx.createLinearGradient(tx, ty, x, y);
        var col = p.hue ? '255,150,60' : pal.pulse;
        g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(1, 'rgba(' + col + ',0.95)');
        ctx.strokeStyle = g; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = 'rgba(' + col + ',1)';
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 6.283); ctx.fill();
      });
    }
    cv.parentNode.addEventListener('pointermove', function (e) { var r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    cv.parentNode.addEventListener('pointerleave', function () { mouse.x = mouse.y = -1e3; });
    return { cv: cv, build: build, draw: draw };
  }
  function initCanvases(scope) {
    scope.querySelectorAll('.grid-canvas').forEach(function (cv) {
      if (cv._g) { cv._g.build(); return; }
      cv._g = Grid(cv); canvases.push(cv._g); cv._g.build();
      if (reduce) cv._g.draw(0);
    });
  }
  var last = 0;
  function loop(t) {
    var dt = Math.min((t - last) / 1000, 0.05); last = t;
    canvases.forEach(function (g) { if (g.cv.offsetParent !== null && g.cv.getBoundingClientRect().bottom > 0) g.draw(dt); });
    requestAnimationFrame(loop);
  }
  if (!reduce) requestAnimationFrame(loop);
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { canvases.forEach(function (g) { if (g.cv.offsetParent !== null) g.build(); }); }, 200); });

  // ---------- Превью: все страницы в одном файле, навигация по #якорю ----------
  var pages = document.querySelectorAll('#app > .page');
  function currentPage() {
    if (!pages.length) return document;
    for (var i = 0; i < pages.length; i++) if (!pages[i].hidden) return pages[i];
    return document;
  }
  function enter(scope) {
    scope.querySelectorAll('.anim-in').forEach(function (el) { el.style.animation = 'none'; el.offsetHeight; el.style.animation = ''; });
    initCanvases(scope);
    armReveal(scope);
    onScroll();
  }
  if (!pages.length) { enter(document); return; }
  function show() {
    var raw = (location.hash || '#home').slice(1);
    var key = raw, anchor = null;
    if (!document.getElementById('page-' + key)) {
      var target = document.getElementById(raw);
      var host = target && target.closest('.page');
      if (host) { key = host.id.replace('page-', ''); anchor = target; } else key = 'home';
    }
    var changed = false;
    pages.forEach(function (p) { var hide = p.id !== 'page-' + key; if (p.hidden !== hide) changed = true; p.hidden = hide; });
    closeMenus(true);
    var pg = document.getElementById('page-' + key);
    if (pg && pg.dataset.title) document.title = pg.dataset.title;
    if (anchor) { anchor.scrollIntoView({ behavior: changed || reduce ? 'auto' : 'smooth' }); }
    else window.scrollTo(0, 0);
    if (changed) Sound.play('page');
    if (changed || !pg._entered) { pg._entered = true; enter(pg); }
  }
  window.addEventListener('hashchange', show);
  show();
})();

/* © в подвале: 5 нажатий подряд показывают автора сайта */
(function () {
  let n = 0, timer, toast;
  document.addEventListener('click', e => {
    if (!e.target.closest('.footer-bottom .copy')) return;
    clearTimeout(timer);
    timer = setTimeout(() => { n = 0; }, 1500);
    if (++n < 5) return;
    n = 0;
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'dev-egg';
      toast.setAttribute('role', 'status');
      toast.innerHTML = '<b>⚡</b> Сайт разработал <strong>kapa</strong>';
      document.body.appendChild(toast);
    }
    toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 4000);
  });
})();
