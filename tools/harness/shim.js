/* Stand-in for the chrome.* extension APIs so the extension's scripts can run inside a normal page for testing.
   window.__lensFiles holds the extension files (path -> text). Background and content run in the same page. */
(function () {
	'use strict';
	var store = {}, changed = [], msgHandlers = [];
	var files = window.__lensFiles;
	var origFetch = window.fetch;
	window.fetch = function (input) {
		var url = typeof input === 'string' ? input : input && input.url;
		if (url && url.indexOf('lens-local://') === 0) {
			var p = url.slice('lens-local://'.length);
			return Promise.resolve(new Response(files[p], { status: 200, headers: { 'Content-Type': 'application/json' } }));
		}
		return origFetch.apply(this, arguments);
	};
	function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
	window.chrome = window.chrome || {};
	window.chrome.runtime = {
		lastError: null,
		getURL: function (p) { return 'lens-local://' + p; },
		onMessage: { addListener: function (fn) { msgHandlers.push(fn); } },
		onInstalled: { addListener: function () {} },
		onStartup: { addListener: function () {} },
		sendMessage: function (msg, cb) {
			var done = false;
			msgHandlers.forEach(function (h) {
				h(clone(msg), {}, function (r) { if (!done) { done = true; setTimeout(function () { cb && cb(clone(r)); }, 0); } });
			});
		}
	};
	window.chrome.storage = {
		local: {
			get: function (keys, cb) {
				var out = {};
				[].concat(keys).forEach(function (k) { if (k in store) out[k] = clone(store[k]); });
				if (cb) setTimeout(function () { cb(out); }, 0);
				return Promise.resolve(out);
			},
			set: function (o) {
				var ch = {};
				Object.keys(o).forEach(function (k) { ch[k] = { oldValue: store[k], newValue: clone(o[k]) }; store[k] = clone(o[k]); });
				setTimeout(function () { changed.forEach(function (fn) { fn(ch, 'local'); }); }, 0);
				return Promise.resolve();
			}
		},
		onChanged: { addListener: function (fn) { changed.push(fn); } }
	};
	window.chrome.alarms = { create: function () {}, onAlarm: { addListener: function () {} } };
	window.chrome.scripting = { getRegisteredContentScripts: function () { return Promise.resolve([]); } };
	window.importScripts = function () {};
	window.__lensStore = store;
})();
