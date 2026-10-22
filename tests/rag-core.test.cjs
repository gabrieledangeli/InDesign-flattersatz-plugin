// Test paragraph planning with exact simulated widths and an exhaustive search.
const test = require("node:test"); // Use the Node test runner.
const assert = require("node:assert/strict"); // Use checks that explain failures.
const fs = require("node:fs"); // Read the script source.
const path = require("node:path"); // Find files from this test folder.
const vm = require("node:vm"); // Run the old JavaScript without InDesign.
const context = {}; // Give the planner its own global scope.
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../indesign/flattersatz/rag-core.js"), "utf8"), context); // Load the actual production planner.
const core = context.FlattersatzRagCore; // Read the public planner functions.

function plain(value) { // Turn results from the script scope into plain test data.
	return JSON.parse(JSON.stringify(value)); // Copy arrays and objects across the script boundary.
} // Finish the plain data helper.

function span(weights, gaps, first, last) { // Measure a complete span in the test font.
	let width = 0; // Start with an empty span.
	for (let i = first; i < last; i++) { // Add each word and each internal gap.
		width += weights[i] + (i > first ? gaps[i - 1] : 0); // Include the full width of spaces between words.
	} // Finish reading the requested span.
	return width; // Return its exact test width.
} // Finish the test measurement helper.

function objective(widths, available, percentage) { // Define the documented score independently of the planner.
	const zone = percentage / 100; // Convert the percentage into a part of the width.
	let total = widths.length; // Charge one point for every line.
	for (let i = 0; i < widths.length; i++) { // Score each line in the proposed arrangement.
		const ratio = widths[i] / available; // Compare the line width with the available width.
		const missing = Math.max(0, 1 - ratio); // Find the unused part of the line.
		const final = i === widths.length - 1; // Treat the final line more freely.
		total += final ? 45 * Math.max(0, 0.4 - ratio) ** 2 + missing ** 2 : 60 * Math.max(0, 1 - zone - ratio) ** 2 + 2 * missing ** 2; // Add the line length penalty from the score definition.
		if (i > 0) { // Compare this line with the one before it.
			const difference = Math.abs(widths[i] - widths[i - 1]) / available; // Find the difference in their lengths.
			total += 12 * (Math.max(0, zone / 3 - difference) / Math.max(0.05, zone)) ** 2; // Penalize neighbours that have nearly equal lengths.
			total += (final ? 2 : 8) * Math.max(0, difference - zone) ** 2; // Penalize large changes more gently at the end.
		} // Finish scoring this pair of lines.
	} // Finish scoring the proposed arrangement.
	return total; // Return the independent score.
} // Finish defining the score.

function oracle(weights, gaps, available, zone) { // Check every possible set of legal word breaks.
	let best = null; // Keep the cheapest complete arrangement.
	for (let mask = 0; mask < 2 ** Math.max(0, weights.length - 1); mask++) { // Try every subset of the spaces between words.
		const breaks = [0]; // Always start at the first word.
		for (let i = 1; i < weights.length; i++) { // Consider each internal word boundary.
			if (mask & (1 << (i - 1))) { breaks.push(i); } // Insert this candidate line break.
		} // Finish choosing the internal breaks.
		breaks.push(weights.length); // Always include the end of the paragraph.
		const widths = []; // Collect the widths in this arrangement.
		let valid = true; // Assume the arrangement is usable until a check fails.
		for (let i = 1; i < breaks.length; i++) { // Check every line in this arrangement.
			const width = span(weights, gaps, breaks[i - 1], breaks[i]); // Measure this complete line.
			if (width > available + 0.001 || (i > 1 && span(weights, gaps, breaks[i - 2], breaks[i]) <= available + 0.001)) { valid = false; } // Require fitting lines that cannot merge with their neighbours.
			widths.push(width); // Keep this width for the independent score.
		} // Finish checking the arrangement.
		if (valid) { // Score only arrangements that No Break can represent.
			const cost = objective(widths, available, zone); // Compute the cost without using planner helpers.
			if (!best || cost < best.cost) { best = {cost, breaks, widths}; } // Keep the cheapest arrangement found.
		} // Finish considering this arrangement.
	} // Finish the exhaustive search.
	return best; // Return the true best result for this small example.
} // Finish the independent search helper.

