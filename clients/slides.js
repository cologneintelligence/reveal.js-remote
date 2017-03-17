(function () {
  var socket, base, reveal, div, listeners = {};

  function init() {
    var scripts;

    if (typeof window.controlSlidesConfig !== 'undefined' && typeof window.controlSlidesConfig.url === 'string') {
      base = window.controlSlidesConfig.url;
    } else {
      scripts = document.getElementsByTagName("script");
      base = scripts[scripts.length - 1].src.replace(/[^\/]+$/, '');
    }

    if (typeof window.controlSlidesConfig !== 'undefined' && typeof window.controlSlidesConfig.reveal === 'object') {
      reveal = window.controlSlidesConfig.reveal;
    } else {
      reveal = window.Reveal;
    }

    socket = io.connect(base, {path: '/s'});
    socket.emit('start', {
      type: 'slides',
      url: base
    });

    socket.on('init', msg_init);
    socket.on('client_connected', msg_client_connected);
    socket.on('command', msg_command);

    on('next', reveal.next);
    on('prev', reveal.prev);
    on('up', reveal.up);
    on('down', reveal.down);
    on('left', reveal.left);
    on('right', reveal.right);
    on('overview', reveal.toggleOverview);
    on('pause', reveal.togglePause);
    on('autoslide', reveal.toggleAutoSlide);
  }

  function msg_init(data) {
    reveal.registerKeyboardShortcut('Shift + r', 'Show remote control url');
    createPopup(data.image, data.url);
    addPopupListener();
    registerRevealEvents();
  }

  function createPopup(image, url) {
    div = document.createElement("div");
    var img = document.createElement("img"),
      a = document.createElement("a"),
      body = document.getElementsByTagName("body")[0];

    img.src = image;

    div.class = "remote-qr-overlay";

    div.style.display = "none";
    div.style.position = "fixed";
    div.style.width = "100%";
    div.style.height = "100%";
    div.style.top = 0;
    div.style.bottom = 0;
    div.style.textAlign = "center";
    div.style.background = "#FFFFFF";
    div.style.zIndex = 1000;

    a.text = url;
    a.href = url;
    a.target = "_blank";

    div.appendChild(img);
    div.appendChild(document.createElement("br"));
    div.appendChild(a);
    body.appendChild(div);
  }

  function addPopupListener() {
    document.addEventListener('keypress', function (event) {
      if (event.shiftKey && event.charCode === 82) {
        if (div.style.display === 'none') {
          div.style.display = 'block';
        } else {
          div.style.display = 'none';
        }
      }
    }, false);
  }

  function registerRevealEvents() {
    reveal.addEventListener('overviewshown', sendState);
    reveal.addEventListener('overviewhidden', sendState);
    reveal.addEventListener('paused', sendState);
    reveal.addEventListener('resumed', sendState);
    reveal.addEventListener('autoslidepaused', sendState);
    reveal.addEventListener('autoslideresumed', sendState);
    reveal.addEventListener('overviewshown', sendState);
    reveal.addEventListener('overviewhidden', sendState);

    reveal.addEventListener('slidechanged', sendFullState);
  }

  function sendFullState() {
    socket.emit('notes_changed', {
      text: reveal.getSlideNotes()
    });
    sendState();
  }

  function sendState() {
    socket.emit('state_changed', {
      isFirstSlide: reveal.isFirstSlide(),
      isLastSlide: reveal.isLastSlide(),
      isOverview: reveal.isOverview(),
      isPaused: reveal.isPaused(),
      isAutoSliding: reveal.isAutoSliding(),
      progress: reveal.getProgress(),
      slideCount: reveal.getTotalSlides(),
      indices: reveal.getIndices(),
      availableRoutes: reveal.availableRoutes()
    });
  }

  function msg_client_connected() {
    div.style.display = "none";
    sendFullState();
  }

  function on(cmd, fn) {
    listeners[cmd] = fn;
  }

  function msg_command(data) {
    var cmd = data.command;
    if (listeners.hasOwnProperty(cmd)) {
      listeners[cmd]();
    } else {
      console.log("No listener registered for", cmd, Object.keys(listeners));
    }
  }

  init();
})();
