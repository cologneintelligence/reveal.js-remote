# reveal.js remote

## Using the tool

### Server side

Initially, install all required dependencies:

```sh
npm install
```

To run the server, start:

```
node main
```

The default port is 8080. Append "--help" for more information.

### Client side

Include the following codeblock into your presentation

```html
    <!-- fully optional, the url is automatically detected:
    <script>
    window.controlSlidesConfig = {
        url: 'http://your-sever.org:8080'
    };
    </script>
    -->

    <!-- Must be included AFTER reveal.js -->
    <script src="http://your-server.org:8080/s/socket.io.js"></script>
    <script src="http://your-server.org/slides.js"></script>
```

While presenting, press `shift-r`!