function fixture(weights, gaps, available, zone = 15) { // Build the inputs for an exact measuring callback.
	const text = weights.map((value, i) => "word" + i).join(" "); // Give every test word a real character range.
	const tokens = core.tokenize(text); // Use the actual tokenizer to find those ranges.
	const calls = new Map(); // Record every host measurement request.
	const measure = (first, last) => { // Supply exact complete-span widths to the planner.
		const key = first + ":" + last; // Identify this span by its token boundaries.
		calls.set(key, (calls.get(key) || 0) + 1); // Count repeated requests if they occur.
		return span(weights, gaps, first, last); // Include all internal boundary spaces.
	}; // Finish the simulated host callback.
	return {input: {tokens, width: available, measure, zone}, calls, text}; // Return both planner inputs and measurement evidence.
} // Finish building a test paragraph.

test("rag tokenizer preserves ranges and all internal ordinary spaces", () => { // Check token positions without rewriting text.
	assert.deepEqual(plain(core.tokenize("alpha   beta gamma")), [{start: 0, end: 5, text: "alpha"}, {start: 8, end: 12, text: "beta"}, {start: 13, end: 18, text: "gamma"}]); // Keep the three-space gap outside the word groups.
	assert.deepEqual(plain(core.tokenize("A\u00a0B C")), [{start: 0, end: 3, text: "A\u00a0B"}, {start: 4, end: 5, text: "C"}]); // Keep a nonbreaking space inside its word group.
}); // Finish the range test.

test("rag tokenizer merges a boundary when any of its spaces is protected", () => { // Preserve existing No Break constraints.
	const flags = [true, false, true, false, false, false]; // Protect the second space between the first two words.
	const saved = flags.slice(); // Keep a copy of the original character flags.
	assert.deepEqual(plain(core.tokenize("A  B C", flags)), [{start: 0, end: 4, text: "A  B"}, {start: 5, end: 6, text: "C"}]); // Merge only the protected boundary.
	assert.deepEqual(flags, saved); // Do not change the supplied character flags.
	assert.equal(core.tokenize("A B", [true, false, true]).length, 2); // Protected letters alone must not protect a boundary space.
	assert.equal(core.tokenize("A B C", [false, true, false, true, false]).length, 1); // Merge several protected boundaries into one group.
}); // Finish testing original No Break constraints.

test("blank rag paragraphs need no measurements but still validate settings", () => { // Make blank paragraphs safe to skip.
	for (const text of ["", "   "]) { // Check empty text and ordinary spaces.
		const result = core.plan({tokens: core.tokenize(text), width: 100}); // Plan without a measuring callback.
		assert.deepEqual(plain(result.lines), []); // Do not create empty lines.
		assert.equal(result.cost, 0); // An untouched paragraph has no cost.
		assert.equal(result.measurements, 0); // Do not ask the host to measure blank text.
	} // Finish checking blank text.
	assert.throws(() => core.plan({tokens: [], width: 0}), /positive/); // Do not accept a zero width for an empty paragraph.
	assert.throws(() => core.plan({tokens: [], width: 100, zone: NaN}), /finite/); // Do not hide an invalid zone behind blank text.
}); // Finish the blank paragraph test.

test("rag tokenizer rejects unsupported controls and ambiguous edge spaces", () => { // Keep the prototype within its supported text model.
	for (const text of ["a\tb", "a\rb", "a\nb", "a\u00adb", "a\u200bb", "a\u2028b", "a\u2029b", "a\ufffcb"]) { // List text that needs separate composition support.
		assert.throws(() => core.tokenize(text), /does not support/); // Explain why each unsupported paragraph is rejected.
	} // Finish checking unsupported text.
	for (const text of [" a", "a ", " a "]) { assert.throws(() => core.tokenize(text), /leading or trailing/); } // Do not silently discard edge spaces.
	assert.throws(() => core.tokenize(12), /string/); // Require original text rather than an automatic conversion.
	assert.throws(() => core.tokenize("a", []), /length/); // Require a flag for every character when flags are supplied.
	assert.throws(() => core.tokenize("a", [1]), /true or false/); // Reject numbers used as character flags.
	assert.throws(() => core.tokenize("a", {length: 1, 0: false}), /length/); // Require an actual array of character flags.
}); // Finish checking unsupported tokenizer inputs.

