# Simple Socket

This is a lightweight wrapper around the Node.js `Socket` class that makes reconnecting and handling errors super simple. It works with `net` and `tls`.

## Installation

```bash
$ npm install simple-socket
```

## Usage

```js
var Socket = require('simple-socket').Socket;

var socket = new Socket({host: 'localhost', port: 80});

connect();

function connect() {
  socket.connect(connectHandler);

  function connectHandler(err) {
    if (err) {
      console.log('error connecting to server', err.stack);
      console.log('attempting to reconnect in 1 second');
      setTimeout(connect, 1000);
    }

    // reconnect when the socket is disconnected
    socket.onDisconnect = connect;

    // reconnect when there is a socket timeout
    socket.onTimeout = function() {
      // set onDisconnect to null before disconnect
      // if you don't want to reconnect
      // socket.onDisconnect = null;

      // disconnect clears all state and onDisconnect will
      // get called
      socket.disconnect();
    };

    // handle incoming data
    socket.onData = function(data) {
      // socket.writeable() will return false if the socket is 
      // disconnected or the underlying socket is not writable
      if (socket.writable()) {
        // socket.write() will callback with an error 
        // (close events before drain are treated as an error)
        socket.write(data, function(err) {
          if (err) console.error('unexepected error', err.stack);
        });
      }
    };

    // socket.pipe(destination) is also available
  };
};

```
