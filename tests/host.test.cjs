const assert = require("node:assert/strict"); // Load the strict test checks.
const test = require("node:test"); // Load the test runner.
const { create_fixture } = require("./host-fixture.cjs"); // Read the values needed for this check.

test("a single full-width line leaves no empty effect layer", () => { // Check a frame that needs no shapes.
	const fixture = create_fixture(); // Make a fresh test document.
	fixture.frames[0].lineData = fixture.frames[0].lineData.slice(0, 1); // Keep only the first line.
	const result = fixture.run(); // Apply the default settings.
	assert.equal(result.wraps, 0); // Keep the first line at full width.
	assert.equal(fixture.doc.layers.length, 1); // Do not leave an empty layer.
	assert.match(result.message, /No wrap objects were needed/); // Explain that no shapes were added.
}); // End the empty result test.

test("invalid selections do not start a transaction or change preferences", () => { // Check the behavior named in this test.
	for (const setup of [ // Visit each value used by this check.
		fixture => { fixture.app.documents = []; }, // Set this value for the current check.
		fixture => { fixture.app.selection = []; }, // Set this value for the current check.
		fixture => { fixture.app.selection.push({ isValid: true }); }, // Set this value for the current check.
		fixture => { fixture.frames[0].isValid = false; } // Set this value for the current check.
	]) { // Complete this test step.
		const fixture = create_fixture(); // Prepare a small fake InDesign document.
		setup(fixture); // Apply this test case to the fake document.
		const original = fixture.preferences(); // Prepare the user settings before the action.
		assert.throws(() => fixture.run()); // Check that this action reports an error.
		assert.equal(fixture.scripts.length, 0); // Check that the value matches the expected value.
		assert.equal(fixture.creates, 0); // Check that the value matches the expected value.
		assert.deepEqual(fixture.preferences(), original); // Check that all expected values match.
	} // End this block.
}); // End this block.

test("multiple selected frames generate wraps in one undo operation and restore preferences", () => { // Check the behavior named in this test.
	const fixture = create_fixture(2); // Prepare a small fake InDesign document.
	fixture.app.scriptPreferences.enableRedraw = false; // Set up this fake document value for the check.
	const original = fixture.preferences(); // Prepare the user settings before the action.
	const result = fixture.run(); // Prepare the result from the script.
	assert.equal(result.frames, 2); // Check that the value matches the expected value.
	assert.equal(result.wraps, 4); // Check that the value matches the expected value.
	assert.equal(fixture.scripts.length, 1); // Check that the value matches the expected value.
	assert.deepEqual(fixture.scripts[0], ["javascript", undefined, "entire-script", "Flattersatz"]); // Check that all expected values match.
	assert.deepEqual(fixture.preferences(), original); // Check that all expected values match.
	const shapes = fixture.live_rectangles(); // Prepare the shapes that still exist.
	assert.deepEqual(shapes.map(item => item.extractLabel("org.flattersatz.owner")), ["1", "1", "2", "2"]); // Check that all expected values match.
	for (const shape of shapes) { // Visit each value used by this check.
		assert.equal(shape.nonprinting, true); // Check that the value matches the expected value.
		assert.equal(shape.strokeWeight, 0); // Check that the value matches the expected value.
		assert.equal(shape.fillColor, fixture.doc.swatches.item(0)); // Check that the value matches the expected value.
		assert.equal(shape.transparencySettings.blendingSettings.opacity, 0); // Check that the value matches the expected value.
		assert.equal(shape.textWrapPreferences.textWrapSide, "left"); // Check that the value matches the expected value.
		assert.equal(shape.textWrapPreferences.textWrapMode, "bounding-box"); // Check that the value matches the expected value.
	} // End this block.
}); // End this block.

test("duplicate selections are processed once", () => { // Check the behavior named in this test.
	const fixture = create_fixture(); // Prepare a small fake InDesign document.
	fixture.app.selection.push(fixture.frames[0]); // Keep this object in the fake document.
	const result = fixture.run(); // Prepare the result from the script.
	assert.equal(result.frames, 1); // Check that the value matches the expected value.
	assert.equal(result.wraps, 2); // Check that the value matches the expected value.
}); // End this block.

