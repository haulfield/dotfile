;((name, definition) => {
    'undefined' != typeof module ? module.exports = definition() :
        'function' == typeof define && 'object' == typeof define.amd ? define(definition) :
            this[name] = definition()
})('streamSaver', () => {
    'use strict';

    let
        iframe, streamSaver = {
            createWriteStream,
            supported : true,
            version : {
                full : '1.0.0',
                major : 1, minor : 0, dot : 0
            }
        };


    function createWriteStream (filename, queuingStrategy, size) {

        // normalize arguments
        if (Number.isFinite(queuingStrategy))
            [size, queuingStrategy] = [queuingStrategy, size];

        let channel = new MessageChannel,
            setupChannel = () => new Promise((resolve, reject) => {
                channel.port1.onmessage = evt => {
                    if (evt.data.download) {
                        resolve();
                        let link = document.createElement('a');
                        let click = new MouseEvent('click');

                        link.href = evt.data.download;
                        link.dispatchEvent(click)
                    }
                };


                chrome.extension.getBackgroundPage().postMessage({filename, size}, '*', [channel.port2])


            });

        return new WritableStream({
            start(error) {
                // is called immediately, and should perform any actions
                // necessary to acquire access to the underlying sink.
                // If this process is asynchronous, it can return a promise
                // to signal success or failure.
                return setupChannel()
            },
            write(chunk) {
                // is called when a new chunk of data is ready to be written
                // to the underlying sink. It can return a promise to signal
                // success or failure of the write operation. The stream
                // implementation guarantees that this method will be called
                // only after previous writes have succeeded, and never after
                // close or abort is called.

                // TODO: Kind of important that service worker respond back when
                // it has been written. Otherwise we can't handle backpressure
                channel.port1.postMessage(chunk)
            },
            close() {
                channel.port1.postMessage('end');
                console.log('All data successfully read!')
            },
            abort(e) {
                channel.port1.postMessage('abort')
            }
        })
    }

    return streamSaver
});
