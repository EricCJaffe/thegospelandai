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
    greeting: script.getAttribute('data-greeting') || 'Ask a question about AI and faith — I’ll answer and point you to helpful resources.',
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
    render(el, answer, resources);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function render(el, answer, resources) {
    var html = String(answer || '').split(/\n\n+/).map(function (p) {
      return '<p>' + esc(p) + '</p>';
    }).join('');
    if (resources && resources.length) {
      html += resources.map(function (r) {
        return '<a class="res" href="' + esc(safeUrl(r.url)) + '" target="_blank" rel="noopener">' +
          '<div class="rt">' + (TYPE_ICONS[r.type] || '🔗') + ' ' + esc(r.type || 'link') + '</div>' +
          '<div class="rl">' + esc(r.title) + '</div>' +
          (r.reason ? '<div class="rw">' + esc(r.reason) + '</div>' : '') +
          '</a>';
      }).join('');
    }
    el.innerHTML = html;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (!q) return;
    input.value = '';
    sendBtn.disabled = true;
    addUser(q);
    var botEl = addBot('<span class="dots"></span>', []);
    botEl.innerHTML = '<span class="dots"></span>';

    fetch(API_BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, history: history }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.d.error || 'Request failed');
        render(botEl, res.d.answer, res.d.resources);
        log.scrollTop = log.scrollHeight;
        history.push({ role: 'user', content: q });
        history.push({ role: 'assistant', content: res.d.answer || '' });
      })
      .catch(function (err) {
        botEl.textContent = (err && err.message) || 'Sorry — something went wrong. Please try again.';
      })
      .finally(function () { sendBtn.disabled = false; input.focus(); });
  });
})();