test("unsupported frames fail preflight without document artifacts", () => { // Check the behavior named in this test.
	const cases = { // Prepare the unsupported frame cases.
		locked: frame => { frame.locked = true; }, // Set this value on the fake object or test case.
		rotated: frame => { frame.absoluteRotationAngle = 5; }, // Set this value on the fake object or test case.
		scaled: frame => { frame.absoluteHorizontalScale = 90; }, // Set this value on the fake object or test case.
		threaded: frame => { frame.parentStory.textContainers.push({}); }, // Set this value on the fake object or test case.
		columns: frame => { frame.textFramePreferences.textColumnCount = 2; }, // Set this value on the fake object or test case.
		autosize: frame => { frame.textFramePreferences.autoSizingType = "height"; }, // Set this value on the fake object or test case.
		ignoreWrap: frame => { frame.textFramePreferences.ignoreWrap = true; }, // Set this value on the fake object or test case.
		curved: frame => { frame.paths.item(0).pathPoints.item(0).leftDirection[0] = 4; }, // Set this value on the fake object or test case.
		corners: frame => { frame.topLeftCornerOption = "rounded"; }, // Set this value on the fake object or test case.
		rtl: frame => { frame.parentStory.storyPreferences.storyDirection = "rtl"; }, // Set this value on the fake object or test case.
		unjustified: frame => { frame.parentStory.paragraphs.item(0).justification = "left"; }, // Set this value on the fake object or test case.
		missingFont: frame => { frame.parentStory.textStyleRanges.item(0).appliedFont.status = "missing"; }, // Set this value on the fake object or test case.
		table: frame => { frame.parentStory.tables.push({}); }, // Set this value on the fake object or test case.
		footnote: frame => { frame.parentStory.footnotes.push({}); } // Set this value on the fake object or test case.
	}; // End this block.
	for (const [name, setup] of Object.entries(cases)) { // Visit each value used by this check.
		const fixture = create_fixture(); // Prepare a small fake InDesign document.
		setup(fixture.frames[0]); // Apply this test case to the fake document.
		const original = fixture.preferences(); // Prepare the user settings before the action.
		assert.throws(() => fixture.run(), name); // Check that this action reports an error.
		assert.equal(fixture.creates, 0, name); // Check that the value matches the expected value.
		assert.equal(fixture.doc.layers.length, 1, name); // Check that the value matches the expected value.
		assert.deepEqual(fixture.preferences(), original, name); // Check that all expected values match.
	} // End this block.
}); // End this block.

test("overlapping text containers are rejected before wrapping neighbouring text", () => { // Check the behavior named in this test.
	const fixture = create_fixture(2); // Prepare a small fake InDesign document.
	fixture.frames[1].geometricBounds = [10, 10, 100, 150]; // Set up this fake document value for the check.
	assert.throws(() => fixture.run(), /overlaps/); // Check that this action reports an error.
	assert.equal(fixture.creates, 0); // Check that the value matches the expected value.
}); // End this block.

test("parent-page text and text on a path are included in overlap checks", () => { // Check the other text types affected by wrapping.
	const inherited = create_fixture(2); // Create two fake text frames.
	const master_frame = inherited.frames.pop(); // Move the second frame out of the spread list.
	master_frame.geometricBounds = [10, 10, 100, 150]; // Put its text above the selected frame.
	inherited.frames[0].parentPage.masterPageItems.push(master_frame); // Put this frame on the fake parent page.
	inherited.app.selection = [inherited.frames[0]]; // Select only the normal page frame.
	assert.throws(() => inherited.run(), /overlaps/); // Check that inherited text blocks the action.
	const path_text = create_fixture(); // Create a separate fake document for text on a path.
	const shape = path_text.add_rectangle(); // Add a shape that can hold text on its path.
	shape.textPaths.push({}); // Give the shape a text path.
	shape.geometricBounds = [10, 10, 100, 150]; // Put the text path above the selected frame.
	assert.throws(() => path_text.run(), /overlaps/); // Check that this text also blocks the action.
}); // End this test.

