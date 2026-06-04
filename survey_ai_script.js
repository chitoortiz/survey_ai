// ============================================================
// SURVEY AI INTERVENTION SCRIPT
// Hosted centrally — loaded once via LimeSurvey's global
// "Additional HTML headers" setting:
//   <script src="https://your-host.example/survey_ai_script.js"></script>
//
// Each survey page only needs a small stub in its "Text before
// questions" field that sets window.SURVEY_PAGE_SWITCHES.
// See the setup guide for per-page stubs.
// ============================================================

(function () {

    $(document).on('ready pjax:scriptcomplete', function () {

        // ── Read per-page config from stub, fall back to safe defaults ──
        var SW = window.SURVEY_PAGE_SWITCHES || {};

        var SWITCHES = {
            enableLogging:      SW.enableLogging      !== undefined ? SW.enableLogging      : true,
            showConsoleLogs:    SW.showConsoleLogs     !== undefined ? SW.showConsoleLogs     : true,
            pageId:             SW.pageId              || "page_unknown",
            questionTopic:      SW.questionTopic       || "unknown topic",

            // "matrix" | "single-choice" | "numeric" | "list-numeric"
            // "narrative" | "list-narrative" | "cata" | "other"
            questionType:       SW.questionType        || "other",

            trackMiddleValues:  SW.trackMiddleValues   !== undefined ? SW.trackMiddleValues   : false,
            middleValueCode:    SW.middleValueCode      || "",

            enableAI:           SW.enableAI            !== undefined ? SW.enableAI            : true,
            enableHistoryRead:  SW.enableHistoryRead   !== undefined ? SW.enableHistoryRead   : true,
            aiApiKey:           SW.aiApiKey             || "",

            personalityPages:   SW.personalityPages    || [],
            personalityItemMap: SW.personalityItemMap  || {},

            qualityIndicators:      SW.qualityIndicators      || [],
            availableInterventions: SW.availableInterventions || [],
            definitionTerms:        SW.definitionTerms        || [],

            // CATA: set to a number to enable the selection ratio (saved to page snap only)
            cataExpectedCount:  SW.cataExpectedCount   !== undefined ? SW.cataExpectedCount   : null,

            // Matrix: scale endpoints used for DoD max, acquiescence + extremity
            matrixScaleMin:     SW.matrixScaleMin      !== undefined ? SW.matrixScaleMin      : 1,
            matrixScaleMax:     SW.matrixScaleMax      !== undefined ? SW.matrixScaleMax      : 5,

            // ── AI system prompt ──────────────────────────────────────
            aiSystemPrompt: [
                "GENERAL ATTITUDE",
                "You are an assistant to respondents in a web survey. Your role is to help them provide high-quality answers by delivering prompts when necessary. These prompts are additional to the question stem and response categories specified in the questionnaire — the question stem and response categories are fixed and will not be altered.",
                "",
                "You decide whether a respondent needs a prompt for the current survey question based on their behaviour when answering previous questions. You will be provided with data quality indicators and respondent characteristics to support this decision.",
                "",
                "IMPORTANT: Do not draw conclusions from any single indicator or small subset. Only make a decision once you have considered all indicators together and evaluated the overall pattern they form as a whole. Ignore isolated cues; only a consistent aggregate picture should trigger a decision.",
                "",
                "DATA QUALITY INDICATORS",
                "You will be provided with the following indicators describing the respondent's previous response behaviour:",
                "",
                "- Nondifferentiation (DoD): Ranges from 0 to 1. Higher values indicate better data quality. The maximum possible DoD value depends on the number of items and scale categories — you will be told the theoretical maximum for the current page. Compare the observed DoD against this maximum when assessing quality.",
                "- Roundness: Ranges from 0 to 1. Lower values indicate better data quality.",
                "- Don't Know (DK): Dichotomous (0/1). Indicates whether a respondent chose the 'don't know' option. 0 = better quality.",
                "- Item missing: Dichotomous (0/1). Indicates whether a respondent did not answer a previous question. 0 = better quality.",
                "- Relative response time (speedRatio): Indicates how fast or slow the respondent answered. Low values indicate low quality; values near 1 indicate acceptable quality; high values indicate the respondent took sufficient time.",
                "- Number of words: Indicates the number of words in an answer to an open-ended narrative question. Ranges from 0 to 100. Higher values indicate better quality.",
                "- CATA selected count: Number of options checked in a check-all-that-apply question. Compare with the expected count if provided.",
                "- CATA selection ratio: Actual selections divided by expected selections. Values near 1 indicate good quality.",
                "- Acquiescence index: Ranges from 0 to 1. High values indicate the respondent frequently selected the extreme ends of the scale (maximum or minimum), which may signal acquiescence bias.",
                "- Extremity index: Ranges from 0 to 1. High values indicate the respondent frequently answered at either extreme of the scale.",
                "",
                "RESPONDENT CHARACTERISTICS",
                "You will also receive the following information about the respondent:",
                "",
                "Demographic information: gender, age group, income, and level of general education.",
                "",
                "Personality traits:",
                "- Receptivity to prompts: Low values indicate low receptivity; high values indicate high receptivity. Tailor the tone and directness of the prompt accordingly.",
                "- Reactance: Low values indicate low reactance; high values indicate high reactance. High reactance may cause aversive behaviour in response to prompts — if high, use subtle, autonomy-preserving language and avoid an instructional tone.",
                "- Maximizing: High values indicate a tendency to seek the best possible response by carefully weighing alternatives. Low values indicate a 'good enough' satisficing approach.",
                "- Need for Cognition (NfC): The tendency to seek out demanding and intensive thinking. Correlates positively with high-quality survey answers. High NfC respondents welcome richer, more detailed explanations.",
                "",
                "TYPES OF PROMPTS",
                "If you decide a prompt is necessary, select the most appropriate type from those available for the current page (listed in the page context below). Available prompt types are a subset of the following:",
                "",
                "- unspecific_motivation: Motivate the respondent to put effort into answering in a way suited to this specific respondent.",
                "- more_words: Motivate the respondent to answer with a higher number of words, with details and elaboration.",
                "- more_topics: Motivate the respondent to answer with more different themes and a broader scope.",
                "- slow_down: Motivate the respondent to take sufficient time to understand the question and consider relevant thoughts.",
                "- cata_consider_all: Motivate the respondent to consider all response categories in a check-all-that-apply question and understand that more than one answer may be appropriate.",
                "- cata_target_count: Motivate the respondent to select the specific number of response categories indicated in the question — not fewer, not more.",
                "- recall_and_count: When the question asks for a count of behaviours or events, motivate the respondent to recall each instance individually and report a precise number.",
                "- precise_numeric: Motivate the respondent to report a precise number rather than a round value.",
                "- differentiate: Motivate the respondent to consider the full range of response categories in a matrix or multi-item question and differentiate more among their answers to different items.",
                "- avoid_extremes: Motivate the respondent to consider the full range of response categories and avoid selecting only extreme (maximally positive or maximally negative) options.",
                "- read_carefully: Motivate the respondent to read the entire question stem carefully and develop a full understanding before responding.",
                "- definition: Identify a word or expression in the question that may cause difficulty and provide a plain-language definition tailored to this respondent. If this type is selected, your message must include the definition.",
                "- significance: Emphasise the importance that a valid answer has for science in a way the respondent may value. Use parsimoniously — only if another prompt type is not preferable.",
                "",
                "DECISION RULES",
                "- Base your decision primarily on the most recently completed page(s). If a respondent was disengaged early but improved recently, do not intervene based on old data.",
                "- Even mild recent signals (slightly fast, a few DKs) warrant consideration if they form a consistent pattern.",
                "- Only select prompt types listed as available for the current page.",
                "- Tailor message tone to reactance and receptivity scores.",
                "- If 'definition' is available and DK signals are present, use the term list provided to personalise the definition.",
                "- Keep any message to a maximum of 2 sentences.",
                "",
                "You must respond with a valid JSON object and nothing else.",
                "No markdown, no backticks, no explanation outside the JSON.",
                "Use this exact schema:",
                '{ "intervene": true or false, "types": ["type_name"], "message": "The message shown to the participant, or null if not intervening.", "reasoning": "1-2 sentences explaining your decision for the researcher." }'
            ].join("\n")
        };

        // ============================================================
        // INTERNALS
        // ============================================================

        var STORAGE_KEY  = "survey_logs";
        var DK_CODE      = "DK";
        var AI_MODEL     = "gpt-4.1-nano";
        var AI_ENDPOINT  = "https://api.openai.com/v1/chat/completions";
        var MS_PER_WORD  = 300;   // reading time: 300 ms per word, no extra answering time
        var PAGE_LOAD_MS = Date.now();

        if (!SWITCHES.enableLogging) return;

        var $syncTarget   = $('.log-storage-field').find('input[type="text"], textarea');
        var $allQuestions = $('.question-container');

        // ── DoD maximum calculator ────────────────────────────────────
        // Theoretical maximum DoD for N items distributed across K scale
        // categories as evenly as possible (verified against spreadsheet).
        // Formula: 1 - [ remainder*(base+1)^2 + (K-remainder)*base^2 ] / N^2
        // where base = floor(N/K), remainder = N mod K.
        function calcDodMax(nItems, nCategories) {
            if (!nItems || !nCategories || nItems < 1 || nCategories < 1) return null;
            var base      = Math.floor(nItems / nCategories);
            var remainder = nItems % nCategories;
            var sos       = (remainder * Math.pow(base + 1, 2) +
                            (nCategories - remainder) * Math.pow(base, 2)) /
                            Math.pow(nItems, 2);
            return parseFloat((1 - sos).toFixed(4));
        }

        // ── Storage helpers ───────────────────────────────────────────

        function readStorage() {
            var raw = localStorage.getItem(STORAGE_KEY);
            return (raw && raw !== "") ? JSON.parse(raw) : {};
        }

        function emptyPageSnap() {
            return {
                questionType:       SWITCHES.questionType,
                pageLoadMs:         PAGE_LOAD_MS,
                timeOnPage:         null,
                expectedMs:         null,
                speedRatio:         null,
                dkCount:            null,
                dkQuestions:        {},
                missingCount:       null,
                missingQuestions:   {},
                DoD:                null,
                DoDMax:             null,
                acquiescence:       null,
                extremity:          null,
                middleValueCount:   null,
                onlyMiddleValues:   null,
                narrativeChars:     {},
                singleChoiceValue:  null,
                cataValues:         {},
                cataSelectedCount:  null,
                cataSelectionRatio: null,
                numericValues:      {},
                dateValues:         {},
                aiResult:           null,
                clicks:             {}
            };
        }

        function writeStorage(data) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

            if ($syncTarget.length > 0) {
                var pageKeys = Object.keys(data).filter(function (key) {
                    return key.indexOf('page_') === 0 && key !== SWITCHES.pageId;
                });
                if (pageKeys.length > 0) {
                    pageKeys.sort();
                    var prevPageId = pageKeys[pageKeys.length - 1];
                    var exportData = {};
                    exportData[prevPageId] = data[prevPageId];
                    $syncTarget.val(JSON.stringify(exportData)).trigger('change');
                } else {
                    var currentData = {};
                    currentData[SWITCHES.pageId] = data[SWITCHES.pageId];
                    $syncTarget.val(JSON.stringify(currentData)).trigger('change');
                }
            }
        }

        function log(msg) {
            if (SWITCHES.showConsoleLogs) console.log("[SurveyLogger] " + msg);
        }

        // ── Initialise page snap ──────────────────────────────────────

        (function initPageSnap() {
            var data = readStorage();
            if (!data[SWITCHES.pageId]) {
                data[SWITCHES.pageId] = emptyPageSnap();
                writeStorage(data);
                log("Page snap initialised for " + SWITCHES.pageId);
            }
        })();

        // ── Reading speed ─────────────────────────────────────────────

        function extractQuestionText() {
            var words = [];
            $allQuestions.each(function () {
                var $q = $(this);
                $q.find('.question-text, .ls-label-question, legend, label.control-label').each(function () {
                    var text = $(this).text().trim();
                    if (text) words.push(text);
                });
                $q.find('.answer-text, .ls-label-answer, li label, .radio label, .checkbox label').each(function () {
                    var text = $(this).text().trim();
                    if (text) words.push(text);
                });
            });
            var fullText = words.join(" ");
            log("Extracted " + fullText.split(/\s+/).length + " words for speed calculation.");
            return fullText;
        }

        function calcExpectedMs(text) {
            if (!text || text.trim() === "") return null;
            return Math.round(text.trim().split(/\s+/).length * MS_PER_WORD);
        }

        function calcSpeedRatio(actualMs, expectedMs) {
            if (!actualMs || !expectedMs || expectedMs === 0) return null;
            return parseFloat((actualMs / expectedMs).toFixed(3));
        }

        // ── Roundness (extracts all numeric tokens from any string) ──

        function calcRoundnessFromText(raw) {
            if (!raw || raw.trim() === "") return null;
            var tokens = raw.match(/-?\d+(\.\d+)?/g);
            if (!tokens || tokens.length === 0) return null;
            var scores = [];
            tokens.forEach(function (token) {
                var val = parseFloat(token);
                if (isNaN(val) || val === 0) return;
                var absVal = Math.abs(Math.round(val));
                var strVal = String(absVal);
                var m = strVal.length;
                if (m >= 2) {
                    var n = strVal.replace(/0+$/, "").length || 1;
                    scores.push((m - n) / (m - 1));
                }
            });
            if (scores.length === 0) return null;
            var sum = scores.reduce(function (a, b) { return a + b; }, 0);
            return parseFloat((sum / scores.length).toFixed(3));
        }

        // ── Missing item detection ────────────────────────────────────
        // For matrix questions: tracks unanswered rows individually.
        // qMap[qID] = { missing: bool, rows: { rowName: bool, ... } }
        // For all other types: qMap[qID] = { missing: bool }

        function collectMissingData() {
            var count = 0;
            var qMap  = {};

            $allQuestions.each(function () {
                var $q  = $(this);
                var qID = $q.attr('id').replace('question', '');

                // ── Matrix: check each row independently ──────────────
                var $rows = $q.find('.answers-list.radio-list, .subquestion-list .answers-list');
                if ($rows.length > 0) {
                    var rowMap      = {};
                    var anyMissing  = false;
                    $rows.each(function () {
                        var $row    = $(this);
                        var $radios = $row.find('input[type="radio"]');
                        if ($radios.length === 0) return; // not an answerable row
                        var rowName = $radios.first().attr('name') || $row.attr('id') || $row.index();
                        var answered = $radios.filter(':checked').length > 0;
                        rowMap[rowName] = !answered;
                        if (!answered) { anyMissing = true; count++; }
                    });
                    qMap[qID] = { missing: anyMissing, rows: rowMap };
                    return; // skip the generic checks below for matrix questions
                }

                // ── All other question types ──────────────────────────
                var missing = false;
                var $radios = $q.find('input[type="radio"]');
                if ($radios.length > 0 && $radios.filter(':checked').length === 0) missing = true;
                $q.find('select').each(function () {
                    var v = $(this).val();
                    if (!v || v === "" || v === "0") missing = true;
                });
                var $cbs = $q.find('input[type="checkbox"]:not([value="DK"])');
                if ($cbs.length > 0 && $radios.length === 0 && $cbs.filter(':checked').length === 0) missing = true;
                $q.find('input[type="text"]:not(.date), input[type="number"], textarea').each(function () {
                    if ($(this).val().trim() === "") missing = true;
                });
                var hasAnswerable = $radios.length > 0 ||
                                    $q.find('select').length > 0 ||
                                    $q.find('input[type="checkbox"]').length > 0 ||
                                    $q.find('input[type="text"]:not(.date), input[type="number"], textarea').length > 0;
                if (hasAnswerable) {
                    qMap[qID] = { missing: missing };
                    if (missing) count++;
                }
            });
            return { count: count, questions: qMap };
        }

        function markMissingQuestions(missingMap) {
            $allQuestions.each(function () {
                var $q   = $(this);
                var qID  = $q.attr('id').replace('question', '');
                var info = missingMap[qID];

                // Clear any previous markers in this question
                $q.find('.survey-missing-marker').remove();

                if (!info || !info.missing) return;

                // ── Matrix: mark each unanswered row individually ─────
                if (info.rows) {
                    $q.find('.answers-list.radio-list, .subquestion-list .answers-list').each(function () {
                        var $row    = $(this);
                        var $radios = $row.find('input[type="radio"]');
                        if ($radios.length === 0) return;
                        var rowName = $radios.first().attr('name') || $row.attr('id') || $row.index();
                        if (info.rows[rowName]) {
                            // Find the closest table row or container to attach the marker to
                            var $tr = $row.closest('tr');
                            var $marker = $('<td class="survey-missing-marker" style="' +
                                'background:#fff3cd;border-left:3px solid #ffc107;' +
                                'padding:2px 8px;font-size:11px;color:#856404;' +
                                'white-space:nowrap;">⚠ Not answered</td>');
                            if ($tr.length) {
                                // Append as an extra cell in the table row
                                $tr.append($marker);
                            } else {
                                // Fallback: insert a div after the row container
                                $row.after($('<div class="survey-missing-marker" style="' +
                                    'background:#fff3cd;border-left:3px solid #ffc107;' +
                                    'padding:2px 8px;margin-top:2px;font-size:11px;color:#856404;' +
                                    'border-radius:3px;">⚠ Not answered</div>'));
                            }
                        }
                    });
                    return;
                }

                // ── All other types: mark the whole question ──────────
                $q.prepend($('<div class="survey-missing-marker" style="' +
                    'background:#fff3cd;border-left:4px solid #ffc107;' +
                    'padding:4px 10px;margin-top:6px;font-size:12px;color:#856404;' +
                    'border-radius:3px;">⚠ This question has not been answered.</div>'));
            });
        }

        // ── DK detection ──────────────────────────────────────────────

        function collectDkData() {
            var count = 0;
            var qMap  = {};
            $allQuestions.each(function () {
                var $q   = $(this);
                var qID  = $q.attr('id').replace('question', '');
                var isDk = false;
                var $checked = $q.find('input[type="radio"]:checked');
                if ($checked.length > 0 && $checked.val() === DK_CODE) isDk = true;
                if (!isDk) {
                    $q.find('select').each(function () { if ($(this).val() === DK_CODE) isDk = true; });
                }
                if (!isDk) {
                    $q.find('input[type="checkbox"]:checked').each(function () { if ($(this).val() === DK_CODE) isDk = true; });
                }
                var hasInput = $checked.length > 0 ||
                               $q.find('select').length > 0 ||
                               $q.find('input[type="checkbox"]').length > 0;
                if (hasInput) {
                    qMap[qID] = isDk;
                    if (isDk) count++;
                }
            });
            return { count: count, questions: qMap };
        }

        // ── Personality score calculation ─────────────────────────────

        function calcPersonalityScores(pageId) {
            var itemMap = SWITCHES.personalityItemMap[pageId];
            if (!itemMap || itemMap.length === 0) return null;
            var data = readStorage();
            var page = data[pageId];
            if (!page) return null;
            var scaleData = {};
            itemMap.forEach(function (item) {
                var rawValue = null;
                for (var key in page.clicks) {
                    if (key.indexOf(item.qSubId) !== -1 && page.clicks[key].val_final) {
                        var parts     = page.clicks[key].val_final.split(":");
                        var candidate = parts.length > 1 ? parseInt(parts[parts.length - 1].trim(), 10) : NaN;
                        if (!isNaN(candidate)) rawValue = candidate;
                        break;
                    }
                }
                if (rawValue === null) return;
                var coded = item.reverseCode ? (6 - rawValue) : rawValue;
                if (!scaleData[item.scale]) scaleData[item.scale] = { sum: 0, count: 0, totalItems: 0 };
                scaleData[item.scale].sum   += coded;
                scaleData[item.scale].count += 1;
            });
            itemMap.forEach(function (item) {
                if (scaleData[item.scale]) scaleData[item.scale].totalItems++;
            });
            var scores = {};
            if (scaleData["NfC"])      { var d = scaleData["NfC"];      scores["NfC"]      = d.count <= 2 ? null : parseFloat(((d.sum / d.count * 4) - 4).toFixed(2)); }
            if (scaleData["MMS"])      { var d = scaleData["MMS"];      scores["MMS"]      = d.count <= 3 ? null : parseFloat(((d.sum / d.count * 5) - 5).toFixed(2)); }
            if (scaleData["Reaktanz"]) { var d = scaleData["Reaktanz"]; scores["Reaktanz"] = d.count <= 4 ? null : parseFloat(((d.sum / d.count * 8) - 8).toFixed(2)); }
            log("Personality scores for " + pageId + ": " + JSON.stringify(scores));
            return scores;
        }

        function savePersonalityScores(pageId) {
            var scores = calcPersonalityScores(pageId);
            if (!scores) return;
            var data = readStorage();
            var page = data[pageId] || emptyPageSnap();
            page.personalityScores = scores;
            page.clicks = {};
            data[pageId] = page;
            writeStorage(data);
            log("Personality scores saved and raw clicks cleared for " + pageId);
        }

        // ── Live tracking: narrative character counter ─────────────────

        if (SWITCHES.questionType === "narrative" || SWITCHES.questionType === "list-narrative") {
            $allQuestions.find('textarea').each(function () {
                var $ta      = $(this);
                var qID      = $ta.closest('.question-container').attr('id').replace('question', '');
                var $counter = $('<div style="font-size:12px;color:#888;margin-top:4px;">0 characters</div>');
                $ta.after($counter);
                $ta.on('input', function () {
                    var len = $ta.val().length;
                    $counter.text(len + " character" + (len !== 1 ? "s" : ""));
                    var data = readStorage();
                    var page = data[SWITCHES.pageId] || emptyPageSnap();
                    if (!page.narrativeChars) page.narrativeChars = {};
                    page.narrativeChars[qID] = len;
                    data[SWITCHES.pageId] = page;
                    writeStorage(data);
                });
            });
            log("Character counter enabled.");
        }

        // ── Live tracking: numeric roundness indicator ─────────────────

        if (SWITCHES.questionType === "numeric" || SWITCHES.questionType === "list-numeric") {
            $allQuestions.find('input[type="number"], input[type="text"]').each(function () {
                var $inp = $(this);
                var qID  = $inp.closest('.question-container').attr('id').replace('question', '');
                var $bar = $(
                    '<div style="margin-top:6px;">' +
                        '<span style="font-size:11px;color:#888;">Roundness: </span>' +
                        '<span class="roundness-dots" style="letter-spacing:3px;">○○○○○</span>' +
                    '</div>'
                );
                $inp.after($bar);
                $inp.on('input', function () {
                    var raw        = $inp.val().trim();
                    var roundness  = calcRoundnessFromText(raw);
                    var primaryVal = parseFloat(raw.replace(/[^0-9.\-]/g, ''));
                    var dots       = "○○○○○";
                    if (roundness !== null) {
                        var filled = Math.round(roundness * 5);
                        dots = "●".repeat(filled) + "○".repeat(5 - filled);
                    }
                    $bar.find('.roundness-dots').text(dots);
                    var data = readStorage();
                    var page = data[SWITCHES.pageId] || emptyPageSnap();
                    if (!page.numericValues) page.numericValues = {};
                    page.numericValues[qID] = { value: isNaN(primaryVal) ? null : primaryVal, roundness: roundness };
                    data[SWITCHES.pageId] = page;
                    writeStorage(data);
                });
            });
            log("Roundness indicator enabled.");
        }

        // ── Live tracking: single-choice ──────────────────────────────

        if (SWITCHES.questionType === "single-choice") {
            $allQuestions.find('input[type="radio"]').on('change.logger', function () {
                var $radio = $(this);
                var val    = $radio.val();
                var label  = $radio.closest('li, .answer, .radio, label')
                                   .find('.answer-text, .ls-label-answer, label').first().text().trim();
                if (!label) label = $radio.next('label').text().trim();
                if (!label) label = val;
                var data = readStorage();
                var page = data[SWITCHES.pageId] || emptyPageSnap();
                page.singleChoiceValue = { value: val, label: label };
                data[SWITCHES.pageId]  = page;
                writeStorage(data);
                log("Single-choice saved: " + val + " (\"" + label + "\")");
            });
            log("Single-choice live tracking enabled.");
        }

        // ── Live tracking: CATA (selection count saved to snap on submit only) ──

        if (SWITCHES.questionType === "cata") {
            $allQuestions.find('input[type="checkbox"]').on('change.logger', function () {
                var $cb    = $(this);
                var val    = $cb.val();
                var checked = $cb.is(':checked');
                var name   = $cb.attr('name') || val;
                var optKey = "opt_" + name + "_" + val;
                var label  = $cb.closest('li, .answer, .checkbox, label')
                                .find('.answer-text, .ls-label-answer, label').first().text().trim();
                if (!label) label = $cb.next('label').text().trim();
                if (!label) label = val;
                var data = readStorage();
                var page = data[SWITCHES.pageId] || emptyPageSnap();
                if (!page.cataValues) page.cataValues = {};
                page.cataValues[optKey] = { value: val, label: label, checked: checked };
                data[SWITCHES.pageId]   = page;
                writeStorage(data);
                log("CATA option " + (checked ? "checked" : "unchecked") + ": " + val + " (\"" + label + "\")");
            });
            log("CATA live tracking enabled.");
        }

        // ── Live tracking: date inputs ────────────────────────────────

        $allQuestions.find('input.date, .answers-list input[type="text"]').on('change.logger input.logger', function () {
            var $dateInp = $(this);
            var val = $dateInp.val();
            var qID = $dateInp.closest('.question-container').attr('id').replace('question', '');
            if (val) {
                var data = readStorage();
                var page = data[SWITCHES.pageId] || emptyPageSnap();
                if (!page.dateValues) page.dateValues = {};
                page.dateValues[qID] = val;
                data[SWITCHES.pageId] = page;
                writeStorage(data);
                log("Date value saved for question " + qID + ": " + val);
            }
        });

        // ── Click / timing listener ───────────────────────────────────

        function resolveItemKey(eventTarget, $questionContainer) {
            var $target = $(eventTarget);
            var $row = $target.closest('tr');
            if ($row.length && $questionContainer.find($row).length) {
                var rowName = $row.find('input[type="radio"]').first().attr('name');
                return "row_" + (rowName || $row.attr('id') || $row.index());
            }
            var $li = $target.closest('li, .answer-item, .answer');
            if ($li.length && $questionContainer.find($li).length) {
                var liName = $li.find('input[type="radio"], input[type="checkbox"]').first().attr('name');
                var liVal  = $li.find('input[type="radio"], input[type="checkbox"]').first().attr('value');
                if (liName && liVal !== undefined) return "opt_" + liName + "_" + liVal;
                return "opt_" + ($li.attr('id') || $li.index());
            }
            var $inp = $target.is('input, textarea') ? $target
                : $target.closest('.question-container').find('input[type="number"], input[type="text"], textarea').first();
            if ($inp.length) {
                var inpName = $inp.attr('name') || $inp.attr('id');
                if (inpName) return "inp_" + inpName;
            }
            return "q_" + ($questionContainer.attr('id') || '').replace('question', '');
        }

        $allQuestions.each(function () {
            var $thisQ = $(this);
            $thisQ.off('mousedown.logger').on('mousedown.logger', function (e) {
                e.stopPropagation();
                var now     = Date.now();
                var itemKey = resolveItemKey(e.target, $thisQ);
                var data    = readStorage();
                var page    = data[SWITCHES.pageId] || emptyPageSnap();
                if (!page.clicks[itemKey]) {
                    page.clicks[itemKey] = { firstMs: now, lastMs: now };
                } else {
                    page.clicks[itemKey].lastMs = now;
                }
                data[SWITCHES.pageId] = page;
                writeStorage(data);
            });
        });

        // ── Submit listener ───────────────────────────────────────────

        $('#ls-button-submit, .ls-move-next').off('click.logger').on('click.logger', function () {
            var submitMs = Date.now();
            var data     = readStorage();
            var page     = data[SWITCHES.pageId] || emptyPageSnap();

            // Timing
            var earliestClick = null;
            for (var itemKey in page.clicks) {
                var c = page.clicks[itemKey];
                if (c.firstMs && (earliestClick === null || c.firstMs < earliestClick)) earliestClick = c.firstMs;
            }
            page.timeOnPage = submitMs - (earliestClick !== null ? earliestClick : page.pageLoadMs);
            page.expectedMs = calcExpectedMs(extractQuestionText());
            page.speedRatio = calcSpeedRatio(page.timeOnPage, page.expectedMs);
            log("Speed ratio: " + page.speedRatio);

            // DK
            var dkData       = collectDkData();
            page.dkCount     = dkData.count;
            page.dkQuestions = dkData.questions;

            // Missing items
            var missingData       = collectMissingData();
            page.missingCount     = missingData.count;
            page.missingQuestions = missingData.questions;
            markMissingQuestions(missingData.questions);
            log("Missing items: " + page.missingCount);

            // Middle values
            if (SWITCHES.trackMiddleValues) {
                var middleCount = 0, validAnswerCount = 0;
                $allQuestions.each(function () {
                    var $checked = $(this).find('input[type="radio"]:checked');
                    if ($checked.length > 0) {
                        validAnswerCount++;
                        if ($checked.val() === SWITCHES.middleValueCode) middleCount++;
                    }
                });
                if (validAnswerCount > 0) {
                    page.middleValueCount = middleCount;
                    page.onlyMiddleValues = (middleCount === validAnswerCount);
                }
            }

            // Matrix: DoD + DoDMax + Acquiescence + Extremity
            if (SWITCHES.questionType === "matrix") {
                var counts            = {};
                var totalValid        = 0;
                var foundCodes        = [];
                var scaleMin          = SWITCHES.matrixScaleMin;
                var scaleMax          = SWITCHES.matrixScaleMax;
                var nCategories       = scaleMax - scaleMin + 1;
                var acquiescenceCount = 0;
                var extremeCount      = 0;

                $allQuestions.find('.answers-list.radio-list, .subquestion-list .answers-list').each(function () {
                    var $row     = $(this);
                    var rowLabel = $row.closest('tr').find('.answertext, .control-label').text().trim() ||
                                   $row.prevAll('.labeltext').text().trim() || "Unknown Row";
                    var $checked = $row.find('input[type="radio"]:checked');
                    if ($checked.length > 0) {
                        var val      = $checked.val();
                        var numVal   = parseFloat(val);
                        var valLabel = $row.find('label[for="' + $checked.attr('id') + '"]').text().trim() || val;
                        var rowKey   = $checked.attr('name');
                        if (!page.clicks[rowKey]) page.clicks[rowKey] = {};
                        page.clicks[rowKey].dk_final  = (val === DK_CODE);
                        page.clicks[rowKey].val_final = rowLabel + ": " + valLabel;
                        if (!counts[val]) { counts[val] = 0; foundCodes.push(val); }
                        counts[val]++;
                        totalValid++;
                        if (!isNaN(numVal) && (numVal === scaleMax || numVal === scaleMin)) {
                            acquiescenceCount++;
                            extremeCount++;
                        }
                    }
                });

                if (totalValid > 0) {
                    var sos = 0;
                    for (var i = 0; i < foundCodes.length; i++) {
                        var p = counts[foundCodes[i]] / totalValid;
                        sos += p * p;
                    }
                    page.DoD          = parseFloat((1 - sos).toFixed(4));
                    page.DoDMax       = calcDodMax(totalValid, nCategories);
                    page.acquiescence = parseFloat((acquiescenceCount / totalValid).toFixed(4));
                    page.extremity    = parseFloat((extremeCount / totalValid).toFixed(4));
                    log("DoD: " + page.DoD + " (max: " + page.DoDMax + ") | Acquiescence: " + page.acquiescence + " | Extremity: " + page.extremity);
                }
            }

            // CATA: final selected count + ratio (saved to snap only, no UI shown)
            if (SWITCHES.questionType === "cata") {
                var checkedFinal = $allQuestions.find('input[type="checkbox"]:checked').not('[value="DK"]').length;
                page.cataSelectedCount = checkedFinal;
                if (SWITCHES.cataExpectedCount !== null && SWITCHES.cataExpectedCount > 0) {
                    page.cataSelectionRatio = parseFloat((checkedFinal / SWITCHES.cataExpectedCount).toFixed(3));
                }
                log("CATA selected: " + checkedFinal + (page.cataSelectionRatio !== null ? " | ratio: " + page.cataSelectionRatio : ""));
            }

            data[SWITCHES.pageId] = page;
            writeStorage(data);

            // Personality scores
            if (SWITCHES.personalityItemMap && SWITCHES.personalityItemMap[SWITCHES.pageId]) {
                savePersonalityScores(SWITCHES.pageId);
            }

            // Sync previous page data to hidden field
            if ($syncTarget.length > 0) {
                var finalRaw  = localStorage.getItem(STORAGE_KEY);
                var parsed    = JSON.parse(finalRaw);
                var pageKeys  = Object.keys(parsed).filter(function (key) {
                    return key.indexOf('page_') === 0 && key !== SWITCHES.pageId;
                });
                if (pageKeys.length > 0) {
                    pageKeys.sort();
                    var prevId     = pageKeys[pageKeys.length - 1];
                    var exportData = {};
                    exportData[prevId] = parsed[prevId];
                    $syncTarget.val(JSON.stringify(exportData)).trigger('change');
                    log("Storage synced to log-storage-field on submit.");
                }
            }
        });

        // ── AI intervention ───────────────────────────────────────────

        function buildBehaviourSummary() {
            var data      = readStorage();
            var dkCount   = 0;
            var pageCount = 0;
            var pages     = [];
            for (var key in data) {
                if (key === SWITCHES.pageId) continue;
                var p = data[key];
                pageCount++;
                if (typeof p.dkCount === 'number') dkCount += p.dkCount;
                pages.push({
                    pageId:             key,
                    questionType:       p.questionType || "unknown",
                    speedRatio:         p.speedRatio,
                    actualMs:           p.timeOnPage,
                    expectedMs:         p.expectedMs,
                    dkCount:            p.dkCount,
                    missingCount:       p.missingCount,
                    DoD:                p.DoD,
                    DoDMax:             p.DoDMax,
                    acquiescence:       p.acquiescence,
                    extremity:          p.extremity,
                    cataSelectedCount:  p.cataSelectedCount,
                    cataSelectionRatio: p.cataSelectionRatio
                });
            }
            var lines = [
                "Pages completed before this one: " + pageCount + ".",
                "Total Don't Know answers so far: " + dkCount + "."
            ];
            if (pages.length > 0) {
                var tableLines = [
                    "| Page | Type | Actual (s) | Expected (s) | Speed Ratio | DK | Missing | DoD | DoD Max | Acquiescence | Extremity | CATA sel. | CATA ratio |",
                    "|------|------|-----------|--------------|-------------|-----|---------|-----|---------|--------------|-----------|-----------|------------|"
                ];
                pages.forEach(function (pg) {
                    tableLines.push(
                        "| " + pg.pageId +
                        " | " + pg.questionType +
                        " | " + (pg.actualMs   != null ? Math.round(pg.actualMs / 1000)   : "N/A") +
                        " | " + (pg.expectedMs != null ? Math.round(pg.expectedMs / 1000) : "N/A") +
                        " | " + (pg.speedRatio != null ? pg.speedRatio : "N/A") +
                        " | " + (pg.dkCount    != null ? pg.dkCount    : 0) +
                        " | " + (pg.missingCount != null ? pg.missingCount : 0) +
                        " | " + (pg.DoD    != null ? pg.DoD    : "N/A") +
                        " | " + (pg.DoDMax != null ? pg.DoDMax : "N/A") +
                        " | " + (pg.acquiescence != null ? pg.acquiescence : "N/A") +
                        " | " + (pg.extremity    != null ? pg.extremity    : "N/A") +
                        " | " + (pg.cataSelectedCount  != null ? pg.cataSelectedCount  : "N/A") +
                        " | " + (pg.cataSelectionRatio != null ? pg.cataSelectionRatio : "N/A") + " |"
                    );
                });
                lines.push(tableLines.join("\n"));
                lines.push("Most recent completed page: '" + pages[pages.length - 1].pageId + "'. Weight this most heavily.");
                lines.push("NOTE: For matrix pages, compare DoD against DoD Max to assess nondifferentiation. A DoD well below its Max indicates likely straight-lining.");
            } else {
                lines.push("No per-page data available yet.");
            }
            return lines.join("\n");
        }

        function buildPersonalityContext() {
            var data   = readStorage();
            var merged = {};
            SWITCHES.personalityPages.forEach(function (pId) {
                var pData = data[pId];
                if (pData && pData.personalityScores) {
                    for (var scale in pData.personalityScores) {
                        if (pData.personalityScores[scale] !== null) merged[scale] = pData.personalityScores[scale];
                    }
                }
            });
            var parts = [];
            if (merged["NfC"]      !== undefined) parts.push("Need for Cognition / NfC (0–16): "     + merged["NfC"]);
            if (merged["MMS"]      !== undefined) parts.push("Maximizing-Satisficing / MMS (0–20): " + merged["MMS"]);
            if (merged["Reaktanz"] !== undefined) parts.push("Reactance / Reaktanz (0–32): "         + merged["Reaktanz"]);
            return parts.length > 0 ? parts.join("; ") : "No personality scores available yet.";
        }

        function buildPageContext() {
            var lines = [
                "Current page: " + SWITCHES.pageId + " (topic: " + SWITCHES.questionTopic + ").",
                "Available prompt types for this page: " + (SWITCHES.availableInterventions.length > 0 ? SWITCHES.availableInterventions.join(", ") : "none specified") + ".",
                "Quality indicators tracked on this page: " + (SWITCHES.qualityIndicators.length > 0 ? SWITCHES.qualityIndicators.join(", ") : "none specified") + "."
            ];
            if (SWITCHES.availableInterventions.indexOf("definition") !== -1 && SWITCHES.definitionTerms.length > 0) {
                lines.push(
                    "Potentially difficult terms on this page: " + SWITCHES.definitionTerms.join(", ") + ". " +
                    "If you select the definition prompt, include a brief plain-language explanation of the most relevant term(s)."
                );
            }
            if (SWITCHES.questionType === "matrix") {
                var nCat = SWITCHES.matrixScaleMax - SWITCHES.matrixScaleMin + 1;
                lines.push("Matrix scale: " + SWITCHES.matrixScaleMin + " (min) to " + SWITCHES.matrixScaleMax + " (max) — " + nCat + " categories.");
            }
            if (SWITCHES.questionType === "cata" && SWITCHES.cataExpectedCount !== null) {
                lines.push("Expected number of CATA selections: " + SWITCHES.cataExpectedCount + ".");
            }
            return lines.join("\n");
        }

        function renderResearcherPanel(aiResult) {
            $('#ai-researcher-panel').remove();
            var intervened  = aiResult.intervene;
            var types       = intervened && aiResult.types && aiResult.types.length ? aiResult.types.join(", ") : "none";
            var borderColor = intervened ? "#3b82f6" : "#9ca3af";
            var bgColor     = intervened ? "#f0f7ff"  : "#f9fafb";
            var badge       = intervened
                ? '<span style="background:#3b82f6;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;">INTERVENED</span>'
                : '<span style="background:#9ca3af;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;">NO INTERVENTION</span>';
            $('body').append(
                '<div id="ai-researcher-panel" style="' +
                    'position:fixed;bottom:16px;right:16px;z-index:9999;' +
                    'background:' + bgColor + ';border:1px solid ' + borderColor + ';' +
                    'border-radius:8px;padding:12px 16px;max-width:320px;' +
                    'box-shadow:0 4px 12px rgba(0,0,0,0.12);font-family:monospace;font-size:12px;' +
                    'color:#1f2937;line-height:1.6;">' +
                    '<div style="font-weight:bold;margin-bottom:6px;">AI Intervention Log ' + badge + '</div>' +
                    '<div><strong>Page:</strong> '  + SWITCHES.pageId        + '</div>' +
                    '<div><strong>Topic:</strong> ' + SWITCHES.questionTopic + '</div>' +
                    '<div><strong>Type(s):</strong> ' + types + '</div>' +
                    '<div style="margin-top:6px;"><strong>Reasoning:</strong><br>' +
                    '<span style="color:#374151;">' + (aiResult.reasoning || "—") + '</span></div>' +
                    '<div style="margin-top:8px;text-align:right;">' +
                        '<a href="#" onclick="document.getElementById(\'ai-researcher-panel\').remove();return false;" ' +
                        'style="font-size:11px;color:#6b7280;">dismiss</a>' +
                    '</div>' +
                '</div>'
            );
        }

        function injectAiMessage(message) {
            var $first = $allQuestions.first();
            if (!$first.length) return;
            var $banner = $('<div style="background:#f0f7ff;border-left:4px solid #3b82f6;' +
                'padding:10px 14px;margin-top:10px;margin-bottom:12px;border-radius:4px;' +
                'font-size:14px;color:#1e3a5f;line-height:1.5;">' + message + '</div>');
            var $questionText = $first.find('.question-text, .ls-label-question, legend, label.control-label').last();
            if ($questionText.length) { $banner.insertAfter($questionText); } else { $first.prepend($banner); }
        }

        function runAiIntervention() {
            if (!SWITCHES.enableAI) return;
            setTimeout(function () {
                var payload = {
                    model:       AI_MODEL,
                    temperature: 0,
                    max_tokens:  300,
                    messages: [
                        { role: "system", content: SWITCHES.aiSystemPrompt },
                        { role: "user",   content: [
                            "=== PARTICIPANT BEHAVIOUR HISTORY ===",
                            buildBehaviourSummary(),
                            "",
                            "=== PARTICIPANT PERSONALITY SCORES ===",
                            buildPersonalityContext(),
                            "",
                            "=== CURRENT PAGE CONTEXT ===",
                            buildPageContext(),
                            "",
                            "Based on the above, decide whether to deliver a prompt.",
                            "Only intervene if recent behaviour (last 1–2 pages) shows a consistent pattern of disengagement.",
                            "Only select prompt types listed as available for this page.",
                            "Tailor tone to the respondent's reactance and receptivity scores.",
                            "Keep any message to a maximum of 2 sentences."
                        ].join("\n") }
                    ]
                };

                log("DEBUG: AI payload: " + JSON.stringify(payload, null, 2));

                $.ajax({
                    url:    AI_ENDPOINT,
                    method: "POST",
                    headers: {
                        "Authorization":    "Bearer " + SWITCHES.aiApiKey,
                        "Content-Type":     "application/json",
                        "X-Requested-With": "XMLHttpRequest"
                    },
                    data: JSON.stringify(payload),
                    success: function (resp) {
                        try {
                            var raw = resp.choices && resp.choices[0] && resp.choices[0].message
                                ? resp.choices[0].message.content.trim() : null;
                            if (!raw) { log("AI: Empty response."); return; }
                            raw = raw.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
                            var aiResult = JSON.parse(raw);
                            log("AI decision: " + JSON.stringify(aiResult));
                            var data = readStorage();
                            if (!data[SWITCHES.pageId]) data[SWITCHES.pageId] = emptyPageSnap();
                            data[SWITCHES.pageId].aiResult = aiResult;
                            writeStorage(data);
                            renderResearcherPanel(aiResult);
                            if (aiResult.intervene && aiResult.message) injectAiMessage(aiResult.message);
                        } catch (e) {
                            log("AI: JSON parse failed — " + e.message);
                        }
                    },
                    error: function (xhr) {
                        log("AI call failed: " + xhr.status + " " + xhr.statusText);
                    }
                });
            }, 300);
        }

        // ── Initial sync of previous page data to hidden field ────────

        var initialRaw = localStorage.getItem(STORAGE_KEY);
        if (initialRaw && $syncTarget.length > 0) {
            var initParsed = JSON.parse(initialRaw);
            var initKeys   = Object.keys(initParsed).filter(function (key) {
                return key.indexOf('page_') === 0 && key !== SWITCHES.pageId;
            });
            if (initKeys.length > 0) {
                initKeys.sort();
                var prevPageId = initKeys[initKeys.length - 1];
                var exportData = {};
                exportData[prevPageId] = initParsed[prevPageId];
                $syncTarget.val(JSON.stringify(exportData)).trigger('change');
                log("Initial sync: previous page data flushed to hidden field.");
            }
        }

        runAiIntervention();

    }); // end document ready
})();
