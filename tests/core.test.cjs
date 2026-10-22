const assert = require("node:assert/strict"); // Load the strict test checks.
const fs = require("node:fs"); // Load the file reader.
const path = require("node:path"); // Load the path helpers.
const test = require("node:test"); // Load the test runner.
const vm = require("node:vm"); // Load the isolated JavaScript runner.

function load_core() { // Load the geometry script without InDesign.
	const context = vm.createContext({}); // Prepare a separate JavaScript space.
	const source = fs.readFileSync(path.join(__dirname, "../indesign/flattersatz/core.js"), "utf8"); // Prepare the script text.
	vm.runInContext(source, context, { filename: "core.js" }); // Run the script inside the separate test space.
	return context.FlattersatzCore; // Return this result to the caller.
} // End this block.

function metrics(count = 12, width = 200) { // Make sample line data for the checks.
	return Array.from({ length: count }, (_, row) => ({ // Return this result to the caller.
		baseline: 20 + row * 14, // Set this value on the fake object or test case.
		ascent: 9, // Set this value on the fake object or test case.
		descent: 3, // Set this value on the fake object or test case.
		left: 10, // Set this value on the fake object or test case.
		right: 10 + width, // Set this value on the fake object or test case.
		outer_right: 20 + width, // Set this value on the fake object or test case.
		start: row * 30, // Set this value on the fake object or test case.
		end: row * 30 + 29 // Set this value on the fake object or test case.
	})); // End this block.
} // End this block.

function plain(value) { // Make a plain copy that can be compared across JavaScript spaces.
	return JSON.parse(JSON.stringify(value)); // Return this result to the caller.
} // End this block.

test("options accept the documented percentage boundaries", () => { // Check the behavior named in this test.
	const core = load_core(); // Prepare the geometry code.
	for (const action of ["apply", "remove"]) { // Visit each value used by this check.
		for (const zone of [0, 15, 100]) { // Visit each value used by this check.
			for (const randomness of [0, 50, 100]) { // Visit each value used by this check.
				assert.doesNotThrow(() => core.validate_options({ action, zone, randomness })); // Check that this action succeeds.
			} // End this block.
		} // End this block.
	} // End this block.
}); // End this block.

test("options reject out-of-range, nonnumeric, and unknown values", () => { // Check the behavior named in this test.
	const core = load_core(); // Prepare the geometry code.
	const defaults = { action: "apply", zone: 15, randomness: 0 }; // Prepare the normal settings.
	for (const property of ["zone", "randomness"]) { // Visit each value used by this check.
		for (const value of [-1, 101, Infinity, -Infinity, NaN, "15", null, undefined]) { // Visit each value used by this check.
			assert.throws(() => core.validate_options({ ...defaults, [property]: value }), `${property}=${value}`); // Check that this action reports an error.
		} // End this block.
	} // End this block.
	assert.throws(() => core.validate_options({ ...defaults, action: "delete" })); // Check that this action reports an error.
}); // End this block.

test("zero zone creates no wrap objects", () => { // Check the behavior named in this test.
	const core = load_core(); // Prepare the geometry code.
	assert.equal(core.make_plan(metrics(), { action: "apply", zone: 0, randomness: 100 }, 42).length, 0); // Check that the value matches the expected value.
}); // End this block.

test("remove ignores stale slider values and creates no wrap objects", () => { // Check the behavior named in this test.
	const core = load_core(); // Prepare the geometry code.
	assert.doesNotThrow(() => core.validate_options({ action: "remove" })); // Check that this action succeeds.
	assert.equal(core.make_plan(metrics(), { action: "remove" }, 42).length, 0); // Check that the value matches the expected value.
}); // End this block.

test("zero randomness alternates full-width and shortened lines", () => { // Check the behavior named in this test.
	const core = load_core(); // Prepare the geometry code.
	const plan = plain(core.make_plan(metrics(6), { action: "apply", zone: 15, randomness: 0 }, 42)); // Prepare the planned wrap bands.
	assert.deepEqual(plan.map(item => item.row), [1, 3, 5]); // Check that all expected values match.
	assert.ok(plan.every(item => Math.abs(item.bounds[1] - 180) < 0.01)); // Check that this required condition is true.
}); // End this block.