test("text inside a parent-page group is included in overlap checks", () => { // Check that inherited groups cannot hide other text from the guard.
	class Group {} // Give the fake group the same type name as InDesign.
	const fixture = create_fixture(2); // Create a normal frame and one inherited frame.
	const inherited_frame = fixture.frames.pop(); // Remove the inherited frame from the spread list.
	inherited_frame.geometricBounds = [10, 10, 100, 150]; // Put the inherited text above the selected frame.
	const inner = new Group(); // Make the group that directly holds the inherited text.
	inner.allPageItems = [inherited_frame]; // List the text item inside this group.
	const outer = new Group(); // Make a second group around the first group.
	outer.allPageItems = [inner, inherited_frame]; // Match the flat list of all children returned by InDesign.
	fixture.frames[0].parentPage.masterPageItems.push(outer); // Put the outer group on the parent page.
	fixture.app.selection = [fixture.frames[0]]; // Select only the normal page frame.
	assert.throws(() => fixture.run(), /overlaps/); // Check that the hidden nested text still blocks wrapping.
	assert.equal(fixture.creates, 0); // Check that the failed check creates no objects.
}); // End this test.

test("a selected text frame with extra text on its path is rejected", () => { // Check that wrapping cannot affect a second story on the same frame.
	const fixture = create_fixture(); // Create a fake text frame.
	fixture.frames[0].textPaths.push({}); // Add a second text story on the frame path.
	const original = fixture.preferences(); // Save the user settings before the action.
	assert.throws(() => fixture.run(), /not supported/); // Check that the unsupported frame is rejected.
	assert.equal(fixture.creates, 0); // Check that no new wrap objects exist.
	assert.deepEqual(fixture.preferences(), original); // Check that the user settings are unchanged.
}); // End this test.

test("a locale without story orientation is accepted but an endnote story is rejected", () => { // Check the optional language feature and the special story type.
	const local = create_fixture(); // Create a fake document for the language check.
	Object.defineProperty(local.frames[0].parentStory.storyPreferences, "storyOrientation", { get() { throw new Error("not available in this locale"); } }); // Simulate a property absent in this language version.
	assert.equal(local.run().wraps, 2); // Check that normal horizontal text still works.
	const endnote = create_fixture(); // Create another fake document for the endnote check.
	endnote.frames[0].parentStory.isEndnoteStory = true; // Mark its story as an endnote story.
	assert.throws(() => endnote.run()); // Check that this unsupported story is rejected.
	assert.equal(endnote.creates, 0); // Check that no shapes were created.
}); // End this test.

test("reapplying replaces only owned wraps and reuses the tagged layer", () => { // Check the behavior named in this test.
	const fixture = create_fixture(); // Prepare a small fake InDesign document.
	const unowned_layer = fixture.add_layer("Flattersatz"); // Prepare a user layer with the same name.
	const unrelated = fixture.add_rectangle(unowned_layer); // Prepare an object the script must leave alone.
	unrelated.textWrapPreferences.textWrapMode = "custom-wrap"; // Set this value for the current check.
	fixture.run(); // Run the host action on the fake document.
	const first = fixture.live_rectangles().filter(item => item !== unrelated); // Prepare the first result or object.
	const layer_count = fixture.doc.layers.length; // Prepare the current number of layers.
	const result = fixture.run(); // Prepare the result from the script.
	assert.equal(result.removed, 2); // Check that the value matches the expected value.
	assert.equal(result.wraps, 2); // Check that the value matches the expected value.
	assert.ok(first.every(item => !item.isValid)); // Check that this required condition is true.
	assert.equal(fixture.doc.layers.length, layer_count); // Check that the value matches the expected value.
	assert.equal(fixture.live_rectangles().length, 3); // Check that the value matches the expected value.
	assert.equal(unrelated.isValid, true); // Check that the value matches the expected value.
	assert.equal(unrelated.textWrapPreferences.textWrapMode, "custom-wrap"); // Check that the value matches the expected value.
	assert.equal(unowned_layer.extractLabel("org.flattersatz.layer"), ""); // Check that the value matches the expected value.
}); // End this block.

test("remove and zero zone affect selected owners only, even after geometry changes", () => { // Check the behavior named in this test.
	for (const options of [{ action: "remove" }, { action: "apply", zone: 0 }]) { // Visit each value used by this check.
		const fixture = create_fixture(2); // Prepare a small fake InDesign document.
		const selected = fixture.add_owned(fixture.frames[0]); // Prepare an old wrap on the selected frame.
		const unselected = fixture.add_owned(fixture.frames[1]); // Prepare an old wrap on the other frame.
		const unrelated = fixture.add_rectangle(); // Prepare an object the script must leave alone.
		fixture.app.selection = [fixture.frames[0]]; // Set up this fake document value for the check.
		fixture.frames[0].absoluteRotationAngle = 20; // Set up this fake document value for the check.
		const result = fixture.run(options); // Prepare the result from the script.
		assert.equal(result.removed, 1); // Check that the value matches the expected value.
		assert.equal(result.wraps, 0); // Check that the value matches the expected value.
		assert.equal(selected.isValid, false); // Check that the value matches the expected value.
		assert.equal(unselected.isValid, true); // Check that the value matches the expected value.
		assert.equal(unrelated.isValid, true); // Check that the value matches the expected value.
		assert.equal(fixture.creates, 0); // Check that the value matches the expected value.
	} // End this block.
}); // End this block.

