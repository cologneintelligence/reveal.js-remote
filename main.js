var
  express = require('express'),
  uuid = require('uuid/v4'),
  qr = require('qr-image'),
  commandLineArgs = require('command-line-args'),
  commandLineUsage = require('command-line-usage'),
  socketIo = require('socket.io'),
  uuid2channels = {},
  args, server,
  app = express();

args = parseArgs();
server = createServer(args, app);

io = socketIo.listen(server, {path: args.basepath + "socket.io"});
app.use(args.basepath, express.static(__dirname + '/clients'));

app.use(args.basepath + "fontawesome/css", express.static('./node_modules/font-awesome/css'));
app.use(args.basepath + "fontawesome/fonts", express.static('./node_modules/font-awesome/fonts'));

io.sockets.on('connection', function (socket) {
  socket.once('start', function (data) {
    if (data.type === "slides") {
      initSlides(socket, data);
    } else if (data.type === "remote") {
      initRemote(socket, data);
    }
  });
});

function initSlides(socket, initialData) {
  var id = uuid();
  uuid2channels[id] = true;

  var url = initialData.url + "?" + id,
    image = qr.imageSync(url),
    base64 = new Buffer(image).toString('base64');

  socket.join(id);

  socket.emit('init', {
    id: id,
    url: url,
    image: "data:image/png;base64," + base64
  });

  socket.on('disconnect', function () {
    delete uuid2channels[id];
  });

  socket.on('state_changed', function (data) {
    socket.to(id).emit('state_changed', data);
  });

  socket.on('notes_changed', function (data) {
    socket.to(id).emit('notes_changed', data);
  });
}

function initRemote(socket, initialData) {
  var id = initialData.id;
  if (!uuid2channels.hasOwnProperty(id)) {
    return;
  }

  socket.join(id);
  socket.to(id).emit('client_connected', {});

  socket.on('command', function (data) {
    if (typeof data !== 'undefined' && typeof data.command === 'string') {
      socket.to(id).emit('command', {
        command: data.command
      });
    }
  });
}

function createServer(args, app) {
  var server, port = 8080;

  if (args.port > 0 && args.port <= 65535) {
    port = args.port;
  } else {
    console.warn("Port must be a positive integer");
    process.exit(1);
  }

  if (args.ssl !== null) {
    try {
      server = require('https').createServer({pfx: require('fs').readFileSync(args.ssl)}, app);
    } catch (e) {
      console.warn("Could not start HTTPS server", e.message);
      process.exit(1)
    }
  } else {
    server = require('http').createServer(app);
  }

  server.listen(port);

  return server;
}

function parseArgs() {
  var args,
    optionList = [
      {
        name: 'port',
        alias: 'p',
        typeLabel: '[underline]{port}',
        type: Number,
        defaultValue: 8080,
        description: "Webserver port (default: 8080)"
      },
      {
        name: 'ssl',
        alias: 's',
        typeLabel: '[underline]{pfxFile}',
        defaultValue: null,
        description: "Enable ssl mode, requires the path to a pfx file as argument (default: none)"
      },
      {
        name: 'basepath',
        alias: 'b',
        typeLabel: '[underline]{path}',
        defaultValue: '/',
        description: "URL basepath where the application can be found (useful for reverse proxys, default: /)"
      },
      {
        name: 'help',
        alias: 'h',
        description: "Displays this help"
      }
    ];

  try {
    args = commandLineArgs(optionList);
  } catch (e) {
    console.warn("Could not process arguments", e.message);
    process.exit(1);
  }

  if (typeof args.help !== 'undefined') {
    console.warn(commandLineUsage(
      [
        {
          header: 'reveal.js-remote',
          content: 'Broker for remote controlling a reveal.js presentation'
        },
        {
          header: 'Synopsis',
          content: [
            '$ node main [--port 8080] [--ssl serverCert.pfx] [--basepath /presentation]',
            '$ node main --help'
          ]
        },
        {
          header: 'Options',
          optionList: optionList
        }
      ]));
    process.exit(1);
  }

  if (!args.basepath.endsWith('/')) {
    args.basepath += '/';
  }

  return args;
}
