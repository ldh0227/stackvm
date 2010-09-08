var RemoteEmitter = require('dnode/events');
var Hash = require('traverse/hash');
var FB = require('./fb');
var Png = require('png').Png;
var fs = require('fs');

module.exports = Process;
Process.prototype = new RemoteEmitter;
function Process (params) {
    if (!(this instanceof Process)) return new Process(params);
    var self = this;
    self.__proto__ = Hash.copy(self.__proto__);
    
    Hash(params).forEach(function (p, key) { self[key] = p });
    
    var framebuffer = null;
    
    self.on('attach', function (tied) {
        tied.fb = {
            input : framebuffer.input,
            encoder : tied.tie(framebuffer.encoder),
            size : framebuffer.size,
        };
    });
    
    setTimeout(function () { // lame hack, give it time to connect
        FB(self.addr, self.engine, function (fb) {
            framebuffer = fb;
            self.emit('ready');
        });
    }, 500);
    
    self.__proto__.access = function () {
        return Access(params.rules || {});
    };
    
    self.__proto__.limit = function (user, access) {
        var can = (access ? access : self.access).allowed(user);
        
        var share = Hash.copy(this);
        share.fb = Hash.copy(share.fb);
        
        if (!can.input) delete share.fb.input;
        if (!can.view) delete share.fb.encoder;
        
        return share;
    };
    
    // probably this will need tied to notify the client
    self.screenshot = function () {
        FB(self.addr, self.engine, function (fb) {
            fb.encoder.requestRedrawScreen();
            fb.encoder.once('raw', function g (rect) {
                fb.encoder.dimensions(function (dims) {
                    var fullScreen = rect.x == 0 && rect.y == 0 &&
                        rect.width == dims.width && rect.height == dims.height;
                    if (!fullScreen) {
                        fb.encoder.once('raw', g);
                    }
                    else {
                        var png = new Png(rect.fb, rect.width, rect.height, 'bgr').
                            encode(function (image) {
                                var fileName = randomFileName();
                                var fullPath = __dirname + '/../../static/screenshots/' +
                                    fileName;
                                    
                                fs.writeFile(fullPath, image, 'binary',
                                    function (err) {
                                        if (err) {
                                            console.log('failed writing screenshot: ' + err);
                                        }
                                        else {
                                            self.emit('screenshot',
                                                'http://10.1.1.2:9000/screenshots/' + fileName);
                                        }
                                });
                            });
                    }
                });
            });
        });
    };
}

// this shouldn't be here. todo: refactor it all out to screenshots.js
function randomFileName () {
    var fileName = '';
    for (var i = 0; i<32; i++) {
        fileName += String.fromCharCode(Math.random()*26 + 97);
    }
    return fileName;
}
