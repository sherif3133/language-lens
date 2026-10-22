/* Packages the extension for every store.
   Usage: node build-zips.js
   language-lens-<v>.zip          Chrome / Edge (and Lemur / Kiwi on Android: "Load from zip")
   language-lens-firefox-<v>.zip  Firefox on computers and Android (addons.mozilla.org)
   Firefox has no background service worker: it loads the same scripts as a background page, and needs its own id. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const src = path.join(root, 'extension');
const man = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));
// Windows' own tar writes real zip files (with forward slashes, as the stores require).
const TAR = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'bsdtar';

function pack(dir, out) {
	fs.rmSync(out, { force: true });
	// Name the top-level entries (not '.') so paths have no './' in front.
	const items = fs.readdirSync(dir).filter((f) => f !== 'test');
	execFileSync(TAR, ['-a', '-c', '-f', out, '-C', dir].concat(items), { stdio: 'inherit' });
	console.log('•', path.basename(out), Math.round(fs.statSync(out).size / 1024) + ' KB');
}

pack(src, path.join(root, 'language-lens-' + man.version + '.zip'));

const ff = path.join(os.tmpdir(), 'lens-firefox');
fs.rmSync(ff, { recursive: true, force: true });
fs.cpSync(src, ff, { recursive: true });
const fm = JSON.parse(JSON.stringify(man));
delete fm.minimum_chrome_version;
fm.background = { scripts: ['core/lens-core.js', 'lib/compromise.js', 'core/grammar.js', 'core/pron.js', 'background.js'] };
// 128: the first Firefox that runs content scripts in the page's own world (content/yt-main.js).
fm.browser_specific_settings = {
	gecko: { id: 'language-lens@sawaenglish.com', strict_min_version: '128.0', data_collection_permissions: { required: ['authenticationInfo', 'websiteActivity'] } },
	gecko_android: { strict_min_version: '128.0' }
};
fs.writeFileSync(path.join(ff, 'manifest.json'), JSON.stringify(fm, null, '\t') + '\n');
pack(ff, path.join(root, 'language-lens-firefox-' + man.version + '.zip'));
