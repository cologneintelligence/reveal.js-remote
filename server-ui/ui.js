import * as io from '../../socket.io/socket.io.esm.min.js';

window.slideControl = window.slideControl || (function () {
    let socket;

    function init() {
        const path = window.location.pathname.replace(/\/_remote\/ui\/[^\/]*(?:\?.*)?$/, '/socket.io'),
            id = window.location.search.substring(1);

        console.log(path, id);

        setupSwipe();

        socket = io.connect({path: path});

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
                type: 'remote',
                id: id
            });
        });

        socket.on('notes_changed', function (data) {
            let text = data.text;
            if (text === undefined || text === null || text.trim() === "") {
                text = "(The current slide has no speaker notes)";
            }
            document.getElementById('notes').innerHTML = text;
        });

        socket.on('state_changed', function (data) {
            document.getElementById('progress').style.width = Math.floor(data.progress * 100) + '%';

            document.getElementById('next').className = data.isLastSlide ? 'disabled' : '';
            document.getElementById('prev').className = data.isFirstSlide ? 'disabled' : '';
            document.getElementById('left').className = data.availableRoutes.left ? '' : 'disabled';
            document.getElementById('right').className = data.availableRoutes.right ? '' : 'disabled';
            document.getElementById('up').className = data.availableRoutes.up ? '' : 'disabled';
            document.getElementById('down').className = data.availableRoutes.down ? '' : 'disabled';

            document.getElementById('pause').className = data.isPaused ? 'pressed' : '';
            document.getElementById('overview').className = data.isOverview ? 'pressed' : '';

            if (data.autoslide) {
                document.getElementById('autoslide').className = data.isAutoSliding ? 'pressed' : '';
            } else {
                document.getElementById('autoslide').className = 'hidden';
            }
        });
    }

    function sendCommand(cmd) {
        socket.emit('command', {
            command: cmd
        });
    }

    function command(cmd) {
        return function () {
            sendCommand(cmd);
        };
    }

    function setupSwipe() {
        let startX = 0;
        let startY = 0;
        let isMoving = false;
        const target = document.getElementById("notes");

        target.addEventListener('touchstart', function (e) {
            if (e.touches.length === 1) {
                startX = e.touches[0].pageX;
                startY = e.touches[0].pageY;
                isMoving = true;
                target.addEventListener('touchmove', onTouchMove, false);
                target.addEventListener('touchend', onTouchEnd, false);
            }
        }, false);

        function onTouchEnd() {
            target.removeEventListener('touchmove', onTouchMove);
            target.removeEventListener('touchend', onTouchEnd);
            isMoving = false;
        }

        function onTouchMove(e) {
            if (isMoving) {
                const x = e.touches[0].pageX;
                const y = e.touches[0].pageY;
                const dx = startX - x;
                const dy = startY - y;

                if (Math.abs(dx) >= 25) {
                    if (Math.abs(dy) <= 50) {
                        sendCommand(dx > 0 ? "next" : "prev");
                    }

                    onTouchEnd();
                } else if (Math.abs(dy) > 100) {
                    onTouchEnd();
                }
            }
        }
    }

    function showMenu() {
        document.getElementsByTagName('body')[0].className = '';
    }

    function hideMenu() {
        document.getElementsByTagName('body')[0].className = 'collapsed';
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
        autoslide: command("autoslide"),
        showMenu,
        hideMenu,
    }
})();
