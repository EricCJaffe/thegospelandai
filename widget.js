/*!
 * The Gospel and AI — embeddable chat widget
 * Drop on any page:
 *   <script src="https://thegospelandai.vercel.app/widget.js" async></script>
 * Optional config via data-attributes on the script tag:
 *   data-accent="#3B82F6"  data-position="right|left"
 *   data-greeting="Ask me anything about AI and faith…"
 *   data-title="Anchored"
 * Renders inside a shadow DOM so host-page CSS can't interfere.
 */
(function () {
  if (window.__gaaiWidgetLoaded) return;
  window.__gaaiWidgetLoaded = true;

  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();

  // API base = origin the widget was served from (works cross-origin).
  var API_BASE;
  try { API_BASE = new URL(script.src).origin; } catch (e) { API_BASE = 'https://thegospelandai.vercel.app'; }

  var cfg = {
    accent: script.getAttribute('data-accent') || '#3B82F6',
    position: script.getAttribute('data-position') === 'left' ? 'left' : 'right',
    greeting: script.getAttribute('data-greeting') || "Ask a question about AI and faith — I’ll answer and point you to helpful resources.",
    title: script.getAttribute('data-title') || 'Anchored',
  };

  var TYPE_ICONS = { video: '▶', article: '📄', pdf: '📕', sermon: '🎙' };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Only allow http/https links (blocks javascript:, data:, etc.).
  function safeUrl(u) {
    try {
      var p = new URL(u, API_BASE);
      return (p.protocol === 'http:' || p.protocol === 'https:') ? p.href : '#';
    } catch (e) { return '#'; }
  }

  // ---- Shadow host ----
  var host = document.createElement('div');
  host.setAttribute('id', 'gaai-widget');
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: 'open' });

  var side = cfg.position === 'left' ? 'left:20px;' : 'right:20px;';

  var style = document.createElement('style');
  style.textContent = [
    ':host{all:initial}',
    '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
    '.launch{position:fixed;bottom:20px;' + side + 'z-index:2147483000;width:60px;height:60px;border-radius:50%;background:' + cfg.accent + ';border:none;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;transition:transform .15s}',
    '.launch:hover{transform:scale(1.06)}',
    '.launch svg{width:28px;height:28px;fill:#fff}',
    '.panel{position:fixed;bottom:92px;' + side + 'z-index:2147483000;width:380px;max-width:calc(100vw - 40px);height:560px;max-height:calc(100vh - 120px);background:#0F172A;border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.4);display:none;flex-direction:column;overflow:hidden}',
    '.panel.open{display:flex}',
    '.hd{padding:16px 18px;background:linear-gradient(135deg,#0F172A,#1E293B);border-bottom:1px solid #1E293B;display:flex;align-items:center;justify-content:space-between}',
    '.hd .t{color:#fff;font-weight:600;font-size:15px}',
    '.hd .s{color:#94A3B8;font-size:12px;margin-top:2px}',
    '.hd button{background:none;border:none;color:#94A3B8;font-size:22px;cursor:pointer;line-height:1}',
    '.log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}',
    '.msg{border-radius:10px;padding:11px 14px;font-size:14px;line-height:1.55;max-width:90%}',
    '.msg.u{background:' + cfg.accent + ';color:#fff;align-self:flex-end}',
    '.msg.a{background:#1E293B;color:#E2E8F0;align-self:flex-start}',
    '.msg.a p{margin:0 0 8px}.msg.a p:last-child{margin:0}',
    '.res{display:block;margin-top:8px;background:#0B1220;border:1px solid #233048;border-radius:8px;padding:9px 12px;text-decoration:none}',
    '.res:hover{border-color:' + cfg.accent + '}',
    '.res .rt{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;margin-bottom:2px}',
    '.res .rl{font-size:13px;color:#93C5FD;font-weight:500}',
    '.res .rw{font-size:12px;color:#94A3B8;margin-top:2px;line-height:1.4}',
    '.form{display:flex;gap:8px;padding:12px;border-top:1px solid #1E293B}',
    '.form input{flex:1;background:#1E293B;border:1px solid #334155;color:#E2E8F0;border-radius:10px;padding:11px 14px;font-size:14px;outline:none}',
    '.form input:focus{border-color:' + cfg.accent + '}',
    '.form button{background:' + cfg.accent + ';color:#fff;border:none;border-radius:10px;padding:0 16px;font-size:14px;font-weight:500;cursor:pointer}',
    '.form button:disabled{opacity:.5;cursor:default}',
    '.ft{font-size:11px;color:#475569;text-align:center;padding:0 0 10px}',
    '.dots{display:inline-block}.dots:after{content:"…";animation:d 1.2s steps(4,end) infinite}',
    '@keyframes d{0%{content:""}25%{content:"."}50%{content:".."}75%{content:"..."}}',
    '.fb{display:flex;align-items:center;gap:6px;margin-top:8px}',
    '.fb button{background:none;border:1px solid #334155;color:#94A3B8;border-radius:6px;padding:3px 8px;font-size:13px;cursor:pointer;line-height:1.4;transition:border-color .15s,color .15s}',
    '.fb button:hover{border-color:' + cfg.accent + ';color:#fff}',
    '.fb button:disabled{opacity:.4;cursor:default}',
    '.fb .thanks{font-size:12px;color:#64748B}',
  ].join('\n');
  root.appendChild(style);

  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<button class="launch" aria-label="Open chat">' +
      '<svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.9 2 11.7c0 2.6 1.3 4.9 3.4 6.5L4.6 21l3.5-1.6c1.2.3 2.5.5 3.9.5 5.5 0 10-3.9 10-8.7S17.5 3 12 3z"/></svg>' +
    '</button>' +
    '<div class="panel" role="dialog" aria-label="' + esc(cfg.title) + ' chat">' +
      '<div class="hd"><div><div class="t">' + esc(cfg.title) + '</div><div class="s">Grounded in Scripture &amp; resources</div></div>' +
      '<button class="x" aria-label="Close">×</button></div>' +
      '<div class="log"></div>' +
      '<form class="form"><input type="text" placeholder="Ask a question…" autocomplete="off"/><button type="submit">Ask</button></form>' +
      '<div class="ft">Powered by thegospelandai.com</div>' +
    '</div>';
  root.appendChild(wrap);

  var launch = root.querySelector('.launch');
  var panel = root.querySelector('.panel');
  var log = root.querySelector('.log');
  var form = root.querySelector('.form');
  var input = root.querySelector('.form input');
  var sendBtn = root.querySelector('.form button');
  var history = [];
  var greeted = false;

  function open() {
    panel.classList.add('open');
    if (!greeted) { addBot(cfg.greeting, []); greeted = true; }
    input.focus();
  }
  function close() { panel.classList.remove('open'); }

  launch.addEventListener('click', function () {
    panel.classList.contains('open') ? close() : open();
  });
  root.querySelector('.x').addEventListener('click', close);

  function addUser(text) {
    var el = document.createElement('div');
    el.className = 'msg u';
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function addBot(answer, resources) {
    var el = document.createElement('div');
    el.className = 'msg a';
    renderAnswer(el, answer);
    renderResources(el, resources);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  // Render (or update) just the answer text paragraphs inside a bot message el.
  // Uses a dedicated child div with class "ans" so resources are not disturbed.
  function renderAnswer(el, answer) {
    var ansDiv = el.querySelector('.ans');
    if (!ansDiv) {
      ansDiv = document.createElement('div');
      ansDiv.className = 'ans';
      el.insertBefore(ansDiv, el.firstChild);
    }
    ansDiv.innerHTML = String(answer || '').split(/\n\n+/).map(function (p) {
      return '<p>' + esc(p) + '</p>';
    }).join('');
  }

  // Render (or replace) resource cards inside a bot message el.
  // Uses a dedicated child div with class "res-wrap".
  function renderResources(el, resources) {
    var resDiv = el.querySelector('.res-wrap');
    if (!resDiv) {
      resDiv = document.createElement('div');
      resDiv.className = 'res-wrap';
      el.appendChild(resDiv);
    }
    if (!resources || !resources.length) {
      resDiv.innerHTML = '';
      return;
    }
    resDiv.innerHTML = resources.map(function (r) {
      return '<a class="res" href="' + esc(safeUrl(r.url)) + '" target="_blank" rel="noopener">' +
        '<div class="rt">' + (TYPE_ICONS[r.type] || '🔗') + ' ' + esc(r.type || 'link') + '</div>' +
        '<div class="rl">' + esc(r.title) + '</div>' +
        (r.reason ? '<div class="rw">' + esc(r.reason) + '</div>' : '') +
        '</a>';
    }).join('');
  }

  // Legacy render() kept for the greeting call (answer + resources at once).
  function render(el, answer, resources) {
    renderAnswer(el, answer);
    renderResources(el, resources);
  }

  // Add thumbs up/down feedback buttons under a completed bot message.
  function addFeedback(botEl, question, finalAnswer, resourceUrls) {
    var fbDiv = document.createElement('div');
    fbDiv.className = 'fb';

    var upBtn = document.createElement('button');
    upBtn.textContent = '👍';
    upBtn.setAttribute('aria-label', 'Helpful');

    var dnBtn = document.createElement('button');
    dnBtn.textContent = '👎';
    dnBtn.setAttribute('aria-label', 'Not helpful');

    function sendFeedback(rating) {
      upBtn.disabled = true;
      dnBtn.disabled = true;
      fetch(API_BASE + '/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question,
          answer: finalAnswer,
          rating: rating,
          resourceUrls: resourceUrls,
        }),
      }).catch(function () { /* silently ignore feedback errors */ });
      fbDiv.innerHTML = '<span class="thanks">Thanks!</span>';
    }

    upBtn.addEventListener('click', function () { sendFeedback('up'); });
    dnBtn.addEventListener('click', function () { sendFeedback('down'); });

    fbDiv.appendChild(upBtn);
    fbDiv.appendChild(dnBtn);
    botEl.appendChild(fbDiv);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (!q) return;
    input.value = '';
    sendBtn.disabled = true;
    addUser(q);

    // Start bot message with typing indicator in the answer slot.
    var botEl = document.createElement('div');
    botEl.className = 'msg a';
    var ansDiv = document.createElement('div');
    ansDiv.className = 'ans';
    ansDiv.innerHTML = '<span class="dots"></span>';
    botEl.appendChild(ansDiv);
    var resDiv = document.createElement('div');
    resDiv.className = 'res-wrap';
    botEl.appendChild(resDiv);
    log.appendChild(botEl);
    log.scrollTop = log.scrollHeight;

    var accumulatedAnswer = '';
    var firstDelta = true;
    var renderedResources = [];

    fetch(API_BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, history: history }),
    })
      .then(function (response) {
        if (!response.ok) {
          // Non-2xx: body is JSON {error}
          return response.json().then(function (d) {
            throw new Error(d.error || 'Request failed');
          });
        }

        // Streaming NDJSON: read body with a reader + TextDecoder.
        var reader = response.body.getReader();
        var decoder = new TextDecoder('utf-8');
        var buf = '';
        var done = false;

        function pump() {
          return reader.read().then(function (chunk) {
            if (chunk.done) { done = true; return; }
            buf += decoder.decode(chunk.value, { stream: true });
            var lines = buf.split('\n');
            // Keep the last (possibly incomplete) segment in the buffer.
            buf = lines.pop();
            for (var i = 0; i < lines.length; i++) {
              var line = lines[i].trim();
              if (!line) continue;
              var msg;
              try { msg = JSON.parse(line); } catch (ex) { continue; }
              if (msg.type === 'delta') {
                if (firstDelta) {
                  // Replace the dots indicator with real content.
                  accumulatedAnswer = '';
                  firstDelta = false;
                }
                accumulatedAnswer += msg.content;
                renderAnswer(botEl, accumulatedAnswer);
                log.scrollTop = log.scrollHeight;
              } else if (msg.type === 'meta') {
                renderedResources = msg.resources || [];
                renderResources(botEl, renderedResources);
                log.scrollTop = log.scrollHeight;
              } else if (msg.type === 'error') {
                ansDiv.textContent = msg.error || 'Sorry — something went wrong.';
              } else if (msg.type === 'done') {
                done = true;
              }
            }
            if (!done) return pump();
          });
        }

        return pump();
      })
      .then(function () {
        // Stream finished — update history and add feedback buttons.
        history.push({ role: 'user', content: q });
        history.push({ role: 'assistant', content: accumulatedAnswer });
        var resourceUrls = renderedResources.map(function (r) { return r.url || ''; });
        addFeedback(botEl, q, accumulatedAnswer, resourceUrls);
      })
      .catch(function (err) {
        var ansEl = botEl.querySelector('.ans');
        if (ansEl) {
          ansEl.textContent = (err && err.message) || 'Sorry — something went wrong. Please try again.';
        }
      })
      .finally(function () { sendBtn.disabled = false; input.focus(); });
  });
})();
