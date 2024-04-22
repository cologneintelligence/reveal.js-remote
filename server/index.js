import * as crypto from "crypto";
import * as fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {createServer as createHttpServer} from "http";
import {createServer as createHttpsServer} from "https";
import {default as commandLineArgs} from "command-line-args";
import {default as commandLineUsage} from "command-line-usage";
import {default as express} from "express";
import {Server} from "socket.io";
import {toDataURL} from "qrcode";
import {v4 as uuidv4} from "uuid";
import {default as cors} from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const states = {};
const multiplexes = {};

const mkHash = (remoteId, multiplexId, hashsecret) => {
    return crypto.createHash("sha256")
        .update(`${remoteId}-${multiplexId}-${hashsecret}`, "utf8")
        .digest("hex");
}

const initPresenter = (socket, initialData, baseUrl, hashsecret) => {
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

    socket.join("presenter-" + remoteId);

    const remoteUrl = baseUrl + "_remote/ui/?" + remoteId;
    const multiplexUrl = initialData.shareUrl.replace(/#.*/, "") +
        (initialData.shareUrl.indexOf("?") > 0 ? "&" : "?") + "remoteMultiplexId=" + multiplexId;

    socket.on('disconnect', () => {
        delete states[remoteId];
        delete multiplexes[multiplexId];
    });

    Promise.all([(async (content) => toDataURL(content, {errorCorrectionLevel: 'Q'}))(remoteUrl), (async (content) => toDataURL(content, {errorCorrectionLevel: 'Q'}))(multiplexUrl)])
        .then((base64) =>
            socket.emit("init", {
                remoteUrl,
                multiplexUrl,
                hash,
                remoteId,
                multiplexId,
                remoteImage: base64[0],
                multiplexImage: base64[1]
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
    socket.to("presenter-" + id).emit("client_connected", {});

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
            socket.to("presenter-" + id).emit("command", {
                command: data.command
            });
        }
    });
}

const initFollower = (socket, data) => {
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
            if (data.type === "presenter") {
                const url = proto + "://" + host + prefix;
                initPresenter(socket, data, url, hashsecret);
            } else if (data.type === "follower") {
                if (!data.id) {
                    return;
                }

                initFollower(socket, data);
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
    fs.promises.readdir(path, {encoding: "utf-8"})
        .then(files => {
            const list = "<li>" +
                files.map(file => {
                    let encodedName = encodeURI(file);
                    let escapedName = file.replace(/[\u00A0-\u9999<>&"']/g, i => "&#" + i.charCodeAt(0) + ";");
                    return `<a href="${encodedName}/">${escapedName}</a>`;
                })
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
            server = createHttpsServer({pfx: fs.readFileSync(args.ssl)}, app);
        } catch (e) {
            console.warn("Could not start HTTPS server", e.message);
            process.exit(1)
        }
    } else {
        try {
            server = createHttpServer(app);
        } catch (e) {
            console.warn("Could not start HTTP server", e.message);
            process.exit(1)
        }
    }

    return new Promise((resolve) =>
        server.listen({port}, () => resolve(server)));
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
            name: "origin",
            alias: "o",
            typeLabel: "{underline string}",
            defaultValue: process.env.PRESENTATION_CORS_ORIGIN || null,
            description: "Comma separated list of allowed origins; use '*' to allow all origins (default: none, env: PRESENTATION_CORS_ORIGIN)"
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

    const corsOptions = (args.origin != null) ?
        {origin: (args.origin === '*') ? true : args.origin.split(/\s*,\s/)}
        : undefined;

    if (corsOptions) {
        app.use(cors(corsOptions));
    }

    app.use(prefix + "_remote/", express.static(__dirname + "/static"));
    app.use(prefix, express.static(args.presentationpath));
    app.get(prefix, (_req, res) => index(res, args.presentationpath));

    const io = new Server(server, {path: args.basepath + "socket.io", cookie: false, cors: corsOptions});
    io.sockets.on("connection", (socket) => initConnection(socket, prefix, args.hashsecret, args.ssl !== null));

    console.log("Serving with prefix " + args.basepath + " on port " + args.port + ", secret: " + args.hashsecret);
    console.log("Server presentations from " + args.presentationpath);
    console.log("Server started.")
});
