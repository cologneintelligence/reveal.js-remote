# reveal.js remote

## Demo

A [demo](https://presentations.jowisoftware.de/demo/) is available here.

## Using the tool

### Server side

Initially, install all required dependencies:

```sh
npm install
```

To run the server, start:

```sh
node index
```

The default port is 8080. Append "--help" for more information.

### Client side

First, include the dependencies. On Reveal.js 4x. use the following code:

```html
    <!--
        reveal.js-remote:
        The next two dependencies are required!
        If you do not serve the presentations from the presentations/-folder
        give the full servername here, e.g.

        https://presentations.jowisoftware.de/soket.io/socket.io.js and
        https://presentations.jowisoftware.de/_remote/plugin.js_
    -->
    <script src="../socket.io/socket.io.js"></script>
    <script src="../_remote/plugin.js"></script>
```

Next, load the plugin as usual:

```javascript
    Reveal.initialize({
        // …
        plugins: [ /* other, plugins, e.g. RevealMarkdown */, RevealRemote ]
        // –
    });
```

On Reveal.js v 3.x, include the scripts as dependencies instead:

```javascript
    Reveal.initialize({
        // …
        dependencies: [
            // …

            /*
                reveal.js-remote:  
                The next two dependencies are required!
                If you do not serve the presentations from the presentations/-folder
                give the full servername here, e.g.

                https://presentations.jowisoftware.de/soket.io/socket.io.js and
                https://presentations.jowisoftware.de/_remote/plugin.js_
            */
            { src: '../socket.io/socket.io.js', async: true },
            { src: '../_remote/plugin.js', async: true },
        ]
        // …
    });
```

In both versions, include the following code block into your presentation's configuration to fine-tune the plugin:

```javascript
    Reveal.initialize({
        // …
        /*
            reveal.js-remote:
            optional configuration (with default values)
        */
        remote: {
            // enable remote control
            //remote: true,

            // enable multiplexing
            //multiplex: true,

            // server address
            // change this if you do not serve the presentation from the same domain
            // example: https://presentations.jowisoftware.de
            //server: window.location.protocol + "//" + window.location.host + "/",

            // path to socket.io
            // change this if the basepath of the server is not "/"
            //path: "/socket.io",

            // url of the presentation to share
            //shareUrl: window.location.href
        }
        // …
    });
```

While presenting, press `r` („Remote“) and scan the QR-Code to get the remote control or press `a` („shAre“) to share the presentation.

### Zooming in presentations

Reveal's zoom-Plugin does not emit any events. This is why changes cannot be tracked and synchronized to the audience.

However, thanks to [l-jonas](https://github.com/l-jonas) this plugin now ships with a custom zoom functionality.
To enable this plugin, include an additional Javascript:

```html
    <script src="../socket.io/socket.io.js"></script>
    <script src="../_remote/plugin.js"></script>
    <!-- this line is new: -->
    <script src="../_remote/remotezoom.js"></script>
```

Then, load the plugin as usual:

```javascript
    Reveal.initialize({
      // … other initialization …
      plugins: [ RevealRemoteZoom, RevealRemote /*, OtherPlugins… */ ]
    });
```

You can now do a synchronized zoom by double-clicking on any element in the presentation.

### Resuming a presentation

When a presentation is reloaded in the browser (both, presenter or audience), the presentation is resumed normally.

However, if the server is restarted, resuming is only possible if a constant hash secret (`-a` or `PRESENTATION_HASH_SECRET`) is provided.
If this parameter is not given, a random secret is generated and the presentation cannot be resumed.

### Example: Running as a docker container behind an nginx reverse proxy

You can easily put the app behind a reverse proxy. First, start the docker container like this:

```bash
docker container run \
    -d \
    -v /var/presentations:/presentations \
    -p 127.0.0.1:8811:8080 \
    --name revealjs-presentations \
    jochenwierum/revealjs-presentations
```

Then configure your nginx (which hopefully also terminates your tls-connection) as reverse proxy:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    server_name presentations.example.org;

    location / {
        proxy_pass                         http://127.0.0.1:8811/;
        proxy_http_version                 1.1;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        $connection_upgrade;
        proxy_set_header Host              $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Sources

The swipe detection is adopted from [marcandre's detect_swipe](https://github.com/marcandre/detect_swipe).  
Icons are [CC BY](https://iconsrepo.com/licensing/) from [iconsrepo](https://iconsrepo.com).
