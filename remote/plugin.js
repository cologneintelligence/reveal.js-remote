(function(global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
      (global = global || self, global.RevealRemote = factory());
}(this, (function() {
  'use strict';

  var Plugin = function Plugin() {
    function init(reveal) {
      var config, socket, div, image, link, listeners = {},
        pluginConfig = {
          server: window.location.protocol + "//" + window.location.host + "/",
          shareUrl: window.location.href,
          path: "/socket.io",
          multiplex: true,
          remote: true
        };

      function extend(a, b) {
        for (var i in b) {
          a[i] = b[i];
        }

        return a;
      }

      function init() {
        config = reveal.getConfig();
        if (typeof config.remote === "object") {
          pluginConfig = extend(pluginConfig, config.remote);
        }

        if (pluginConfig.multiplex === false && pluginConfig.remote === false) {
          return;
        }

        console.log("Remote: connecting to", pluginConfig.server, pluginConfig.path);
        socket = io.connect(pluginConfig.server, { path: pluginConfig.path });

        socket.on("connect_error", function(err) { console.warn("Remote: Could not connect to socket.io-remote server", err); });
        socket.on("reconnect_error", function(err) { console.warn("Remote: Could not reconnect to socket.io-remote server", err); });
        socket.on("connect_timeout", function() { console.warn("Remote: Could not connect to socket.io-remote server (timeout)"); });
        socket.on("reconnect_failed", function(err) { console.warn("Remote: Could not reconnect to socket.io-remote server - this was the last try, giving up", err); });
        socket.on("error", function(err) { console.warn("Remote: Unknown error in socket.io", err); });

        socket.on("connect", onConnect);
        socket.on("init", msgInit);
        socket.on("client_connected", msgClientConnected);

        if (pluginConfig.multiplex && config.remoteMultiplexId !== undefined) {
          socket.on("multiplex", msgSync);

          reveal.configure({
            controls: false,
            keyboard: false,
            touch: false,
            help: false
          });
        }

        if (pluginConfig.remote) {
          socket.on("command", msgCommand);

          on("next", reveal.next);
          on("prev", reveal.prev);
          on("up", reveal.up);
          on("down", reveal.down);
          on("left", reveal.left);
          on("right", reveal.right);
          on("overview", reveal.toggleOverview);
          on("pause", reveal.togglePause);
          on("autoslide", reveal.toggleAutoSlide);
        }

        createPopup();

        console.info("Remote: Starting connection");
      }

      function onConnect() {
        console.info("Remote: Connected - sending welcome message");

        if (config.remoteMultiplexId === undefined) {
          var data = {
            type: "master",
            shareUrl: pluginConfig.shareUrl
          };

          if (window.localStorage) {
            var hashes = JSON.parse(window.localStorage.getItem("presentations") || "{}"),
              hashUrl = pluginConfig.shareUrl.replace(/#.*/, "");
            if (hashes.hasOwnProperty(hashUrl)) {
              data.hash = hashes[hashUrl].hash;
              data.remoteId = hashes[hashUrl].remoteId;
              data.multiplexId = hashes[hashUrl].multiplexId;
            }
          }

          socket.emit("start", data);
        } else {
          socket.emit("start", {
            type: "slave",
            id: config.remoteMultiplexId
          });
        }
      }

      function createPopup() {
        var body = document.getElementsByTagName("body")[0],
          inner = document.createElement("div");

        link = document.createElement("a");
        image = document.createElement("img");
        div = document.createElement("div");

        div.class = "remote-qr-overlay";
        div.style.display = "none";
        div.style.position = "fixed";
        div.style.left = 0;
        div.style.top = 0;
        div.style.bottom = 0;
        div.style.right = 0;
        div.style.zIndex = 1000;
        div.style.alignItems = "center";
        div.style.justifyContent = "center";

        inner.style.padding = "50px";
        inner.style.borderRadius = "50px";
        inner.style.textAlign = "center";
        inner.style.background = "rgba(255, 255, 255, .9)";

        link.target = "_blank";
        link.style.fontSize = "200%";

        image.style.border = "20px solid white";

        div.appendChild(inner);

        inner.appendChild(link);
        link.appendChild(image);
        link.appendChild(document.createElement("br"));
        link.appendChild(document.createElement("br"));
        link.appendChild(document.createTextNode("Or share this link"));
        body.appendChild(div);
      }

      function togglePopup(imageData, url) {
        if (link.href === url && div.style.display !== "none") {
          div.style.display = "none";
        } else {
          image.src = imageData;
          link.href = url;
          div.style.display = "flex";
        }
      };

      function msgInit(data) {
        if (pluginConfig.remote) {
          reveal.addKeyBinding({ keyCode: 82, key: "R", description: "Show remote control url" }, function() {
            togglePopup(data.remoteImage, data.remoteUrl);
          });

          reveal.addEventListener("overviewshown", sendRemoteState);
          reveal.addEventListener("overviewhidden", sendRemoteState);
          reveal.addEventListener("paused", sendRemoteState);
          reveal.addEventListener("resumed", sendRemoteState);
          reveal.addEventListener("autoslidepaused", sendRemoteState);
          reveal.addEventListener("autoslideresumed", sendRemoteState);
          reveal.addEventListener("overviewshown", sendRemoteState);
          reveal.addEventListener("overviewhidden", sendRemoteState);
          reveal.addEventListener("slidechanged", sendRemoteFullState);

          sendRemoteFullState();
        }

        if (pluginConfig.multiplex) {
          reveal.addKeyBinding({ keyCode: 65, key: "A", description: "Show share url" }, function() {
            togglePopup(data.multiplexImage, data.multiplexUrl);
          });

          window.addEventListener("load", sendMultiplexState);
          reveal.addEventListener("slidechanged", sendMultiplexState);
          reveal.addEventListener("fragmentshown", sendMultiplexState);
          reveal.addEventListener("fragmenthidden", sendMultiplexState);
          reveal.addEventListener("overviewhidden", sendMultiplexState);
          reveal.addEventListener("overviewshown", sendMultiplexState);
          reveal.addEventListener("paused", sendMultiplexState);
          reveal.addEventListener("resumed", sendMultiplexState);
          reveal.addEventListener("enable-zoom", sendMultiplexState);
          reveal.addEventListener("disable-zoom", sendMultiplexState);

          sendMultiplexState();
        }

        if (window.localStorage) {
          var hashes = JSON.parse(window.localStorage.getItem("presentations") || "{}"),
            hashUrl = pluginConfig.shareUrl.replace(/#.*/, "");
          hashes[hashUrl] = {
            hash: data.hash,
            remoteId: data.remoteId,
            multiplexId: data.multiplexId
          };
          window.localStorage.setItem("presentations", JSON.stringify(hashes));
        }
      }

      function sendRemoteFullState() {
        socket.emit("notes_changed", {
          text: reveal.getSlideNotes()
        });
        sendRemoteState();
      }

      function sendRemoteState() {
        socket.emit("state_changed", {
          isFirstSlide: reveal.isFirstSlide(),
          isLastSlide: reveal.isLastSlide(),
          isOverview: reveal.isOverview(),
          isPaused: reveal.isPaused(),
          isAutoSliding: reveal.isAutoSliding(),
          progress: reveal.getProgress(),
          slideCount: reveal.getTotalSlides(),
          indices: reveal.getIndices(),
          availableRoutes: reveal.availableRoutes(),
          autoslide: (typeof config.autoSlide === "number" && config.autoSlide > 0) &&
            (typeof config.autoSlideStoppable !== "boolean" || !config.autoSlideStoppable)
        });
      }


      function sendMultiplexState() {
        var state = reveal.getState();
        var zoomPlugin = reveal.getPlugin("remote-zoom");
        var zoom = zoomPlugin ? zoomPlugin.getCurrentZoom() : null;

        socket.emit("multiplex", { state: state, zoom: zoom });
      }

      function msgClientConnected() {
        div.style.display = "none";
      }

      function msgSync(data) {
        var zoomPlugin = reveal.getPlugin("remote-zoom");

        reveal.setState(data.state);

        if (zoomPlugin) { zoomPlugin.setCurrentZoom(data.zoom); }
      }

      function on(cmd, fn) {
        listeners[cmd] = fn;
      }

      function msgCommand(data) {
        var cmd = data.command;
        if (listeners.hasOwnProperty(cmd)) {
          listeners[cmd]();
        } else {
          console.log("Remote: No listener registered for", cmd, Object.keys(listeners));
        }
      }

      init();
    }

    return {
      id: 'RevealRemote',
      init: init
    };
  };

  if (typeof Reveal === "object" && Reveal.hasOwnProperty("VERSION") && Reveal.VERSION.startsWith("3.")) {
    new Plugin().init(Reveal);
  }

  return Plugin;
})));
