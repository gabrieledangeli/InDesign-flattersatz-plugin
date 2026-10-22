const assert = require("node:assert/strict"); // Load the strict test checks.
const fs = require("node:fs"); // Load the file reader.
const path = require("node:path"); // Load the path helpers.
const test = require("node:test"); // Load the test runner.
const vm = require("node:vm"); // Load the isolated JavaScript runner.

function load_ui(interact) { // Load the dialog script with fake controls.
	const messages = []; // Prepare a list of shown messages.
	const controls = []; // Prepare a list of fake dialog controls.
	let closed = null; // Prepare the dialog close result.
	function Control(type, text) { // Make one fake dialog control.
		this.type = type; // Save this value on the fake object.
		this.text = text; // Save this value on the fake object.
		this.value = text; // Save this value on the fake object.
		this.preferredSize = {}; // Save this value on the fake object.
		controls.push(this); // Keep this control so the test can find it.
	} // End this block.
	Control.prototype.add = function(type, bounds, text) { // Define this fake dialog action.
		return new Control(type, text); // Return this result to the caller.
	}; // End this block.
	Control.prototype.show = function() { // Define this fake dialog action.
		interact({ // Run the test steps on this fake dialog.
			fields: controls.filter(control => control.type === "edittext"), // Set this value on the fake object or test case.
			sliders: controls.filter(control => control.type === "slider"), // Set this value on the fake object or test case.
			click: text => controls.find(control => control.type === "button" && control.text === text).onClick(), // Set this value on the fake object or test case.
			get closed() { return closed; } // Read the current value when it is needed.
		}); // End this block.
	}; // End this block.
	Control.prototype.close = function(code) { closed = code; }; // Define this fake dialog action.
	const context = vm.createContext({ Window: Control, alert: message => messages.push(message) }); // Prepare a separate JavaScript space.
	vm.runInContext(fs.readFileSync(path.join(__dirname, "../indesign/flattersatz/ui.js"), "utf8"), context); // Run the script inside the separate test space.
	return { ui: context.FlattersatzUI, messages, get closed() { return closed; } }; // Return this result to the caller.
} // End this block.

