/* Draws the Language Lens icon (ink tile, white lens) as PNGs without any image library. */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
	let c, crc = 0xffffffff;
	for (let n = 0; n < buf.length; n++) {
		c = (crc ^ buf[n]) & 0xff;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		crc = (crc >>> 8) ^ c;
	}
	return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const td = Buffer.concat([Buffer.from(type), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(td));
	return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
	const raw = Buffer.alloc((size * 4 + 1) * size);
	for (let y = 0; y < size; y++) {
		raw[y * (size * 4 + 1)] = 0;
		for (let x = 0; x < size; x++) {
			// 4x4 supersampling for smooth edges
			let r = 0, g = 0, b = 0, a = 0;
			for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
				const p = pixel((x + (sx + 0.5) / 4) / size, (y + (sy + 0.5) / 4) / size);
				r += p[0] * p[3]; g += p[1] * p[3]; b += p[2] * p[3]; a += p[3];
			}
			const o = y * (size * 4 + 1) + 1 + x * 4;
			raw[o] = a ? Math.round(r / a) : 0;
			raw[o + 1] = a ? Math.round(g / a) : 0;
			raw[o + 2] = a ? Math.round(b / a) : 0;
			raw[o + 3] = Math.round((a / 16) * 255);
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
	return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const INK = [15, 15, 16, 1], WHITE = [255, 255, 255, 1], RED = [227, 38, 43, 1], NONE = [0, 0, 0, 0];
function icon(u, v) {
	// rounded square tile
	const r = 0.2, dx = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0), dy = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0);
	if (Math.hypot(dx, dy) > r) return NONE;
	// lens ring centred slightly up-left, handle to bottom-right
	const cx = 0.44, cy = 0.44, d = Math.hypot(u - cx, v - cy);
	if (d > 0.2 && d < 0.29) return WHITE;
	// handle: thick segment along the diagonal
	const t = ((u - cx) + (v - cy)) / 2;
	const perp = Math.abs((u - cx) - (v - cy)) / Math.SQRT2;
	if (t > 0.2 && t < 0.33 && perp < 0.055) return WHITE;
	// the one red element: a dot inside the lens
	if (d < 0.07) return RED;
	return INK;
}

const dir = path.join(__dirname, '../extension/icons');
fs.mkdirSync(dir, { recursive: true });
for (const s of [16, 32, 48, 128]) fs.writeFileSync(path.join(dir, s + '.png'), png(s, icon));
console.log('icons written');
