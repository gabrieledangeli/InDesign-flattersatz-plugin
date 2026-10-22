const assert = require("node:assert/strict"); // Load the strict test checks.
const fs = require("node:fs"); // Load the file reader.
const path = require("node:path"); // Load the path helpers.
const test = require("node:test"); // Load the test runner.
const vm = require("node:vm"); // Load the separate JavaScript runner.

function load_dialog(interact) { // Load the preview settings with fake dialog controls.
	const controls = [], messages = []; // Keep controls and messages for the checks.
	let close_code = null; // Remember whether the dialog was closed.
	function Control(type, text) { this.type = type; this.text = text; controls.push(this); } // Make one fake dialog control.
	Control.prototype.add = function(type, bounds, text) { return new Control(type, text); }; // Add a child control to the fake dialog.
	Control.prototype.close = function(code) { close_code = code; }; // Save the result when the dialog closes.
	Control.prototype.show = function() { interact({ field: controls.find(control => control.type === "edittext"), click: text => controls.find(control => control.type === "button" && control.text === text).onClick(), get closed() { return close_code; } }); }; // Let the test act as the user.
	const context = vm.createContext({ Window: Control, alert: message => messages.push(message) }); // Create a fake ScriptUI runtime.
	vm.runInContext(fs.readFileSync(path.join(__dirname, "../indesign/flattersatz/preview-ui.js"), "utf8"), context); // Load the real preview dialog code.
	return { ui: context.FlattersatzPreviewUI, messages, get closed() { return close_code; } }; // Share the dialog and its visible results.
} // End the dialog loader.

function run_entry(input = {}) { // Run the preview entry script with a fake app and preview host.
	class TextFrame {} // Give the selected fake object the expected Adobe type name.
	const settings = input.settings === undefined ? { zone: 15 } : input.settings; // Use normal settings unless the test chooses Cancel.
	const calls = { settings: 0, preview: 0, messages: [] }; // Count calls that could show a dialog or create a document.
	const app = { documents: input.documents || [{}], selection: input.selection || [new TextFrame()] }; // Use the requested app state.
	const context = vm.createContext({ // Keep this test separate from other entry runs.
		app, // Provide the fake active app.
		alert: message => calls.messages.push(message), // Keep each user-visible message.
		FlattersatzPreviewUI: { settings() { calls.settings++; return settings; } }, // Return the chosen fake dialog result.
		FlattersatzPreview: { run(passed_app, passed_settings) { calls.preview++; assert.equal(passed_app, app); assert.equal(passed_settings, settings); if (input.error) { throw input.error; } return input.result || { paragraphs: 2, lines: 5, legacy_message: "" }; } } // Record the preview call and return or fail as requested.
	}); // End the fake entry runtime.
	const source = fs.readFileSync(path.join(__dirname, "../indesign/flattersatz/flattersatz-preview.js"), "utf8"); // Read the real preview entry script.
	vm.runInContext(source.replace(/^#.*$/gm, ""), context, { filename: "flattersatz-preview.js" }); // Run its JavaScript without Adobe-only file directives.
	return calls; // Return all recorded entry actions.
} // End the entry runner.

test("preview settings accept the default and both percentage boundaries", () => { // Check valid values before any document creation.
	for (const value of [undefined, "0", "100", "12.5"]) { // Try the default, the edges, and a decimal.
		const loaded = load_dialog(dialog => { if (value !== undefined) { dialog.field.text = value; } dialog.click("Create preview"); }); // Enter this value and start the preview.
		assert.deepEqual(JSON.parse(JSON.stringify(loaded.ui.settings())), { zone: value === undefined ? 15 : Number(value) }); // Check the exact accepted percentage.
		assert.equal(loaded.closed, 1); // Check that the accepted settings close the dialog.
		assert.deepEqual(loaded.messages, []); // Check that valid input shows no error.
	} // End the valid value checks.
}); // End the accepted settings test.

test("invalid preview settings keep the dialog open until corrected", () => { // Check that wrong values cannot start a trial.
	const invalid = ["", " ", "-1", "101", "NaN", "Infinity", "15%", "1,5", "0x10"]; // List wrong values that a user may type.
	const loaded = load_dialog(dialog => { // Act as a user correcting invalid input.
		for (const value of invalid) { dialog.field.text = value; dialog.click("Create preview"); assert.equal(dialog.closed, null); } // Check that each wrong value leaves the dialog open.
		dialog.field.text = "20"; // Replace the wrong input with a valid percentage.
		dialog.click("Create preview"); // Start the preview with the corrected value.
	}); // End the fake user actions.
	assert.equal(loaded.ui.settings().zone, 20); // Check that the corrected value is returned.
	assert.equal(loaded.messages.length, invalid.length); // Check that every invalid value shows an explanation.
}); // End the invalid input test.

test("preview Cancel returns no action and never calls the preview host", () => { // Check cancellation before document creation.
	const dialog = load_dialog(control => control.click("Cancel")); // Press Cancel in the real dialog logic.
	assert.equal(dialog.ui.settings(), null); // Check that the dialog returns no accepted settings.
	assert.equal(dialog.closed, 0); // Check that the dialog closes as cancelled.
	const calls = run_entry({ settings: null }); // Run the entry script after cancellation.
	assert.equal(calls.settings, 1); // Check that the settings dialog was opened once.
	assert.equal(calls.preview, 0); // Check that no comparison document can be created.
	assert.deepEqual(calls.messages, []); // Check that cancellation shows no success or error message.
}); // End the cancellation test.

test("preview entry rejects missing documents and unsupported selections before its dialog", () => { // Check early entry guards.
	for (const input of [{ documents: [] }, { selection: [] }, { selection: [{}, {}] }, { selection: [{}] }]) { // Try no document, no selection, multiple selections, and the wrong type.
		const calls = run_entry(input); // Run the entry with this unsupported state.
		assert.equal(calls.settings, 0); // Check that the settings dialog was not opened.
		assert.equal(calls.preview, 0); // Check that no preview host action was called.
		assert.equal(calls.messages.length, 1); // Check that the user receives one useful message.
		assert.match(calls.messages[0], /select one text frame/); // Check that the message explains the required selection.
	} // End the early guard checks.
}); // End the entry guard test.

test("preview entry reports success, historical limits, and host errors", () => { // Check that the final message describes what the user can review.
	const completed = run_entry({ result: { paragraphs: 2, lines: 5, legacy_message: "Not justified" } }); // Return a valid text-only preview with an unavailable historical page.
	assert.equal(completed.preview, 1); // Check that the preview was called once.
	assert.match(completed.messages[0], /2 paragraph\(s\), 5 planned lines/); // Check that the success message reports the actual result size.
	assert.match(completed.messages[0], /Close this new document to discard/); // Check that the message explains how to discard the trial.
	assert.match(completed.messages[0], /Not justified/); // Check that the optional historical limitation is visible.
	const failed = run_entry({ error: new Error("Measured widths changed") }); // Simulate a host failure after its cleanup.
	assert.equal(failed.preview, 1); // Check that the attempted preview ran once.
	assert.match(failed.messages[0], /could not finish.*Measured widths changed/s); // Check that the failure reason reaches the user.
}); // End the result message test.
