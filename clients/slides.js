(function () {
  var baseUrl, socket, reveal, div, image, link, listeners = {}, serverUrl;

  function init() {
    var scripts, endpoint;

    if (typeof window.controlSlidesConfig !== 'undefined' && typeof window.controlSlidesConfig.path === 'string') {
      baseUrl = window.controlSlidesConfig.url;
    } else {
      scripts = document.getElementsByTagName("script");
      baseUrl = removeFilename(scripts[scripts.length - 1].src);
    }

    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }
    endpoint = removeProtocol(baseUrl) + 'socket.io';
    serverUrl = getServer(baseUrl);

    if (typeof window.controlSlidesConfig !== 'undefined' && typeof window.controlSlidesConfig.reveal === 'object') {
      reveal = window.controlSlidesConfig.reveal;
    } else {
      reveal = window.Reveal;
    }

    console.log("Connecting to", serverUrl, endpoint);
    socket = io.connect(serverUrl, {path: endpoint});

    socket.on('connect_error', function (err) {
      console.warn("Could not connect to socket.io-remote server", err);
    });
    socket.on('reconnect_error', function (err) {
      console.warn("Could not reconnect to socket.io-remote server", err);
    });
    socket.on('connect_timeout', function () {
      console.warn("Could not connect to socket.io-remote server (timeout)");
    });
    socket.on('reconnect_failed', function (err) {
      console.warn("Could not reconnect to socket.io-remote server - this was the last try, giving up", err);
    });
    socket.on('error', function (err) {
      console.warn("Unknown error in socket.io", err);
    });
    socket.on('connect', function () {
      console.info("Connected - sending welcome message");

      socket.emit('start', {
        type: 'slides',
        url: baseUrl
      });
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

    console.info("Starting connection");
  }

  function msg_init(data) {
    reveal.registerKeyboardShortcut('Shift + R', 'Show remote control url');
    createPopup(data.image, data.url);
    addPopupListener();
    registerRevealEvents();
  }

  function createPopup(imageData, url) {
    var body = document.getElementsByTagName("body")[0];
    link = document.createElement("a");
    image = document.createElement("img");

    if (div === undefined) {
      div = document.createElement("div");

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

      link.target = "_blank";

      div.appendChild(image);
      div.appendChild(document.createElement("br"));
      div.appendChild(link);
      body.appendChild(div);
    }

    image.src = imageData;
    link.text = url;
    link.href = url;
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

  function removeProtocol(url) {
    return url.replace(/[^/]+\/\/[^/]+\//, '/');
  }

  function removeFilename(url) {
    return url.replace(/\/slides\.js(\?.*)?$/, '');
  }

  function getServer(url) {
    return url.replace(/^([^/]+\/\/[^/]+).*/, '$1/');
  }

  init();
})();
