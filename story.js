// Created with Squiffy 5.1.2
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = '_default';
squiffy.story.sections = {
	'_default': {
		'text': "<p>June 1882. You are sitting in your cottage with your wife. Afternoon sunlight streams through the window. It&#39;s a peaceful summer day.</p>\n<p>Suddenly, there is a knock on the door. You can <a class=\"squiffy-link link-passage\" data-passage=\"ignore the knock\" role=\"link\" tabindex=\"0\">ignore the knock</a> or <a class=\"squiffy-link link-section\" data-section=\"open the door\" role=\"link\" tabindex=\"0\">open the door</a>. </p>",
		'passages': {
			'ignore the knock': {
				'text': "<p>The knocking becomes more insistent. Shuffling over, you <a class=\"squiffy-link link-section\" data-section=\"open the door\" role=\"link\" tabindex=\"0\">open the door</a>.</p>",
			},
		},
	},
	'open the door': {
		'text': "<p>Your good friend, Nahum Gardner, has sought you out unexpectedly. You invite him in.\nHe tells you about a great rock that fell out of the sky and bedded itself in the ground beside the well at his place. </p>\n<p>&quot;It happen&#39;d at noontide. Sounded like a rifle had gone off...a strange kind o&#39; smoke. The big stone came hurtlin&#39; down...&quot;</p>\n<p>You <a class=\"squiffy-link link-section\" data-section=\"go see the meteorite\" role=\"link\" tabindex=\"0\">go see the meteorite</a> or <a class=\"squiffy-link link-section\" data-section=\"stay at home\" role=\"link\" tabindex=\"0\">stay at home</a>.</p>",
		'passages': {
		},
	},
	'go see the meteorite': {
		'text': "<p>The next morning, along with three professors from Miskatonic University, you and your wife go see the weird visitor from unknown stellar space. The stone is not nearly as large as Nahum had described.</p>\n<p>&quot;It&#39;s shrunken,&quot; Nahum says as he points out the big brownish mound above the ripped earth and charred grass.</p>\n<p>&quot;Stones don&#39;t shrink,&quot; one of the professors says.</p>\n<p>The wise men find the rock to be oddly soft, and they gouge a specimen to take back for testing.</p>\n<p>When they decide to come by your house to rest, your wife remarks, &quot;That fragment&#39;s growed smaller.&quot; The scientists seem thoughtful.</p>\n<p>The morning after that, they pass by your place in a great excitement. They tell you about the rock. </p>\n<p>&quot;It was rather queer,&quot; one wise man says. &quot;When we brought a specimen back for testing, it faded wholly away when we put it in a glass beaker. The beaker had gone, too...the stone has an affinity for silicon. It was so odd...&quot; </p>\n<p>Another scientist tells you about other odd properties of the rock: highly malleable, spectral bands unlike any known colours, and so forth. Breathlessly, he talks of new elements, bizarre optical properties, and other things which puzzled men of science are wont to say when faced by the unknown. </p>\n<p>Their words stir up curiosity. Once again, you go to <a class=\"squiffy-link link-section\" data-section=\"see the meteorite\" role=\"link\" tabindex=\"0\">see the meteorite</a>. This time, your wife does not accompany you.</p>",
		'passages': {
		},
	},
	'stay at home': {
		'text': "<p>Nahum seems unduly astonished by a simple rock. You choose to stay home. </p>\n<p>The day after that, professors from Miskatonic University pass by your place. You ask if they are going to Nahum Gardner&#39;s place. Excitedly, they tell you about the rock. </p>\n<p>&quot;It was rather queer,&quot; one wise man says. &quot;When we brought a specimen back for testing, it faded wholly away when we put it in a glass beaker. The beaker had gone, too...seemingly the stone has an affinity for silicon.&quot; </p>\n<p>Another scientist tells you about other odd properties of the rock: highly malleable, spectral bands unlike any known colours, and so forth. Breathlessly, he talks of new elements, bizarre optical properties, and other things which puzzled men of science are wont to say when faced by the unknown. </p>\n<p>Now convinced of the rock&#39;s strangeness, you decide to <a class=\"squiffy-link link-section\" data-section=\"see the meteorite\" role=\"link\" tabindex=\"0\">see the meteorite</a>.</p>",
		'passages': {
		},
	},
	'see the meteorite': {
		'text': "<p>The stone has shrunk. All around the dwindling brown lump near the well is a vacant space, except where the earth has caved in. </p>\n<p>The scientists gouge the rock deeply. As they pry away the smaller mass, a large coloured globule is uncovered. One professor says that its colour is similar to some bands in the meteor&#39;s strange spectrum. He gives it a blow with a hammer, and it bursts with a little <i>pop</i>! Nothing is emitted. Everyone is baffled.</p>\n<p>The next night, there is a thunderstorm. Later in the day, when the scientists pass by your cottage after another visit to Nahum&#39;s, they are bitterly disappointed. </p>\n<p>&quot;The stone was magnetic, and it drew the lightning, according to the farmer,&quot; one of them tells you. &quot;The thing&#39;s completely gone.&quot;</p>\n<p>As the weeks pass, you and Nahum exchange frequent visits. He seems slightly proud of the attention his place has attracted, and speaks often of the meteorite. However, he seems to tire more quickly than before. You think perhaps his age is beginning to tell on him.</p>\n<p>At the time of harvest, Nahum&#39;s orchard prospers as never before. His fruits grow to phenomenal size and unwonted gloss; he orders extra barrels to handle the crop. </p>\n<p>But it&#39;s soon discovered that a stealthy bitterness has crept into the fine flavour of the pears and apples. Even the smallest of bites induces lasting disgust. It&#39;s assumed that the meteorite has poisoned the soil. The entire crop is lost.  </p>\n<p>As winter seeps in, you see Nahum less often than usual. When you do visit, he seems worried, although you can&#39;t fathom the cause. One day, Nahum speaks of <a class=\"squiffy-link link-section\" data-section=\"disturbing footprints in the snow\" role=\"link\" tabindex=\"0\">disturbing footprints in the snow</a>.</p>",
		'passages': {
		},
	},
	'disturbing footprints in the snow': {
		'text': "<p>&quot;There&#39;s suthin&#39; wrong with those prints. Squirrels n&#39; rabbits n&#39; foxes don&#39; jump like that...&quot; </p>\n<p>You listen without interest until one day, driving past Nahum&#39;s house on the way back from Clark&#39;s Corners, you see a rabbit dart across the road. The leaps of the rabbit are long and unsettling. Your horse nearly runs away.</p>\n<p>Afterwards, you give Nahum&#39;s tales more respect. You wonder why the Gardner dogs seem so cowed and quivering every morning; they&#39;ve nearly lost the spirit to bark.</p>\n<p>Throughout the next few months, <a class=\"squiffy-link link-section\" data-section=\"strange happenings\" role=\"link\" tabindex=\"0\">strange happenings</a> continue to occur.</p>",
		'passages': {
		},
	},
	'strange happenings': {
		'text': "<p>A string of peculiar incidences occur: claims of odd woodchucks, odd vegetation, odd insects. Steadily, the other townsfolk begin to avoid the Gardners. By May, you are the only one who ever visits the place, and even your visits have become fewer and fewer. You aren&#39;t sure of the reason, but there is something deeply discomforting about the Gardner place.</p>\n<p>You <a class=\"squiffy-link link-section\" data-section=\"stop coming round\" role=\"link\" tabindex=\"0\">stop coming round</a> or <a class=\"squiffy-link link-section\" data-section=\"continue to visit\" role=\"link\" tabindex=\"0\">continue to visit</a>.</p>",
		'passages': {
		},
	},
	'continue to visit': {
		'text': "<p>No one is surprised at the news of Mrs. Gardner&#39;s madness. The poor woman screams about things that you cannot perceive, and finally, Nahum is forced to lock her up in the attic. By July, she ceases to speak entirely and crawls on all fours. One day, Nahum tells you, &quot;Nabby&#39;s face is gettin&#39; to hev a glow...like the flowers an&#39; plants...&quot;</p>\n<p>You assure him that&#39;s absurd. </p>\n<p>It is on one of your rare visits when you realize that the well water has gone bad. You advise Nahum to dig another well on higher ground to use till the soil is good again, but he ignores your warning. By this time, he has become calloused to strange and unpleasant things.</p>\n<p>Thaddeus goes mad in September after a visit to the well. He shrieks, lapses into inane tittering or whispering, then veers back to shrieking. Nahum allows him to run about for a week before shutting him in an attic room across from his mother&#39;s.</p>\n<p>You dare not speculate on the roots of this madness. Matters of the mind are impenetrable. Instead, you can <a class=\"squiffy-link link-passage\" data-passage=\"urge Nahum to move\" role=\"link\" tabindex=\"0\">urge Nahum to move</a> or <a class=\"squiffy-link link-section\" data-section=\"do nothing\" role=\"link\" tabindex=\"0\">do nothing</a>.</p>",
		'passages': {
			'urge Nahum to move': {
				'text': "<p>&quot;That meteor stone&#39;s poisoned your land,&quot; you say. &quot;Nothing&#39;s growed anymore.&quot; But toxic soil does not explain every queer happening. You cannot give any indisputable reasoning for <i>why</i> the Gardners ought to move. Your words <a class=\"squiffy-link link-section\" data-section=\"do nothing\" role=\"link\" tabindex=\"0\">do nothing</a>.</p>",
			},
		},
	},
	'do nothing': {
		'text': "<p>In October, Nahum staggers into your house with hideous news. Poor Thaddeus has died. You and your wife console the stricken man best you can, but shudder while you do so. Stark terror seems to cling around the Gardners and all they touch.</p>\n<p>With great reluctance, you accompany Nahum home. When night approaches, you rush to leave. </p>\n<p>Only three days later, Nahum lurches into your kitchen, stammering out another sad, desperate tale to your wife. When you arrive home, you hear that little Merwin is gone. </p>\n<p>Two weeks pass with no trace of Nahum. Worried about what may have transpired, you <a class=\"squiffy-link link-section\" data-section=\"visit the Gardners\" role=\"link\" tabindex=\"0\">visit the Gardners</a>.</p>",
		'passages': {
		},
	},
	'stop coming round': {
		'text': "<p>Gradually, you stop trekking over to the Gardners. You convince yourself that Nahum wouldn&#39;t mind. Lately, his entire family has become listless and melancholy, and your visits did not seem to affect them.</p>\n<p>Weeks pass. There is no word from the Gardners. When you run errands in town, no one else has heard any news about the family, either. Eventually, you become worried about what has transpired. Your wife tells you there is no real reason to be concerned. After all, there is nothing <i>truly</i> fearful about rabbits that leap too far, or vegetation with strange colours.</p>\n<p>You <a class=\"squiffy-link link-section\" data-section=\"visit the Gardners\" role=\"link\" tabindex=\"0\">visit the Gardners</a> or <a class=\"squiffy-link link-section\" data-section=\"stay home\" role=\"link\" tabindex=\"0\">stay home</a>.</p>",
		'passages': {
		},
	},
	'stay home': {
		'text': "<p>Summer simmers into autumn. No whispers of the Gardners reach you, but silence is more unsettling than wicked rumors. Still, you avoid visiting Nahum&#39;s place. You are afraid of what you might find there.</p>\n<p>Months pass. In winter, you finally hear some news. One of the townsfolk passed by the Gardner place, which had no smoke curling up into the deep skyey voids, not even in the dead of December. It was quiet, eerily so.</p>\n<p>Perhaps the Gardners finally moved away from that wretched area. You wish Nahum had informed you, but you haven&#39;t visited him in the last half-year. This explanation should put you at ease, but doubt still plagues you. Perhaps his house wasn&#39;t abandoned at all...</p>\n<p>But you cannot bring yourself to visit the place yourself.</p>\n<p>Years unspool. Gradually, the memories of the Gardners and that strange meteorite fade, much like ink on paper. Still, you avoid that blasted heath. A new road is laid curving far toward the south, replacing the road that once ran straight where the Gardner place was.</p>\n<p>Years turn into decades. One day, you are sitting in your cottage alone. Morning sunlight streams through the window. It&#39;s a peaceful summer day.</p>\n<p>Suddenly, there is a knock on the door. Shuffling over, you open it.</p>\n<p>A city surveyor has sought you out unexpectedly. You invite him in. He proposes a resevoir that will bury that strange, unsettling place in eternal, watery slumber. You feel only relief.</p>",
		'passages': {
		},
	},
	'visit the Gardners': {
		'text': "<p>There is no smoke from the chimney. Grey withered grass and leaves mat the ground. Great bare trees claw up at the November sky with a studied malevolence. But Nahum is alive.</p>\n<p>He is sprawled on a couch in the kitchen. When he sees you, he shouts huskily, &quot;Zenas, git more wood!&quot;</p>\n<p>The fireplace is unlit and empty. A cloud of soot blows about in the chill wind that spirals down the chimney.</p>\n<p>&quot;Is the extra wood gud?&quot; Nahum asks, and with dread, you realize the truth. Zenas is gone, and your friend&#39;s mind has done what was needed to protect itself from more sorrow.</p>\n<p>&quot;Where&#39;s Zenas been?&quot; you ask.</p>\n<p>&quot;In the well — he lives in the well — &quot;</p>\n<p>You remember someone else. &quot;What&#39;s happened to Nabby?&quot;</p>\n<p>No clear answer is given, so you troop up to the attic. The room is dark. The window is small and obscured. There is a shadow in the corner, and upon seeing it more clearly, you scream. Strange colours dance before your eyes. Horror numbs you.</p>\n<p>The monstrosity moves as it crumbles. </p>\n<p>You <a class=\"squiffy-link link-section\" data-section=\"kill it\" role=\"link\" tabindex=\"0\">kill it</a> or <a class=\"squiffy-link link-section\" data-section=\"run away\" role=\"link\" tabindex=\"0\">run away</a>.</p>",
		'passages': {
		},
	},
	'kill it': {
		'text': "<p>There are things that cannot be mentioned; what is done in common humanity is sometimes cruelly judged by the law.</p>\n<p>You pick up a heavy stick lying on the attic floor, close your eyes, and thrust downwards.</p>\n<p>As you descend the stairs, a thud echoes below. Your grip tightens on the stick. </p>\n<p>Something has come to meet you. Collapse, greying, and disintegration were already far advanced. </p>\n<p>You do not reach out to touch the distorted parody that had been a face, but listen as bulging lips whisper accursed secrets. When death leeches away all movement, you lay a red checked tablecloth over what is left. Your horse and buggy has run off without you, so you have no choice but to stumble home.</p>\n<p>You <a class=\"squiffy-link link-section\" data-section=\"set out for Arkham\" role=\"link\" tabindex=\"0\">set out for Arkham</a> or <a class=\"squiffy-link link-section\" data-section=\"do not inform anyone\" role=\"link\" tabindex=\"0\">do not inform anyone</a>.</p>",
		'passages': {
		},
	},
	'do not inform anyone': {
		'text': "<p>You cannot bring yourself to notify the proper channels that the Gardner family is no more. You fear that it would only draw more people to the Gardner place, and recoil at the thought. The thing that had once been Nahum and its final words convince you that it is best if nobody else ever sets foot near that well.</p>\n<p>Years unspool. You have never been quite right since that last fateful day. Your mind has bent from those horrible, disintegrated sights. Your dreams are never restful.</p>\n<p>Years turn into decades. One day, you are sitting in your cottage alone. Morning sunlight streams through the window. It&#39;s a peaceful summer day.</p>\n<p>Suddenly, there is a knock on the door. Shuffling over, you open it.</p>\n<p>A city surveyor has sought you out unexpectedly. You invite him in. He proposes a resevoir that will bury that strange, unsettling place in eternal, watery slumber. You hope it will forever blot out those unspeakable secrets.</p>",
		'passages': {
		},
	},
	'set out for Arkham': {
		'text': "<p>When you notify the authorities that the Gardner family is gone, you indulge in no details. You hope there will be no further questioning, but in the end, you are compelled to take three officers to the Gardner farm, along with the coroner, the medical examiner, and the veterinary.</p>\n<p>The afternoon is advancing, and you fear nightfall, but it is some comfort to have so many people with you.</p>\n<p>When you pass by the well, you glance at it aprehensively. When a detective questions you, you admit, &quot;Nahum said somethin&#39; lived in the well that sucks your life out. Some&#39;at growed from a round ball like one we all seen in the meteor stone. He was scared o&#39; it. Didn&#39; even search it for Merwin or Zenas.&quot;</p>\n<p>After that nothing would do but that they empty and explore the well immediately. Pail after pail of rank water is hauled up. You tremble as the discovery is announced. Merwin and Zenas are both there, mainly skeletal.</p>\n<p>All of this defies natural law. What peculiar madness could have made both boys jump into the well? Why is everything so grey and brittle? </p>\n<p>It is the coroner who first notices the glow. Night has fully set in, and a new glow appears to shoot up from the black pit of the well. You give a violent start as a terrible connection is made. You have seen this colour before, in that globule of the meteorite. You&#39;ve seen it again for a fleeting instance in that attic. </p>\n<p>It becomes clear that a faint phosphorescence has begun to pervade the entire house. It glows on the floor and fragment of carpet, and shimmers over the sashes of the small-paned windows. Your mind races. Every healthy living thing must leave immediately.</p>\n<p>You shew the men the back door and everyone files out. Nobody dares to look back until they are far away on the high ground. Finally, when they do, they&#39;re met with a fearsome sight: the farm shines with a hideous color. Without warning, a horrible thing shoots vertically up toward the sky like a rocket. You know that it must be the same thing that Nahum feared.</p>\n<p>The other men turn away, trembling. But you are not so fortunate, for you keep looking for a second longer. And you see something feebly rise, only to sink down again upon the place where the great shapeless horror had shot into the sky. It was just a colour, but a colour you recognise. And you wish you didn&#39;t realise the implication: that this last faint remnant must still lurk down in that well.</p>\n<p>Years unspool. You have never been quite right since that horrible night. Your mind has bent from grotesque fear, always humming below the surface of your thoughts. Your dreams are never restful.</p>\n<p>Years turn into decades. One day, you are sitting in your cottage alone. Morning sunlight streams through the window. It&#39;s a peaceful summer day.</p>\n<p>Suddenly, there is a knock on the door. Shuffling over, you open it.</p>\n<p>A city surveyor has sought you out unexpectedly. You invite him in. He proposes a resevoir that will bury that strange, unsettling place in eternal, watery slumber. You hope it will forever blot out that lurking, otherworldly evil.</p>",
		'passages': {
		},
	},
	'run away': {
		'text': "<p>You scramble down the stairs and slam out the door. Terror propels you forward as you flee. It is only later that you remember you did not even say good-bye to Nahum.</p>\n<p>Several days later, you finally work up the strength to reach out to men in town and troop over to the Gardner place together. Your worst fears are confirmed. There is nothing living left in the house. Amongst that wreckage, something feels inexplicably evil, and your group is quick to leave.</p>\n<p>Years unspool. You will never go near that place again. You have never been quite right since that last fateful day, and shudder to think of what may have happened had you stayed any longer. Your dreams are rarely restful.</p>\n<p>Years turn into decades. One day, you are sitting in your cottage alone. Morning sunlight streams through the window. It&#39;s a peaceful summer day.</p>\n<p>Suddenly, there is a knock on the door. Shuffling over, you open it.</p>\n<p>A city surveyor has sought you out unexpectedly. You invite him in. He proposes a resevoir that will bury that strange, unsettling place in eternal, watery slumber. You can only be glad.</p>",
		'passages': {
		},
	},
}
})();