test("rag planner matches an independent exhaustive oracle across small paragraphs", () => { // Verify the full search rather than a greedy line choice.
	let seed = 1729; // Start a repeatable set of examples.
	const next = () => (seed = (seed * 48271) % 2147483647); // Produce repeatable test values.
	for (let example = 0; example < 60; example++) { // Compare many different word and gap lengths.
		const count = 5 + next() % 4; // Keep exhaustive enumeration small enough to inspect fully.
		const weights = Array.from({length: count}, () => 6 + next() % 21); // Give every word a positive width.
		const gaps = Array.from({length: count - 1}, () => 1 + next() % 4); // Vary the exact width of boundary spaces.
		const width = 35 + next() % 35, zone = next() % 41; // Try different line widths and rhythm settings.
		const data = fixture(weights, gaps, width, zone); // Build the simulated host callback.
		const expected = oracle(weights, gaps, width, zone); // Find the true best legal arrangement by enumeration.
		const actual = core.plan(data.input); // Run the production planner on the same paragraph.
		assert.ok(expected, "the example must have a feasible plan"); // Check that this example can be arranged.
		assert.ok(Math.abs(actual.cost - expected.cost) < 1e-9, "global cost differs in example " + example); // Require the globally lowest cost.
		assert.ok(Math.abs(core.score_path(data.input, plain(actual.lines).map(line => line.width)) - expected.cost) < 1e-9); // Check the public score against the independent definition.
		assert.equal(actual.lines[0].first, 0); // Start at the original first word.
		assert.equal(actual.lines[actual.lines.length - 1].last, count); // Include the final word exactly once.
		for (let i = 0; i < actual.lines.length; i++) { // Verify each line in the chosen path.
			const line = actual.lines[i]; // Read this line's original positions.
			assert.equal(line.start, data.input.tokens[line.first].start); // Preserve the first character position.
			assert.equal(line.end, data.input.tokens[line.last - 1].end); // Preserve the exclusive final character position.
			assert.ok(line.width <= width + 0.001); // Keep every unbreakable group within the frame.
			if (i > 0) { // Check the boundary before this line.
				assert.equal(actual.lines[i - 1].last, line.first); // Do not omit or repeat any word group.
				assert.ok(span(weights, gaps, actual.lines[i - 1].first, line.last) > width + 0.001); // Ensure adjacent groups cannot merge.
			} // Finish checking this line boundary.
		} // Finish checking the chosen lines.
		assert.equal(actual.measurements, data.calls.size); // Count only distinct complete-span measurements.
		assert.ok([...data.calls.values()].every(count => count === 1)); // Never ask the host to measure the same span twice.
	} // Finish comparing the exhaustive examples.
}); // Finish the global optimality test.

test("rag planning is deterministic and does not change input groups", () => { // Keep previews repeatable.
	const data = fixture([35, 35, 35, 10], [1, 3, 2], 90); // Include a short possible final group.
	const before = JSON.stringify(data.input.tokens); // Save the original character ranges.
	const first = core.plan(data.input); // Find one complete arrangement.
	const second = core.plan(data.input); // Repeat the exact same request.
	assert.deepEqual(plain(first), plain(second)); // Require the same result and work count.
	assert.equal(JSON.stringify(data.input.tokens), before); // Preserve the original token objects.
	assert.equal(first.lines.length, 2); // Keep this paragraph in two feasible lines.
	assert.ok(span([35, 35, 35, 10], [1, 3, 2], first.lines[0].first, first.lines[1].last) > 90.001); // Do not accept two groups that would fit on one line.
}); // Finish the repeatability test.