function run_entry({ documents = [{}], selection = [{}], settings = { action: "apply", zone: 15, randomness: 0 }, error, result } = {}) { // Run the entry script with fake app and dialog objects.
	const calls = { messages: [], settings: 0, host: 0 }; // Prepare the calls made by the entry script.
	const app = { documents, selection }; // Prepare the fake InDesign app.
	const context = vm.createContext({ // Prepare a separate JavaScript space.
		app, // Complete this test step.
		FlattersatzUI: { // Set this value on the fake object or test case.
			settings() { calls.settings++; return settings; }, // Return the fake dialog result and count the call.
			message(message) { calls.messages.push(message); } // Keep the message for later checks.
		}, // End this block.
		FlattersatzHost: { // Set this value on the fake object or test case.
			run(passed_app, passed_settings) { // Define the fake host call for the entry test.
				calls.host++; // Record the host call made by the entry script.
				assert.equal(passed_app, app); // Check that the value matches the expected value.
				assert.equal(passed_settings, settings); // Check that the value matches the expected value.
				if (error) { throw error; } // Handle this case when the condition is true.
				return result; // Return this result to the caller.
			} // End this block.
		} // End this block.
	}); // End this block.
	const source = fs.readFileSync(path.join(__dirname, "../indesign/flattersatz/flattersatz.js"), "utf8"); // Prepare the script text.
	vm.runInContext(source.replace(/^#.*$/gm, ""), context, { filename: "flattersatz.js" }); // Run the script inside the separate test space.
	return calls; // Return this result to the caller.
} // End this block.

test("entry rejects a missing document or selection before opening settings", () => { // Check the behavior named in this test.
	for (const input of [{ documents: [] }, { selection: [] }]) { // Visit each value used by this check.
		const calls = run_entry(input); // Prepare the calls made by the entry script.
		assert.equal(calls.settings, 0); // Check that the value matches the expected value.
		assert.equal(calls.host, 0); // Check that the value matches the expected value.
		assert.equal(calls.messages.length, 1); // Check that the value matches the expected value.
	} // End this block.
}); // End this block.

test("cancelling settings leaves the document host untouched", () => { // Check the behavior named in this test.
	const calls = run_entry({ settings: null }); // Prepare the calls made by the entry script.
	assert.equal(calls.settings, 1); // Check that the value matches the expected value.
	assert.equal(calls.host, 0); // Check that the value matches the expected value.
	assert.deepEqual(calls.messages, []); // Check that all expected values match.
}); // End this block.

test("entry reports host failures and optional completion messages", () => { // Check the behavior named in this test.
	const failed = run_entry({ error: new Error("Frame is locked") }); // Prepare the entry result for an error.
	assert.equal(failed.host, 1); // Check that the value matches the expected value.
	assert.match(failed.messages[0], /Frame is locked/); // Check that the message explains the result.
	const completed = run_entry({ result: { message: "Removed 3 shapes" } }); // Prepare the entry result after success.
	assert.deepEqual(completed.messages, ["Removed 3 shapes"]); // Check that all expected values match.
}); // End this block.

test("dialog applies defaults and supports cancellation and removal", () => { // Check the behavior named in this test.
	const defaults = load_ui(dialog => dialog.click("Apply")); // Prepare the normal settings.
	assert.deepEqual(JSON.parse(JSON.stringify(defaults.ui.settings())), { zone: 15, randomness: 0, action: "apply" }); // Check that all expected values match.
	assert.equal(defaults.closed, 1); // Check that the value matches the expected value.
	const cancelled = load_ui(dialog => dialog.click("Cancel")); // Prepare the dialog used to test Cancel.
	assert.equal(cancelled.ui.settings(), null); // Check that the value matches the expected value.
	assert.equal(cancelled.closed, 0); // Check that the value matches the expected value.
	const removed = load_ui(dialog => { // Prepare the dialog used to test Remove.
		dialog.fields[0].text = "invalid"; // Set the dialog value used by this check.
		dialog.click("Remove effect"); // Press this fake dialog button.
	}); // End this block.
	assert.deepEqual(JSON.parse(JSON.stringify(removed.ui.settings())), { zone: 0, randomness: 0, action: "remove" }); // Check that all expected values match.
}); // End this block.

test("invalid percentage input keeps the dialog open until corrected", () => { // Check the behavior named in this test.
	const invalid_values = ["", "abc", "15%", "-1", "101", "Infinity", "NaN", "1,5"]; // Prepare the wrong input values.
	const loaded = load_ui(dialog => { // Prepare the fake settings dialog.
		for (const value of invalid_values) { // Visit each value used by this check.
			dialog.fields[0].text = value; // Set the dialog value used by this check.
			dialog.click("Apply"); // Press this fake dialog button.
			assert.equal(dialog.closed, null); // Check that the value matches the expected value.
		} // End this block.
		dialog.fields[0].text = "12.5"; // Set the dialog value used by this check.
		dialog.fields[1].text = "100"; // Set the dialog value used by this check.
		dialog.click("Apply"); // Press this fake dialog button.
	}); // End this block.
	assert.deepEqual(JSON.parse(JSON.stringify(loaded.ui.settings())), { zone: 12.5, randomness: 100, action: "apply" }); // Check that all expected values match.
	assert.equal(loaded.messages.length, invalid_values.length); // Check that the value matches the expected value.
}); // End this block.

test("slider changes and numeric edits produce the values actually displayed", () => { // Check the behavior named in this test.
	const loaded = load_ui(dialog => { // Prepare the fake settings dialog.
		dialog.sliders[0].value = 27.8; // Set the dialog value used by this check.
		dialog.sliders[0].onChanging(); // Run the fake control change event.
		assert.equal(dialog.fields[0].text, "28"); // Check that the value matches the expected value.
		dialog.fields[1].text = "33.5"; // Set the dialog value used by this check.
		dialog.fields[1].onChange(); // Run the fake control change event.
		assert.equal(dialog.sliders[1].value, 33.5); // Check that the value matches the expected value.
		dialog.click("Apply"); // Press this fake dialog button.
	}); // End this block.
	assert.deepEqual(JSON.parse(JSON.stringify(loaded.ui.settings())), { zone: 28, randomness: 33.5, action: "apply" }); // Check that all expected values match.
}); // End this block.