test("creation and property failures restore old wraps and remove partial new objects", () => { // Check the behavior named in this test.
	for (const phase of ["create", "style", "bounds"]) { // Visit each value used by this check.
		const fixture = create_fixture(); // Prepare a small fake InDesign document.
		const previous = fixture.add_owned(); // Prepare an old wrap object.
		const original = fixture.preferences(); // Prepare the user settings before the action.
		if (phase === "create") { // Handle this case when the condition is true.
			fixture.onCreate = count => { if (count === 2) { throw new Error("creation failed"); } }; // Add the fake failure or layout change used by this check.
		} else { // Handle the other case.
			fixture.onStyle = item => { // Add the fake failure or layout change used by this check.
				if (phase === "style") { throw new Error("style failed"); } // Handle this case when the condition is true.
				Object.defineProperty(item, "geometricBounds", { set() { throw new Error("bounds failed"); } }); // Give this fake object a live value or an error hook.
			}; // End this block.
		} // End this block.
		assert.throws(() => fixture.run(), /Previous Flattersatz objects were restored/); // Check that this action reports an error.
		assert.deepEqual(fixture.live_rectangles(), [previous], phase); // Check that all expected values match.
		assert.equal(previous.textWrapPreferences.textWrapMode, "bounding-box", phase); // Check that the value matches the expected value.
		assert.equal(fixture.doc.layers.length, 1, phase); // Check that the value matches the expected value.
		assert.deepEqual(fixture.preferences(), original, phase); // Check that all expected values match.
	} // End this block.
}); // End this block.

test("new overset after recomposition rolls back the entire operation", () => { // Check the behavior named in this test.
	const fixture = create_fixture(); // Prepare a small fake InDesign document.
	const previous = fixture.add_owned(); // Prepare an old wrap object.
	const original = fixture.preferences(); // Prepare the user settings before the action.
	fixture.onRecompose = count => { fixture.frames[0].parentStory.overflows = count === 2; }; // Add the fake failure or layout change used by this check.
	assert.throws(() => fixture.run(), /effect causes overset/); // Check that this action reports an error.
	assert.deepEqual(fixture.live_rectangles(), [previous]); // Check that all expected values match.
	assert.equal(previous.textWrapPreferences.textWrapMode, "bounding-box"); // Check that the value matches the expected value.
	assert.deepEqual(fixture.preferences(), original); // Check that all expected values match.
}); // End this block.

test("an already overset frame or unsafe line spacing leaves no new objects", () => { // Check the behavior named in this test.
	for (const setup of [ // Visit each value used by this check.
		frame => { frame.parentStory.overflows = true; }, // Set this value for the current check.
		frame => { frame.lineData[1].baseline = frame.lineData[1].endBaseline = 25; }, // Set this value for the current check.
		frame => { frame.lineData[0].endBaseline += 1; }, // Set this value for the current check.
		frame => { frame.lineData = []; } // Set this value for the current check.
	]) { // Complete this test step.
		const fixture = create_fixture(); // Prepare a small fake InDesign document.
		const previous = fixture.add_owned(); // Prepare an old wrap object.
		const original = fixture.preferences(); // Prepare the user settings before the action.
		setup(fixture.frames[0]); // Apply this test case to the fake document.
		assert.throws(() => fixture.run()); // Check that this action reports an error.
		assert.deepEqual(fixture.live_rectangles(), [previous]); // Check that all expected values match.
		assert.equal(previous.textWrapPreferences.textWrapMode, "bounding-box"); // Check that the value matches the expected value.
		assert.deepEqual(fixture.preferences(), original); // Check that all expected values match.
	} // End this block.
}); // End this block.