test("global planning improves a greedy example with a very short ending", () => { // Show a concrete benefit of looking beyond the current line.
	const weights = [34, 8, 36, 10, 23, 10, 14, 8, 15, 10, 30, 32, 27, 9]; // Use fixed measured word widths in points.
	const gaps = Array(weights.length - 1).fill(3), width = 100, greedy = []; // Use three-point spaces and a hundred-point line.
	for (let first = 0; first < weights.length;) { // Make the ordinary longest-fitting-line baseline.
		let last = first + 1; // Start with one word.
		while (last < weights.length && span(weights, gaps, first, last + 1) <= width) { last++; } // Add words until the next one would overflow.
		greedy.push(span(weights, gaps, first, last)); // Keep the baseline line width.
		first = last; // Start its next line after the last word.
	} // Finish the greedy baseline.
	const result = core.plan(fixture(weights, gaps, width).input); // Optimize the same words with the same spacing.
	const optimized = plain(result.lines).map(line => line.width); // Read the chosen natural widths.
	assert.deepEqual(greedy, [97, 95, 95, 9]); // Confirm the baseline leaves a very short last line.
	assert.deepEqual(optimized, [84, 95, 78, 39]); // Move earlier breaks to produce a fuller ending.
	assert.equal(optimized.length, greedy.length); // Keep the same number of lines in this example.
	assert.ok(result.cost < objective(greedy, width, 15) * 0.42); // Reduce this stated heuristic score by more than half.
	assert.ok(Math.abs(result.cost - oracle(weights, gaps, width, 15).cost) < 1e-9); // Confirm that the example also reaches the true best score.
}); // Finish the concrete improvement test.

test("a paragraph that already fits uses one exact measurement", () => { // Avoid unnecessary host work for short text.
	const data = fixture([10, 20, 30], [4, 6], 100); // Include meaningful internal space widths.
	const result = core.plan(data.input); // Plan the short paragraph.
	assert.equal(result.lines.length, 1); // Keep the existing single line.
	assert.equal(result.lines[0].width, 70); // Include both full boundary spaces in the width.
	assert.equal(result.measurements, 1); // Measure only the complete paragraph.
	assert.equal(result.lines[0].last, 3); // Use an exclusive final token index.
}); // Finish the single-line test.

test("oversize words and protected groups fail instead of forcing illegal breaks", () => { // Respect words and existing semantic constraints.
	assert.throws(() => core.plan(fixture([60, 5], [1], 50).input), /No complete/); // Refuse a word wider than the frame.
	const tokens = core.tokenize("big group tail", [false, false, false, true, false, false, false, false, false, false, false, false, false, false]); // Protect the space after the first word.
	assert.equal(tokens.length, 2); // Keep the protected first pair as one unit.
	assert.throws(() => core.plan({tokens, width: 50, measure: (first, last) => span([65, 10], [1], first, last)}), /No complete/); // Do not split the protected pair to make it fit.
}); // Finish checking oversized protected content.

test("invalid exact measurements are rejected and host errors are preserved", () => { // Reject unsafe widths from the host.
	for (const value of [NaN, Infinity, -1, 0, "12", undefined]) { // Try invalid number values and types.
		assert.throws(() => core.plan({tokens: core.tokenize("word"), width: 100, measure: () => value}), /finite|positive/); // Do not create a plan from invalid geometry.
	} // Finish checking bad measurements.
	assert.throws(() => core.plan({tokens: core.tokenize("word"), width: 100, measure: () => { throw new Error("native failure"); }}), /native failure/); // Preserve a useful error reported by InDesign.
}); // Finish the measurement error test.

