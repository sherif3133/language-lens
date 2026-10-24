/* Language Lens on YouTube.
   - Caption box on the video: hoverable, colour-coded words, a translation line (YouTube's own auto-translate),
     optional blur until hovered, and a grip to move it up or down.
   - Transcript sidebar on the right: full sentences with timestamps and translations; click to play,
     ↻ to play one sentence, "Sounds" for how it's said in fast speech.
   - Focus: highlight a grammar or pronunciation feature everywhere, and jump between examples.
   - Hotkeys: A previous sentence · S repeat · D next · Q auto-pause after each sentence.
   - Vocabulary goal bar (top 1k / 2k / 3k words) at the top of the sidebar.
   Colours (content/marks.js): known = plain · learning = yellow fill · new for you = solid blue underline · hard or rare = dotted orange underline · phrase = double pink underline. */
(function () {
	'use strict';
	if (window.__sawaLensYT) return;
	window.__sawaLensYT = true;
	var U = window.LensUI, Card = window.LensCard;
	// Phones: YouTube's phone site has the player fixed on top and the page scrolling under it,
	// so the controls and transcript go under the player. No mouse: tap a word instead of hovering it.
	var MOBILE = location.hostname === 'm.youtube.com';
	var TOUCH = !!(window.matchMedia && matchMedia('(hover: none)').matches);

	var FONT = '"IBM Plex Sans","IBM Plex Sans Arabic","Segoe UI",system-ui,sans-serif';
	var AR = '"IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif';
	var CSS = '' +
		'.line.slg{font-size:.62em;font-weight:500;color:#FDE68A;text-align:left;max-width:100%}.line.slg:empty{display:none}.line.slg b{color:#fff}.line.slg[dir=rtl]{text-align:right}' +
		':host{all:initial}*{box-sizing:border-box}:host(.gaming) .bar{visibility:hidden}' + // 🎮 no spoilers during the lyrics game
		'.bar{position:absolute;left:50%;transform:translateX(-50%);bottom:var(--pos,12%);z-index:60;max-width:min(94%,1000px);width:max-content;pointer-events:auto;' +
		'font:600 clamp(16px,2.2vw,26px)/1.45 ' + FONT + ';color:#fff;text-align:center;display:flex;align-items:center;gap:6px}' +
		'.grip{flex:none;align-self:stretch;display:flex;align-items:center;cursor:ns-resize;color:rgba(255,255,255,.55);font-size:16px;padding:0 4px;opacity:0;transition:opacity .15s;user-select:none}' +
		'.bar:hover .grip{opacity:1}.grip:hover{color:#fff}' +
		'.box{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}' +
		'.line{background:rgba(15,15,16,.86);border-radius:10px;padding:5px 14px;display:inline-block;user-select:text;transition:filter .15s}' +
		'.line:empty{display:none}' +
		'.tr{font:500 clamp(14px,1.8vw,21px)/1.5 ' + AR + ';direction:rtl;color:#E6E3DF}' +
		':host(.blur-en) .line.en{filter:blur(7px)}:host(.blur-en) .line.en:hover{filter:none}' +
		':host(.blur-tr) .line.tr{filter:blur(6px);pointer-events:auto;cursor:pointer}:host(.blur-tr) .line.tr:hover,:host(.blur-tr) .line.tr.peek{filter:none}' +
		':host(.no-en) .line.en{display:none}:host(.no-tr) .line.tr{display:none}.line.snd{font-size:.7em;color:#FDE68A;letter-spacing:.02em;cursor:help;pointer-events:auto}.line.snd:empty{display:none}:host(.no-snd) .line.snd{display:none}.box{position:relative}.sndtip{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);width:min(520px,90vw);background:#fff;color:#0F0F10;border-radius:12px;padding:10px 14px;font:500 14px/1.45 ' + FONT + ';text-align:left;display:none;box-shadow:0 8px 24px rgba(0,0,0,.3);pointer-events:auto}.sndtip.on{display:block}.sndtip ul{margin:6px 0 0;padding-left:18px}.lensmenu{position:absolute;right:12px;bottom:60px;width:270px;background:rgba(15,15,16,.94);color:#fff;border-radius:12px;padding:10px;display:none;flex-direction:column;gap:6px;pointer-events:auto;font:500 13px/1.3 ' + FONT + '}.lensmenu.on{display:flex}.lensmenu .lmpage{display:flex;flex-direction:column;gap:6px}.lensmenu .lmpage[hidden]{display:none}.lensmenu .menu label[data-tip]{padding-right:0}.lensmenu .more span{opacity:.6}.lensmenu label.pin{background:#202531;border-radius:8px;padding:6px 8px;font-weight:600}.lensmenu select{background:#0e1016;color:#fff;border:1px solid #444;border-radius:6px;padding:4px 6px;font:inherit;margin-left:6px;max-width:130px}.opts label.pin{font-weight:600}.lensmenu .go{background:#22C55E;color:#04210F;border-radius:8px;padding:5px 10px;font-weight:700}.lensmenu .menu label>.tipi{order:3}.lensmenu{max-height:calc(100% - 72px);overflow-y:auto;overscroll-behavior:contain}.lensmenu .lmmusic{display:flex;flex-direction:column;gap:6px}.lensmenu .lmmusic[hidden],.lensmenu a.gen[hidden]{display:none}.lensmenu a.t{text-decoration:none;box-sizing:border-box}.lensmenu .t{display:flex;justify-content:space-between;align-items:center;width:100%;border-radius:8px;text-align:left}.lensmenu .lmh{font:700 11px/1 ' + FONT + ';letter-spacing:.06em;text-transform:uppercase;color:#FDE68A;margin-top:4px}.lensmenu .menu{position:static;display:block;background:transparent;color:#fff;padding:0;min-width:0}.lensmenu .menu label{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:6px 2px;min-height:36px;cursor:pointer}.lensmenu input[type=checkbox]{-webkit-appearance:none;appearance:none;order:2;margin:0 0 0 auto;flex:none;width:36px;height:20px;border-radius:99px;background:#8A8584;position:relative;cursor:pointer;transition:background .15s}.lensmenu input[type=checkbox]::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s;box-shadow:0 1px 2px rgba(0,0,0,.3)}.lensmenu input[type=checkbox]:checked{background:#22C55E}.lensmenu input[type=checkbox]:checked::after{transform:translateX(16px)}.lensmenu input[type=checkbox]:focus-visible{outline:2px solid #FDE68A;outline-offset:2px}' +
		'.wd{cursor:pointer;border-radius:4px;padding:0 1px}' +
		'.wd:hover{background:#fff;color:#0F0F10;text-decoration:none}' +
		LensMarks.css('dark', 3) +
		'.fx{background:rgba(167,139,250,.55);box-shadow:0 0 0 2px rgba(167,139,250,.55);border-radius:4px}' +
		'.tools{position:absolute;left:50%;transform:translateX(-50%);top:100%;margin-top:6px;display:flex;justify-content:center;gap:5px;opacity:0;transition:opacity .15s;white-space:nowrap}' +
		'.bar:hover .tools,.tools:hover{opacity:1}' +
		'.t{font:600 12.5px/1 ' + FONT + ';background:rgba(15,15,16,.9);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:7px 11px;cursor:pointer}' +
		'.t:hover{border-color:#fff}.t.on{background:#fff;color:#0F0F10}.t[disabled]{opacity:.6;cursor:default}.t kbd{font:600 10.5px/1 ' + FONT + ';opacity:.6;margin-left:4px}' +
		'.menu{position:absolute;bottom:calc(100% + 8px);right:0;background:#fff;color:#0F0F10;border-radius:12px;padding:8px;font:500 13.5px/1.4 ' + FONT + ';text-align:left;display:none;min-width:220px;pointer-events:auto}' +
		'.menu.on{display:block}.menu label{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 8px;min-height:36px;border-radius:8px;cursor:pointer}.menu input[type=checkbox]{-webkit-appearance:none;appearance:none;order:2;margin:0 0 0 auto;flex:none;width:36px;height:20px;border-radius:99px;background:#8A8584;position:relative;cursor:pointer;transition:background .15s}.menu input[type=checkbox]::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s;box-shadow:0 1px 2px rgba(0,0,0,.3)}.menu input[type=checkbox]:checked{background:#22C55E}.menu input[type=checkbox]:checked::after{transform:translateX(16px)}.menu input[type=checkbox]:focus-visible{outline:2px solid #FDE68A;outline-offset:2px}.menu label:hover{background:#F6F5F3}' +
		'.chip{position:absolute;top:12px;right:12px;z-index:61;font:600 13px/1 ' + FONT + ';background:#0F0F10;color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:8px 12px;cursor:pointer;pointer-events:auto}' +
		'.chip b{font:800 14px/1 Changa,sans-serif;margin:0 4px}' +
		'.chip .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#fff;margin-right:6px;vertical-align:1px}' +
		'.chip.hard .dot,.chip.too-hard .dot{background:#E3262B}' +
		'.advb{position:absolute;top:12px;left:12px;z-index:61;font:600 12.5px/1 ' + FONT + ';background:#E3262B;color:#fff;border-radius:999px;padding:8px 12px;pointer-events:auto;cursor:default}' +
		'.quiz{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:64;width:min(460px,calc(100% - 32px));max-height:calc(100% - 40px);overflow:auto;background:#fff;color:#0F0F10;border-radius:14px;padding:18px;pointer-events:auto;font:15px/1.5 ' + FONT + ';box-shadow:0 12px 40px rgba(0,0,0,.35);text-align:left}' +
		'.quiz .qh{font-size:12px;color:#8A8584;font-weight:600;margin-bottom:6px}.quiz .qq{font-size:18px;font-weight:600;margin:0 0 12px}.quiz .qq u{text-decoration:none;border-bottom:2px solid #0F0F10;padding:0 22px}' +
		'.quiz .qo{display:grid;gap:8px}.quiz .qo button{text-align:left;border:1px solid #E6E3DF;background:#fff;border-radius:10px;padding:10px 12px;font:inherit;font-size:16px;cursor:pointer;color:#0F0F10}.quiz .qo button:hover{border-color:#0F0F10}' +
		'.quiz .qo button.r{border-color:#15803D;background:#E7F5EC;color:#15803D;font-weight:600}.quiz .qo button.w{border-color:#E3262B;background:#FDECEC;color:#E3262B}' +
		'.quiz input{width:100%;box-sizing:border-box;border:1px solid #E6E3DF;border-radius:10px;padding:10px 12px;font:inherit;font-size:16px}' +
		'.quiz .fb{margin-top:10px;border-radius:10px;padding:10px 12px}.quiz .fb.ok{background:#E7F5EC}.quiz .fb.no{background:#FDECEC}.quiz .fb p{margin:4px 0 0}.quiz .ar{direction:rtl;text-align:right}' +
		'.quiz .qa{display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap}.quiz .go{border:0;background:#0F0F10;color:#fff;border-radius:999px;padding:9px 18px;font:inherit;font-weight:600;cursor:pointer}.quiz .lk{border:0;background:none;padding:0;font:inherit;font-size:13px;text-decoration:underline;cursor:pointer;color:#4A4847}' +
		'.panel{position:absolute;top:52px;right:12px;z-index:62;width:300px;max-height:calc(100% - 140px);overflow:auto;background:#fff;color:#0F0F10;border-radius:12px;' +
		'font:14px/1.5 ' + FONT + ';text-align:left;padding:14px;display:none;pointer-events:auto}' +
		'.panel.on{display:block}' +
		'.panel h3{font:800 17px/1.3 Changa,sans-serif;margin:0 0 4px}' +
		'.panel .sub{color:#8A8584;font-size:12.5px;margin-bottom:10px}' +
		'.panel ul{list-style:none;margin:0;padding:0}' +
		'.panel li{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 0;border-top:1px solid #E6E3DF}' +
		'.panel .en{font-weight:600}.panel .ar{color:#4A4847;font-size:13px;direction:rtl;text-align:left;font-family:' + AR + '}' +
		'.panel .lv{font-size:11px;border:1px solid #E6E3DF;border-radius:5px;padding:1px 5px;margin-left:6px}' +
		'.panel .k{font:600 12px/1 ' + FONT + ';border:1px solid #E6E3DF;background:#fff;border-radius:999px;padding:6px 9px;cursor:pointer;white-space:nowrap}' +
		'.panel .k:hover{border-color:#0F0F10}' +
		'.msg{position:absolute;left:50%;transform:translateX(-50%);top:14%;z-index:63;font:600 14px/1.4 ' + FONT + ';background:rgba(15,15,16,.9);color:#fff;border-radius:10px;padding:8px 14px;pointer-events:none}' +
		':host(.mob) .bar{font-size:15px;max-width:96%;bottom:var(--pos,8%)}:host(.mob) .tr{font-size:13px}:host(.mob) .line{padding:3px 10px;border-radius:8px}' +
		':host(.mob) .grip,:host(.mob) .chip,:host(.mob) .advb,:host(.mob) .panel,:host(.mob) .lensmenu{display:none!important}:host(.mob) .msg{font-size:13px;max-width:90%;text-align:center}' +
		':host(.mob) .quiz{position:fixed;left:0;right:0;top:auto;bottom:0;transform:none;width:100%;max-height:70vh;border-radius:16px 16px 0 0;padding-bottom:calc(18px + env(safe-area-inset-bottom))}';

	var MUSIC_CSS = '.slgs{font-size:12.5px;line-height:1.5;color:#57534E;background:#FFFBEB;border-radius:6px;padding:4px 8px;margin-top:4px}.slgs[dir=rtl]{text-align:right}.slgs b{color:#0F0F10}' + '.music{margin:8px 10px;padding:8px 10px;border:1px solid #E6E3DF;border-radius:10px;background:#FFFBEB;font-size:13px}.music .mh{font:700 11px/1 ' + FONT + ';letter-spacing:.06em;text-transform:uppercase;color:#8A6D00;margin-bottom:6px}' +
		'.music .mr{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;justify-content:space-between;margin-top:4px}.music a{color:#0F0F10;font-weight:600}.ib2{font:600 12px/1 ' + FONT + ';border:1px solid #E6E3DF;background:#fff;border-radius:999px;padding:5px 8px;cursor:pointer;margin-left:4px}.ib2.on{background:#0F0F10;color:#fff;border-color:#0F0F10}.snd.lyr{background:#FFFBEB}';
	var SIDE_CSS = '' +
		':host{all:initial;display:block;margin-bottom:16px}*{box-sizing:border-box}' +
		'.side{font:14px/1.55 ' + FONT + ';color:#0F0F10;background:#fff;border:1px solid #E6E3DF;border-radius:12px;overflow:hidden}' +
		'.head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:#0F0F10;color:#fff}' +
		'.ttl{font:800 15px/1 Changa,' + FONT + ';display:flex;align-items:center;gap:8px}' +
		'.ttl small{font:600 12px/1 ' + FONT + ';color:#8A8584}' +
		'.hb{display:flex;gap:4px}' +
		'.ib{font:600 12px/1 ' + FONT + ';background:transparent;color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:6px 10px;cursor:pointer}' +
		'.ib:hover{border-color:#fff}.ib.on{background:#fff;color:#0F0F10;border-color:#fff}' +
		'.goal{padding:9px 12px;border-bottom:1px solid #E6E3DF;font-size:12.5px;color:#4A4847}' +
		'.goal .gl{display:flex;justify-content:space-between;gap:8px}.goal b{color:#0F0F10}' +
		'.gbar{position:relative;height:8px;border-radius:99px;background:#EFEDEA;overflow:hidden;margin-top:5px}.gbar i{position:absolute;left:0;top:0;bottom:0;background:#0F0F10}.gbar i.lr{background:#FDE68A}' +
		'.goal a{color:#0F0F10;font-weight:600}' +
		'.adv{padding:8px 12px;border-bottom:1px solid #E6E3DF;font-size:12.5px;color:#4A4847}.adv:empty{display:none}.adv .ok{color:#15803D;font-weight:600}.adv .warn{color:#B91C1C;font-weight:600}.adv a{color:#0F0F10;font-weight:600;cursor:pointer;text-decoration:underline}.adv ul{list-style:none;margin:6px 0 0;padding:0;max-height:160px;overflow:auto}.adv li{display:flex;gap:8px;align-items:center;padding:3px 0}.adv .lvl{font-size:11px;border-radius:4px;padding:1px 6px;font-weight:600}.lvl.mild{background:#FEF3C7}.lvl.moderate{background:#FED7AA}.lvl.strong{background:#FECACA}' +
		'.lq{padding:8px 12px;border-bottom:1px solid #E6E3DF;font-size:12.5px;color:#4A4847}.lq:empty{display:none}.lq a{color:#0F0F10;font-weight:600;cursor:pointer;text-decoration:underline}' +
		'.legend{display:flex;flex-wrap:wrap;gap:10px;padding:8px 12px;border-bottom:1px solid #E6E3DF;font-size:12px;color:#4A4847}' +
		'.legend span{display:inline-flex;align-items:center;gap:5px}' +
		'.sw{display:inline-block;width:18px;height:10px;border-radius:2px}' +
		LensMarks.legendCss('light') +
		'.focus{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #E6E3DF;font-size:12.5px}' +
		'.focus label{color:#4A4847;font-weight:600;white-space:nowrap}' +
		'.fsel{flex:1;min-width:0;font:600 13px/1.2 ' + FONT + ';border:1px solid #E6E3DF;border-radius:8px;padding:6px 8px;background:#fff;color:#0F0F10}' +
		'.fbar{display:none;padding:8px 12px;border-bottom:1px solid #E6E3DF;background:#F5F3FF;font-size:12.5px;color:#4A4847}' +
		'.fbar.on{display:block}.fbar .rule{margin-top:2px}.fbar .row{display:flex;align-items:center;justify-content:space-between;gap:8px}' +
		'.fbar b{color:#0F0F10}.fbar .sw2{display:inline-block;width:18px;height:10px;background:#EDE9FE;outline:1px solid #A78BFA;margin-right:6px}' +
		'.fnav{display:flex;gap:4px}.fnav button{font:600 12px/1 ' + FONT + ';border:1px solid #E6E3DF;background:#fff;border-radius:6px;padding:5px 9px;cursor:pointer}.fnav button:hover{border-color:#0F0F10}' +
		'.list{max-height:min(62vh,640px);overflow:auto;padding:4px 0}' +
		'.s{display:flex;gap:8px;align-items:flex-start;padding:7px 8px 7px 10px;border-left:3px solid transparent;cursor:pointer}' +
		'.s:hover{background:#F6F5F3}' +
		'.s.now{background:#F6F5F3;border-left-color:#0F0F10}' +
		'.tm{font:600 12px/1 ' + FONT + ';color:#4A4847;background:#fff;border:1px solid #E6E3DF;border-radius:6px;padding:4px 6px;cursor:pointer;flex:none;margin-top:2px;font-variant-numeric:tabular-nums}' +
		'.tm:hover{border-color:#0F0F10}' +
		'.body{flex:1;min-width:0}' +
		'.tx{font-size:15px;line-height:1.65;user-select:text}' +
		'.trs{font:13.5px/1.6 ' + AR + ';color:#4A4847;direction:rtl;text-align:left;margin-top:2px;transition:filter .15s}' +
		':host(.no-tr) .trs{display:none}:host(.blur-tr) .trs{filter:blur(5px)}:host(.blur-tr) .trs:hover,:host(.blur-tr) .trs.peek{filter:none}' +
		':host(.blur-en) .tx{filter:blur(5px)}:host(.blur-en) .s:hover .tx{filter:none}' +
		'.snd{margin-top:6px;padding:8px 10px;background:#F6F5F3;border-radius:8px;font-size:13px;color:#4A4847;cursor:auto}.snd b{color:#0F0F10}.snd .sl{font-weight:600;color:#0F0F10}.snd ul{margin:4px 0 0;padding-left:16px}.snd li{margin-top:3px}' +
		'.acts{flex:none;display:flex;flex-direction:column;gap:2px}' +
		'.rep{border:0;background:transparent;color:#8A8584;cursor:pointer;padding:3px 4px;border-radius:6px;line-height:0}' +
		'.rep:hover{color:#0F0F10;background:#fff}.rep.on{color:#fff;background:#6250d6}.rep.star{font:16px/16px Arial,sans-serif;min-width:24px;min-height:22px}.rep.star.on{background:transparent;color:#EAB308}.s.looping{box-shadow:inset 3px 0 0 #6250d6}.loopnote{margin-top:6px;font-size:12px;color:#6250d6;font-weight:600}.rep svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
		'.wd{border-radius:3px;padding:0 1px}' +
		'.wd:hover{background:#0F0F10;color:#fff;text-decoration:none}' +
		LensMarks.css('light', 2) +
		'.fx{background:#EDE9FE;box-shadow:0 0 0 1px #A78BFA;border-radius:3px}' +
		'.empty{padding:16px;color:#8A8584}' +
		'.foot{padding:8px 12px;border-top:1px solid #E6E3DF;font-size:12px;color:#8A8584}.foot kbd{font:600 11px/1 ' + FONT + ';border:1px solid #E6E3DF;border-bottom-width:2px;border-radius:4px;padding:1px 5px;color:#0F0F10}' +
		':host(.min) .legend,:host(.min) .list,:host(.min) .foot,:host(.min) .focus,:host(.min) .fbar,:host(.min) .opts{display:none!important}' +
		// Phones: the player's controls live in a row under the header, and the transcript scrolls inside the card.
		':host(.mob){margin:8px 12px 16px}:host(.mob) .list{max-height:45vh}:host(.mob) .tx{font-size:16px}' +
		'.ctl{display:flex;gap:6px;padding:8px 10px;border-bottom:1px solid #E6E3DF;overflow-x:auto;scrollbar-width:none}' +
		'.cb{flex:none;font:600 13px/1 ' + FONT + ';border:1px solid #E6E3DF;background:#fff;color:#0F0F10;border-radius:999px;padding:9px 12px;white-space:nowrap;cursor:pointer}.cb.on{background:#0F0F10;border-color:#0F0F10;color:#fff}.cb[disabled]{opacity:.6}' +
		'.opts{display:none;padding:4px 12px 8px;border-bottom:1px solid #E6E3DF;font-size:14px}.opts.on{display:block}.opts label{display:flex;gap:10px;align-items:center;padding:7px 0}.opts input{width:18px;height:18px}';

	var HOV = TOUCH ? 'tap' : 'hover';
	function trow(pref, label, tip) { return '<label data-tip="' + tip + '"><input type="checkbox" data-pref="' + pref + '"> ' + label + '</label>'; }
	var TIPSW = '<label class="pin"><input type="checkbox" data-tipsw> 💡 Show Tips</label><button class="t" data-a="tipreset" hidden>Bring back hidden tips</button>';
	var MODESEL = '<label data-tip="openmode">Open word cards with <select data-sel="ytShowOn"><option value="click">a click</option><option value="hover">hovering</option></select></label>';
	var FURTHER = trow('pauseClick', (TOUCH ? 'Pause when I tap on a word' : 'Pause when I click on a word'), 'pauseClick') + (TOUCH ? '' : trow('pauseHover', 'Pause when I hover on a word', 'pauseHover') + MODESEL) + trow('wordQuiz', 'Quiz Mode', 'quiz');
	var OPTS = TIPSW + trow('ctlBasic', 'Show Basic Controls', 'ctlb') + trow('ctlRep', 'Show Repeat / Loop / Auto-pause', 'ctlr') + trow('showEn', 'English captions', 'en') + trow('showTrans', 'Arabic translation', 'tr') + trow('showSound', 'How it sounds', 'snd') +
		trow('blurCaptions', 'Blur English until ' + HOV, 'blurEn') + trow('blurTrans', 'Blur Arabic until ' + HOV, 'blurTr') + trow('colors', 'Colour words', 'colors') + FURTHER;

	var REPEAT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4"/></svg>';
	var WAVE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 11v2"/></svg>';

	var S = { videoId: '', cues: [], lines: null, sents: [], sentToks: null, tcues: [], cueTr: null, sentTr: null, grade: null, idx: -1, sIdx: -1, host: null, root: null, side: null, sRoot: null, video: null, pausedByUs: false, raf: 0, primed: '', stopAt: 0, follow: true, scrolledAt: 0, sounds: {}, loopI: -1, savedRows: {} };
	var prefs = { lensYT: true, showEn: true, sidebar: true, colors: true, pauseOnHover: true, sideMin: false, focus: '', showTrans: true, showSound: true, blurCaptions: false, blurTrans: false, barPos: 0.12, ctlBasic: false, ctlRep: false, pauseClick: true, pauseHover: true, autoPause: false, maskSwears: false, wordQuiz: false, songLyrics: true, lyricLang: 'en' };
	var PREF_KEYS = ['lensYT', 'showEn', 'sidebar', 'lensColors', 'colorLearnOnly', 'ytShowOn', 'pauseOnHover', 'sideMin', 'focus', 'showTrans', 'showSound', 'blurCaptions', 'blurTrans', 'barPos', 'ctlShow', 'ctlBasic', 'ctlRep', 'pauseClick', 'pauseHover', 'tipsOff', 'autoPause', 'maskSwears', 'wordQuiz', 'songLyrics', 'explainLang'];
	function readPrefs(o) {
		prefs.sidebar = o.sidebar !== false;
		prefs.ctlBasic = o.ctlBasic != null ? !!o.ctlBasic : !!o.ctlShow; // ◀ ▶ next to the caption: off until the student turns them on (0.10.0 'Show controls' carries over)
		prefs.ctlRep = !!o.ctlRep; // the Repeat / Loop / Auto-pause line
		prefs.pauseClick = o.pauseClick != null ? !!o.pauseClick : o.pauseOnHover !== false;
		prefs.pauseHover = o.pauseHover != null ? !!o.pauseHover : o.pauseOnHover !== false;
		prefs.tipsOff = !!o.tipsOff;
		prefs.colors = o.lensColors !== false;
		prefs.learnOnly = !!o.colorLearnOnly; // "Learning only": no new/hard marks
		prefs.ytClick = o.ytShowOn !== 'hover'; // computer: meanings on click (default) or hover; phones always tap
		prefs.pauseOnHover = o.pauseOnHover !== false;
		prefs.sideMin = !!o.sideMin;
		prefs.focus = o.focus || '';
		prefs.showTrans = o.showTrans !== false;
		prefs.showEn = o.showEn !== false;
		prefs.lensYT = o.lensYT !== false; // the Lens on/off switch on the player bar
		prefs.showSound = o.showSound !== false;
		prefs.blurCaptions = !!o.blurCaptions;
		prefs.blurTrans = !!o.blurTrans;
		prefs.barPos = typeof o.barPos === 'number' ? o.barPos : 0.12;
		prefs.autoPause = !!o.autoPause;
		prefs.maskSwears = false; // the option was removed
		prefs.wordQuiz = o.wordQuiz === true; // Quiz Mode is off until the student turns it on (0.10.1)
		prefs.songLyrics = o.songLyrics !== false;
		prefs.lyricLang = o.explainLang === 'ar' ? 'ar' : 'en'; // the one "Explanations" setting (popup), saved with the account
	}
	chrome.storage.local.get(PREF_KEYS, function (o) {
		readPrefs(o);
		applyPrefs();
	});

	/* ------------------------------------------------------------ captions + translation from the page script */
	window.addEventListener('message', function (e) {
		if (e.source !== window || !e.data || e.data.source !== 'sawa-lens-main') return;
		var d = e.data;
		if (d.videoId !== currentVideoId()) return;
		if (d.type === 'translation') {
			S.tcues = parse(d.body, false);
			alignTranslation();
			paintSide();
			S.idx = -1;
			tick(true);
			return;
		}
		if (d.type !== 'captions') return;
		S.safety = d.safety || null;
		if (d.media) { S.media = d.media; S.mediaFor = d.videoId; }
		if (d.none) {
			S.adv = null;
			S.videoId = d.videoId;
			S.savedRows = {}; S.loopI = -1; clearTimeout(S.loopT); if (window.LensControls) LensControls.reset(); // a new video: no loop, no saved marks
			S.cues = [];
			S.sents = [];
			mount();
			paintSide();
			say('This video has no English captions.');
			maybeLyrics(d.videoId, null);
			return;
		}
		// Keep hand-made captions over auto-generated ones if both arrive.
		if (S.videoId === d.videoId && S.kind && S.kind !== 'asr' && d.kind === 'asr' && S.cues.length) return;
		var cues = parse(d.body, d.kind === 'asr');
		if (!cues.length) return;
		// 🎵 Songs: LRCLIB's lyrics are shown when found (the uploader's subtitles of music videos are often messy:
		// ♪ signs, capitals, skits); the video's own captions line their timing up, and the student can switch back.
		if (S.videoId === d.videoId && S.kind === 'lyrics') {
			if (d.kind !== 'asr' || !S.subs) S.subs = { cues: cues, kind: d.kind };
			return paintMusic();
		}
		S.subs = { cues: cues, kind: d.kind };
		useCues(d.videoId, cues, d.kind);
		if (!S.music || S.music.vid !== d.videoId) maybeLyrics(d.videoId, cues);
		else paintMusic();
	});

	/** Show these caption lines (or lyric lines) on the video and in the transcript. */
	function useCues(vid, cues, kind) {
		if (isSong()) cues = cues.map(function (c) { return { start: c.start, end: c.end, text: c.text.replace(/[♪♫]/g, ' ').replace(/\s+/g, ' ').trim(), words: c.words }; }).filter(function (c) { return c.text; });
		S.videoId = vid;
		S.cues = cues;
		S.heardSeen = {};
		S.kind = kind;
		// lyrics: one line of the song = one row
		S.sents = kind === 'lyrics' ? cues.map(function (c, ci) { return { start: c.start, end: c.end, text: c.text, parts: [{ ci: ci, co: 0, so: 0, n: c.text.length }] }; }) : sentences(cues, kind === 'asr');
		S.cueParts = window.LensCaptions.cueParts(cues.length, S.sents);
		S.sentAi = []; S.trAsked = {}; S.aiTrOff = false;
		S.sounds = {};
		S.lyrExp = {};
		S.adv = window.LensExplicit ? window.LensExplicit.scan(S.sents.map(function (x) { return x.text; })) : null;
		S.advOpen = '';
		alignTranslation();
		mount();
		S.fxCues = S.fxSents = null;
		analyse();
		runFocus();
		loadLesson(vid);
	}

	/* ------------------------------------------------------------ 🎵 Music: lyrics for songs */
	function isSong() {
		return !!(window.LensMusic && S.media && S.mediaFor === S.videoId && !S.media.live && LensMusic.isSong(S.media));
	}
	/** A song with only auto-generated captions (or none): look for its timed lyrics on LRCLIB. */
	function maybeLyrics(vid, asr) {
		if (!prefs.songLyrics || !isSong()) return paintMusic();
		S.music = { state: 'looking', vid: vid };
		paintMusic();
		LensMusic.lookup(S.media).then(function (hit) {
			if (vid !== S.videoId || !S.music || S.music.vid !== vid) return;
			if (!hit) { S.music = { state: 'none', vid: vid }; return paintMusic(); }
			var off = LensMusic.offsetFrom(hit.lines, S.subs ? S.subs.cues : asr);
			S.music = { state: 'lrclib', vid: vid, hit: hit, offset: off, auto: off };
			useCues(vid, LensMusic.cues(hit.lines, off), 'lyrics');
			paintMusic();
			translateSong();
		});
	}
	/** Switch between LRCLIB's lyrics and the video's own captions. */
	function swapLyrics() {
		var mu = S.music;
		if (!mu || mu.state !== 'lrclib') return;
		if (S.kind === 'lyrics') { if (S.subs) useCues(S.videoId, S.subs.cues, S.subs.kind); }
		else useCues(S.videoId, LensMusic.cues(mu.hit.lines, mu.offset), 'lyrics');
		paintMusic();
	}
	/* 🎵 Songs: each line translated by what it actually means, and its slang explained (literal → real meaning).
	   One request per song (/song-lines in sawa-lens, cached and shared); needs the student signed in. */
	function songKey() { return S.videoId + '|' + prefs.lyricLang; }
	function applySongTr() {
		var st = S.songTr;
		if (S.kind !== 'lyrics' || !st || !st.res || st.key !== songKey() || st.n !== S.cues.length) return false;
		S.cueTr = st.res.lines.map(function (l) { return l.ar || ''; });
		S.sentTr = S.cueTr.slice(); // lyrics: one row per line
		return true;
	}
	function slangOf(i) {
		var st = S.songTr;
		if (S.kind !== 'lyrics' || !st || !st.res || st.key !== songKey()) return null;
		var l = st.res.lines[i];
		return l && l.slang && l.slang.length ? l.slang : null;
	}
	/** Rude words: how strong they are (the meaning itself is always said politely). */
	var SEV = {
		mild: ['#FDE68A', '#0F0F10', 'mild: common, not very rude', 'خفيفة: شائعة وليست وقحة جدًا'],
		moderate: ['#FDBA74', '#0F0F10', 'rude', 'وقحة'],
		strong: ['#FCA5A5', '#0F0F10', 'very rude', 'وقحة جدًا'],
		slur: ['#DC2626', '#fff', 'slur: hurtful, never use it', 'إهانة جارحة: لا تستخدمها أبدًا']
	};
	function sevHtml(x) {
		var v = SEV[x.severity];
		if (!v) return '';
		var ar = prefs.lyricLang === 'ar';
		return ' <span style="display:inline-block;background:' + v[0] + ';color:' + v[1] + ';border-radius:99px;padding:0 7px;font-size:.9em;font-weight:600">⚠ ' + (ar ? v[3] : v[2]) + '</span>' +
			(x.context ? '<br><span style="opacity:.9">' + (ar ? 'حسب السياق: ' : 'Depends on context: ') + U.esc(x.context) + '</span>' : '');
	}
	function slangHtml(list) {
		var ar = prefs.lyricLang === 'ar';
		return list.map(function (x) {
			return '💬 <b dir="ltr">' + U.esc(x.text) + '</b>' + (x.literal ? (ar ? ' حرفيًا: ' : ': literally ') + '“' + U.esc(x.literal) + '”' : '') + (x.meaning ? ' → ' + U.esc(x.meaning) : '') + sevHtml(x);
		}).join('<br>');
	}
	function translateSong() {
		if (S.kind !== 'lyrics' || !isSong()) return;
		var key = songKey(), n = S.cues.length;
		if (S.songTr && S.songTr.key === key && S.songTr.n === n) return;
		var lines = S.cues.map(function (c) { return c.text; }), nm = LensMusic.names(S.media);
		S.songTr = { key: key, n: n, res: null };
		U.send('songLines', { song: nm.artist + ' – ' + nm.track, lines: lines, lang: prefs.lyricLang }).then(function (res) {
			if (!S.songTr || S.songTr.key !== key || !res || !res.lines || res.lines.length !== n) return;
			S.songTr.res = res;
			alignTranslation();
			paintSide();
			S.idx = -1;
			tick(true);
		}, function () { /* signed out or no AI: YouTube's translation stays */ });
	}
	/** Lyrics a little early or late: move them (ms). */
	function nudgeLyrics(ms) {
		var mu = S.music;
		if (!mu || mu.state !== 'lrclib') return;
		mu.offset += ms;
		useCues(S.videoId, LensMusic.cues(mu.hit.lines, mu.offset), 'lyrics');
		paintMusic();
		say('Lyrics ' + (mu.offset >= 0 ? '+' : '') + (mu.offset / 1000).toFixed(1) + 's');
	}
	/** The 🎵 Music bar above the transcript, and the Music part of the player menu. */
	function paintMusic() {
		var song = isSong(), vocals = !!(window.LensVocals && LensVocals.supported());
		if (S.root) {
			var sec = S.root.querySelector('.lmmusic'), gen = S.root.querySelector('.lmmusic .gen');
			if (sec) sec.hidden = !song && !vocals;
			if (gen) { gen.hidden = !song; if (song) gen.href = LensMusic.genius(S.media); }
			var gm = S.root.querySelector('.lmmusic [data-a=game]');
			if (gm) gm.hidden = !canGame();
			// ⏬ preparing songs ahead: computers that can do Vocals only
			var pp = S.root.querySelector('.lmmusic [data-a=vplist]'), pl = S.root.querySelector('.lmmusic [data-a=prepList]'), n = vocals && /[?&]list=/.test(location.search) ? LensVocals.playlist().length : 0;
			if (pp) pp.hidden = !vocals;
			if (pl) { pl.hidden = n < 2; pl.textContent = '➕ Add these ' + n + ' songs to the Voice-only playlist'; }
		}
		if (!S.sRoot) return;
		var el = S.sRoot.querySelector('.music');
		if (!el) return;
		if (!song) { el.hidden = true; el.innerHTML = ''; return; }
		var mu = S.music || {}, src;
		var other = mu.state === 'lrclib' && S.subs ? '<button class="ib2" data-a="ly-src">' + (S.kind === 'lyrics' ? (S.subs.kind === 'asr' ? 'Show YouTube’s auto captions' : 'Show the video’s subtitles') : 'Show LRCLIB lyrics') + '</button>' : '';
		if (S.kind === 'lyrics') src = 'Lyrics from LRCLIB' + (mu.offset ? ' (moved ' + (mu.offset > 0 ? '+' : '') + (mu.offset / 1000).toFixed(1) + 's to fit the video)' : '');
		else if (mu.state === 'looking') src = 'Looking for the lyrics…';
		else if (S.kind && S.kind !== 'asr') src = 'Lyrics from the video’s own subtitles';
		else if (mu.state === 'lrclib') src = 'YouTube’s auto captions';
		else if (!prefs.songLyrics) src = 'Song lyrics are off (Language Lens popup → Music)';
		else src = S.cues.length ? 'No timed lyrics found: these are YouTube’s auto captions, often wrong in songs' : 'No timed lyrics found for this song';
		var ar = prefs.lyricLang === 'ar';
		el.hidden = false;
		el.innerHTML = '<div class="mh">🎵 Music</div><div class="mr">' + U.esc(src) +
			(S.kind === 'lyrics' ? ' <span class="nud"><button class="ib2" data-a="ly-" title="Lyrics too late: show them earlier">−0.5s</button><button class="ib2" data-a="ly+" title="Lyrics too early: show them later">+0.5s</button></span>' : '') + other + '</div>' +
			(canGame() ? '<div class="mr"><button class="ib2 on" data-a="game" style="margin-left:0">🎮 Lyrics game</button><span style="color:#8A8584">fill in the missing words</span></div>' : '') +
			'<div class="mr"><a class="gen" href="' + U.esc(LensMusic.genius(S.media)) + '" target="_blank" rel="noopener">Check the lyrics on Genius ↗</a>' +
			'<span class="ll">💡 Explanations in <button class="ib2' + (ar ? '' : ' on') + '" data-a="ll-en">English</button><button class="ib2' + (ar ? ' on' : '') + '" data-a="ll-ar">عربي</button></span></div>';
	}
	/** 🎮 The lyrics game needs a song with timed lyrics (LRCLIB or the uploader's subtitles, not auto captions). */
	function canGame() {
		return !!(window.LensGame && isSong() && S.kind && S.kind !== 'asr' && S.sents.length >= 4);
	}
	function startGame() {
		if (!canGame() || !S.video) return;
		if (!S.sRoot || !S.side || !S.side.isConnected) {
			if (!prefs.sidebar) chrome.storage.local.set({ sidebar: true, sideMin: false });
			return setTimeout(function () { if (S.sRoot) startGame(); }, 600);
		}
		if (prefs.sideMin) setPref('sideMin', false);
		var menu = S.root && S.root.querySelector('.lensmenu');
		if (menu) menu.classList.remove('on');
		LensGame.start({
			root: S.sRoot, video: S.video, lines: S.sents, toks: S.sentToks, videoId: S.videoId, touch: TOUCH,
			esc: U.esc, send: U.send, errText: U.errText,
			trOf: function (i) { return S.sentTr ? S.sentTr[i] || '' : ''; }, // 🌐 the line's meaning (song translation, or YouTube's)
			onStart: function () { S.gaming = true; S.stopAt = 0; if (S.host) S.host.classList.add('gaming'); S.side.scrollIntoView({ block: MOBILE ? 'start' : 'nearest', behavior: 'smooth' }); },
			onExit: function () { S.gaming = false; if (S.host) S.host.classList.remove('gaming'); }
		});
	}
	/** One lyric line explained: meaning, slang and idioms, the line in plain English. */
	function lyricBox(r) {
		var u = U.esc;
		if (r === 'loading') return '<div class="snd lyr">Explaining…</div>';
		if (r.error) return '<div class="snd lyr" style="color:#E3262B">' + u(r.error) + '</div>';
		var ar = r.lang === 'ar', dir = ar ? ' dir="rtl" style="text-align:right;font-family:' + AR.replace(/"/g, '&quot;') + '"' : '';
		return '<div class="snd lyr"' + dir + '><div><b>' + (ar ? 'المعنى:' : 'Meaning:') + '</b> ' + u(r.meaning) + '</div>' +
			(r.parts && r.parts.length ? '<ul>' + r.parts.map(function (p) { return '<li><b dir="ltr">' + u(p.text) + '</b> · ' + u(p.why) + sevHtml(p) + '</li>'; }).join('') + '</ul>' : '') +
			(r.plain ? '<div dir="ltr" style="text-align:left"><b>In plain English:</b> ' + u(r.plain) + '</div>' : '') + '</div>';
	}

	function parse(body, asr) {
		var j;
		try {
			j = JSON.parse(body);
		} catch (e) {
			return [];
		}
		var out = [];
		(j.events || []).forEach(function (ev) {
			if (!ev.segs) return;
			var text = ev.segs.map(function (s) { return s.utf8 || ''; }).join('').replace(/\s+/g, ' ').trim();
			if (!text || /^\[[^\]]*\]$/.test(text)) return; // "[Music]"-only lines
			var start = ev.tStartMs || 0, end = start + (ev.dDurationMs || 2000);
			if (asr && out.length && ev.aAppend) return;
			var words = null;
			if (asr && ev.segs.length > 1) {
				words = ev.segs.map(function (s) { return { t: start + (s.tOffsetMs || 0), text: (s.utf8 || '').trim() }; }).filter(function (w) { return w.text; });
			}
			out.push({ start: start, end: end, text: text, words: words });
		});
		for (var i = 0; i < out.length - 1; i++) {
			if (out[i].end > out[i + 1].start) out[i].end = out[i + 1].start;
		}
		return out;
	}

	/* Full sentences from the caption pieces, and a map back from each piece: core/captions.js (LensCaptions).
	   The sentence rules (pauses, word counts, words a sentence doesn't end on) come from the server (sawa-lens /rules). */
	var SR = null;
	U.send('rules').then(function (r) { SR = (r && r.sentences) || null; }, function () {});
	function sentences(cues, asr) { return window.LensCaptions.sentences(cues, asr, SR); }
	function cueToks(i, fb) { return (S.cues[i] && window.LensCaptions.cueToks(S.cueParts && S.cueParts[i], S.sentToks, S.cues[i].text)) || fb; }
	/** Which sentence is being heard now on caption line i. */
	function sentNow(i) { return window.LensCaptions.sentenceAt(S.cueParts && S.cueParts[i], S.sents, S.video ? S.video.currentTime * 1000 : 0); }

	/**
	 * The Arabic for sentence j: the AI translation of the whole sentence (asked for in batches around the playback
	 * point, cached per sentence on the server); until it arrives, or when signed out, YouTube's own translation of
	 * the pieces joined into the whole sentence. Never one piece's translation on its own.
	 */
	function trFor(j) {
		if (j < 0) return '';
		if (S.sentAi && S.sentAi[j]) return S.sentAi[j];
		return S.sentTr ? S.sentTr[j] || '' : '';
	}
	function wantTr(j) {
		if (S.kind === 'lyrics' || S.aiTrOff || !prefs.showTrans || j < 0 || !S.sents.length) return;
		S.sentAi = S.sentAi || [];
		S.trAsked = S.trAsked || {};
		var ask = [];
		for (var k = Math.max(0, j - 1); k < Math.min(S.sents.length, j + 12) && ask.length < 12; k++) if (!S.trAsked[k]) ask.push(k);
		if (!ask.length) return;
		// Ask in batches: when the current sentence is missing, or when the next few are.
		if (ask[0] > j && ask.length < 6 && ask[ask.length - 1] !== S.sents.length - 1) return;
		var vid = S.videoId, sents = S.sents;
		ask.forEach(function (k) { S.trAsked[k] = 1; });
		U.send('sentTr', { texts: ask.map(function (k) { return sents[k].text; }) }).then(function (res) {
			if (vid !== S.videoId || sents !== S.sents) return;
			ask.forEach(function (k, n) { if (res && res[n]) { S.sentAi[k] = res[n]; paintRowTr(k); } });
			paintTr();
		}, function (err) {
			var m = String((err && err.message) || err);
			if (/signed_out|locked|limit|paused|not switched on|not active/i.test(m)) S.aiTrOff = true; // YouTube's translation stays
			else ask.forEach(function (k) { delete S.trAsked[k]; }); // try again later
		});
	}
	function paintTr() {
		if (!S.root || S.kind === 'lyrics' || S.shown == null || S.shown < 0) return;
		var tr = S.root.querySelector('.line.tr');
		var j = sentNow(S.shown);
		var t = j >= 0 ? trFor(j) : (S.cueTr ? S.cueTr[S.shown] || '' : '');
		if (tr.textContent !== t) tr.textContent = t;
	}
	function paintRowTr(k) {
		if (!S.sRoot) return;
		var body = S.sRoot.querySelector('.s[data-i="' + k + '"] .body');
		var t = trFor(k);
		if (!body || !t) return;
		var el = body.querySelector('.trs');
		if (!el) { el = document.createElement('div'); el.className = 'trs'; body.querySelector('.tx').after(el); }
		el.textContent = t;
	}

	/** Match YouTube's translated lines to our caption lines and sentences by time. */
	function alignTranslation() {
		S.cueTr = S.sentTr = null;
		if (applySongTr()) return;
		if (!S.tcues.length || !S.cues.length) return;
		S.cueTr = S.cues.map(function (c) {
			var best = '', bestOv = 0;
			S.tcues.forEach(function (t) {
				var ov = Math.min(c.end, t.end) - Math.max(c.start, t.start);
				if (ov > bestOv) { bestOv = ov; best = t.text; }
			});
			return best;
		});
		S.sentTr = S.sents.map(function (s) {
			return S.tcues.filter(function (t) { var mid = (t.start + t.end) / 2; return mid >= s.start - 200 && mid < s.end + 200; })
				.map(function (t) { return t.text; }).join(' ');
		});
	}

	function currentVideoId() {
		var m = location.search.match(/[?&]v=([\w-]{11})/);
		return m ? m[1] : '';
	}

	/* ------------------------------------------------------------ analysis */
	function analyse() {
		var vid = S.videoId;
		Promise.all([
			U.send('analyze', { texts: S.cues.map(function (c) { return c.text; }) }).then(function (x) { U.send('soundLines', { texts: S.cues.map(function (c) { return c.text; }) }).then(function (sl) { S.cueSnd = sl; }, function () {}); U.send('videoProfile', { texts: S.cues.map(function (c) { return c.text; }) }).then(function (vp) { S.vprof = vp; paintProfile(); }, function () {}); return x; }),
			U.send('analyze', { texts: S.sents.map(function (s) { return s.text; }) })
		]).then(function (r) {
			if (vid !== S.videoId) return;
			S.sentToks = r[1].lines;
			S.lines = r[0].lines.map(function (l, i) { return cueToks(i, l); }); // phrases found on the whole sentence
			S.grade = r[1].grade;
			S.level = r[1].level;
			S.gradeFrom = U.gradeSource(r[1]);
			paintChip();
			paintSide();
			paintProfile();
			S.idx = -1;
			S.sIdx = -1;
			tick(true);
		}, function (err) {
			say(U.errText(err));
		});
	}

	var reT = null;
	chrome.storage.onChanged.addListener(function (ch) {
		if ((ch.words || ch.level || ch.exprOn || ch.vocabProfile || ch.vocabTest || ch.mature || ch.levelT) && S.cues.length) {
			clearTimeout(reT);
			reT = setTimeout(analyse, 300);
		}
		if (ch.words || ch.vocabTest) paintGoal();
		if (ch.explainLang) { S.lyrExp = {}; S.cueSound = {}; S.sounds = {}; setTimeout(translateSong, 100); } // explained in the other language now
		var touched = PREF_KEYS.some(function (k) { return ch[k]; });
		if (!touched) return;
		chrome.storage.local.get(PREF_KEYS, function (o) {
			var oldFocus = prefs.focus;
			readPrefs(o);
			applyPrefs();
			if (oldFocus !== prefs.focus) runFocus();
			if (ch.maskSwears) {
				paintSide();
				S.idx = -1;
				tick(true);
			}
		});
	});

	function applyPrefs() {
		[S.host, S.side].forEach(function (h) {
			if (!h) return;
			h.classList.toggle('colors', prefs.colors);
			h.classList.toggle('cnew', prefs.colors && !prefs.learnOnly);
			h.classList.toggle('no-en', !prefs.showEn);
			h.classList.toggle('no-tr', !prefs.showTrans);
			h.classList.toggle('no-snd', !prefs.showSound);
			h.classList.toggle('blur-en', prefs.blurCaptions);
			h.classList.toggle('blur-tr', prefs.blurTrans);
		});
		if (S.host) {
			S.host.style.display = prefs.lensYT ? '' : 'none';
			if (S.host.parentNode && S.host.parentNode.classList) S.host.parentNode.classList.toggle('sawa-lens-on', prefs.lensYT);
			var lt = document.querySelector('.sawa-lens-yttoggle');
			if (lt) { lt.classList.toggle('off', !prefs.lensYT); lt.title = 'Language Lens: ' + (prefs.lensYT ? 'on' : 'off') + ' (click to turn ' + (prefs.lensYT ? 'off' : 'on') + ')'; lt.setAttribute('aria-pressed', String(prefs.lensYT)); }
			var bar = S.root.querySelector('.bar');
			bar.style.setProperty('--pos', Math.round(prefs.barPos * 1000) / 10 + '%');
			S.root.querySelectorAll('[data-pref]').forEach(function (i) { i.checked = !!prefs[i.dataset.pref]; });
			S.root.querySelectorAll('[data-tipsw]').forEach(function (i) { i.checked = !prefs.tipsOff; });
			S.host.classList.toggle('ctl-basic', prefs.ctlBasic);
			S.host.classList.toggle('ctl-rep', prefs.ctlRep);
			S.root.querySelectorAll('[data-sel=ytShowOn]').forEach(function (i) { i.value = prefs.ytClick ? 'click' : 'hover'; });
			var ap = S.root.querySelector('[data-a=autopause]');
			if (ap) ap.classList.toggle('on', prefs.autoPause);
		}
		if (S.side) {
			S.side.classList.toggle('min', prefs.sideMin);
			S.side.style.display = prefs.sidebar && prefs.lensYT ? '' : 'none';
			var cb = S.sRoot.querySelector('[data-a=colors]');
			if (cb) cb.classList.toggle('on', prefs.colors);
			S.sRoot.querySelectorAll('[data-pref]').forEach(function (i) { i.checked = !!prefs[i.dataset.pref]; });
			S.sRoot.querySelectorAll('[data-tipsw]').forEach(function (i) { i.checked = !prefs.tipsOff; });
			var sap = S.sRoot.querySelector('.ctl [data-a=autopause]');
			if (sap) sap.classList.toggle('on', prefs.autoPause);
		}
		if (prefs.sidebar && S.videoId && !S.side) mountSide();
	}

	function setPref(key, value) {
		var o = {};
		o[key] = value;
		chrome.storage.local.set(o);
	}

	/* ------------------------------------------------------------ grammar / pronunciation focus */
	function runFocus() {
		var vid = S.videoId, f = prefs.focus;
		if (!f || !S.cues.length) {
			S.fxCues = S.fxSents = null;
			S.fxInfo = null;
			paintSide();
			S.idx = -1;
			tick(true);
			return;
		}
		Promise.all([
			U.send('grammar', { texts: S.cues.map(function (c) { return c.text; }), focus: f }),
			U.send('grammar', { texts: S.sents.map(function (s) { return s.text; }), focus: f })
		]).then(function (r) {
			if (vid !== S.videoId || f !== prefs.focus) return;
			S.fxCues = r[0].spans;
			S.fxSents = r[1].spans;
			S.fxInfo = { name: r[1].name, rule: r[1].rule, ruleLang: r[1].ruleLang, count: r[1].count };
			paintSide();
			S.idx = -1;
			tick(true);
		}, function () {});
	}

	/** Jump to the previous/next sentence that has the focused feature. */
	function jumpFocus(dir) {
		if (!S.fxSents) return;
		var from = S.sIdx < 0 ? (dir > 0 ? -1 : S.sents.length) : S.sIdx;
		for (var i = from + dir; i >= 0 && i < S.sents.length; i += dir) {
			if (S.fxSents[i] && S.fxSents[i].length) {
				play(S.sents[i].start, 0);
				return;
			}
		}
	}

	/* ------------------------------------------------------------ caption box on the video */
	function mount() {
		var player = document.querySelector('#movie_player');
		if (!player) return;
		if (!(S.host && S.host.isConnected && S.host.parentNode === player)) {
			if (S.host) S.host.remove();
			U.fonts();
			S.host = document.createElement('sawa-lens-yt');
			S.host.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:60';
			S.root = S.host.attachShadow({ mode: 'open' });
			S.root.innerHTML = '<style>' + CSS + '</style>' +
				'<button class="chip" hidden></button><div class="advb" hidden></div><div class="panel"></div><div class="quiz" hidden></div>' +
				'<div class="bar"><div class="grip" title="Drag to move the captions up or down">⋮⋮</div><div class="box"><div class="line en"></div><div class="line tr"></div><div class="line slg"></div><div class="line snd" title="How it sounds — hover for fast speech"></div><div class="sndtip"></div></div></div>' +
				'<div class="lensmenu"><div class="lmpage lmmain"><div class="lmh">Language Lens</div><div class="menu on">' + TIPSW +
				trow('sidebar', 'Transcript', 'transcript') + trow('ctlBasic', 'Show Basic Controls', 'ctlb') + trow('ctlRep', 'Show Repeat / Loop / Auto-pause', 'ctlr') + '</div>' +
				'<div class="lmh">Captions</div><div class="menu on">' + trow('showEn', 'English', 'en') + trow('showTrans', 'Arabic translation', 'tr') + trow('showSound', 'How it sounds', 'snd') + trow('blurCaptions', 'Blur English until I ' + HOV, 'blurEn') + trow('blurTrans', 'Blur Arabic until I ' + HOV, 'blurTr') + trow('colors', 'Colour words', 'colors') + '</div>' +
				'<button class="t more" data-a="more" data-tip="more">Further Controls<span>›</span></button></div>' +
				'<div class="lmpage lmmore" hidden><button class="t" data-a="back">‹ Back</button>' +
				'<div class="lmh">Further Controls</div><div class="menu on">' + FURTHER + '</div>' +
				// 0.10.1: the Voice-only playlist and "Add these songs" are on the shelf (ops/shelf.md): the buttons are not drawn.
				'<div class="lmmusic" hidden><div class="lmh">🎵 Music</div>' +
				(window.LensVocals && LensVocals.supported() ? '<button class="t" data-a="vocals" data-tip="vocals" title="Listen to songs without background music">🎤 Vocals only<span class="vst"></span></button>' : '') +
				'<button class="t" data-a="game" data-tip="game" hidden>🎮 Lyrics game<span class="go">▶ Start</span></button>' +
				'<a class="t gen" target="_blank" rel="noopener" hidden>Check the lyrics on Genius ↗</a></div></div></div>';
			if (MOBILE) S.host.classList.add('mob');
			if (window.LensVocals) LensVocals.bindMenu(S.root);
			if (window.LensTips) LensTips.attach(S.root);
			player.appendChild(S.host);
			S.root.querySelector('.line.snd').addEventListener('mouseenter', soundTip);
			S.root.querySelector('.line.snd').addEventListener('mouseleave', function () { S.root.querySelector('.sndtip').classList.remove('on'); });
			player.classList.add('sawa-lens-on');
			hideNativeCaptions();
			S.root.addEventListener('mouseover', function (e) { onOver(e, 'bar'); });
			S.root.addEventListener('mouseout', onOut);
			S.root.addEventListener('click', onClick);
			S.root.addEventListener('change', function (e) {
				if (e.target.hasAttribute('data-tipsw')) return window.LensTips && LensTips.setOff(!e.target.checked);
				if (e.target.dataset.sel) return setPref(e.target.dataset.sel, e.target.value);
				var k = e.target.dataset.pref;
				if (k) setPref(k === 'colors' ? 'lensColors' : k, e.target.checked);
			});
			S.root.addEventListener('mouseup', function (e) { onSelect(e, S.root, 'bar'); });
			if (!TOUCH) S.root.addEventListener('contextmenu', function (e) { wordMenu(e, 'bar'); });
			setupDrag(player);
			if (window.LensControls) LensControls.attach(S.root, S.host, CTRL_API, TOUCH);
			useVideo(player.querySelector('video'));
			loop();
		}
		applyPrefs();
		paintMusic();
		ytButton(player);
		if (prefs.sidebar) mountSide();
	}

	/** Follow the player's video. The phone site swaps in a new <video> (after ads, for example): keep up with it. */
	function useVideo(v) {
		if (!v || v === S.video) return;
		S.video = v;
		// Also check on the video's own time updates: screen refreshes slow down when the tab is in the background.
		v.addEventListener('timeupdate', function () { if (S.video === v) { checkStop(); tick(false); checkQuiz(); } });
	}

	/** The Language Lens button on YouTube's own control bar: it opens the menu with the controls and display options. */
	function ytButton(player) {
		if (MOBILE) return; // the phone player has no control bar to add to: the controls are under the player
		var bar = player.querySelector('.ytp-right-controls');
		if (!bar || bar.querySelector('.sawa-lens-ytbtn')) return;
		var b = document.createElement('button');
		b.className = 'ytp-button sawa-lens-ytbtn';
		b.title = 'Language Lens (A ◀ · S ↻ · D ▶ · Q auto-pause)';
		b.setAttribute('aria-label', 'Language Lens');
		b.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;height:100%"><img alt="" width="22" height="22" style="width:22px;height:22px;border-radius:5px;display:block" src="' + chrome.runtime.getURL('icons/48.png') + '"></span>';
		b.addEventListener('click', function (e) { e.stopPropagation(); paintMusic(); S.root.querySelector('.lensmenu').classList.toggle('on'); });
		bar.insertBefore(b, bar.firstChild);
		var t = document.createElement('button');
		t.className = 'ytp-button sawa-lens-yttoggle' + (prefs.lensYT ? '' : ' off');
		t.setAttribute('aria-label', 'Language Lens on or off');
		t.setAttribute('aria-pressed', String(prefs.lensYT));
		t.title = 'Language Lens: ' + (prefs.lensYT ? 'on' : 'off');
		t.innerHTML = '<span class="sl-sw"><i></i></span>';
		t.addEventListener('click', function (e) { e.stopPropagation(); setPref('lensYT', !prefs.lensYT); });
		bar.insertBefore(t, bar.firstChild);
		if (!document.getElementById('sawa-lens-yttoggle-css')) {
			var cs = document.createElement('style');
			cs.id = 'sawa-lens-yttoggle-css';
			cs.textContent = '.sawa-lens-yttoggle{display:inline-flex!important;align-items:center;justify-content:center;width:52px!important}'
				+ '.sawa-lens-yttoggle .sl-sw{position:relative;width:36px;height:20px;border-radius:99px;background:#22C55E;transition:background .15s}'
				+ '.sawa-lens-yttoggle .sl-sw i{position:absolute;top:2px;left:18px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}'
				+ '.sawa-lens-yttoggle.off .sl-sw{background:#717171}.sawa-lens-yttoggle.off .sl-sw i{left:2px}';
			document.documentElement.appendChild(cs);
		}
		document.addEventListener('click', function (e) { if (!e.composedPath().some(function (n) { return n === S.host || (n.classList && n.classList.contains('sawa-lens-ytbtn')); })) S.root.querySelector('.lensmenu').classList.remove('on'); });
	}

	/** Hover the third line: how the sentence sounds in fast natural speech (and why). */
	function soundTip() {
		var i = S.shown, tip = S.root.querySelector('.sndtip');
		if (i == null || i < 0 || !S.cues[i]) return;
		S.cueSound = S.cueSound || {};
		tip.classList.add('on');
		var paint = function () { if (S.shown === i) tip.innerHTML = soundBox(S.cueSound[i]); };
		if (S.cueSound[i]) return paint();
		S.cueSound[i] = 'loading'; paint();
		U.send('sound', { text: S.cues[i].text }).then(function (r) { S.cueSound[i] = r; paint(); }, function (err) { S.cueSound[i] = { error: U.errText(err) }; paint(); });
	}

	/** Drag the grip to move the caption box up or down; the position is remembered. */
	function setupDrag(player) {
		var grip = S.root.querySelector('.grip'), bar = S.root.querySelector('.bar');
		grip.addEventListener('mousedown', function (e) {
			e.preventDefault();
			e.stopPropagation();
			var rect = player.getBoundingClientRect(), pos = prefs.barPos;
			function move(ev) {
				var fromBottom = rect.bottom - ev.clientY - bar.offsetHeight / 2;
				pos = Math.max(0.02, Math.min(0.85, fromBottom / rect.height));
				bar.style.setProperty('--pos', Math.round(pos * 1000) / 10 + '%');
			}
			function up() {
				document.removeEventListener('mousemove', move, true);
				document.removeEventListener('mouseup', up, true);
				setPref('barPos', pos);
			}
			document.addEventListener('mousemove', move, true);
			document.addEventListener('mouseup', up, true);
		});
	}

	function hideNativeCaptions() {
		if (document.getElementById('sawa-lens-hide-cc')) return;
		var st = document.createElement('style');
		st.id = 'sawa-lens-hide-cc';
		st.textContent = '#movie_player.sawa-lens-on .ytp-caption-window-container{display:none!important}';
		document.documentElement.appendChild(st);
	}

	function say(text) {
		if (!S.root) return;
		var m = S.root.querySelector('.msg') || S.root.appendChild(document.createElement('div'));
		m.className = 'msg';
		m.textContent = text;
		clearTimeout(S.sayT);
		S.sayT = setTimeout(function () { m.remove(); }, 2600);
	}

	var BAND = U.BAND;
	function paintChip() {
		var c = S.root && S.root.querySelector('.chip');
		if (!c || !S.grade) return;
		c.hidden = false;
		c.className = 'chip ' + S.grade.band;
		c.innerHTML = '<span class="dot"></span>You know about<b>' + S.grade.percent + '%</b>of the words · ' + BAND[S.grade.band];
		c.title = 'Language Lens: share of the words in this video you probably know. ' + U.GRADE_TIP;
		if (S.root.querySelector('.panel').classList.contains('on')) paintPanel();
		paintAdvisory();
	}

	function paintPanel() {
		var p = S.root.querySelector('.panel'), g = S.grade, u = U.esc;
		if (!g) return;
		p.innerHTML = '<h3>New words in this video</h3>' +
			'<div class="sub">You know about ' + g.percent + '% of the words (' + u(U.GRADE_TIP) + '). ' + u(S.gradeFrom || '') + ' ' + (g.unknownLemmas ? 'Learn these first:' : 'No new words.') + '</div><ul>' +
			g.top.map(function (w) {
				return '<li><div><span class="en">' + u(w.lemma) + '</span>' + (w.level ? '<span class="lv">' + U.LEVEL_NAMES[w.level - 1] + '</span>' : '') +
					(w.ar ? '<div class="ar">' + u(w.ar) + '</div>' : '') + '</div><button class="k" data-a="know" data-l="' + u(w.lemma) + '">Known</button></li>';
			}).join('') + '</ul>';
	}

	function paintLine(i) {
		var en = S.root.querySelector('.line.en'), tr = S.root.querySelector('.line.tr');
		if (S.host) S.host.classList.toggle('has-cap', i >= 0 && !!S.cues[i]); // the ★ and the buttons show only next to a caption
		if (i < 0 || !S.cues[i]) {
			en.innerHTML = '';
			tr.textContent = '';
			var sg = S.root.querySelector('.line.slg'); if (sg) sg.innerHTML = '';
			var sl = S.root.querySelector('.line.snd'); if (sl) sl.textContent = '';
			return;
		}
		en.innerHTML = U.markup(mask(S.cues[i].text), S.lines ? S.lines[i] : null, S.fxCues ? S.fxCues[i] : null);
		S.shown = i;
		if (S.kind === 'lyrics') tr.textContent = S.cueTr ? S.cueTr[i] || '' : '';
		else { wantTr(sentNow(i)); paintTr(); } // the whole sentence's meaning, not this piece's
		var slg = S.root.querySelector('.line.slg');
		if (slg) { var ns = slangOf(i); slg.innerHTML = ns ? slangHtml(ns) : ''; slg.dir = prefs.lyricLang === 'ar' ? 'rtl' : 'ltr'; }
		tr.classList.remove('peek');
		heard(i);
		var snd = S.root.querySelector('.line.snd'); if (snd) snd.textContent = S.cueSnd ? S.cueSnd[i] || '' : '';
		var tip = S.root.querySelector('.sndtip'); if (tip) tip.classList.remove('on');
	}

	/* ------------------------------------------------------------ transcript sidebar */
	function mountSide() {
		if (!prefs.sidebar || !S.videoId) return;
		// Computer: the right column. Phone: under the video's title, above the next videos.
		var col = MOBILE ? document.querySelector('ytm-single-column-watch-next-results-renderer') : document.querySelector('#secondary-inner') || document.querySelector('#secondary');
		if (!col) return;
		if (S.side && S.side.isConnected && S.side.parentNode === col) return;
		if (S.side) S.side.remove();
		S.side = document.createElement('sawa-lens-side');
		if (MOBILE) S.side.classList.add('mob');
		S.sRoot = S.side.attachShadow({ mode: 'open' });
		S.sRoot.innerHTML = '<style>' + SIDE_CSS + MUSIC_CSS + (window.LensTips ? LensTips.css : '') + '.vprof{margin:6px 10px;font:500 13px/1.4 ' + FONT + '}.vprof summary{cursor:pointer;padding:6px 0}.vprof summary small{color:#8A8584}.vbar{display:flex;height:10px;border-radius:5px;overflow:hidden;margin:6px 0}.vbar i{display:block;height:100%}.vt{width:100%;border-collapse:collapse;font-size:12.5px}.vt td{padding:2px 4px}.vt td:nth-child(n+2){text-align:right;color:#57534E}.vd{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px}.vv{margin:8px 0;font-size:13px}.lmh2{font:700 11px/1 ' + FONT + ';letter-spacing:.06em;text-transform:uppercase;color:#8A8584;margin:8px 0 4px}.vtop{display:flex;flex-wrap:wrap;gap:4px}.vtop span{background:#F3F1EE;border-radius:99px;padding:3px 8px;font-size:12.5px}.vtop small{color:#8A8584}</style><div class="side">' +
			'<div class="head"><div class="ttl">Language Lens <small class="g"></small></div><div class="hb">' +
			'<button class="ib" data-a="follow" title="Keep the sentence being spoken in view">Auto-scroll</button>' +
			'<button class="ib" data-a="colors" title="Colour words">Colours</button>' +
			'<button class="ib" data-a="min" title="Collapse">—</button></div></div>' +
			(MOBILE ? '<div class="ctl"><button class="cb" data-a="opts">Display ▾</button></div><div class="opts">' + OPTS + '</div>' : '') +
			'<div class="music" hidden></div><div class="goal"></div><div class="vprof"></div><div class="lq"></div><div class="adv"></div>' +
			'<div class="legend">' + LensMarks.legendHtml() + '</div>' +
			'<div class="focus"><label for="fsel">Focus on</label><select class="fsel" id="fsel"><option value="">— none —</option></select></div>' +
			'<div class="fbar"><div class="row"><div><i class="sw2"></i><b class="fname"></b> · <span class="fcount"></span></div><div class="fnav"><button data-a="fprev" title="Previous example">▲</button><button data-a="fnext" title="Next example">▼</button></div></div><div class="rule"></div></div>' +
			'<div class="list"></div><div class="foot">' + (TOUCH
				? 'Tap a sentence to play it, ↻ to hear only that sentence. On the caption: swipe ←/→ for the next or previous sentence, double-tap to repeat. Tap a word for its meaning. Press and hold to select words to translate or save.'
				: 'Click a sentence to play it. <kbd>A</kbd> previous · <kbd>S</kbd> repeat · <kbd>D</kbd> next · <kbd>R</kbd> loop · <kbd>X</kbd> slower · <kbd>W</kbd> shadow · <kbd>Q</kbd> auto-pause. Select words to translate, hear or save them.') + '</div></div>';
		var meta = MOBILE && col.querySelector(':scope > ytm-slim-video-metadata-section-renderer');
		col.insertBefore(S.side, meta ? meta.nextSibling : col.firstChild);
		if (window.LensTips) LensTips.attach(S.sRoot);
		if (!TOUCH) S.sRoot.addEventListener('contextmenu', function (e) { wordMenu(e, 'side'); });
		S.sRoot.addEventListener('mouseover', function (e) { onOver(e, 'side'); });
		S.sRoot.addEventListener('mouseout', onOut);
		S.sRoot.addEventListener('click', onSideClick);
		S.sRoot.addEventListener('mouseup', function (e) { onSelect(e, S.sRoot, 'side'); });
		S.sRoot.addEventListener('change', function (e) {
			if (e.target.hasAttribute('data-tipsw')) return window.LensTips && LensTips.setOff(!e.target.checked);
			if (e.target.dataset.sel) return setPref(e.target.dataset.sel, e.target.value);
			var k = e.target.dataset.pref;
			if (k) setPref(k === 'colors' ? 'lensColors' : k, e.target.checked);
		});
		var list = S.sRoot.querySelector('.list');
		list.addEventListener('wheel', function () { S.scrolledAt = Date.now(); }, { passive: true });
		list.addEventListener('touchmove', function () { S.scrolledAt = Date.now(); }, { passive: true });
		var fsel = S.sRoot.querySelector('.fsel');
		U.send('focusList').then(function (fl) {
			var groups = {};
			fl.forEach(function (f) { (groups[f.group] = groups[f.group] || []).push(f); });
			fsel.innerHTML = '<option value="">— none —</option>' + Object.keys(groups).map(function (gname) {
				return '<optgroup label="' + gname + '">' + groups[gname].map(function (f) { return '<option value="' + f.key + '">' + U.esc(f.name) + '</option>'; }).join('') + '</optgroup>';
			}).join('');
			fsel.value = prefs.focus || '';
		}, function () {});
		fsel.addEventListener('change', function () { U.send('setPref', { key: 'focus', value: fsel.value }).catch(function () {}); });
		applyPrefs();
		paintSide();
		paintGoal();
	}

	/** Swear words shown as f*** when the learner turns masking on (same length, so word positions stay put). */
	function mask(text) {
		if (!prefs.maskSwears || !window.LensExplicit) return text;
		return text.replace(/[A-Za-z]+(?:['\u2019][A-Za-z]+)*/g, function (w) {
			return window.LensExplicit.severityOf(w) ? w[0] + w.slice(1).replace(/[A-Za-z']/g, '*') : w;
		});
	}

	var THEME_NAMES = { violence: 'violence', drugs: 'drugs or alcohol', selfharm: 'self-harm' };
	var KIND = { sexual: 'sexual language', topic: 'sexual topic', profanity: 'profanity', mild: 'mild', slur: 'slur' };
	/** Content check (what is said): sexual language or topics first, then profanity and slurs, other themes, and YouTube's family-safe flag. */
	function paintAdvisory() {
		var a = S.adv, sf = S.safety || {}, unsafe = sf.familySafe === false || sf.ageRestricted;
		var flags = [];
		if (a) {
			if (a.sexual === 'explicit') flags.push('Sexual language');
			else if (a.sexual === 'topics') flags.push('Sexual topics');
			if (a.slurs) flags.push('Slurs');
			if (a.profanity === 'frequent') flags.push('Frequent profanity');
			else if (a.profanity === 'moderate') flags.push('Moderate profanity');
		}
		var badge = S.root && S.root.querySelector('.advb');
		if (badge) {
			badge.hidden = !(flags.length || unsafe);
			badge.textContent = '⚠ ' + flags.concat(unsafe ? ['Not family-safe (YouTube)'] : []).join(' · ');
			badge.title = 'Language Lens content check. Details in the transcript panel.';
		}
		var el = S.sRoot && S.sRoot.querySelector('.adv');
		if (!el) return;
		if (!a) { el.innerHTML = unsafe ? '<span class="warn">⚠ YouTube marks this video as not family-safe.</span>' : ''; return; }
		var u = U.esc, parts = [], c = a.counts;
		var show = function (k) { return ' · <a data-adv="' + k + '">' + (S.advOpen === k ? 'hide' : 'show') + '</a>'; };
		if (a.sexual === 'explicit') parts.push('<span class="warn">⚠ Sexual language</span> ×' + (c.sexual + c.topic) + show('sexual'));
		else if (a.sexual === 'topics') parts.push('<span class="warn">⚠ Sexual topics</span> ×' + c.topic + show('sexual'));
		if (a.slurs) parts.push('<span class="warn">⚠ Slurs</span> ×' + a.slurs + show('slur'));
		if (a.profanity === 'frequent' || a.profanity === 'moderate') parts.push('<span class="warn">⚠ ' + (a.profanity === 'frequent' ? 'Frequent' : 'Moderate') + ' profanity</span> ×' + c.profanity + (c.mild ? ' (+' + c.mild + ' mild)' : '') + show('profanity'));
		if (!parts.length) parts.push('<span class="ok">✓ No explicit language</span>' + (a.profanity === 'mild' ? ' · mild words only ×' + c.mild + show('profanity') : ''));
		var th = Object.keys(a.themes);
		if (th.length) parts.push('Mentions: ' + th.map(function (k) { return THEME_NAMES[k] + ' ×' + a.themes[k]; }).join(', ') + show('themes'));
		if (unsafe) parts.push('<span class="warn">⚠ YouTube marks this video as ' + (sf.ageRestricted ? 'age-restricted' : 'not family-safe') + ': it may contain graphic content.</span>');
		var list = '', want = { sexual: ['sexual', 'topic'], slur: ['slur'], profanity: ['profanity', 'mild'] }[S.advOpen];
		if (want) {
			list = '<ul>' + a.hits.filter(function (h) { return want.indexOf(h.kind) >= 0; }).slice(0, 60).map(function (h) {
				var lv = { sexual: 'strong', slur: 'strong', topic: 'moderate', profanity: 'moderate', mild: 'mild' }[h.kind];
				return '<li><button class="tm" data-adv="play" data-i="' + h.i + '">' + fmt(S.sents[h.i].start) + '</button><span class="lvl ' + lv + '">' + KIND[h.kind] + '</span>' + u(h.word) + '</li>';
			}).join('') + '</ul>';
		} else if (S.advOpen === 'themes') {
			list = '<ul>' + th.map(function (k) {
				return a.themeHits[k].slice(0, 20).map(function (i) { return '<li><button class="tm" data-adv="play" data-i="' + i + '">' + fmt(S.sents[i].start) + '</button>' + u(THEME_NAMES[k]) + '</li>'; }).join('');
			}).join('') + '</ul>';
		}
		el.innerHTML = '<div>' + parts.join('<br>') + '</div>' + list + '<div style="margin-top:4px;font-size:11.5px;color:#8A8584">Checked from the words spoken (no AI). It can\'t see what is shown on screen.</div>';
	}

	/** "Top 1,000 words: 812 known" — the vocabulary goal at the top of the sidebar. */
	/** The video's vocabulary: frequency bands of all its words and its 20 most used words. */
	function paintProfile() {
		var box = S.sRoot && S.sRoot.querySelector('.vprof'), v = S.vprof, u = U.esc;
		if (!box || !v || !v.total) return;
		var names = ['Top 1,000', '1,000–2,000', '2,000–3,000', '3,000–6,000', 'Rarer'], cols = ['#15803D', '#65A30D', '#CA8A04', '#EA580C', '#E3262B'];
		var pct = function (n) { return Math.round(100 * n / v.total); };
		var cov = S.grade ? S.grade.percent : v.cover; // the same number as the chip: from the learner's vocabulary profile
		var verdict = cov >= 95 ? '✅ Good for you: you know about ' + cov + '% of these words.' : cov >= 90 ? '🟡 A good challenge: you know about ' + cov + '% of the words. Use the captions and save new words.' : '🔴 Hard for you: you know about ' + cov + '% of the words. Use subtitles and the translation, or pick an easier video.';
		box.innerHTML = '<details' + (S.vprofOpen ? ' open' : '') + '><summary><b>Words in this video</b> <small>' + v.total + ' words</small></summary>'
			+ '<div class="vbar">' + v.bands.map(function (b, i) { return b.n ? '<i style="width:' + (100 * b.n / v.total) + '%;background:' + cols[i] + '" title="' + names[i] + ': ' + b.n + ' words"></i>' : ''; }).join('') + '</div>'
			+ '<table class="vt">' + v.bands.map(function (b, i) { return '<tr><td><span class="vd" style="background:' + cols[i] + '"></span>' + names[i] + '</td><td>' + b.n + ' words</td><td>' + pct(b.n) + '%</td><td>' + b.uniq + ' different</td></tr>'; }).join('') + '</table>'
			+ '<p class="vv">' + verdict + '</p>'
			+ '<div class="lmh2">Most used words</div><div class="vtop">' + v.top.map(function (w) { return '<span title="' + u(w.ar) + '">' + u(w.lemma) + ' <small>×' + w.count + '</small></span>'; }).join('') + '</div></details>';
		box.querySelector('details').addEventListener('toggle', function () { S.vprofOpen = this.open; });
	}

	/** Words heard today: each caption line counts once per video, only while the video plays. */
	var heardSum = 0, heardT = null;
	function heard(i) {
		if (!S.video || S.video.paused || !S.cues[i]) return;
		S.heardSeen = S.heardSeen || {};
		if (S.heardSeen[i]) return;
		S.heardSeen[i] = 1;
		heardSum += (S.cues[i].text.match(/[A-Za-z]+(?:['’][a-z]+)?/g) || []).length;
		if (!heardT) heardT = setTimeout(function () { heardT = null; if (heardSum) U.send('addDaily', { heard: heardSum }).catch(function () {}); heardSum = 0; }, 15000);
	}

	function paintGoal() {
		if (!S.sRoot) return;
		U.send('goal').then(function (g) {
			var el = S.sRoot && S.sRoot.querySelector('.goal');
			if (!el) return;
			if (!g.tested && !g.known) {
				el.innerHTML = '<div class="gl"><span>Find your English level (A1–C2): free level test.</span><a href="#" data-a="test">Start</a></div>';
				return;
			}
			var n = g.goal.toLocaleString('en-US'), k = Math.round(g.have), pk = Math.min(100, (g.have / g.goal) * 100), pl = Math.min(100 - pk, (g.learning / g.goal) * 100);
			el.innerHTML = '<div class="gl"><span>Goal: the top <b>' + n + '</b> words</span><span><b>' + k.toLocaleString('en-US') + '</b> / ' + n + (g.learning ? ' · ' + g.learning + ' learning' : '') + '</span></div>' +
				'<div class="gbar"><i style="width:' + pk + '%"></i><i class="lr" style="left:' + pk + '%;width:' + pl + '%"></i></div>';
		}, function () {});
	}

	function fmt(ms) {
		var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
		return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
	}

	function paintFocusBar() {
		if (!S.sRoot) return;
		var bar = S.sRoot.querySelector('.fbar'), fsel = S.sRoot.querySelector('.fsel');
		if (fsel && fsel.value !== (prefs.focus || '') && fsel.options.length > 1) fsel.value = prefs.focus || '';
		bar.classList.toggle('on', !!(prefs.focus && S.fxInfo));
		if (!S.fxInfo) return;
		bar.querySelector('.fname').textContent = S.fxInfo.name;
		var n = S.fxInfo.count, inS = S.fxSents ? S.fxSents.filter(function (x) { return x && x.length; }).length : 0;
		bar.querySelector('.fcount').textContent = n ? n + ' examples in ' + inS + ' sentences' : 'none in this video';
		bar.querySelector('.rule').textContent = S.fxInfo.rule;
		bar.querySelector('.rule').dir = S.fxInfo.ruleLang === 'ar' ? 'rtl' : 'ltr';
	}

	function soundBox(r) {
		var u = U.esc;
		if (r === 'loading') return '<div class="snd">Listening closely…</div>';
		if (r.error) return '<div class="snd" style="color:#E3262B">' + u(r.error) + '</div>';
		return '<div class="snd"><div><b>Sounds like:</b> <span class="sl">' + u(r.soundsLike) + '</span></div>' +
			(r.features && r.features.length ? '<ul>' + r.features.map(function (f) { return '<li><b>' + u(f.where) + '</b> · ' + u(f.feature) + (r.lang === 'ar' ? '<div dir="rtl" lang="ar" style="text-align:right;font-family:' + AR.replace(/"/g, "'") + '">' + u(f.why) + '</div>' : ': ' + u(f.why)) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
	}

	function rowHtml(s, i) {
		var tr = trFor(i) ? '<div class="trs">' + U.esc(trFor(i)) + '</div>' : '';
		var sl = slangOf(i);
		if (sl) tr += '<div class="slgs"' + (prefs.lyricLang === 'ar' ? ' dir="rtl"' : '') + '>' + slangHtml(sl) + '</div>';
		return '<div class="s" data-i="' + i + '"><button class="tm" data-a="seek">' + fmt(s.start) + '</button><div class="body"><div class="tx">' +
			U.markup(mask(s.text), S.sentToks ? S.sentToks[i] : null, S.fxSents ? S.fxSents[i] : null) + '</div>' + tr +
			(S.sounds[i] ? soundBox(S.sounds[i]) : '') + (S.lyrExp && S.lyrExp[i] ? lyricBox(S.lyrExp[i]) : '') + '</div>' +
			'<div class="acts"><button class="rep' + (S.loopI === i ? ' on' : '') + '" data-a="once" title="Loop" aria-label="Loop this sentence (say it after the speaker)">' + REPEAT + '</button><button class="rep star' + (S.savedRows && S.savedRows[i] ? ' on' : '') + '" data-a="star" title="' + (S.savedRows && S.savedRows[i] ? 'Saved to your review cards' : 'Save this sentence') + '" aria-label="Save this sentence">' + (S.savedRows && S.savedRows[i] ? '★' : '☆') + '</button><button class="rep" data-a="sound" title="How it sounds in fast speech">' + WAVE + '</button>' +
			(isSong() ? '<button class="rep" data-a="lyr" title="Explain this line">💡</button>' : '') + '</div></div>';
	}

	function paintSide() {
		if (!S.sRoot) return;
		var list = S.sRoot.querySelector('.list'), g = S.sRoot.querySelector('.g');
		g.textContent = S.grade ? 'you know about ' + S.grade.percent + '% of the words' : '';
		g.title = S.grade ? BAND[S.grade.band] + '. ' + U.GRADE_TIP + '. ' + (S.gradeFrom || '') : '';
		S.sRoot.querySelector('[data-a=follow]').classList.toggle('on', S.follow);
		paintFocusBar();
		paintAdvisory();
		paintLessonInfo();
		paintMusic();
		if (!S.sents.length) {
			list.innerHTML = '<div class="empty">' + (S.cues.length || !S.videoId ? 'Preparing the transcript…' : 'This video has no English captions.') + '</div>';
			return;
		}
		var top = list.scrollTop;
		list.innerHTML = S.sents.map(rowHtml).join('');
		list.scrollTop = top;
		S.sIdx = -1;
	}

	function onSideClick(e) {
		var bt = prefs.blurTrans && e.target.closest('.trs');
		if (bt) { bt.classList.toggle('peek'); return; }
		var b = e.target.closest('[data-a]');
		if (b && b.closest('.ctl')) {
			if (b.dataset.a === 'opts') S.sRoot.querySelector('.opts').classList.toggle('on');
			else doAction(b.dataset.a, b);
			return;
		}
		if (b && b.closest('.head')) {
			var a = b.dataset.a;
			if (a === 'follow') {
				S.follow = !S.follow;
				S.scrolledAt = 0;
				b.classList.toggle('on', S.follow);
			} else if (a === 'colors') setPref('lensColors', !prefs.colors);
			else if (a === 'min') setPref('sideMin', !prefs.sideMin);
			return;
		}
		if (b && b.dataset.a === 'test') {
			e.preventDefault();
			U.send('openTest').catch(function () {});
			return;
		}
		if (b && (b.dataset.a === 'fprev' || b.dataset.a === 'fnext')) {
			jumpFocus(b.dataset.a === 'fnext' ? 1 : -1);
			return;
		}
		if (b && b.dataset.a === 'tipreset') {
			doAction('tipreset', b);
			return;
		}
		if (b && b.dataset.a === 'game') {
			startGame();
			return;
		}
		if (b && b.dataset.a === 'ly-src') {
			swapLyrics();
			return;
		}
		if (b && (b.dataset.a === 'ly-' || b.dataset.a === 'ly+')) {
			nudgeLyrics(b.dataset.a === 'ly+' ? 500 : -500);
			return;
		}
		if (b && (b.dataset.a === 'll-en' || b.dataset.a === 'll-ar')) {
			S.lyrExp = {};
			U.send('setPref', { key: 'explainLang', value: b.dataset.a === 'll-ar' ? 'ar' : 'en' }).catch(function () {}); // same as the popup's "Explanations"
			prefs.lyricLang = b.dataset.a === 'll-ar' ? 'ar' : 'en';
			paintSide();
			return;
		}
		var lq = e.target.closest('[data-lq]');
		if (lq) {
			if (lq.dataset.lq === 'make') makeQuiz();
			return;
		}
		var ab = e.target.closest('[data-adv]');
		if (ab) {
			if (ab.dataset.adv === 'play') play(S.sents[+ab.dataset.i].start, S.sents[+ab.dataset.i].end);
			else {
				S.advOpen = S.advOpen === ab.dataset.adv ? '' : ab.dataset.adv;
				paintAdvisory();
			}
			return;
		}
		if (e.target.closest('.focus,.goal,.snd,.adv,.opts,.music')) return;
		var wd = (TOUCH || prefs.ytClick) && e.target.closest('.wd');
		if (wd) return openWord(wd, 'side');
		var row = e.target.closest('.s');
		if (!row || !S.video) return;
		var i = +row.dataset.i, s = S.sents[i];
		if (b && b.dataset.a === 'star') {
			S.savedRows = S.savedRows || {};
			if (S.savedRows[i]) return;
			S.savedRows[i] = 1;
			repaintRow(i);
			U.send('saveSentence', { text: s.text, url: 'https://www.youtube.com/watch?v=' + S.videoId + '&t=' + Math.floor(s.start / 1000), title: document.title.replace(/ - YouTube$/, ''), videoId: S.videoId, startMs: s.start, endMs: s.end })
				.then(function () { say('Saved ★ It will come back in your review cards.'); }, function (err) { delete S.savedRows[i]; repaintRow(i); say(U.errText(err)); });
			return;
		}
		if (b && b.dataset.a === 'lyr') {
			S.lyrExp = S.lyrExp || {};
			if (S.lyrExp[i] && S.lyrExp[i] !== 'loading') {
				delete S.lyrExp[i];
				row.outerHTML = rowHtml(s, i);
				return;
			}
			S.lyrExp[i] = 'loading';
			row.outerHTML = rowHtml(s, i);
			var ctx = [S.sents[i - 1], S.sents[i + 1]].filter(Boolean).map(function (x) { return x.text; }).join(' / ');
			var n = LensMusic.names(S.media);
			U.send('lyric', { line: s.text, song: n.artist + ' – ' + n.track, context: ctx, lang: prefs.lyricLang }).then(function (r) { S.lyrExp[i] = r; repaintRow(i); }, function (err) { S.lyrExp[i] = { error: U.errText(err) }; repaintRow(i); });
			return;
		}
		if (b && b.dataset.a === 'sound') {
			if (S.sounds[i] && S.sounds[i] !== 'loading') {
				delete S.sounds[i];
				row.outerHTML = rowHtml(s, i);
				return;
			}
			S.sounds[i] = 'loading';
			row.outerHTML = rowHtml(s, i);
			U.send('sound', { text: s.text }).then(function (r) { S.sounds[i] = r; repaintRow(i); }, function (err) { S.sounds[i] = { error: U.errText(err) }; repaintRow(i); });
			return;
		}
		// Selecting text to save an expression shouldn't jump the video.
		var sel = S.sRoot.getSelection ? S.sRoot.getSelection() : window.getSelection();
		if (sel && !sel.isCollapsed && String(sel).trim().length > 1) return;
		if (b && b.dataset.a === 'once') {
			if (S.loopI === i) return stopLoop();
			S.loopI = i;
			markLoop();
			return play(s.start, s.end, true);
		}
		play(s.start, 0);
	}

	function repaintRow(i) {
		var row = S.sRoot && S.sRoot.querySelector('.s[data-i="' + i + '"]');
		if (!row) return;
		var now = row.classList.contains('now');
		row.outerHTML = rowHtml(S.sents[i], i);
		if (now) S.sRoot.querySelector('.s[data-i="' + i + '"]').classList.add('now');
	}

	/** Stop at the end of each sentence: auto-pause, or Shadow mode (content/yt-controls.js). */
	function stopEnd() { return prefs.autoPause || (window.LensControls && LensControls.shadowOn()); }
	var CTRL_API = {
		video: function () { return S.video; },
		sents: function () { return S.sents; },
		current: currentSentence,
		go: function (a) { doAction(a); },
		looping: function () { return S.loopI; },
		loop: function (j) {
			if (S.loopI >= 0) return stopLoop();
			if (!S.sents[j]) return;
			S.loopI = j;
			markLoop();
			play(S.sents[j].start, S.sents[j].end, true);
			say('🔁 Looping this sentence: say it after the speaker');
		},
		playSentence: function (k) {
			if (S.sents[k]) play(S.sents[k].start, S.sents[k].end);
			else say('The end of the video');
		},
		shadowStart: function () {
			var j = currentSentence();
			if (!S.video || !S.sents[j]) return;
			if (S.video.paused) play(S.sents[j].start, S.sents[j].end);
			else S.stopAt = S.sents[j].end;
		},
		say: function (t) { say(t); },
		hideCard: function () { if (Card.isOpen()) Card.hide(); }
	};

	/** Play from startMs; stop at endMs if given (0 = keep playing). */
	function play(startMs, endMs, keepLoop) {
		if (!S.video) return;
		if (!keepLoop && S.loopI >= 0) stopLoop();
		S.stopAt = endMs || 0;
		S.video.currentTime = Math.max(0, startMs / 1000 - 0.05);
		var p = S.video.play();
		if (p && p.catch) p.catch(function () {});
		S.scrolledAt = 0;
	}

	/** The sentence playing now (or the last one before now). */
	function currentSentence() {
		return S.video ? find(S.sents, S.video.currentTime * 1000 + 30, null) : -1;
	}

	/* ------------------------------------------------------------ playback sync */
	function find(arr, ms, slack) {
		var lo = 0, hi = arr.length - 1, ans = -1;
		while (lo <= hi) {
			var mid = (lo + hi) >> 1;
			if (arr[mid].start <= ms) {
				ans = mid;
				lo = mid + 1;
			} else hi = mid - 1;
		}
		if (ans >= 0 && slack != null && ms > arr[ans].end + slack) return -1;
		return ans;
	}

	/* ------------------------------------------------------------ video quizzes */
	/** Sherif's quiz for this video, if he published one. Admins also get a "make a quiz" button. */
	function loadLesson(vid) {
		U.send('lesson', { videoId: vid }).then(function (r) {
			if (vid !== S.videoId) return;
			S.lesson = r.lesson;
			S.isAdmin = r.admin;
			paintSide();
			if (S.lesson) say('This video has ' + S.lesson.questions.length + ' questions from Sherif. The video stops to ask them.');
		}, function () {});
	}

	function quizOpen() { var q = S.root && S.root.querySelector('.quiz'); return q && !q.hidden; }

	function checkQuiz() {
		if (!S.video || quizOpen() || document.querySelector('#movie_player.ad-showing')) return;
		var t = S.video.currentTime;
		// 1. Sherif's questions
		if (S.lesson) {
			for (var i = 0; i < S.lesson.questions.length; i++) {
				var q = S.lesson.questions[i];
				if (!S.lesson.answers[q.id] && t >= q.t && t < q.t + 5) { S.video.pause(); askLesson(q, i); return; }
			}
		}
		// 2. A Learning word just said (at most one quiz every 3 minutes)
		if (!prefs.wordQuiz || S.gaming || !S.sentToks || !S.sents.length) return;
		var ms = t * 1000, k = find(S.sents, ms, null);
		var ended = k - 1;
		if (k >= 0 && ms > S.sents[k].end) ended = k;
		if (ended < 0 || ended === S.lastEnded) return;
		S.lastEnded = ended;
		if (Date.now() - S.quizAt < 180000 || ms - S.sents[ended].end > 1500) return;
		var nearLesson = S.lesson && S.lesson.questions.some(function (q) { return Math.abs(q.t - t) < 20; });
		if (nearLesson) return;
		var tok = (S.sentToks[ended] || []).filter(function (x) { return x.status === 'learning' && x.listed && !S.quizzed[x.lemma] && /^[A-Za-z][a-z'-]+$/.test(x.text); })[0];
		if (!tok) return;
		S.quizzed[tok.lemma] = 1;
		S.quizAt = Date.now();
		S.video.pause();
		askWord(ended, tok);
	}

	function showQuiz(html) {
		var el = S.root.querySelector('.quiz');
		el.innerHTML = html;
		el.hidden = false;
		return el;
	}
	function closeQuiz(play) {
		var el = S.root && S.root.querySelector('.quiz');
		if (el) { el.hidden = true; el.innerHTML = ''; }
		if (play && S.video) S.video.play();
	}

	function askLesson(q, i) {
		var u = U.esc, L = S.lesson;
		var body = q.type === 'blank'
			? '<input class="qi" placeholder="Type the missing word" autocomplete="off"><div class="qa"><span></span><button class="go" data-q="send">Check</button></div>'
			: '<div class="qo">' + q.options.map(function (o, k) { return '<button data-k="' + k + '">' + u(o) + '</button>'; }).join('') + '</div>';
		var el = showQuiz('<div class="qh">Question ' + (i + 1) + ' of ' + L.questions.length + ' · from Sherif</div><p class="qq">' + u(q.q).replace(/_{3,}/g, '<u></u>') + '</p>' + body + '<div class="out"></div>'
			+ '<div class="qa"><button class="lk" data-q="rewatch">↺ Watch that part again</button></div>');
		var send = function (a, btn) {
			U.send('lessonAnswer', { id: L.id, qid: q.id, a: a }).then(function (r) {
				L.answers[q.id] = { a: a, ok: r.ok };
				paintLessonInfo();
				el.querySelectorAll('.qo button').forEach(function (b) { b.disabled = true; });
				if (btn) btn.classList.add(r.ok ? 'r' : 'w');
				var right = el.querySelector('.qo button[data-k="' + r.answer + '"]'); if (right) right.classList.add('r');
				el.querySelector('.out').innerHTML = '<div class="fb ' + (r.ok ? 'ok' : 'no') + '"><b>' + (r.ok ? 'Correct ✓ +5 XP' : 'Not quite' + (q.type === 'blank' ? ' — it\'s “' + u(r.answer) + '”' : '')) + '</b>'
					+ (r.why ? '<p>' + u(r.why) + '</p>' : '') + (r.why_ar ? '<p class="ar">' + u(r.why_ar) + '</p>' : '') + (!r.ok && q.word ? '<p style="font-size:13px;color:#8A8584">“' + u(q.word) + '” is now in your Learning words.</p>' : '') + '</div>'
					+ '<div class="qa"><span>' + r.correct + ' right so far · ' + Object.keys(L.answers).length + ' of ' + r.total + ' done</span><button class="go" data-q="cont">Continue ▶</button></div>';
			}, function (err) { say(U.errText(err)); });
		};
		el.onclick = function (e) {
			var b = e.target.closest('button'); if (!b) return;
			if (b.dataset.k != null && !b.disabled) send(+b.dataset.k, b);
			else if (b.dataset.q === 'send') { var v = el.querySelector('.qi').value.trim(); if (v) { b.remove(); el.querySelector('.qi').disabled = true; send(v); } }
			else if (b.dataset.q === 'cont') closeQuiz(true);
			else if (b.dataset.q === 'rewatch') { closeQuiz(false); S.video.currentTime = Math.max(0, q.t - 12); S.video.play(); }
		};
		var inp = el.querySelector('.qi');
		if (inp) { inp.focus(); inp.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') el.querySelector('[data-q=send]') && el.querySelector('[data-q=send]').click(); }; }
	}

	/** "Which word did you hear?" for one of the learner's Learning words in the sentence just said. */
	function askWord(si, tok) {
		var u = U.esc, s = S.sents[si];
		var text = s.text.slice(0, tok.start) + '_____' + s.text.slice(tok.end);
		U.send('distractors', { lemma: tok.lemma, n: 2 }).then(function (ds) {
			var opts = ds.concat([tok.text.toLowerCase()]).sort(function () { return Math.random() - 0.5; });
			var el = showQuiz('<div class="qh">A word you learn · which word did you hear?</div><p class="qq">' + u(text).replace('_____', '<u></u>') + '</p>'
				+ '<div class="qo">' + opts.map(function (o) { return '<button data-w="' + u(o) + '">' + u(o) + '</button>'; }).join('') + '</div><div class="out"></div>'
				+ '<div class="qa"><button class="lk" data-q="again">↺ Hear it again</button><button class="lk" data-q="off">Stop these quizzes</button></div>');
			el.onclick = function (e) {
				var b = e.target.closest('button'); if (!b) return;
				if (b.dataset.w && !b.disabled) {
					var ok = b.dataset.w === tok.text.toLowerCase();
					el.querySelectorAll('.qo button').forEach(function (x) { x.disabled = true; if (x.dataset.w === tok.text.toLowerCase()) x.classList.add('r'); });
					if (!ok) b.classList.add('w');
					el.querySelector('.out').innerHTML = '<div class="fb ' + (ok ? 'ok' : 'no') + '"><b>' + (ok ? 'Correct ✓' : 'It was “' + u(tok.text) + '”') + '</b><p>' + u(s.text) + '</p></div><div class="qa"><span></span><button class="go" data-q="cont">Continue ▶</button></div>';
				} else if (b.dataset.q === 'again') { S.stopAt = s.end; S.video.currentTime = Math.max(0, s.start / 1000 - 0.05); S.video.play(); }
				else if (b.dataset.q === 'off') { setPref('wordQuiz', false); closeQuiz(true); say('Word quizzes are off. Turn them on again in Further Controls.'); }
				else if (b.dataset.q === 'cont') closeQuiz(true);
			};
		}, function () { S.video.play(); });
	}

	function paintLessonInfo() {
		var el = S.sRoot && S.sRoot.querySelector('.lq');
		if (!el) return;
		var L = S.lesson, n = L ? Object.keys(L.answers).length : 0;
		el.innerHTML = (L ? '<b>🎯 Quiz from Sherif:</b> ' + L.questions.length + ' questions' + (n ? ' · ' + n + ' answered' : ' · the video stops to ask them') : '')
			+ (S.isAdmin ? (L ? ' · ' : '') + '<a data-lq="make">' + (L ? 'Edit this quiz' : 'Make a quiz from this video') + '</a>' : '');
	}

	/** Admin: send this video's captions to make a quiz draft in WordPress. */
	function makeQuiz() {
		if (!S.sents.length) return say('Captions are still loading.');
		say('Sending the transcript…');
		U.send('lessonDraft', { videoId: S.videoId, title: (document.title || '').replace(/ - YouTube$/, ''), lines: S.sents.map(function (s) { return { start: s.start / 1000, text: s.text }; }) })
			.then(function () { say('Draft made. Add key words and generate questions in the new tab.'); }, function (err) { say(U.errText(err)); });
	}

	function checkStop() {
		if (S.stopAt && S.video && S.video.currentTime * 1000 >= S.stopAt - 120) atStop();
	}

	/** Reached the end of a "play only this" sentence: stop, or in a loop, pause for the student to say it, then replay. */
	function atStop() {
		S.stopAt = 0;
		S.video.pause();
		var s = S.loopI >= 0 && S.sents[S.loopI];
		if (!s) { if (window.LensControls && LensControls.shadowOn() && !S.gaming) LensControls.yourTurn(currentSentence()); return; }
		clearTimeout(S.loopT);
		S.loopT = setTimeout(function () { if (S.sents[S.loopI] === s) play(s.start, s.end, true); }, Math.min(6000, Math.max(1500, s.end - s.start + 500)));
	}
	/** Loop (shadowing): the sentence repeats, with a pause after each time for the student to repeat it. */
	function stopLoop() {
		clearTimeout(S.loopT);
		S.loopI = -1;
		markLoop();
		if (S.root) S.root.querySelectorAll('[data-a=loop]').forEach(function (b) { b.classList.remove('on'); });
	}
	function markLoop() {
		if (!S.sRoot) return;
		S.sRoot.querySelectorAll('.s').forEach(function (r) {
			var on = +r.dataset.i === S.loopI, btn = r.querySelector('[data-a=once]'), note = r.querySelector('.loopnote');
			r.classList.toggle('looping', on);
			if (btn) btn.classList.toggle('on', on);
			if (S.root) S.root.querySelectorAll('[data-a=loop]').forEach(function (b) { b.classList.toggle('on', S.loopI >= 0); });
			if (on && !note) r.querySelector('.body').insertAdjacentHTML('beforeend', '<div class="loopnote">🔁 Looping: say it after the speaker. Tap 🔁 again to stop.</div>');
			if (!on && note) note.remove();
		});
	}

	function tick(force) {
		if (S.host && S.host.parentNode) useVideo(S.host.parentNode.querySelector('video'));
		if (!S.video || !S.root) return;
		if (document.querySelector('#movie_player.ad-showing')) {
			if (S.idx !== -2) {
				S.idx = -2;
				paintLine(-1);
			}
			return;
		}
		var ms = S.video.currentTime * 1000;
		if (S.stopAt && ms >= S.stopAt) atStop();
		if (window.LensControls) LensControls.tick(ms, find(S.sents, ms, null));
		if (Card.isOpen() && S.pausedByUs) return;
		var i = find(S.cues, ms, 400);
		if (i !== S.idx || force) {
			S.idx = i;
			paintLine(i);
		}
		if (S.sents.length) {
			var j = find(S.sents, ms, null);
			if (j !== S.sIdx) {
				// Auto-pause: stop at the end of every sentence.
				if (stopEnd() && !S.gaming && j >= 0 && !S.video.paused && !S.stopAt) S.stopAt = S.sents[j].end;
				if (S.sRoot) {
					var prev = S.sRoot.querySelector('.s.now');
					if (prev) prev.classList.remove('now');
					var row = S.sRoot.querySelector('.s[data-i="' + j + '"]');
					if (row) {
						row.classList.add('now');
						if (S.follow && Date.now() - S.scrolledAt > 5000 && !Card.isOpen()) {
							var list = S.sRoot.querySelector('.list');
							var y = list.scrollTop + row.getBoundingClientRect().top - list.getBoundingClientRect().top;
							list.scrollTo({ top: Math.max(0, y - list.clientHeight / 3), behavior: 'smooth' });
						}
					}
				}
				S.sIdx = j;
				wantTr(j);
				paintTr();
			}
		}
	}

	function loop() {
		cancelAnimationFrame(S.raf);
		var last = 0;
		(function f(ts) {
			if (ts - last > 100) {
				last = ts;
				tick(false);
			}
			S.raf = requestAnimationFrame(f);
		})(0);
	}

	/* ------------------------------------------------------------ hotkeys: A previous · S repeat · D next · Q auto-pause */
	document.addEventListener('keydown', function (e) {
		if (!S.sents.length || !S.video || e.ctrlKey || e.metaKey || e.altKey) return;
		var t = e.target;
		if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
		var k = e.key.toLowerCase(), j = currentSentence();
		if (k === 'a') {
			// Within the first second of a sentence go to the previous one, otherwise restart this one.
			var s = S.sents[j];
			var target = s && S.video.currentTime * 1000 - s.start > 1200 ? j : Math.max(0, j - 1);
			play(S.sents[target].start, stopEnd() ? S.sents[target].end : 0);
		} else if (k === 'd') {
			var n = Math.min(S.sents.length - 1, j + 1);
			play(S.sents[n].start, stopEnd() ? S.sents[n].end : 0);
		} else if (k === 's') {
			if (j >= 0) play(S.sents[j].start, S.sents[j].end);
		} else if (window.LensControls && LensControls.key(k)) {
			/* R loop · X slower · W shadow (content/yt-controls.js) */
		} else if (k === 'q') {
			setPref('autoPause', !prefs.autoPause);
			say(!prefs.autoPause ? 'Auto-pause on: the video stops after each sentence' : 'Auto-pause off');
		} else return;
		e.preventDefault();
		e.stopPropagation();
	}, true);

	/* ------------------------------------------------------------ hover, select, clicks */
	var overT = null;
	function onOver(e, where) {
		if (TOUCH || prefs.ytClick) return; // phones (and click mode) open the card on tap/click (onClick / onSideClick)
		var w = e.target.closest && e.target.closest('.wd');
		if (!w) {
			if (Card.isOpen()) Card.keepOpen();
			return;
		}
		if (Card.selectOpen && Card.selectOpen()) return;
		clearTimeout(overT);
		overT = setTimeout(function () { openWord(w, where, 'hover'); }, 350); // a mouse just passing over doesn't open it
	}

	/** Right-click a word (computer): a small menu that sets it to Learn or Known, depending on what it is now. */
	function wordMenu(e, where) {
		var w = e.target.closest && e.target.closest('.wd');
		if (!w) return;
		var toks = where === 'side' ? (function () { var r = w.closest('.s'); return r && S.sentToks ? S.sentToks[+r.dataset.i] : null; })() : (S.lines ? S.lines[S.idx] : null);
		var tk = toks && toks[+w.dataset.k];
		if (!tk || !tk.lemma) return;
		e.preventDefault(); e.stopPropagation();
		var root = where === 'side' ? S.sRoot : S.root, old = root.querySelector('.wctx');
		if (old) old.remove();
		var st = tk.status, m = document.createElement('div');
		m.className = 'wctx';
		m.style.cssText = 'position:fixed;left:' + Math.min(e.clientX, window.innerWidth - 230) + 'px;top:' + Math.min(e.clientY, window.innerHeight - 110) + 'px;z-index:2147483000;background:#17191F;color:#fff;border:1px solid #444;border-radius:10px;padding:5px;box-shadow:0 8px 24px rgba(0,0,0,.5);font:500 14px/1.3 ' + FONT + ';pointer-events:auto;min-width:200px';
		var rows = [];
		if (st !== 'learning') rows.push(['learning', '★ Mark “' + tk.lemma + '” as Learn']);
		if (st !== 'known') rows.push(['known', '✓ Mark “' + tk.lemma + '” as Known']);
		m.innerHTML = rows.map(function (r) { return '<div data-s="' + r[0] + '" style="padding:10px 12px;border-radius:7px;cursor:pointer">' + U.esc(r[1]) + '</div>'; }).join('');
		m.addEventListener('click', function (ev) {
			var b = ev.target.closest('[data-s]'); if (!b) return;
			ev.stopPropagation(); m.remove();
			U.send('mark', { lemma: tk.lemma, status: b.dataset.s }).then(function () { say(b.dataset.s === 'known' ? '“' + tk.lemma + '” is Known' : '“' + tk.lemma + '” is in Learn'); }, function (err) { say(U.errText(err)); });
		});
		root.appendChild(m);
		var off = function (ev) { if (!ev.composedPath().includes(m)) { m.remove(); document.removeEventListener('pointerdown', off, true); } };
		setTimeout(function () { document.addEventListener('pointerdown', off, true); }, 0);
	}

	/** The word card for a caption or transcript word, with its sentence as context. */
	function openWord(w, where, how) {
		var src;
		if (where === 'side') {
			var row = w.closest('.s'), s = row && S.sents[+row.dataset.i];
			if (!s) return;
			src = { text: s.text, start: s.start, end: s.end };
		} else {
			var cue = S.cues[S.idx];
			if (!cue) return;
			// The full sentence around this caption line is the better context.
			var si = find(S.sents, cue.start + 1, null), sent = S.sents[si];
			src = sent && sent.text.indexOf(w.textContent) >= 0 ? { text: sent.text, start: sent.start, end: sent.end } : { text: cue.text, start: cue.start, end: cue.end };
			if ((how === 'hover' ? prefs.pauseHover : prefs.pauseClick) && S.video && !S.video.paused) {
				S.video.pause();
				S.pausedByUs = true;
			}
		}
		Card.show({
			word: w.dataset.e || w.textContent,
			surface: w.textContent,
			grammar: w.closest('.fx') ? w.closest('.fx').dataset.l : '',
			rect: w.getBoundingClientRect(),
			sentence: src.text,
			source: { url: 'https://www.youtube.com/watch?v=' + S.videoId + '&t=' + Math.floor(src.start / 1000), title: document.title.replace(/ - YouTube$/, ''), videoId: S.videoId, startMs: src.start, endMs: src.end },
			onHide: resume,
			onReplay: function (a, b) {
				S.pausedByUs = false;
				play(a, b);
			}
		});
	}

	function onOut(e) {
		if (TOUCH || prefs.ytClick) return;
		var w = e.target.closest && e.target.closest('.wd');
		if (w) {
			clearTimeout(overT);
			Card.hideSoon(450);
		}
	}

	function resume() {
		if (S.pausedByUs && S.video) S.video.play();
		S.pausedByUs = false;
	}

	/** Words selected in the caption box or the transcript: translate, hear, or save them. */
	function onSelect(e, root, where) {
		setTimeout(function () {
			var sel = root.getSelection ? root.getSelection() : window.getSelection();
			var text = sel && !sel.isCollapsed ? String(sel).replace(/\s+/g, ' ').trim() : '';
			if (!e) {
				// Phone selection (no mouseup): only a new selection inside this box or transcript.
				if (!sel || !sel.anchorNode || !root.contains(sel.anchorNode)) return;
				if (text === S.lastSel) return;
				S.lastSel = text;
			}
			if (!/[A-Za-z]{2,}/.test(text) || text.length > 400) return;
			var s;
			if (where === 'side') {
				var node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
				var row = node && node.closest('.s');
				s = row && S.sents[+row.dataset.i];
			} else {
				var cue = S.cues[S.idx];
				var si = cue ? find(S.sents, cue.start + 1, null) : -1;
				s = S.sents[si] || (cue ? { text: cue.text, start: cue.start, end: cue.end } : null);
				if (S.video && !S.video.paused) {
					S.video.pause();
					S.pausedByUs = true;
				}
			}
			if (!s) return;
			clearTimeout(overT);
			Card.hide();
			Card.select({
				text: text,
				sentence: s.text,
				rect: sel.getRangeAt(0).getBoundingClientRect(),
				source: { url: 'https://www.youtube.com/watch?v=' + S.videoId + '&t=' + Math.floor(s.start / 1000), title: document.title.replace(/ - YouTube$/, ''), videoId: S.videoId, startMs: s.start, endMs: s.end },
				onReplay: function (a, b) { play(a, b); }
			});
		}, 10);
	}

	function onClick(e) {
		// Blurred Arabic translation: a tap shows it (phones have no hover); the next caption is blurred again.
		var bt = prefs.blurTrans && e.target.closest('.line.tr');
		if (bt) { bt.classList.toggle('peek'); return; }
		var wd = (TOUCH || prefs.ytClick) && e.target.closest('.wd');
		if (wd) {
			e.stopPropagation();
			return openWord(wd, 'bar');
		}
		var b = e.target.closest('[data-a], .chip');
		if (!b) return;
		e.stopPropagation();
		if (b.classList.contains('chip')) {
			var p = S.root.querySelector('.panel');
			p.classList.toggle('on');
			if (p.classList.contains('on')) paintPanel();
			return;
		}
		doAction(b.dataset.a, b);
	}

	/** The sentence controls, from the player menu (computer) or the row under the player (phone). */
	function doAction(a, b) {
		var j = currentSentence();
		if (a === 'prev' || a === 'next') {
			var n = a === 'next' ? Math.min(S.sents.length - 1, j + 1) : Math.max(0, j - 1);
			if (S.sents[n]) play(S.sents[n].start, stopEnd() ? S.sents[n].end : 0);
		} else if (a === 'repeat') {
			if (S.sents[j]) play(S.sents[j].start, S.sents[j].end);
		} else if (a === 'loop') {
			CTRL_API.loop(j);
		} else if (a === 'autopause') {
			setPref('autoPause', !prefs.autoPause);
		} else if (a === 'more' || a === 'back') {
			var lm = S.root.querySelector('.lensmenu');
			lm.querySelector('.lmmain').hidden = a === 'more';
			lm.querySelector('.lmmore').hidden = a !== 'more';
		} else if (a === 'tipreset') {
			if (window.LensTips) LensTips.reset();
			say('Tips are back');
		} else if (a === 'menu') {
			S.root.querySelector('.menu').classList.toggle('on');
		} else if (a === 'vplist') {
			LensVocals.prepare([]);
		} else if (a === 'prepList') {
			LensVocals.prepare(LensVocals.playlist());
		} else if (a === 'game') {
			startGame();
		} else if (a === 'vocals') {
			if (window.LensVocals) LensVocals.toggle();
		} else if (a === 'side') {
			chrome.storage.local.set({ sidebar: !prefs.sidebar, sideMin: false });
		} else if (a === 'save') {
			var s = S.sents[j];
			if (!s) return;
			b.disabled = true;
			U.send('saveSentence', {
				text: s.text,
				url: 'https://www.youtube.com/watch?v=' + S.videoId + '&t=' + Math.floor(s.start / 1000),
				title: document.title.replace(/ - YouTube$/, ''),
				videoId: S.videoId,
				startMs: s.start,
				endMs: s.end
			}).then(function () {
				var g = b.querySelector('.g') || b;
				g.textContent = b.dataset.done || 'Saved ✓';
				setTimeout(function () {
					g.textContent = b.dataset.t || (b.querySelector('.g') ? '★' : 'Save sentence');
					b.disabled = false;
				}, 1800);
			}, function (err) {
				b.disabled = false;
				say(U.errText(err));
			});
		} else if (a === 'know') {
			b.disabled = true;
			U.send('mark', { lemma: b.dataset.l, status: 'known' }).catch(function (err) { say(U.errText(err)); });
		}
	}

	/* ------------------------------------------------------------ navigation */
	/** Ask the player for captions until they arrive (it ignores us while loading or showing an ad). */
	function primeUntilReady(vid, n) {
		if (vid !== currentVideoId() || (S.videoId === vid && S.cues.length) || n > 15) return;
		if (document.querySelector('#movie_player.ad-showing')) return setTimeout(function () { primeUntilReady(vid, n); }, 2000);
		window.postMessage({ source: 'sawa-lens-ui', type: 'prime' }, location.origin);
		setTimeout(function () { primeUntilReady(vid, n + 1); }, n < 3 ? 1500 : 3000);
	}

	function start() {
		var vid = currentVideoId();
		if (!vid || !/^\/watch/.test(location.pathname)) {
			if (S.host) S.host.remove();
			if (S.side) S.side.remove();
			S.side = null;
			S.videoId = '';
			S.cues = [];
			S.sents = [];
			return;
		}
		// Captions that arrived before this ran (a quick navigation) must not be wiped: that left the video without captions (0.10.2).
		if (S.videoId === vid && (S.primed === vid || S.cues.length)) { S.primed = vid; return; }
		S.primed = vid;
		S.cues = [];
		S.sents = [];
		S.tcues = [];
		S.cueTr = S.sentTr = null;
		S.lines = null;
		S.sentToks = null;
		S.grade = null;
		S.idx = -1;
		S.sIdx = -1;
		S.stopAt = 0;
		S.sounds = {};
		S.lesson = null;
		S.quizzed = {};
		S.quizAt = 0;
		S.lastEnded = -1;
		S.music = null;
		S.subs = null;
		S.songTr = null;
		if (window.LensGame && LensGame.running()) LensGame.stop();
		S.lyrExp = {};
		var tries = 0;
		(function wait() {
			if (document.querySelector('#movie_player video')) {
				mount();
				paintLine(-1);
				paintSide();
				var chip = S.root && S.root.querySelector('.chip');
				if (chip) chip.hidden = true;
				primeUntilReady(vid, 0);
			} else if (tries++ < 40) setTimeout(wait, 250);
		})();
	}

	// Phones: press-and-hold selects words but there is no mouseup, so wait until the selection settles.
	if (TOUCH) {
		var selT = null;
		document.addEventListener('selectionchange', function () {
			clearTimeout(selT);
			selT = setTimeout(function () {
				if (S.sRoot) onSelect(null, S.sRoot, 'side');
				if (S.root) onSelect(null, S.root, 'bar');
			}, 600);
		});
	}

	// YouTube rebuilds the right column on navigation: keep the sidebar in place.
	setInterval(function () { if (S.videoId && prefs.sidebar) mountSide(); }, 2000);
	document.addEventListener('yt-navigate-finish', function () { setTimeout(start, 300); });
	// The phone site has no yt-navigate-finish: notice the address changing instead.
	var lastHref = location.href;
	if (MOBILE) setInterval(function () {
		if (location.href === lastHref) return;
		lastHref = location.href;
		setTimeout(start, 300);
	}, 1000);
	start();
})();
