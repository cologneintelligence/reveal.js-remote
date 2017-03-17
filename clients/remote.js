window.slideControl = (function () {
  var socket;

  function init() {
    var base = window.location.protocol + "//" + window.location.host,
      id = window.location.search.substr(1);
    console.log("Connect to:", base);
    socket = io.connect(base, {path: '/s'});

    socket.on('init', function () {
      console.log("init!");
    });

    socket.emit('start', {
      type: 'remote',
      id: id
    });

    socket.on('notes_changed', function (data) {
      document.getElementById('notes').innerHTML = data.text;
    });

    socket.on('state_changed', function (data) {
      console.log("New state", data);

      document.getElementById('progress').style.width = Math.floor(data.progress * 100) + '%';

      document.getElementById('next').className = data.isLastSlide ? 'disabled' : '';
      document.getElementById('prev').className = data.isFirstSlide ? 'disabled' : '';
      document.getElementById('left').className = data.availableRoutes.left ? '' : 'disable';
      document.getElementById('right').className = data.availableRoutes.right ? '' : 'disabled';
      document.getElementById('up').className = data.availableRoutes.up ? '' : 'disabled';
      document.getElementById('down').className = data.availableRoutes.down ? '' : 'disabled';

      document.getElementById('pause').className = data.isPaused ? 'pressed' : '';
      document.getElementById('overview').className = data.isOverview ? 'pressed' : '';
      document.getElementById('autoslide').className = data.isAutoSliding ? 'pressed' : '';
    });
  }

  function command(cmd) {
    return function () {
      socket.emit('command', {
        command: cmd
      });
    };
  }

  init();

  return {
    next: command("next"),
    prev: command("prev"),
    left: command("left"),
    right: command("right"),
    up: command("up"),
    down: command("down"),
    overview: command("overview"),
    pause: command("pause"),
    autoslide: command("autoslide")
  }
})();