test("oversized measurement sentinels preserve feasible plans", () => { // Allow the native host to stop measuring a span that is already too wide.
	const weights = [25, 17, 31, 12, 26, 18], gaps = [3, 2, 3, 2, 3], width = 60; // Choose words that need several lines.
	const exact = core.plan(fixture(weights, gaps, width).input); // Find the plan from complete exact widths.
	const input = fixture(weights, gaps, width).input; // Prepare the same text for a limited measuring frame.
	input.measure = (first, last) => { // Return a safe large value for spans wider than the frame.
		const measured = span(weights, gaps, first, last); // Measure the full candidate in the test font.
		return measured > width ? width * 3 : measured; // Preserve exact widths for all usable lines.
	}; // Finish the overflow-aware test callback.
	const limited = core.plan(input); // Plan with the same sentinel used by the native preview.
	assert.deepEqual(plain(limited.lines), plain(exact.lines)); // Keep exactly the same legal line choices and widths.
	assert.equal(limited.cost, exact.cost); // Keep the same objective value.
}); // Finish the overflow sentinel test.

test("rag planning enforces option, range and work limits", () => { // Validate inputs before doing expensive native work.
	for (const width of [0, -1, Infinity, "100"]) { assert.throws(() => core.plan({tokens: [], width}), /finite|positive/); } // Require a positive numeric frame width.
	for (const zone of [-1, 101, Infinity, "15"]) { assert.throws(() => core.plan({tokens: [], width: 100, zone}), /finite|between/); } // Require a numeric percentage within range.
	assert.throws(() => core.plan(), /settings/); // Require the settings object.
	assert.throws(() => core.plan({width: 100}), /word groups/); // Require an explicit group list.
	assert.throws(() => core.plan({tokens: core.tokenize("word"), width: 100}), /measures/); // Require the exact host measuring callback.
	assert.throws(() => core.plan({tokens: [{text: "word", start: 0, end: 3}], width: 100, measure: () => 10}), /character ranges/); // Reject incorrect text offsets.
	assert.throws(() => core.plan({tokens: [{text: "a", start: 0, end: 1}, {text: "b", start: 1, end: 2}], width: 100, measure: () => 10}), /character ranges/); // Require a boundary space between separate groups.
	assert.throws(() => core.plan({tokens: core.tokenize(Array(82).join("w ").trim()), width: 100, measure: () => 10}), /at most 80/); // Reject paragraphs beyond the token budget.
	for (const limit of [0, -1, 1.5, 4001]) { assert.throws(() => core.plan({tokens: [], width: 100, max_measurements: limit}), /Measurement limit/); } // Require a valid whole-number measurement budget.
	const data = fixture([20, 20, 20, 20], [1, 1, 1], 45); // Make a paragraph that needs more than one measurement.
	assert.throws(() => core.plan({...data.input, max_measurements: 1}), /measurement limit/); // Stop before exceeding a caller's smaller budget.
	assert.equal(data.calls.size, 1); // Do not make an extra host call after the limit.
}); // Finish checking input and work limits.

test("the largest supported paragraph stays within the exact measurement budget", () => { // Check bounded work at the supported size limit.
	const data = fixture(Array(80).fill(5), Array(79).fill(1), 50); // Use a paragraph with eighty short words.
	const result = core.plan(data.input); // Search the largest supported token list.
	assert.equal(result.lines[result.lines.length - 1].last, 80); // Cover the full paragraph.
	assert.ok(result.measurements <= 4000); // Stay below the documented host-call limit.
	assert.ok(result.measurements <= 80 * 81 / 2); // Cache every possible span at most once.
}); // Finish the maximum-size test.

test("the public width score handles zero zone and rejects invalid paths", () => { // Make the scoring rule safe to inspect independently.
	assert.equal(core.score_path({width: 100, zone: 0}, []), 0); // Give an empty path a zero score.
	assert.ok(Number.isFinite(core.score_path({width: 100, zone: 0}, [80, 75]))); // Avoid division by zero at the minimum setting.
	assert.throws(() => core.score_path({width: 100}, [101]), /fits/); // Reject an oversized scored line.
	assert.throws(() => core.score_path({width: 100}, [0]), /positive/); // Reject an empty scored line.
	assert.throws(() => core.score_path({width: 100}, null), /array/); // Require a real width list.
}); // Finish checking the public score.
