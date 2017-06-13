function XHRequest(url, method, body, callback, errcallback, Content, Accept) {
    var req = new XMLHttpRequest();
    req.open(method, url, true);
    if (Content) {
        req.setRequestHeader("Content-Type", Content);
    }
    if (Accept) {
        req.setRequestHeader("Accept", Accept);
    }
    req.onreadystatechange = function(aEvt) {
        if (req.readyState == 4) {
            if (req.status == 200) {
                callback(req);
            } else if (req.status == 404) {
                errcallback(req);
            }
        }
    };
    req.send(body);
}

function LOG(text) {    
    console.log(text);
}