test("invalid composed metrics fail instead of creating unusable geometry", () => { // Check the behavior named in this test.
	const core = load_core(); // Prepare the geometry code.
	const options = { action: "apply", zone: 15, randomness: 50 }; // Prepare the settings for this check.
	for (const property of ["baseline", "ascent", "descent", "left", "right", "outer_right"]) { // Visit each value used by this check.
		for (const value of [NaN, Infinity, "20", undefined]) { // Visit each value used by this check.
			const input = metrics(1); // Prepare the line data for this check.
			input[0][property] = value; // Set this value for the current check.
			assert.throws(() => core.make_plan(input, options, 42), `${property}=${value}`); // Check that this action reports an error.
		} // End this block.
	} // End this block.
	for (const invalid of [{ ascent: 0 }, { descent: -1 }, { right: 10 }, { outer_right: 200 }]) { // Visit each value used by this check.
		assert.throws(() => core.make_plan([{ ...metrics(1)[0], ...invalid }], options, 42)); // Check that this action reports an error.
	} // End this block.
}); // End this block.

test("plans are reproducible without changing input metrics or options", () => { // Check the behavior named in this test.
	const core = load_core(); // Prepare the geometry code.
	const input = metrics(); // Prepare the line data for this check.
	const options = { action: "apply", zone: 35, randomness: 80 }; // Prepare the settings for this check.
	const input_before = plain(input); // Prepare a copy of the original line data.
	const options_before = plain(options); // Prepare a copy of the original settings.
	const first = plain(core.make_plan(input, options, 42)); // Prepare the first result or object.
	const second = plain(core.make_plan(input, options, 42)); // Prepare the second result or object.
	assert.ok(first.length > 0); // Check that this required condition is true.
	assert.deepEqual(first, second); // Check that all expected values match.
	assert.deepEqual(input, input_before); // Check that all expected values match.
	assert.deepEqual(options, options_before); // Check that all expected values match.
	assert.notDeepEqual(first, plain(core.make_plan(input, options, 43))); // Check that these results are different.
}); // End this block.

test("every generated band has finite bounds and retains readable text width", () => { // Check the behavior named in this test.
	const core = load_core(); // Prepare the geometry code.
	for (const width of [10, 24, 25, 60, 200, 1000]) { // Visit each value used by this check.
		for (const zone of [1, 15, 50, 100]) { // Visit each value used by this check.
			for (const randomness of [0, 50, 100]) { // Visit each value used by this check.
				const input = metrics(16, width); // Prepare the line data for this check.
				const plan = core.make_plan(input, { action: "apply", zone, randomness }, 123); // Prepare the planned wrap bands.
				for (const item of plan) { // Visit each value used by this check.
					const line = input[item.row]; // Prepare the line used by this band.
					assert.ok(line, "the band refers to an existing composed line"); // Check that this required condition is true.
					assert.equal(item.bounds.length, 4); // Check that the value matches the expected value.
					assert.ok(item.bounds.every(Number.isFinite)); // Check that this required condition is true.
					const [top, left, bottom, right] = item.bounds; // Read the values needed for this check.
					assert.ok(top < bottom, "the band has positive height"); // Check that this required condition is true.
					assert.ok(left < right, "the band has positive width"); // Check that this required condition is true.
					assert.ok(left >= line.left + Math.max(12, 2 * (line.ascent + line.descent)) - 0.01, // Check that this required condition is true.
						"at least two character-heights of horizontal text space remain"); // Explain the condition checked on the previous line.
					assert.ok(left >= line.left + width * 0.05 - 0.01, "at most 95% of the line is removed"); // Check that this required condition is true.
					assert.ok(top <= line.baseline - line.ascent / 2 && bottom >= line.baseline - line.ascent / 2, // Check that this required condition is true.
						"the band crosses the actual composed line rather than an estimated leading grid"); // Explain the condition checked on the previous line.
				} // End this block.
			} // End this block.
		} // End this block.
	} // End this block.
}); // End this block.

test("line comparison tolerates numeric noise but catches reflow", () => { // Check the behavior named in this test.
	const core = load_core(); // Prepare the geometry code.
	const original = metrics(); // Prepare the user settings before the action.
	const same = plain(original); // Prepare a copy of the line data.
	assert.equal(core.metrics_equal(original, same), true); // Check that the value matches the expected value.
	same[1].baseline += 0.001; // Set this value for the current check.
	assert.equal(core.metrics_equal(original, same), true); // Check that the value matches the expected value.
	same[1].baseline += 0.1; // Set this value for the current check.
	assert.equal(core.metrics_equal(original, same), false); // Check that the value matches the expected value.
	assert.equal(core.metrics_equal(original, original.slice(1)), false); // Check that the value matches the expected value.
	const reflowed = plain(original); // Prepare a changed copy of the line data.
	reflowed[1].start += 1; // Set this value for the current check.
	assert.equal(core.metrics_equal(original, reflowed), false); // Check that the value matches the expected value.
}); // End this block.