test("recomposition rebuilds bands until the text settles and keeps only the final plan", () => { // Check the behavior named in this test.
	const fixture = create_fixture(); // Prepare a small fake InDesign document.
	fixture.onRecompose = count => { // Add the fake failure or layout change used by this check.
		if (count >= 2) { fixture.frames[0].lineData[1].insertionPoints.item(0).index = 31; } // Handle this case when the condition is true.
	}; // End this block.
	const result = fixture.run(); // Prepare the result from the script.
	assert.equal(fixture.recomposes, 3); // Check that the value matches the expected value.
	assert.equal(fixture.creates, 4); // Check that the value matches the expected value.
	assert.equal(result.wraps, 2); // Check that the value matches the expected value.
	assert.equal(fixture.live_rectangles().length, 2); // Check that the value matches the expected value.
}); // End this block.

test("ignored text wrapping is detected and previous objects are restored", () => { // Check that silent wrap failures are caught.
	const fixture = create_fixture(); // Create a fake InDesign document.
	const previous = fixture.add_owned(); // Keep one old wrap object for the recovery check.
	const original = fixture.preferences(); // Save all user settings before the action.
	fixture.ignoreWrap = true; // Make the fake text layout ignore the new bands.
	assert.throws(() => fixture.run(), /did not apply the expected text wrap/); // Check that the host reports the missing effect.
	assert.deepEqual(fixture.live_rectangles(), [previous]); // Check that only the old wrap remains.
	assert.equal(previous.textWrapPreferences.textWrapMode, "bounding-box"); // Check that the old wrap is active again.
	assert.deepEqual(fixture.preferences(), original); // Check that all user settings are restored.
}); // End this test.

test("layout that keeps reflowing reaches the pass limit and restores previous wraps", () => { // Check the behavior named in this test.
	const fixture = create_fixture(); // Prepare a small fake InDesign document.
	const previous = fixture.add_owned(); // Prepare an old wrap object.
	fixture.onRecompose = count => { // Add the fake failure or layout change used by this check.
		fixture.frames[0].lineData[1].insertionPoints.item(0).index = 30 + count % 2; // Set up this fake document value for the check.
	}; // End this block.
	assert.throws(() => fixture.run(), /did not settle after 12 passes/); // Check that this action reports an error.
	assert.equal(fixture.creates, 24); // Check that the value matches the expected value.
	assert.deepEqual(fixture.live_rectangles(), [previous]); // Check that all expected values match.
	assert.equal(previous.textWrapPreferences.textWrapMode, "bounding-box"); // Check that the value matches the expected value.
}); // End this block.

test("failure deleting old objects recovers deleted objects from exact duplicates", () => { // Check the behavior named in this test.
	const fixture = create_fixture(); // Prepare a small fake InDesign document.
	const first = fixture.add_owned(); // Prepare the first result or object.
	const second = fixture.add_owned(); // Prepare the second result or object.
	fixture.onRemove = item => { if (item === second) { throw new Error("old deletion failed"); } }; // Add the fake failure or layout change used by this check.
	assert.throws(() => fixture.run(), /old deletion failed/); // Check that this action reports an error.
	const survivors = fixture.live_rectangles(); // Prepare the objects left after recovery.
	assert.equal(first.isValid, false); // Check that the value matches the expected value.
	assert.equal(second.isValid, true); // Check that the value matches the expected value.
	assert.equal(survivors.length, 2); // Check that the value matches the expected value.
	const recovered = survivors.find(item => item.backupOf === first); // Prepare the recovered copy of the old object.
	assert.ok(recovered); // Check that this required condition is true.
	assert.equal(recovered.customProperty, "preserve-this"); // Check that the value matches the expected value.
	assert.ok(survivors.every(item => item.textWrapPreferences.textWrapMode === "bounding-box")); // Check that this required condition is true.
}); // End this block.

test("failure backing up old objects restores originals before any old object is deleted", () => { // Check the behavior named in this test.
	const fixture = create_fixture(); // Prepare a small fake InDesign document.
	const first = fixture.add_owned(); // Prepare the first result or object.
	const second = fixture.add_owned(); // Prepare the second result or object.
	fixture.onDuplicate = item => { if (item === second) { throw new Error("backup failed"); } }; // Add the fake failure or layout change used by this check.
	assert.throws(() => fixture.run(), /backup failed/); // Check that this action reports an error.
	assert.deepEqual(fixture.live_rectangles(), [first, second]); // Check that all expected values match.
	assert.equal(first.textWrapPreferences.textWrapMode, "bounding-box"); // Check that the value matches the expected value.
	assert.equal(second.textWrapPreferences.textWrapMode, "bounding-box"); // Check that the value matches the expected value.
}); // End this block.

