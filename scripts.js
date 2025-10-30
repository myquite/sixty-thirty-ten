(function() {
  var storageKey = 'preferred-theme';
  // Safe storage wrapper to avoid exceptions (e.g., Safari private mode)
  var safeStorage = {
    getItem: function(key) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    setItem: function(key, val) {
      try { localStorage.setItem(key, val); } catch (e) {}
    },
    removeItem: function(key) {
      try { localStorage.removeItem(key); } catch (e) {}
    }
  };
  var body = document.body;
  // Declare as no-op initially; redefined after designer inputs are ready
  var applyThemeOverrides = function(theme) {};
  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function applyTheme(theme) {
    body.classList.remove('theme-light','theme-dark');
    body.classList.add(theme);
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = theme === 'theme-dark' ? '☀️' : '🌙';
      btn.setAttribute('aria-label', theme === 'theme-dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
    // Defer two frames to ensure CSS vars recompute
    window.requestAnimationFrame(function(){
      window.requestAnimationFrame(function(){
        applyThemeOverrides(theme);
      });
    });
  }
  var saved = safeStorage.getItem(storageKey);
  var initial = saved ? saved : (systemPrefersDark() ? 'theme-dark' : 'theme-light');
  applyTheme(initial);
  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function() {
      var next = body.classList.contains('theme-dark') ? 'theme-light' : 'theme-dark';
      safeStorage.setItem(storageKey, next);
      applyTheme(next);
    });
  }
  
  // =============== Theme Designer ===============
  var panel = document.getElementById('designer-panel');
  var fab = document.getElementById('designer-toggle');
  var closeBtn = document.getElementById('designer-close');
  var form = document.getElementById('designer-form');
  var inputs = {
    '--color-primary': document.getElementById('color-primary'),
    '--color-secondary': document.getElementById('color-secondary'),
    '--color-accent': document.getElementById('color-accent'),
    '--color-accent-hover': document.getElementById('color-accent-hover'),
    '--color-accent-ring': document.getElementById('color-accent-ring')
  };
  var overridesPrefix = 'theme-overrides:'; // key per theme
  var sharedKey = overridesPrefix + 'shared'; // global shared overrides (accent)

  function getCurrentTheme() {
    return body.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light';
  }

  function loadOverrides(theme) {
    try {
      var raw = safeStorage.getItem(overridesPrefix + theme);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveOverrides(theme, data) {
    try {
      safeStorage.setItem(overridesPrefix + theme, JSON.stringify(data));
    } catch (e) {}
  }

  function loadShared() {
    try {
      var raw = safeStorage.getItem(sharedKey);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveShared(data) {
    try {
      safeStorage.setItem(sharedKey, JSON.stringify(data));
    } catch (e) {}
  }

  function getMergedOverrides(theme) {
    var shared = loadShared();
    var themed = loadOverrides(theme);
    var merged = {};
    // shared first, then theme-specific wins for any collisions
    Object.keys(shared).forEach(function(k){ merged[k] = shared[k]; });
    Object.keys(themed).forEach(function(k){ merged[k] = themed[k]; });
    return merged;
  }

  function applyOverridesFor(theme, data) {
    Object.keys(inputs).forEach(function(varName){
      if (data[varName]) {
        body.style.setProperty(varName, data[varName]);
      } else {
        body.style.removeProperty(varName);
      }
    });
  }

  function syncForm(theme) {
    var data = getMergedOverrides(theme);
    Object.keys(inputs).forEach(function(varName){
      var input = inputs[varName];
      var current = data[varName];
      if (current) {
        input.value = current;
      } else {
        // fallback to computed var so the picker reflects current state
        var computed = getComputedStyle(body).getPropertyValue(varName).trim();
        if (computed) {
          // ensure it's a valid color; attempt to convert to hex via a canvas if needed
          input.value = toHexColor(computed) || input.value;
        }
      }
    });
    // Ensure dependent accent variants reflect current accent
    var baseAccent = inputs['--color-accent'] && inputs['--color-accent'].value;
    if (baseAccent) {
      var variants = deriveAccentVariants(baseAccent);
      if (inputs['--color-accent-hover']) inputs['--color-accent-hover'].value = variants.hover;
      if (inputs['--color-accent-ring']) inputs['--color-accent-ring'].value = variants.ring;
    }
  }

  function toHexColor(color) {
    // Handle hex already
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return color;
    var ctx = toHexColor._ctx || (toHexColor._ctx = (function(){
      var canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      return canvas.getContext('2d');
    })());
    ctx.clearRect(0,0,1,1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = color;
    var computed = ctx.fillStyle;
    // computed is in rgb(a) string; parse and convert to hex
    var m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i.exec(computed);
    if (!m) return null;
    function toHex(n){ var h = parseInt(n,10).toString(16); return h.length===1 ? '0'+h : h; }
    return '#' + toHex(m[1]) + toHex(m[2]) + toHex(m[3]);
  }

  // Color helpers and derived accent variants
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return null;
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  }
  function rgbToHex(r,g,b){
    function h(n){ var s=n.toString(16); return s.length===1?'0'+s:s; }
    return '#'+h(r)+h(g)+h(b);
  }
  function rgbToHsl(r,g,b){
    r/=255; g/=255; b/=255;
    var max=Math.max(r,g,b), min=Math.min(r,g,b);
    var h,s,l=(max+min)/2;
    if (max===min) { h=s=0; }
    else {
      var d=max-min;
      s = l>0.5 ? d/(2-max-min) : d/(max+min);
      switch(max){
        case r: h=(g-b)/d+(g<b?6:0); break;
        case g: h=(b-r)/d+2; break;
        case b: h=(r-g)/d+4; break;
      }
      h/=6;
    }
    return { h:h*360, s:s*100, l:l*100 };
  }
  function hslToRgb(h,s,l){
    h/=360; s/=100; l/=100;
    var r,g,b;
    if (s===0) { r=g=b=l; }
    else {
      var hue2rgb=function(p,q,t){
        if (t<0) t+=1; if (t>1) t-=1;
        if (t<1/6) return p+(q-p)*6*t;
        if (t<1/2) return q;
        if (t<2/3) return p+(q-p)*(2/3 - t)*6;
        return p;
      };
      var q = l<0.5 ? l*(1+s) : l+s-l*s;
      var p = 2*l-q;
      r = hue2rgb(p,q,h+1/3);
      g = hue2rgb(p,q,h);
      b = hue2rgb(p,q,h-1/3);
    }
    return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
  }
  function adjustLightness(hex, delta){
    var rgb=hexToRgb(hex); if(!rgb) return hex;
    var hsl=rgbToHsl(rgb.r,rgb.g,rgb.b);
    hsl.l = clamp(hsl.l + delta, 0, 100);
    var out=hslToRgb(hsl.h,hsl.s,hsl.l);
    return rgbToHex(out.r,out.g,out.b);
  }
  function mixWithWhite(hex, whiteRatio){
    var rgb=hexToRgb(hex); if(!rgb) return hex;
    var r = Math.round(rgb.r*(1-whiteRatio) + 255*whiteRatio);
    var g = Math.round(rgb.g*(1-whiteRatio) + 255*whiteRatio);
    var b = Math.round(rgb.b*(1-whiteRatio) + 255*whiteRatio);
    return rgbToHex(r,g,b);
  }
  function mixColors(aHex, bHex, ratio){
    var a = hexToRgb(aHex), b = hexToRgb(bHex);
    if(!a||!b) return aHex;
    var r = Math.round(a.r*(1-ratio) + b.r*ratio);
    var g = Math.round(a.g*(1-ratio) + b.g*ratio);
    var b2 = Math.round(a.b*(1-ratio) + b.b*ratio);
    return rgbToHex(r,g,b2);
  }
  function deriveAccentVariants(baseHex){
    // Slightly darker for hover; light tint for ring
    var hover = adjustLightness(baseHex, -12);
    var ring = mixWithWhite(baseHex, 0.6);
    return { hover: hover, ring: ring };
  }

  // WCAG contrast helpers
  function relLuminance(hex){
    var rgb = hexToRgb(hex); if(!rgb) return 0;
    function chan(c){ c/=255; return c<=0.03928? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
    var r=chan(rgb.r), g=chan(rgb.g), b=chan(rgb.b);
    return 0.2126*r + 0.7152*g + 0.0722*b;
  }
  function contrastRatio(fgHex, bgHex){
    var L1 = relLuminance(fgHex); var L2 = relLuminance(bgHex);
    var lighter = Math.max(L1,L2), darker = Math.min(L1,L2);
    return (lighter + 0.05) / (darker + 0.05);
  }
  function adjustContrast(fgHex, bgHex, target){
    if (!fgHex || !bgHex) return fgHex;
    var current = contrastRatio(fgHex, bgHex);
    if (current >= target) return fgHex;
    // Try darkening and lightening to find minimal delta reaching target
    var best = { hex: fgHex, delta: Infinity };
    var rgb = hexToRgb(fgHex); if(!rgb) return fgHex;
    var hsl = rgbToHsl(rgb.r,rgb.g,rgb.b);
    // scan steps up to +/- 40 lightness
    for (var d=-40; d<=40; d+=1) {
      if (d===0) continue;
      var nl = clamp(hsl.l + d, 0, 100);
      var out = hslToRgb(hsl.h, hsl.s, nl);
      var hex = rgbToHex(out.r,out.g,out.b);
      if (contrastRatio(hex, bgHex) >= target) {
        var score = Math.abs(d);
        if (score < best.delta) { best = { hex: hex, delta: score }; }
      }
    }
    return best.delta < Infinity ? best.hex : fgHex;
  }
  function minContrastAcross(fgHex, bgHexes){
    var min = Infinity;
    for (var i=0;i<bgHexes.length;i++) {
      var c = contrastRatio(fgHex, bgHexes[i]);
      if (c < min) min = c;
    }
    return min;
  }
  function adjustContrastAgainstAll(fgHex, bgHexes, target){
    if (!fgHex || !bgHexes || !bgHexes.length) return fgHex;
    if (minContrastAcross(fgHex, bgHexes) >= target) return fgHex;
    var rgb = hexToRgb(fgHex); if(!rgb) return fgHex;
    var hsl = rgbToHsl(rgb.r,rgb.g,rgb.b);
    var best = { hex: fgHex, delta: Infinity };
    for (var d=-40; d<=40; d+=1) {
      if (d===0) continue;
      var nl = clamp(hsl.l + d, 0, 100);
      var out = hslToRgb(hsl.h, hsl.s, nl);
      var hex = rgbToHex(out.r,out.g,out.b);
      if (minContrastAcross(hex, bgHexes) >= target) {
        var score = Math.abs(d);
        if (score < best.delta) { best = { hex: hex, delta: score }; }
      }
    }
    return best.delta < Infinity ? best.hex : fgHex;
  }
  function getBgHexForElement(el, fallback){
    if (!el) return fallback;
    var c = getComputedStyle(el).backgroundColor;
    var hex = toHexColor(c);
    return hex || fallback;
  }
  function pickTextOn(bgHex, target){
    var white = '#ffffff', black = '#000000';
    var cw = contrastRatio(white, bgHex);
    var cb = contrastRatio(black, bgHex);
    if (cw >= target || cb >= target) return (cw >= cb ? white : black);
    return (cw >= cb ? white : black);
  }

  applyThemeOverrides = function(theme) {
    var data = getMergedOverrides(theme);
    // Ensure minimum contrast for secondary across key surfaces (normal text 4.5:1)
    var primaryHex = data['--color-primary'] || toHexColor(getComputedStyle(body).getPropertyValue('--color-primary').trim()) || '#ffffff';
    var secondaryHex = data['--color-secondary'] || toHexColor(getComputedStyle(body).getPropertyValue('--color-secondary').trim()) || '#111827';
    var surfaces = [primaryHex];
    surfaces.push(getBgHexForElement(document.querySelector('.site-header'), primaryHex));
    surfaces.push(getBgHexForElement(document.querySelector('.card'), primaryHex));
    surfaces.push(getBgHexForElement(document.querySelector('.site-footer'), primaryHex));
    // Compute primary text color against key backgrounds (do not mutate base tokens)
    var textPrimary = adjustContrastAgainstAll(secondaryHex, surfaces, 4.5);
    body.style.setProperty('--text-primary', textPrimary);

    // Text on secondary surfaces (e.g., secondary-demo block)
    var textOnSecondary = pickTextOn(secondaryHex, 4.5);
    body.style.setProperty('--text-on-secondary', textOnSecondary);

    // Softer secondary for gradients (used by hero-title)
    var secondarySoft = mixColors(secondaryHex, primaryHex, 0.35);
    body.style.setProperty('--color-secondary-soft', secondarySoft);

    // Accent text contrast on accent background
    var accentHex = data['--color-accent'] || toHexColor(getComputedStyle(body).getPropertyValue('--color-accent').trim()) || '#EF4444';
    var textOnAccent = pickTextOn(accentHex, 4.5);
    // If still insufficient, adjust accent to reach contrast with chosen text
    if (contrastRatio(textOnAccent, accentHex) < 4.5) {
      accentHex = adjustContrast(accentHex, textOnAccent, 4.5);
      body.style.setProperty('--color-accent', accentHex);
      data['--color-accent'] = accentHex;
    }
    body.style.setProperty('--text-on-accent', textOnAccent);

    // Accent when used as text on primary background (e.g., links) target 3:1
    var accentOnPrimary = adjustContrast(accentHex, primaryHex, 3.0);
    body.style.setProperty('--accent-on-primary', accentOnPrimary);

    // Re-apply hover and ring based on possibly adjusted accent
    var variants = deriveAccentVariants(accentHex);
    body.style.setProperty('--color-accent-hover', variants.hover);
    body.style.setProperty('--color-accent-ring', variants.ring);

    // Derive a muted text color relative to primary/secondary (target ~3:1)
    var baseMuted = mixColors(textPrimary, primaryHex, 0.35);
    var muted = adjustContrast(baseMuted, primaryHex, 3.0);
    body.style.setProperty('--text-muted', muted);

    applyOverridesFor(theme, data);
    syncForm(theme);
  };

  // Observe theme class changes as a safety net (in case theme changes elsewhere)
  try {
    var themeObserver = new MutationObserver(function(mutations){
      for (var i=0;i<mutations.length;i++) {
        if (mutations[i].type === 'attributes' && mutations[i].attributeName === 'class') {
          // Defer two frames to ensure computed styles reflect the new theme
          window.requestAnimationFrame(function(){
            window.requestAnimationFrame(function(){
              applyThemeOverrides(getCurrentTheme());
            });
          });
          break;
        }
      }
    });
    themeObserver.observe(document.body, { attributes: true });
  } catch (e) {}

  // Init designer panel state and events
  if (fab && panel) {
    fab.addEventListener('click', function(){
      var expanded = fab.getAttribute('aria-expanded') === 'true';
      var next = !expanded;
      fab.setAttribute('aria-expanded', String(next));
      panel.setAttribute('aria-hidden', String(!next));
      document.body.classList.toggle('designer-open', next);
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', function(){
      fab.setAttribute('aria-expanded', 'false');
      panel.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('designer-open');
    });
  }

  if (form) {
    form.addEventListener('input', function(e){
      var theme = getCurrentTheme();
      var themed = loadOverrides(theme);
      var shared = loadShared();
      // Save primary/secondary normally (per-theme)
      ['--color-primary','--color-secondary','--color-accent'].forEach(function(varName){
        var val = inputs[varName] && inputs[varName].value;
        if (val) {
          if (varName === '--color-accent') {
            shared[varName] = val; // accent is shared
          } else {
            themed[varName] = val;
          }
          body.style.setProperty(varName, val);
        }
      });
      // Derive hover & ring from accent
      var baseAccent = inputs['--color-accent'] && inputs['--color-accent'].value;
      if (baseAccent) {
        var variants = deriveAccentVariants(baseAccent);
        shared['--color-accent-hover'] = variants.hover;
        shared['--color-accent-ring'] = variants.ring;
        body.style.setProperty('--color-accent-hover', variants.hover);
        body.style.setProperty('--color-accent-ring', variants.ring);
        if (inputs['--color-accent-hover']) inputs['--color-accent-hover'].value = variants.hover;
        if (inputs['--color-accent-ring']) inputs['--color-accent-ring'].value = variants.ring;
      }
      saveOverrides(theme, themed);
      saveShared(shared);
      // After saving, ensure contrast derived vars are updated
      applyThemeOverrides(theme);
    });
  }

  var resetBtn = document.getElementById('designer-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', function(){
      var theme = getCurrentTheme();
      safeStorage.removeItem(overridesPrefix + theme);
      // Also clear shared accent so both themes return to defaults
      safeStorage.removeItem(sharedKey);
      Object.keys(inputs).forEach(function(varName){
        body.style.removeProperty(varName);
      });
      applyThemeOverrides(theme);
    });
  }
  // Apply overrides once at load for initial theme
  applyThemeOverrides(getCurrentTheme());
})();


