/* Original Zeitgeist plugin under GNU GPLv3 (c) Zeitgeist project, 2012
 * Original native messaging API under Chromium's BSD-style license (c) Chromium authors, 2013
 * Additions under GNU GPLv3 (c) Steve Dodier-Lazaro for UCL Computer Science, 2015
 */

var host = null;
var tabInfo = {};
var tabIdTimeouts = {};

/* STORAGE FOR LAST STEP'S ACTIVE WINDOWS */
var _latestActiveTabs = {};		// Array of tabs that were active for long enough at the last event logging call (key: XID, data: active duration in secs)
var _currentActiveTab = null;   // Pointer to the window that last sent a 'focus' signal
var _activeTimeStart = 0;		// Timestamp of when that window was last active

/* STORAGE FOR LAST STEP'S ACTIVE WORKSPACES */
var _latestActiveWorkspaces;	// List of workspaces that were active in the 
var _currentActiveWorkspace = null;	// Pointer to the window that last sent a 'focus' signal
var _activeWsTimeStart = 0;		// Timestamp of when that window was last active

var intervalWorker;

/* UTILITIES */
function startsWith(str, prefix) {
    return str && str.indexOf(prefix, 0) === 0;
}

function getCurrentTabId () {
//    if (typeof _currentActiveTab !== 'undefined')
    if (_currentActiveTab !== null)
        return _currentActiveTab.id;
    else
        return -1;
}

function hasFocus(callback) {
    chrome.windows.getLastFocused ({}, function (current) {
        if (typeof current !== 'undefined')
            callback(current.focused);
        else
            callback(false);
    });
}

function pollForFocusLoss() {
    hasFocus(function (focused) {
        if (!focused) {
            onCurrentTabChanged(null);
        //    console.error ("LOST FOCUS! LOST FOCUS! PANIC!");
        //} else {
        //    console.log ("We currently have the focus");
        }
    });
    
    window.setTimeout(pollForFocusLoss, 500);
}

function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}


function onCurrentTabChanged (tab) {
    if (typeof tab !== 'undefined') {
        var currentTime = Date.now();
        var duration = (currentTime - _activeTimeStart) / 1000;

        if (_currentActiveTab !== null) {
            // The previously active tab has stayed long enough to be registered as active
            if (_currentActiveTab.id in _latestActiveTabs)
                _latestActiveTabs[_currentActiveTab.url] += duration;
            else
                _latestActiveTabs[_currentActiveTab.url] = duration;
        }
        if (_currentActiveTab || tab)
            //console.log("Activated %d in %d, previous tab %d stayed %f seconds",
               // tab? tab.id : -1,
               // tab? tab.windowId : -1,
               // getCurrentTabId(),
               // _currentActiveTab ? duration : 0.0);

        _currentActiveTab = tab;
        _activeTimeStart = currentTime;
    }
}

function onTabActivated (tabId) {
    chrome.windows.getLastFocused ({}, function (current) {
        if (typeof current !== 'undefined') {
            chrome.tabs.get (tabId, function (tab) {
                if (typeof tab !== 'undefined') {
                    if (current.id === tab.windowId) {
                        onCurrentTabChanged (tab);
                    }
                } else
                    onCurrentTabChanged (null);
	        });
        } else
            onCurrentTabChanged (null);
    });
}

function onTabActivatedListener (activeInfo) {
    onTabActivated (activeInfo.tabId);
}

function onWindowsFocusChanged (windowId) {
    chrome.windows.get (windowId, {populate: true}, function (current) {
        var foundActive = false;
        if (typeof chrome.runtime.lastError == 'undefined' && typeof current !== 'undefined') {
            current.tabs.forEach (function (tab) {
                if (tab.active) {
                    onCurrentTabChanged (tab);
                    foundActive = true;
                }
	        });
        }
        
        if (!foundActive)
            onCurrentTabChanged (null);
    });
}

function initActiveTab () {
    chrome.windows.getLastFocused ({populate: true}, function (current) {
        if (typeof chrome.runtime.lastError !== 'undefined') return;
        if (typeof current !== 'undefined') {
            current.tabs.forEach (function (tab) {
                if (tab.active) {
                    _currentActiveTab = tab;
                    _activeTimeStart = Date.now();
                }
	        });
        }
    });
}

function getLatestActiveTabs() {
	// Hack: register current window if it's been here for long enough
	onCurrentTabChanged(_currentActiveTab);

	var latest = _latestActiveTabs;
	_latestActiveTabs = {};
	
	return latest;
}

function intervalRun() {
	var currentActive = getLatestActiveTabs();
	if (!isEmpty(currentActive))
    	sendActiveEvent(currentActive);
//    To stop, call: worker.postMessage ({type: "Stop"});
}


/* ZEITGEIST EVENT HANDLING */
function sendAccessEvent (documentInfo, tab) {
    chrome.processes.getProcessIdForTab(tab.id, function (pid) {
        documentInfo.sentAccess = true;
        documentInfo.pid = pid;
        documentInfo.windowId = tab.windowId;
        documentInfo.index = tab.index;
        documentInfo.id = tab.id;
        tabInfo[tab.id] = documentInfo;

        console.log ("Sending an access event for tab %d, %s, %O", tab.id, tab.url, tab);
        sendNativeMessage({type: "Access", documentInfo: documentInfo});
    });
}

