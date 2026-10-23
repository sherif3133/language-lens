/* Language Lens — word marks: the one place that decides how word states look (YouTube captions, transcript, websites, popup legend).
   Four states that differ by SHAPE as well as colour, so they read in colour-blind vision, in grey, over video and on light pages:
     learning      = yellow fill (dark text)
     new for you   = solid underline, blue      (the "next" level)
     hard or rare  = dotted underline, orange
     phrase        = double underline, pink    ("give up": one meaning together)
   Known words have no mark. Colours: Okabe–Ito (colour-blind safe). Contrast of the underline against the background
   (WCAG 1.4.11, 3:1 for graphics): dark/video ≥ 4.9:1, light ≥ 5.1:1, websites (any background) ≥ 3:1 on white and on black.
   Text on the yellow fill: #0F0F10 = 15:1. */
(function () {
	'use strict';
	var P = {
		dark: { next: '#56B4E9', hard: '#E69F00', ex: '#CC79A7' }, // on the caption box over video
		light: { next: '#0072B2', hard: '#C2410C', ex: '#A23B72' }, // transcript, popup
		any: { next: '#2B8CD6', hard: '#D97706', ex: '#C04F93' } // websites: light or dark pages
	};
	var FILL = '#FDE68A', INK = '#0F0F10';
	var LABELS = {
		learning: ['Learning', 'In your Review'],
		next: ['New for you', 'Worth learning now'],
		hard: ['Hard or rare', 'Skip it if you are busy'],
		ex: ['Phrase', 'One meaning together']
	};

	function ul(style, w, c) { return 'text-decoration:underline ' + style + ' ' + w + 'px ' + c + ';text-decoration-skip-ink:none;'; }

	/** CSS for .wd spans inside a shadow root whose host has .colors (all marks on) and .cnew (new/hard marks on). */
	function css(theme, w) {
		var c = P[theme] || P.light, off = 'text-underline-offset:' + (w + 2) + 'px;';
		return ':host(.colors) .wd.learning{background:' + FILL + ';color:' + INK + ';box-shadow:0 0 0 ' + (w - 1) + 'px ' + FILL + '}' +
			':host(.cnew) .wd.next{' + ul('solid', w, c.next) + off + '}' +
			':host(.cnew) .wd.hard{' + ul('dotted', w, c.hard) + off + '}' +
			// Phrases have their own switch (popup → "Highlight phrases & idioms"), so they show without .colors too.
			'.wd.ex,:host(.cnew) .wd.ex.next,:host(.cnew) .wd.ex.hard{' + ul('double', w, c.ex) + off + '}';
	}

	/** Small samples for a legend: <i class="mk next">word</i>. */
	function legendCss(theme) {
		var c = P[theme] || P.light;
		return '.mk{font-style:normal;font-weight:700;padding:0 3px;border-radius:3px;text-underline-offset:4px}' +
			'.mk.learning{background:' + FILL + ';color:' + INK + '}' +
			'.mk.next{' + ul('solid', 2, c.next) + '}.mk.hard{' + ul('dotted', 2, c.hard) + '}.mk.ex{' + ul('double', 2, c.ex) + '}';
	}

	function legendHtml(short) {
		return ['learning', 'next', 'hard', 'ex'].map(function (k) {
			return '<span title="' + LABELS[k][1] + '"><i class="mk ' + k + '">' + (k === 'ex' ? 'give up' : 'word') + '</i> ' + LABELS[k][0] + (short ? '' : ' · ' + LABELS[k][1]) + '</span>';
		}).join('');
	}

	/** Websites: CSS Custom Highlights (they allow colour, background and text-decoration only). */
	function highlightCss() {
		var c = P.any;
		return '::highlight(lens-learning){background-color:' + FILL + ';color:' + INK + '}' +
			'::highlight(lens-next){' + ul('solid', 2, c.next) + '}' +
			'::highlight(lens-hard){' + ul('dotted', 2, c.hard) + '}' +
			'::highlight(lens-expr),::highlight(lens-exul){' + ul('double', 2, c.ex) + '}';
	}

	var api = { P: P, FILL: FILL, LABELS: LABELS, css: css, legendCss: legendCss, legendHtml: legendHtml, highlightCss: highlightCss };
	if (typeof window !== 'undefined') window.LensMarks = api;
	if (typeof module !== 'undefined') module.exports = api;
})();
