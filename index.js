const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const http = require("http");

const commandLineArgs = require("command-line-args");
const commandLineUsage = require("command-line-usage");
const express = require("express");
const qr = require("qr-image");
const socketIo = require("socket.io");
const { v4: uuidv4 } = require('uuid');

const states = {};
const multiplexes = {};

const createImage = async (content) =>
  new Promise((resolve, reject) => {
    const chunks = [];

    const stream = qr.image(content);
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => {
      const result = Buffer.concat(chunks);
      resolve(result.toString("base64"));
    });
    stream.on("error", reject);
  });

const mkHash = (remoteId, multiplexId, hashsecret) => {
  return crypto.createHash("sha256")
    .update(`${remoteId}-${multiplexId}-${hashsecret}`, "utf8")
    .digest("hex");
}

const initMaster = (socket, initialData, baseUrl, hashsecret) => {
  let remoteId = null;
  let multiplexId = null;
  let hash = null;

  if (initialData.remoteId !== null && initialData.multiplexId !== null && initialData.hash !== null &&
    mkHash(initialData.remoteId, initialData.multiplexId, hashsecret) === initialData.hash) {
    remoteId = initialData.remoteId;
    multiplexId = initialData.multiplexId;
    hash = initialData.hash;
  }

  if (remoteId === null) {
    remoteId = uuidv4();
    multiplexId = uuidv4();
    hash = mkHash(remoteId, multiplexId, hashsecret);
  }

  socket.join("master-" + remoteId);

  const remoteUrl = baseUrl + "_remote/?" + remoteId;
  const multiplexUrl = initialData.shareUrl.replace(/#.*/, "") +
    (initialData.shareUrl.indexOf("?") > 0 ? "&" : "?") + "remoteMultiplexId=" + multiplexId;

  socket.on('disconnect', () => {
    delete states[remoteId];
    delete multiplexes[multiplexId];
  });

  Promise.all([createImage(remoteUrl), createImage(multiplexUrl)])
    .then((base64) =>
      socket.emit("init", {
        remoteUrl,
        multiplexUrl,
        hash,
        remoteId,
        multiplexId,
        remoteImage: "data:image/png;base64," + base64[0],
        multiplexImage: "data:image/png;base64," + base64[1]
      }));

  socket.on("state_changed", function (data) {
    if (!states.hasOwnProperty(remoteId)) {
      states[remoteId] = {};
    }

    states[remoteId].state = data;
    socket.to("remote-" + remoteId).emit("state_changed", data);
  });

  socket.on("notes_changed", function (data) {
    if (!states.hasOwnProperty(remoteId)) {
      states[remoteId] = {};
    }
    states[remoteId].notes = data;

    socket.to("remote-" + remoteId).emit("notes_changed", data);
  });

  socket.on("multiplex", function (data) {
    multiplexes[multiplexId] = data;

    socket.to("multiplex-" + multiplexId).emit("multiplex", data);
  })
};

const initRemoteControl = (socket, initialData) => {
  const id = initialData.id;
  socket.join("remote-" + id);
  socket.to("master-" + id).emit("client_connected", {});

  if (states.hasOwnProperty(initialData.id)) {
    if (states[initialData.id].notes) {
      socket.emit("notes_changed", states[initialData.id].notes);
    }
    if (states[initialData.id].state) {
      socket.emit("state_changed", states[initialData.id].state);
    }
  }

  socket.on("command", (data) => {
    if (typeof data !== "undefined" && typeof data.command === "string") {
      socket.to("master-" + id).emit("command", {
        command: data.command
      });
    }
  });
}

const initSlave = (socket, data) => {
  socket.join("multiplex-" + data.id);
  if (multiplexes.hasOwnProperty(data.id)) {
    socket.emit("multiplex", multiplexes[data.id]);
  }
};

const initConnection = (socket, prefix, hashsecret, ssl) => {
  const host = socket.request.headers["x-forwarded-host"] || socket.request.headers["host"];
  const proto = socket.request.headers["x-forwarded-proto"] || (ssl ? "https" : "http");

  socket.once("start", (data) => {
    try {
      if (data.type === "master") {
        const url = proto + "://" + host + prefix;
        initMaster(socket, data, url, hashsecret);
      } else if (data.type === "slave") {
        if (!data.id) {
          return;
        }

        initSlave(socket, data);
      } else if (data.type === "remote") {
        if (!data.id) {
          return;
        }

        initRemoteControl(socket, data);
      }
    } catch (e) {
      console.warn(e);
    }
  });
};

const index = async (res, path) => {
  fs.promises.readdir(path, { encoding: "utf-8" })
    .then(files => {
      const list = "<li>" +
        files.map(file => '<a href="' + encodeURI(file) + '/">' + file.replace(/[\u00A0-\u9999<>&"']/g, i => "&#" + i.charCodeAt(0) + ";") + "</a>")
          .join("</li><li>") +
        "</li>";

      res.set("Content-Type", "text/html");
      res.send("<!DOCTYPE html><html lang='en'><head><title>Directory Listing</title></head><ul>" + list + "</ul>");
    })
    .catch(e => {
      console.warn("Unable to build directory listing:", e);
    })
};


const createServer = (args, app) => {
  let port = 8080;

  if (args.port > 0 && args.port <= 65535) {
    port = args.port;
  } else {
    console.warn("Port must be a positive integer");
    process.exit(1);
  }

  let server;
  if (args.ssl !== null) {
    try {
      server = https.createServer({ pfx: fs.readFileSync(args.ssl) }, app);
    } catch (e) {
      console.warn("Could not start HTTPS server", e.message);
      process.exit(1)
    }
  } else {
    try {
      server = http.createServer(app);
    } catch (e) {
      console.warn("Could not start HTTP server", e.message);
      process.exit(1)
    }
  }

  return new Promise((resolve) =>
    server.listen({ port }, () => resolve(server)));
};

const parseArgs = () => {
  const optionList = [
    {
      name: "port",
      alias: "p",
      typeLabel: "{underline port}",
      type: Number,
      defaultValue: process.env.PRESENTATION_PORT || 8080,
      description: "Webserver port (default: 8080, env: PRESENTATION_PORT)"
    },
    {
      name: "ssl",
      alias: "s",
      typeLabel: "{underline file}",
      defaultValue: process.env.PRESENTATION_PFX_FILE || null,
      description: "Enable ssl mode, requires the path to a pfx file as argument (default: none, env: PRESENTATION_PFX_FILE)"
    },
    {
      name: "basepath",
      alias: "b",
      typeLabel: "{underline path}",
      defaultValue: process.env.PRESENTATION_BASE_PATH || "/",
      description: "URL basepath where the application can be found (useful for reverse proxys, default: /, env: PRESENTATION_BASE_PATH)"
    },
    {
      name: "presentationpath",
      alias: "e",
      typeLabel: "{underline path}",
      defaultValue: process.env.PRESENTATION_PRESENTATION_PATH || (__dirname + "/presentations/"),
      description: "URL basepath where the application presentations can be found (default: ./presentations/, env: PRESENTATION_PRESENTATION_PATH)"
    },
    {
      name: "hashsecret",
      alias: "a",
      typeLabel: "{underline string}",
      defaultValue: process.env.PRESENTATION_HASH_SECRET || uuidv4(),
      description: "A secret which is used to resume a session after the presentation is reloaded (default: a random value, env: PRESENTATION_PRESENTATION_PATH)"
    },
    {
      name: "help",
      alias: "h",
      description: "Displays this help"
    }
  ];

  let args;
  try {
    args = commandLineArgs(optionList);
  } catch (e) {
    console.warn("Could not process arguments", e.message);
    process.exit(1);
  }

  if (typeof args.help !== "undefined") {
    console.warn(commandLineUsage(
      [
        {
          header: "reveal.js-remote",
          content: "Broker for remote controlling a reveal.js presentation"
        },
        {
          header: "Synopsis",
          content: [
            "$ node main [--port 8080] [--ssl serverCert.pfx] [--basepath /presentation] [--presentationpath /my-presentations]",
            "$ node main --help"
          ]
        },
        {
          header: "Options",
          optionList: optionList
        }
      ]));

    process.exit(1);
  }

  if (!args.basepath.endsWith("/")) {
    args.basepath += "/";
  }

  return args;
}


const args = parseArgs();
const app = express();

createServer(args, app).then(server => {
  const prefix = args.basepath;
  app.use(prefix + "_remote/", express.static(__dirname + "/remote"));
  app.use(prefix, express.static(args.presentationpath));
  app.get(prefix, (_req, res) => index(res, args.presentationpath));

  const io = socketIo(server, { path: args.basepath + "socket.io", cookie: false });
  io.sockets.on("connection", (socket) => initConnection(socket, prefix, args.hashsecret, args.ssl !== null));

  console.log("Serving with prefix " + args.basepath + " on port " + args.port + ", secret: " + args.hashsecret);
  console.log("Server presentations from " + args.presentationpath);
  console.log("Server started.")
});
