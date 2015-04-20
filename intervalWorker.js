var INTERVAL_DURATION = 120;	// Duration of the interval between logged events in seconds
var INTERVAL_DURATION_MSEC = 1000 * INTERVAL_DURATION;

var interval;

function intervalPost() {
    postMessage({type: "Timeout"});
}

function runActiveTabIntervalAligned() {
    interval = setInterval(intervalPost, INTERVAL_DURATION_MSEC);
    intervalPost();
}

function runActiveTabInterval() {
    var currentTime = Math.floor(Date.now() / 1000);
    var date = new Date();
    
    var s = date.toTimeString();
    
    var tmpsec = 60 - date.getSeconds();
    var tmpmin = date.getMinutes();
    var tmpodd = tmpmin % 2;
    
    var alignment = tmpsec + (tmpodd? 0:60);

    setTimeout(runActiveTabIntervalAligned, alignment * 1000);
}

onmessage = function(evt) {
    switch (evt.data.type) {
        case 'Start':
        runActiveTabInterval();
        case 'Stop':
            clearInterval(interval);
            break;
    };
}
