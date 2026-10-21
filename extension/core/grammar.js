/* Language Lens grammar focus: finds tenses and structures in text so learners can notice them.
   Uses compromise (MIT) for tagging. Runs in the service worker; returns character spans per text.
   Each span: { start, end, label } where label is a short Arabic name shown on hover. */
(function (g) {
	'use strict';

	/** The structures a learner can focus on: key -> [Arabic name, short rule]. */
	var FOCUS = {
		verbs: ['كل الأفعال', 'مرّر على أي فعل لترى تصريفاته الثلاثة.'],
		past: ['الماضي البسيط', 'الفعل + ed، أو التصريف الثاني للأفعال الشاذة: walked · went.'],
		present: ['المضارع البسيط', 'الفعل كما هو، ونضيف s مع he / she / it: I work · she works.'],
		future: ['المستقبل', 'will + الفعل، أو am / is / are going to + الفعل.'],
		continuous: ['الأزمنة المستمرة', 'am / is / are / was / were + الفعل‑ing: is running · was running.'],
		perfect: ['الأزمنة التامة', 'have / has / had + التصريف الثالث: has lived · had known.'],
		passive: ['المبني للمجهول', 'be + التصريف الثالث: was built · is made.'],
		modal: ['الأفعال الناقصة', 'can · could · should · must · might · may · would + الفعل.'],
		conditional: ['الجمل الشرطية', 'if + شرط، ثم النتيجة. صفري: present + present · أول: present + will · ثانٍ: past + would · ثالث: had + would have.'],
		relative: ['جمل الوصل', 'who للأشخاص · which للأشياء · that للاثنين · whose للملكية · where للمكان.'],
		pronouns: ['الضمائر', 'I · you · he · she · it · we · they، و me · him · her · us · them، و my · your · his …'],
		adjectives: ['الصفات', 'تصف الاسم وتأتي قبله غالبًا: a big house · the house is big.'],
		comparatives: ['المقارنة والتفضيل', 'الصفة + er / more، والصفة + est / most: bigger · the biggest · more useful.'],
		phrasal: ['الأفعال المركّبة', 'فعل + حرف يغيّر المعنى: give up · look after · find out.']
	};

	var FORM_LABEL = {
		'simple-past': 'الماضي البسيط', 'simple-present': 'المضارع البسيط', 'simple-future': 'المستقبل (will)', 'auxiliary-future': 'المستقبل (going to)',
		'present-progressive': 'المضارع المستمر', 'past-progressive': 'الماضي المستمر', 'future-progressive': 'المستقبل المستمر',
		'present-perfect': 'المضارع التام', 'past-perfect': 'الماضي التام', 'future-perfect': 'المستقبل التام',
		'present-perfect-progressive': 'المضارع التام المستمر', 'past-perfect-progressive': 'الماضي التام المستمر',
		'passive-past': 'المبني للمجهول (ماضٍ)', 'passive-present': 'المبني للمجهول (مضارع)', 'passive-future': 'المبني للمجهول (مستقبل)'
	};
	var MODALS = /^(can|could|should|must|might|may|would|shall|ought|can't|couldn't|shouldn't|mustn't|wouldn't|won't|cannot)\b/i;

	function nlp() {
		return g.nlp;
	}

	/** Trim a span to its letters (compromise offsets include trailing punctuation). */
	function span(text, start, length, label) {
		var end = start + length;
		while (end > start && !/[A-Za-z0-9']/.test(text[end - 1])) end--;
		while (start < end && !/[A-Za-z0-9']/.test(text[start])) start++;
		// Offsets can be one character off: snap to whole words.
		while (end < text.length && /[A-Za-z0-9']/.test(text[end])) end++;
		while (start > 0 && /[A-Za-z0-9']/.test(text[start - 1])) start--;
		return end > start ? { start: start, end: end, label: label } : null;
	}

	function verbSpans(text, keep) {
		var out = [];
		nlp()(text).verbs().json({ offset: true }).forEach(function (v) {
			var gr = (v.verb && v.verb.grammar) || {}, form = gr.form || '';
			var isModal = MODALS.test(v.text.trim());
			var label = isModal ? 'فعل ناقص (modal)' : FORM_LABEL[form] || (gr.tense === 'PastTense' ? 'زمن ماضٍ' : gr.tense === 'FutureTense' ? 'المستقبل' : 'فعل');
			if (keep(form, gr, isModal)) {
				var s = span(text, v.offset.start, v.offset.length, label);
				if (s) out.push(s);
			}
		});
		return out;
	}

	function matchSpans(text, pattern, label) {
		var out = [];
		nlp()(text).match(pattern).json({ offset: true }).forEach(function (m) {
			var s = span(text, m.offset.start, m.offset.length, label);
			if (s) out.push(s);
		});
		return out;
	}

	/** If-clauses (and the result clause), with the conditional type when the tenses show it. */
	function conditionals(text) {
		var out = [];
		var re = /\b(if|unless)\b/gi, m;
		while ((m = re.exec(text))) {
			var start = m.index;
			// The sentence the "if" belongs to.
			var sEnd = text.slice(start).search(/[.!?](\s|$)/);
			var end = sEnd < 0 ? text.length : start + sEnd;
			var sStart = Math.max(text.lastIndexOf('. ', start), text.lastIndexOf('? ', start), text.lastIndexOf('! ', start));
			sStart = sStart < 0 ? 0 : sStart + 2;
			var sentence = text.slice(sStart, end).toLowerCase();
			var type = 'جملة شرطية';
			if (/\bhad\b[^,]*,?.*\bwould(n't)? have\b|\bwould(n't)? have\b.*\bif\b[^,]*\bhad\b/.test(sentence)) type = 'شرطية – النوع الثالث (had + would have)';
			else if (/\bwould(n't)?\b|\b(could|might)\b/.test(sentence) && /\bif\b\s+\w+\s+(were|was|had|did|\w+ed)\b/.test(sentence)) type = 'شرطية – النوع الثاني (past + would)';
			else if (/\bwill\b|'ll\b|\bwon't\b|\bgoing to\b/.test(sentence)) type = 'شرطية – النوع الأول (present + will)';
			else if (!/\bwould\b/.test(sentence)) type = 'شرطية – النوع الصفري (present + present)';
			var sp = span(text, sStart, end - sStart, type);
			if (sp) out.push(sp);
			re.lastIndex = end;
		}
		return out;
	}

	/** who / which / whose / whom / where after a noun, and "that" after a noun followed by a clause. */
	function relatives(text) {
		var out = [];
		var doc = nlp()(text);
		var verbs = doc.verbs().json({ offset: true }).map(function (v) { return v.offset.start; });
		var m = doc.match('#Noun [(who|whom|whose|which|where|that)] (#Determiner|#Pronoun|#Verb|#Adverb|#Noun|#Adjective)', 0);
		m.json({ offset: true }).forEach(function (r) {
			var start = r.offset.start;
			// Up to the next comma or sentence end, at most ~10 words…
			var rest = text.slice(start);
			var stop = rest.search(/[,;.!?]/);
			var words = rest.split(/\s+/).slice(0, 10).join(' ').length;
			var len = Math.min(stop < 0 ? rest.length : stop, words);
			// …and before the main verb: "the book [that I bought] is better".
			var after = verbs.filter(function (v) { return v > start; });
			if (after.length >= 2 && after[1] - start < len) len = after[1] - start;
			var label = { who: 'جملة وصل (who: للأشخاص)', whom: 'جملة وصل (whom)', whose: 'جملة وصل (whose: للملكية)', which: 'جملة وصل (which: للأشياء)', where: 'جملة وصل (where: للمكان)', that: 'جملة وصل (that)' }[r.text.trim().toLowerCase()] || 'جملة وصل';
			var s = span(text, start, len, label);
			if (s) out.push(s);
		});
		return out;
	}

	function find(text, focus) {
		switch (focus) {
			case 'verbs': return verbSpans(text, function () { return true; });
			case 'past': return verbSpans(text, function (f, gr, modal) { return !modal && f === 'simple-past'; });
			case 'present': return verbSpans(text, function (f, gr, modal) { return !modal && f === 'simple-present'; });
			case 'future': return verbSpans(text, function (f, gr) { return /future/.test(f) || gr.tense === 'FutureTense'; });
			case 'continuous': return verbSpans(text, function (f, gr) { return /progressive/.test(f) || gr.progressive === true; });
			case 'perfect': return verbSpans(text, function (f) { return /perfect/.test(f); });
			case 'passive': return verbSpans(text, function (f, gr) { return /passive/.test(f) || gr.passive === true; });
			case 'modal': return verbSpans(text, function (f, gr, modal) { return modal; });
			case 'conditional': return conditionals(text);
			case 'relative': return relatives(text);
			case 'pronouns': return matchSpans(text, '#Pronoun', 'ضمير');
			case 'adjectives': return matchSpans(text, '#Adjective', 'صفة');
			case 'comparatives': return matchSpans(text, '(#Comparative|#Superlative|more #Adjective|most #Adjective|less #Adjective|least #Adjective|as #Adjective as)', 'مقارنة / تفضيل');
			case 'phrasal': return matchSpans(text, '#PhrasalVerb+', 'فعل مركّب');
		}
		return [];
	}

	/** Spans for every text; texts are analysed one by one so offsets stay per text. */
	function grammar(texts, focus) {
		if (!FOCUS[focus] || !nlp()) return { spans: texts.map(function () { return []; }), count: 0 };
		var count = 0;
		var spans = texts.map(function (t) {
			try {
				var s = find(t, focus);
				count += s.length;
				return s;
			} catch (e) {
				return [];
			}
		});
		return { spans: spans, count: count, name: FOCUS[focus][0], rule: FOCUS[focus][1] };
	}

	/** Base, past and past participle (+ -ing, -s) of a verb; irregular when the past isn't -ed. */
	function verbForms(lemma) {
		if (!nlp() || !lemma || /\s/.test(lemma) && !/^\w+ \w+$/.test(lemma)) return null;
		var parts = lemma.split(' '), head = parts[0], rest = parts.slice(1).join(' ');
		var c = nlp()(head).verbs().conjugate()[0];
		if (!c || !c.PastTense) return null;
		var add = function (w) { return rest ? w + ' ' + rest : w; };
		var past = c.PastTense, pp = c.Participle || c.PastTense;
		return {
			base: add(c.Infinitive || head),
			past: add(past),
			pp: add(pp),
			ing: add(c.Gerund ? c.Gerund.replace(/^is /, '') : ''),
			s: add(c.PresentTense || ''),
			irregular: !/ed$/.test(past) || (pp !== past)
		};
	}

	g.LensGrammar = { FOCUS: FOCUS, grammar: grammar, verbForms: verbForms };
})(typeof globalThis !== 'undefined' ? globalThis : self);