function sendLeaveEvent (tabid) {
	var documentInfo = tabInfo[tabid];
	if (documentInfo == null || documentInfo.sentAccess != true) return;

    console.log ("Sending a leave event for tab %d", tabid);
    sendNativeMessage({type: "Leave", tabid: tabid, documentInfo: documentInfo});

	tabInfo[tabid] = null;
}

function sendActiveEvent (activeEventInfo) {
    console.log ("Sending an active tabs event, %O", activeEventInfo);
    sendNativeMessage({type: "ActiveTabs", info: activeEventInfo});
}

function sendDownloadEvent (downloadItem) {
    console.log ("Sending a download event, %O", downloadItem);
    sendNativeMessage({type: "Download", item: downloadItem});
}


/* LISTENERS */
function onTabCreated (tab) {
    if (startsWith (tab.url, "chrome://")) return;
    //console.log ("Tab created: %d, %O", tab.id, tab);

	chrome.tabs.executeScript(tab.id, {file: "content_script.js"}, function(result) {
                if (chrome.runtime.lastError)
                    console.error ("Could not inject content in tab, %O", chrome.runtime.lastError);
                });
}

function onTabRemoved (tabid) {
    //console.log ("Tab removed: %d", tabid);

	sendLeaveEvent(tabid);
}

function onTabUpdated (tabid, changeInfo, tab) {
	if (startsWith (changeInfo.url, "chrome://")) return;
    //console.log ("Tab updated: %d, %O, %O", tabid, changeInfo, tab);
	if (!changeInfo.url) return;
	
	onCurrentTabChanged(tab);

	window.clearTimeout(tabIdTimeouts[tabid])
	tabIdTimeouts[tabid] = window.setTimeout(function(){
		chrome.tabs.executeScript(tabid, {file: "content_script.js"}, function(result) {
                if (chrome.runtime.lastError)
                    console.error ("Could not inject content in tab, %O", chrome.runtime.lastError);
                });
        },
		5000);
}

function onDownloadChanged (downloadDelta) {
    //console.log ("File downloaded: %s", downloadItem.url);

    if (downloadDelta.state && downloadDelta.state.current == "complete") {
        chrome.downloads.search({id: downloadDelta.id}, function (results) {
            if (results.length > 0) {
                sendDownloadEvent(results[0]);
            }
        });
    }
}


/* NATIVE MESSAGE API */
var port = null;

function sendNativeMessage(message) {
  port.postMessage(message);
  console.log("Sent message: <b>" + JSON.stringify(message) + "</b>");
}
function onNativeMessage(message) {
  console.log("Received message: <b>" + JSON.stringify(message) + "</b>");
}
function onDisconnected() {
  console.log("Failed to connect: " + chrome.runtime.lastError.message);
  port = null;
}
function nativeConnect() {
  var hostName = "uk.ac.ucl.cs.study.multitasking.chrome";
  console.log("Connecting to native messaging host <b>" + hostName + "</b>");
  port = chrome.runtime.connectNative(hostName);
  port.onMessage.addListener(onNativeMessage);
  port.onDisconnect.addListener(onDisconnected);
}


/* EXTENSION SETUP */
function onExtensionRequest (request, sender, sendResponse) {
	var id = sender.tab.id;
	sendLeaveEvent(id);
	sendAccessEvent(request, sender.tab);
}

/* We trust ourselves that we're running chrome, and will set the actor on the host-side
var is_chromium = /chromium/.test( navigator.userAgent.toLowerCase() );
if (!is_chromium) plugin.setActor("application://google-chrome.desktop");
else plugin.setActor("application://chromium-browser.desktop");
*/

chrome.extension.onRequest.addListener (onExtensionRequest);
chrome.tabs.onUpdated.addListener (onTabUpdated);
chrome.tabs.onCreated.addListener (onTabCreated);
chrome.tabs.onRemoved.addListener (onTabRemoved);

chrome.downloads.onChanged.addListener(onDownloadChanged);

chrome.tabs.onActivated.addListener(onTabActivatedListener);
chrome.windows.onFocusChanged.addListener (onWindowsFocusChanged);

chrome.windows.getAll({"populate" : true}, function (windows) {
    for (var i = 0; i < windows.length; i++) {
        var tabs = windows[i].tabs;
        for (var j = 0; j < tabs.length; j++) {
            chrome.tabs.executeScript(tabs[j].id, {file: "content_script.js"}, function(result) {
                if (chrome.runtime.lastError)
                    console.error ("Could not inject content in tab, %O", chrome.runtime.lastError);
                });
        }
    }
});


initActiveTab();
pollForFocusLoss();

intervalWorker = new Worker ("intervalWorker.js");
intervalWorker.onmessage = function (evt) {
    if (evt.data.type == "Timeout") {
        intervalRun();
    }
};
intervalWorker.onerror = function (evt) {
    console.error ("The worker that periodically processes active tabs has thrown an error (%s)", evt.data);
};
intervalWorker.postMessage ({type: "Start"});

nativeConnect();