test("a backup cleanup failure reports an inactive copy without undoing a successful result", () => { // Check the behavior named in this test.
	const fixture = create_fixture(); // Prepare a small fake InDesign document.
	const previous = fixture.add_owned(); // Prepare an old wrap object.
	fixture.onRemove = item => { if (item.backupOf) { throw new Error("backup cleanup failed"); } }; // Add the fake failure or layout change used by this check.
	const result = fixture.run(); // Prepare the result from the script.
	assert.match(result.message, /inactive recovery copy could not be removed/); // Check that the message explains the result.
	assert.equal(result.wraps, 2); // Check that the value matches the expected value.
	assert.equal(previous.isValid, false); // Check that the value matches the expected value.
	const backup = fixture.live_rectangles().find(item => item.backupOf === previous); // Prepare the saved recovery copy.
	assert.equal(backup.textWrapPreferences.textWrapMode, "no-wrap"); // Check that the value matches the expected value.
	assert.equal(fixture.live_rectangles().filter(item => item.textWrapPreferences.textWrapMode === "bounding-box").length, 2); // Check that the value matches the expected value.
}); // End this block.

test("a newly created layer is removed if its setup fails", () => { // Check the behavior named in this test.
	const fixture = create_fixture(); // Prepare a small fake InDesign document.
	const original = fixture.preferences(); // Prepare the user settings before the action.
	const add = fixture.doc.layers.add; // Prepare the original layer creation function.
	fixture.doc.layers.add = properties => { // Set up this fake document value for the check.
		const layer = add(properties); // Prepare the layer for this step.
		layer.insertLabel = () => { throw new Error("layer label failed"); }; // Mark this layer or simulate a label error.
		return layer; // Return this result to the caller.
	}; // End this block.
	assert.throws(() => fixture.run(), /layer label failed/); // Check that this action reports an error.
	assert.equal(fixture.doc.layers.length, 1); // Check that the value matches the expected value.
	assert.deepEqual(fixture.preferences(), original); // Check that all expected values match.
}); // End this block.

test("cleanup failures are reported while restoration continues for remaining objects and preferences", () => { // Check the behavior named in this test.
	const fixture = create_fixture(); // Prepare a small fake InDesign document.
	const previous = fixture.add_owned(); // Prepare an old wrap object.
	const original = fixture.preferences(); // Prepare the user settings before the action.
	fixture.onCreate = count => { if (count === 2) { throw new Error("creation failed"); } }; // Add the fake failure or layout change used by this check.
	fixture.onRemove = item => { if (item !== previous) { throw new Error("cannot delete partial object"); } }; // Add the fake failure or layout change used by this check.
	assert.throws(() => fixture.run(), /Recovery was incomplete.*cannot delete partial object/); // Check that this action reports an error.
	assert.equal(previous.textWrapPreferences.textWrapMode, "bounding-box"); // Check that the value matches the expected value.
	assert.deepEqual(fixture.preferences(), original); // Check that all expected values match.
}); // End this block.

test("a failed preference restoration does not prevent other preferences being restored", () => { // Check the behavior named in this test.
	const fixture = create_fixture(); // Prepare a small fake InDesign document.
	const original = fixture.preferences(); // Prepare the user settings before the action.
	let horizontal = "mm"; // Prepare the fake horizontal unit setting.
	Object.defineProperty(fixture.doc.viewPreferences, "horizontalMeasurementUnits", { // Give this fake object a live value or an error hook.
		enumerable: true, // Set this value on the fake object or test case.
		get() { return horizontal; }, // Complete this test step.
		set(value) { if (value === "mm") { throw new Error("units locked"); } horizontal = value; } // Set the fake value or raise the test error.
	}); // End this block.
	assert.throws(() => fixture.run(), /Could not restore all preferences: units locked/); // Check that this action reports an error.
	const actual = fixture.preferences(); // Prepare the settings after the action.
	assert.equal(actual.horizontalMeasurementUnits, "points"); // Check that the value matches the expected value.
	assert.deepEqual({ ...actual, horizontalMeasurementUnits: "mm" }, original); // Check that all expected values match.
}); // End this block.
