// Ask ExtendScript to check the code more strictly.
#strict on
// Run this script inside Adobe InDesign.
#target "InDesign";
#include "../indesign/flattersatz/core.js"; // Load the shared geometry functions.
#include "../indesign/flattersatz/host.js"; // Load the code that works with InDesign objects.

// Run manually in InDesign. Only the disposable document created here is edited.
(function() { // Keep the script variables inside this function.
	var original_window = app.windows.length ? app.activeWindow : null; // Remember the window that was active before this test.
	var original_selection = app.documents.length ? app.selection.slice(0) : []; // Save the selection if a document is open.
	var original_units = app.scriptPreferences.measurementUnit; // Remember the original script measurement units.
	var original_redraw = app.scriptPreferences.enableRedraw; // Remember whether screen updates were enabled.
	var doc = null; // Start without a test document.
	var failure = null; // Start without a test error.
	var assertions = 0; // Start counting successful checks at zero.

	function check(condition, description) { // Define a small function that checks one test result.
		if (!condition) { // Stop this test if the condition is false.
			throw new Error(description); // Report the reason this check failed.
		} // End this block.
		assertions++; // Count this successful check.
	} // End this block.

	function owned_items(frame_id) { // Find the wrap objects that belong to one test frame.
		var items = doc.allPageItems; // Read all page objects in the test document.
		var result = []; // Prepare an empty list of matching objects.
		for (var i = 0; i < items.length; i++) { // Check every page object in order.
			if (items[i].extractLabel("org.flattersatz.owner") === String(frame_id) && // Check that this object belongs to the requested frame.
				items[i].extractLabel("org.flattersatz.version") === "2") { // Also require the current Flattersatz object version.
				result.push(items[i]); // Keep this matching wrap object.
			} // End this block.
		} // End this block.
		return result; // Return the values collected by this function.
	} // End this block.

	function check_preferences(layer_id) { // Check that the plugin restored the test preferences.
		check(app.scriptPreferences.measurementUnit == MeasurementUnits.MILLIMETERS, "Script units were not restored."); // Check that script measurements use millimeters again.
		check(app.scriptPreferences.enableRedraw === false, "The prior disabled-redraw state was not restored."); // Check that screen updates are still disabled.
		check(doc.viewPreferences.horizontalMeasurementUnits == MeasurementUnits.MILLIMETERS, "Horizontal document units changed."); // Check that horizontal ruler units did not change.
		check(doc.viewPreferences.verticalMeasurementUnits == MeasurementUnits.PICAS, "Vertical document units changed."); // Check that vertical ruler units did not change.
		check(doc.activeLayer.id === layer_id, "The active layer changed."); // Check that the same layer is still active.
	} // End this block.

	try { // Start work that may report an error.
		app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS; // Use points to create or measure the test layout.
		doc = app.documents.add(); // Create a new document only for this test.
		doc.documentPreferences.properties = {pageWidth: "595 pt", pageHeight: "842 pt", facingPages: false}; // Use a fixed page size with single pages.
		var frame = doc.pages.item(0).textFrames.add(); // Create a text frame on the first test page.
		frame.applyObjectStyle(doc.objectStyles.item(0), true, true); // Remove default object styling from the test frame.
		frame.geometricBounds = [40, 40, 780, 400]; // Place the frame with enough room for the test text.
		frame.textFramePreferences.properties = { // Set simple text-frame options for this test.
			textColumnCount: 1, insetSpacing: 8, ignoreWrap: false, // Use one column, a small inset and active text wrapping.
			autoSizingType: AutoSizingTypeEnum.OFF, verticalJustification: VerticalJustification.TOP_ALIGN // Keep the frame size fixed and align its text at the top.
		}; // End this function or group of settings.
		var sentence = "Typography combines careful spacing and clear structure. The selected frame keeps its original words while invisible objects shape its right edge. "; // Provide the words used in the test document.
		var contents = ""; // Start with an empty text string.
		for (var paragraph = 0; paragraph < 5; paragraph++) { // Create five paragraphs of test text.
			contents += (paragraph > 0 ? "\r" : "") + sentence + sentence; // Add two sentences and separate the paragraphs.
		} // End this block.
		frame.contents = contents; // Put the prepared text into the test frame.
		var text = frame.parentStory.texts.item(0); // Get all text in the frame story.
		text.applyParagraphStyle(doc.paragraphStyles.item(0), true); // Remove default paragraph styling from the test text.
		text.properties = { // Set predictable type and paragraph settings.
			pointSize: 10, leading: 14, justification: Justification.FULLY_JUSTIFIED, // Use ten-point type, fourteen-point line spacing and justified text.
			paragraphDirection: ParagraphDirectionOptions.LEFT_TO_RIGHT_DIRECTION, // Make each paragraph read from left to right.
			spanColumnType: SpanColumnTypeOptions.SINGLE_COLUMN, dropCapCharacters: 0, // Use a single column and no large first letters.
			leftIndent: 0, rightIndent: 0, firstLineIndent: 0, lastLineIndent: 0 // Remove all paragraph indents.
		}; // End this function or group of settings.
		frame.parentStory.storyPreferences.storyDirection = StoryDirectionOptions.LEFT_TO_RIGHT_DIRECTION; // Make the whole story read from left to right.
		doc.recompose(); // Ask InDesign to calculate the text layout.
		check(!frame.overflows, "The smoke-test fixture is overset before applying the effect."); // Check that all test text fits before applying the effect.
		var frame_id = frame.id; // Remember the test frame identifier.
		var layer_id = doc.activeLayer.id; // Remember the active layer identifier.
		var baseline_width = Infinity; // Prepare to find the shortest original text line.
		for (var original_line = 0; original_line < frame.lines.length; original_line++) { // Measure each original line before applying the effect.
			var before = frame.lines.item(original_line); // Read the next original text line.
			baseline_width = Math.min(baseline_width, Number(before.endHorizontalOffset) - Number(before.horizontalOffset)); // Keep the smallest original line width.
		} // End this block.
		doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.MILLIMETERS; // Use millimeters on the horizontal ruler to test restoration.
		doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.PICAS; // Use picas on the vertical ruler to test restoration.
		app.scriptPreferences.measurementUnit = MeasurementUnits.MILLIMETERS; // Use millimeters to test whether the plugin restores script units.
		app.scriptPreferences.enableRedraw = false; // Disable screen updates to test whether that state is preserved.
		app.select(frame); // Select the test frame for the next operation.

		var applied = FlattersatzHost.run(app, {action: "apply", zone: 15, randomness: 0}); // Apply the effect with the default percentages.
		var first_count = owned_items(frame_id).length; // Count the wrap objects from the first application.
		check(applied.frames === 1 && first_count > 0 && applied.wraps === first_count, "Apply did not create the expected wraps."); // Check that Apply created wrap objects for this frame.
		check(frame.parentStory.contents === contents, "Apply changed the story's text."); // Check that Apply kept every word unchanged.
		check_preferences(layer_id); // Check the saved units, redraw state and active layer.
		app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS; // Use points to create or measure the test layout.
		var narrowed = false; // Start without evidence that a line became narrower.
		for (var line_index = 0; line_index < frame.lines.length; line_index++) { // Measure every line after applying the effect.
			var line = frame.lines.item(line_index); // Read the next composed text line.
			if (Number(line.endHorizontalOffset) - Number(line.horizontalOffset) < baseline_width - 1) { // Look for a line narrower than the original lines.
				narrowed = true; // Remember that InDesign narrowed at least one line.
			} // End this block.
		} // End this block.
		check(narrowed, "The real text compositor did not narrow any lines."); // Check that the real InDesign layout changed as expected.
		app.scriptPreferences.measurementUnit = MeasurementUnits.MILLIMETERS; // Use millimeters to test whether the plugin restores script units.

		app.undo(); // Undo the last complete Flattersatz operation.
		check(owned_items(frame_id).length === 0, "Apply could not be undone in one step."); // Check that one undo removed every generated wrap.
		check(frame.parentStory.contents === contents, "Undo changed the original text."); // Check that undo kept the original words.
		app.redo(); // Redo the last undone operation.
		check(owned_items(frame_id).length === first_count, "Redo did not restore the effect."); // Check that redo restored the same number of wraps.
		app.select(frame); // Select the test frame for the next operation.
		var repeated = FlattersatzHost.run(app, {action: "apply", zone: 15, randomness: 0}); // Apply the same effect again to test repeat use.
		check(owned_items(frame_id).length === first_count && repeated.wraps === first_count, "Rerunning accumulated or changed wrap counts."); // Check that a second run did not add duplicate wraps.
		check_preferences(layer_id); // Check the saved units, redraw state and active layer.

		app.select(frame); // Select the test frame for the next operation.
		var removed = FlattersatzHost.run(app, {action: "remove"}); // Remove the effect from the selected test frame.
		check(owned_items(frame_id).length === 0 && removed.removed === first_count, "Remove did not remove the selected frame's wraps."); // Check that removal deleted exactly the owned wraps.
		check(frame.parentStory.contents === contents, "Remove changed the story's text."); // Check that removal kept every word unchanged.
		check_preferences(layer_id); // Check the saved units, redraw state and active layer.
		app.undo(); // Undo the last complete Flattersatz operation.
		check(owned_items(frame_id).length === first_count, "Remove could not be undone in one step."); // Check that one undo restored the removed wraps.
	} catch (error) { // Handle an error from the preceding work.
		failure = error.message || String(error); // Keep the test error so it can be shown at the end.
	} finally { // Run cleanup even if the work failed.
		try { // Start work that may report an error.
			if (doc && doc.isValid) { // Close only the test document if it still exists.
				doc.close(SaveOptions.NO); // Close the temporary document without saving it.
			} // End this block.
		} catch (close_error) { // Handle an error from the preceding work.
			failure = (failure ? failure + "\r" : "") + "Could not close the test document: " + close_error; // Keep a clear message if the test document could not close.
		} // End this block.
		app.scriptPreferences.measurementUnit = original_units; // Restore the script units used before this test.
		app.scriptPreferences.enableRedraw = original_redraw; // Restore the original screen-update setting.
		if (original_window && original_window.isValid) { // Restore the original window if it is still open.
			app.activeWindow = original_window; // Make the original window active again.
			app.select(original_selection); // Restore the selection that existed before this test.
		} // End this block.
	} // End this block.

	alert(failure ? "FAILED on InDesign " + app.version + ":\r" + failure : // Show a failure message with the tested InDesign version.
		"PASS on InDesign " + app.version + ": " + assertions + " smoke-test assertions.", "Flattersatz smoke test"); // Otherwise show the number of successful checks.
})(); // Run this function now.
