const assert = require("node:assert/strict"); // Load the checks.
const test = require("node:test"); // Load the test runner.
const fs = require("node:fs"); // Read the helper file.
const path = require("node:path"); // Build file paths.
const vm = require("node:vm"); // Run the old script in a test scope.
const source = fs.readFileSync(path.join(__dirname, "../indesign/_common/helpers.js"), "utf8"); // Load the helper code.
function load() { // Make a fresh test scope.
	const app = {scriptPreferences: {enableRedraw: false}}; // Start with redraw off.
	const scope = vm.createContext({app, MeasurementUnits: {POINTS: "points"}}); // Add the small fake Adobe API.
	vm.runInContext(source, scope); // Load the helper functions.
	return scope; // Return the test scope.
} // End the loader.

test("file helpers handle mixed path separators and keep dots in the base name", () => { // Check old path bugs.
	const scope = load(); // Load a fresh copy.
	assert.equal(scope.get_filename("C:\\scripts\\flattersatz.v2.js"), "flattersatz.v2.js"); // Check a Windows path.
	assert.equal(scope.get_filename("C:/scripts/flattersatz.v2.js"), "flattersatz.v2.js"); // Check a Windows path with slashes.
	assert.equal(scope.get_filename("/Users/name/scripts/test.js"), "test.js"); // Check a Mac path.
	assert.equal(scope.remove_file_extension("flattersatz.v2.js"), "flattersatz.v2"); // Keep the earlier dot.
	assert.equal(scope.remove_file_extension("no-extension"), "no-extension"); // Keep a name with no extension.
	assert.equal(scope.remove_file_extension(".hidden"), ".hidden"); // Keep a hidden file's whole name.
	assert.equal(scope.remove_file_extension("name."), "name."); // Keep a final dot with no extension.
}); // End the path test.

test("saved units stay separate for two documents and both values are restored", () => { // Check that no shared saved state is used.
	const scope = load(); // Load a fresh copy.
	const first = {viewPreferences: {horizontalMeasurementUnits: "mm", verticalMeasurementUnits: "inch"}}; // Make the first document.
	const second = {viewPreferences: {horizontalMeasurementUnits: "pica", verticalMeasurementUnits: "cm"}}; // Make the second document.
	const a = scope.store_measurement_units(first); // Save the first document's units.
	const b = scope.store_measurement_units(second); // Save the second document's units.
	scope.restore_measurement_units(first, a); // Restore the first document.
	scope.restore_measurement_units(second, b); // Restore the second document.
	assert.deepEqual(first.viewPreferences, {horizontalMeasurementUnits: "mm", verticalMeasurementUnits: "inch"}); // Check the first pair.
	assert.deepEqual(second.viewPreferences, {horizontalMeasurementUnits: "pica", verticalMeasurementUnits: "cm"}); // Check the second pair.
	assert.throws(() => scope.restore_measurement_units(first), /saved measurement-unit state/); // Reject a missing saved value.
}); // End the unit test.

test("a failed unit change restores the value already changed", () => { // Check a partial change.
	const scope = load(); // Load a fresh copy.
	let vertical = "inch"; // Keep the current vertical unit.
	const prefs = {horizontalMeasurementUnits: "mm"}; // Set the other unit.
	Object.defineProperty(prefs, "verticalMeasurementUnits", { // Add a setter that can fail.
		get() { return vertical; }, // Read the current unit.
		set(value) { // Change the vertical unit.
			if (value === "points") { throw new Error("change failed"); } // Simulate an Adobe error.
			vertical = value; // Allow the original value to be restored.
		} // End the setter.
	}); // Finish the fake preference.
	assert.throws(() => scope.store_measurement_units({viewPreferences: prefs}), /change failed/); // Check that the error is reported.
	assert.equal(prefs.horizontalMeasurementUnits, "mm"); // Check that the first change was reversed.
	assert.equal(vertical, "inch"); // Check that the second unit stayed the same.
}); // End the failed change test.

test("redraw helpers keep the original false value", () => { // Check a setting that the old code lost.
	const scope = load(); // Load a fresh copy.
	const previous = scope.redraw_off(); // Save the current redraw state.
	scope.redraw_on(previous); // Restore that state.
	assert.equal(scope.app.scriptPreferences.enableRedraw, false); // Keep redraw off as before.
}); // End the redraw test.

test("layer helpers return existing layers and report real creation errors", () => { // Check layer errors.
	const scope = load(); // Load a fresh copy.
	const existing = {isValid: true}; // Make an existing layer.
	const doc = {layers: {itemByName: () => existing}}; // Find the existing layer.
	assert.equal(scope.create_layer(doc, "Example"), existing); // Return the same layer.
	doc.layers.itemByName = () => ({isValid: false}); // Simulate a missing layer.
	doc.layers.add = () => { throw new Error("document is locked"); }; // Fail to create a new layer.
	assert.throws(() => scope.create_layer(doc, "Example"), /document is locked/); // Report the real error.
}); // End the layer test.

test("page helpers require an active layout window", () => { // Check that a story window is not used as a page.
	const scope = load(); // Load a fresh copy.
	scope.app.documents = [{}]; // Open a fake document.
	scope.app.layoutWindows = [{}]; // Keep a layout window open.
	scope.app.activeWindow = {constructor: {name: "StoryWindow"}}; // Make a story window active.
	assert.throws(() => scope.current_page_number(), /layout window/); // Ask for a layout window instead.
	scope.app.activeWindow = {constructor: {name: "LayoutWindow"}, activePage: {name: "3"}}; // Make page three active.
	assert.equal(scope.current_page_number(), "3"); // Read the active page number.
}); // End the active window test.
