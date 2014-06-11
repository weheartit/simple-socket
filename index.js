var _ = require('lodash');
var net = require('net');
var tls = require('tls');
var debug;

var defaultOptions = {
  noDelay: true,
  timeout: 1000,
  rejectUnauthorized: true
};

var Socket = function(options) {
  this.options = _.defaults(options, defaultOptions);
  this.debug = this.options.debug;
};

Socket.prototype.writable = function() {
  return this.socket && this.socket.writable
};

Socket.prototype.connect = function(callback) {
  if (this.socket) return callback(new Error('socket already connected'));

  var self = this;

  // connect
  var options = _.pick(self.options, 'host', 'port', 'key', 'cert', 'ca', 'rejectUnauthorized', 'servername', 'requestCert');
  var connectEvent;
  if (options.key) {
    self.debug && self.debug('making ssl connection');
    self.socket = tls.connect(options);
    connectEvent = 'secureConnect';
  } else {
    self.debug && self.debug('making non-ssl connection');
    self.socket = net.connect(options);
    connectEvent = 'connect';
  }

  // set timeout
  self.debug && self.debug('setting connection timeout to ' + self.options.timeout);
  self.socket.setTimeout(self.options.timeout, self.handleTimeout.bind(self));

  // set delay
  self.debug && self.debug('setting no delay to' + self.options.noDelay);
  self.socket.setNoDelay(self.options.noDelay);

  // event handlers
  self.handleCallback(connectEvent, function(err) {
    if (err) { 
      self.socket = null;
    } else if (!self.socket) { // disconnect was called
      return callback(new Error('socket disconnected'))
    }else {
      self.handleClose();
    }
    callback(err);
  });
};

Socket.prototype.disconnect = function(callback) {
  if (!this.socket) return callback && callback();

  this.debug && this.debug('socket disconnect');
  this.socket.end();
  this.socket.on('close', function() { callback && callback(); });
  this.socket = null;
};

Socket.prototype.onData = function(callback) {
  this.socket.on('data', callback);
};

Socket.prototype.pipe = function(dest) {
  return this.socket.pipe(dest);
};

Socket.prototype.write = function() {
  var args = Array.prototype.slice.call(arguments)
  var callback = args.pop()
  var sent = this.socket.write.apply(this.socket, args);
  if (_.isFunction(callback)) {
    if (sent) return callback();
    this.handleCallbackWithClose('drain', callback);
  }
};

Socket.prototype.addCloseListener = function(callback) {
  var socket = this.socket;

  var closeHander = function() { callback(new Error('unexpected close')); };
  socket.on('close', closeHander);
  socket.on('error', callback);

  return function(callback) {
    socket.removeListener('close', closeHander);
    socket.removeListener('error', callback);
  };
};

Socket.prototype.handleClose = function() {
  var self = this;
  self.handleCallback('close', function(err) {
    err && self.debug && self.debug('unexpected socket error', err.stack);
    self.socket = null;
    if (self.onDisconnect) self.onDisconnect();
  });
};

Socket.prototype.handleTimeout = function() {
  this.debug && this.debug('socket timeout');
  if (this.onTimeout) this.onTimeout();
};

Socket.prototype.handleCallback = function(successEvent, callback) {
  var socket = this.socket;
  var self = this;

  self.debug && self.debug(successEvent + ' adding handler');
  var callbackHandler = function(err) {
    self.debug && self.debug(successEvent + ' complete ' + (err && err.stack));

    socket.removeListener(successEvent, callbackHandler);
    socket.removeListener('error', callbackHandler);

    callback.apply(null, arguments)
  };

  socket.on(successEvent, callbackHandler);
  socket.on('error', callbackHandler);
};

Socket.prototype.handleCallbackWithClose = function(successEvent, callack) {
  var self = this;
  var socket = this.socket;

  self.debug && self.debug(successEvent + ' adding handler with close');
  var callbackHandler = function(err) {
    self.debug && self.debug(successEvent + ' complete ' + (err && err.stack));

    socket.removeListener(successEvent, callbackHandler);
    removeCloseListener(callbackHandler);

    callack.apply(null, arguments);
  };

  socket.on(successEvent, callbackHandler);
  var removeCloseListener = this.addCloseListener(callbackHandler);
};

module.exports = Socket;
