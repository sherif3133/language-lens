/* Test helper: serves the extension folder plus helper.html on http://127.0.0.1:9420 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../../extension');
const helper = path.join(__dirname, 'helper.html');
const shim = path.join(__dirname, 'shim.js');
http.createServer((req, res) => {
	const u = decodeURIComponent(req.url.split('?')[0]);
	const file = u === '/helper.html' ? helper : u === '/shim.js' ? shim : path.join(root, u);
	if (!file.startsWith(root) && file !== helper && file !== shim) return res.writeHead(403).end();
	fs.readFile(file, (err, data) => {
		if (err) return res.writeHead(404).end();
		res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html' : file.endsWith('.json') ? 'application/json' : 'text/javascript', 'Access-Control-Allow-Origin': '*' });
		res.end(data);
	});
}).listen(9420, '127.0.0.1', () => console.log('harness on 9420'));
