// Ask ExtendScript to check this code more strictly.
#strict on
// Run this test inside Adobe InDesign.
#target "InDesign";
#include "../indesign/flattersatz/core.js"; // Load the old shape calculations.
#include "../indesign/flattersatz/host.js"; // Load the old shape tools and frame checks.
#include "../indesign/flattersatz/rag-core.js"; // Load the new word group calculations.
#include "../indesign/flattersatz/preview.js"; // Load the new comparison document tools.

(function() { // Keep test names inside this function.
	var old_window = app.windows.length ? app.activeWindow : null; // Save the window used before this test.
	var old_selection = app.documents.length ? app.selection.slice(0) : []; // Save any selection in an open document.
	var old_units = app.scriptPreferences.measurementUnit; // Save the script units.
	var old_redraw = app.scriptPreferences.enableRedraw; // Save the screen update setting.
	var old_document_count = app.documents.length; // Save how many user documents were open.
	var source_doc = null; // Start without a test source document.
	var preview_doc = null; // Start without a comparison document.
	var failure = null; // Start without a failure message.
	var assertions = 0; // Start the count of passed checks.

	function check(condition, message) { // Check one expected result.
		if (!condition) { // Stop when a result is wrong.
			throw new Error(message); // Explain which check failed.
		} // End this check.
		assertions++; // Count this passed check.
	} // End the check function.

	function character_signature(frame, include_breaks) { // Read character settings without changing the text.
		var parts = []; // Start a list of saved character settings.
		var characters = frame.parentStory.characters; // Read all characters in the frame story.
		for (var i = 0; i < characters.length; i++) { // Visit each character in order.
			var character = characters.item(i); // Read the next character.
			parts.push(String(character.contents), character.appliedFont.name, character.fontStyle, character.appliedCharacterStyle.name, // Save the text, font and character style names.
				String(character.pointSize), String(character.leading), String(character.tracking), // Save type size, line spacing and tracking.
				String(character.horizontalScale), String(character.verticalScale), String(character.baselineShift)); // Save character scale and baseline shift.
			if (include_breaks) { // Include the break setting when checking the source.
				parts.push(String(character.noBreak)); // Save whether this character must stay with its neighbours.
			} // End the optional break check.
		} // End the character loop.
		return parts.join("|"); // Return a value that can be compared later.
	} // End the character settings function.

	function paragraph_signature(frame) { // Read paragraph settings that the source must keep.
		var parts = []; // Start a list of paragraph settings.
		var paragraphs = frame.parentStory.paragraphs; // Read the story paragraphs.
		for (var i = 0; i < paragraphs.length; i++) { // Visit each paragraph in order.
			var paragraph = paragraphs.item(i); // Read the next paragraph.
			parts.push(paragraph.appliedParagraphStyle.name, String(paragraph.justification), paragraph.composer, // Save the paragraph style, alignment and composer.
				String(paragraph.hyphenation), String(paragraph.balanceRaggedLines), String(paragraph.leftIndent), // Save break choices and the left indent.
				String(paragraph.rightIndent), String(paragraph.firstLineIndent), String(paragraph.lastLineIndent), // Save the other paragraph indents.
				String(paragraph.desiredWordSpacing), String(paragraph.desiredLetterSpacing), String(paragraph.desiredGlyphScaling)); // Save the requested spacing and glyph size.
		} // End the paragraph loop.
		return parts.join("|"); // Return the saved paragraph settings.
	} // End the paragraph settings function.

	function line_signature(frame) { // Read the actual line endings in a composed frame.
		var parts = []; // Start a list of line endings.
		for (var i = 0; i < frame.lines.length; i++) { // Visit each composed line.
			parts.push(String(frame.lines.item(i).contents)); // Save the characters on this line.
		} // End the line loop.
		return parts.join("|"); // Return the saved line endings.
	} // End the line settings function.

	function check_plain_page(frame, description) { // Check that a native comparison page has no wrap shapes.
		check(frame.parentPage.rectangles.length === 0, description + " contains a rectangle."); // Reject rectangular wrap objects on this test page.
		check(frame.parentPage.graphicLines.length === 0, description + " contains a graphic line."); // Reject line wrap objects on this test page.
		var items = frame.parentPage.allPageItems; // Read all objects on this page.
		for (var i = 0; i < items.length; i++) { // Visit each page object.
			check(!items[i].extractLabel("org.flattersatz.owner"), description + " contains an owned wrap."); // Check that no object belongs to the old wrap method.
		} // End the page object loop.
	} // End the plain page function.

	function close_test_doc(doc, description) { // Close only a document made by this test.
		try { // Catch a failure while closing a test document.
			if (doc && doc.isValid) { // Close the document only if it still exists.
				doc.close(SaveOptions.NO); // Discard the test document without saving it.
			} // End the document check.
		} catch (error) { // Keep any cleanup error in the final result.
			failure = (failure ? failure + "\r" : "") + "Could not close " + description + ": " + error; // Add a clear cleanup message.
		} // End the cleanup error check.
	} // End the close function.

	try { // Run the test and collect any error.
		app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS; // Use points to build the test frame.
		source_doc = app.documents.add(); // Create a disposable source document.
		source_doc.documentPreferences.properties = {pageWidth: "595 pt", pageHeight: "842 pt", facingPages: false}; // Use a simple page size.
		var frame = source_doc.pages.item(0).textFrames.add(); // Create the test text frame.
		frame.applyObjectStyle(source_doc.objectStyles.item(0), true, true); // Remove inherited object settings.
		frame.geometricBounds = [50, 50, 780, 420]; // Leave enough height for all comparison methods.
		frame.textFramePreferences.properties = { // Set simple frame settings.
			textColumnCount: 1, insetSpacing: 8, ignoreWrap: false, // Use one column with a small text inset.
			autoSizingType: AutoSizingTypeEnum.OFF, verticalJustification: VerticalJustification.TOP_ALIGN // Keep a fixed frame and top alignment.
		}; // Finish the frame settings.
		var sentence = "Clear typography gives every paragraph a steady rhythm. Words remain readable while the right edge changes gently between longer and shorter lines."; // Use ordinary words below the test limits.
		frame.contents = sentence + "\r" + sentence + "\r" + sentence; // Add three short test paragraphs.
		var contents = frame.parentStory.contents; // Save all original story characters.
		var text = frame.parentStory.texts.item(0); // Read all text in the story.
		text.applyParagraphStyle(source_doc.paragraphStyles.item(0), true); // Remove inherited paragraph settings.
		text.properties = { // Set predictable text and paragraph options.
			pointSize: 10, leading: 14, tracking: 0, justification: Justification.LEFT_JUSTIFIED, // Use simple type with a justified paragraph and a left last line.
			paragraphDirection: ParagraphDirectionOptions.LEFT_TO_RIGHT_DIRECTION, // Use ordinary left to right paragraphs.
			spanColumnType: SpanColumnTypeOptions.SINGLE_COLUMN, dropCapCharacters: 0, // Disable spanning and large first letters.
			leftIndent: 0, rightIndent: 0, firstLineIndent: 0, lastLineIndent: 0, // Remove paragraph indents.
			alignToBaseline: false, noBreak: false, hyphenation: false, balanceRaggedLines: false // Use no grid and no existing break constraints.
		}; // Finish the text settings.
		var font_found = false; // Start without a chosen installed font.
		for (var font_index = 0; font_index < app.fonts.length; font_index++) { // Look through the available fonts.
			var font = app.fonts.item(font_index); // Read the next available font.
			if (font.status == FontStatus.INSTALLED) { // Choose a font that is installed on this computer.
				text.appliedFont = font; // Use that font throughout the test text.
				font_found = true; // Record that the test has a usable font.
				break; // Stop looking after the first installed font.
			} // End the installed font check.
		} // End the font loop.
		check(font_found, "No installed font was found for the test."); // Explain a missing test requirement.
		var emphasis = source_doc.characterStyles.add({name: "Flattersatz preview test", tracking: 20}); // Make a named style that changes local tracking.
		frame.parentStory.characters.itemByRange(0, 4).appliedCharacterStyle = emphasis; // Apply this style to test its preservation in each copy.
		frame.parentStory.characters.itemByRange(0, 15).noBreak = true; // Protect the first two words before running the preview.
		frame.parentStory.storyPreferences.storyDirection = StoryDirectionOptions.LEFT_TO_RIGHT_DIRECTION; // Use a left to right story.
		source_doc.recompose(); // Ask InDesign to compose the source text.
		check(!frame.overflows, "The source fixture is overset."); // Check that the test starts with visible text.
		check(frame.lines.length > 3, "The source fixture has too few lines."); // Require enough lines to test the line plan.
		source_doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.MILLIMETERS; // Set a nondefault horizontal unit to test restoration.
		source_doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.PICAS; // Use a different vertical unit to test restoration.
		app.scriptPreferences.measurementUnit = MeasurementUnits.MILLIMETERS; // Set the script units that the preview must restore.
		app.scriptPreferences.enableRedraw = false; // Disable screen updates to test restoration.
		var old_bounds = frame.geometricBounds.join(","); // Save the source frame position.
		var old_characters = character_signature(frame, true); // Save source characters and their break settings.
		var old_formatting = character_signature(frame, false); // Save character settings for checking the copies.
		var old_paragraphs = paragraph_signature(frame); // Save source paragraph settings.
		var old_lines = line_signature(frame); // Save the original line endings.
		var old_items = source_doc.allPageItems.length; // Save the number of source page objects.
		var old_layers = source_doc.layers.length; // Save the number of source layers.
		var old_layer_id = source_doc.activeLayer.id; // Save the source active layer.
		app.select(frame); // Select the source frame for the preview.
		var result = FlattersatzPreview.run(app, {zone: 15}); // Build a comparison with the default ragged zone.
		preview_doc = result.document; // Keep the result document so this test can close it.
		check(preview_doc && preview_doc.isValid && preview_doc.id !== source_doc.id, "The preview did not create a separate document."); // Check that the source was not used as the preview.
		check(preview_doc.pages.length === 4, "The comparison must contain four pages."); // Check the comparison layout.
		check(result.source_id === frame.id, "The result refers to the wrong source frame."); // Check the saved source identifier.
		check(result.paragraphs === 3 && result.plans.length === 3, "The preview did not plan all three paragraphs."); // Check the paragraph result count.
		check(result.measurements > 0 && result.measurements <= 6000, "The candidate measurement count is invalid."); // Check that native measurements stayed inside the limit.
		check(frame.parentStory.contents === contents, "The preview changed the source characters."); // Check the unchanged source text.
		check(character_signature(frame, true) === old_characters, "The preview changed source character formatting."); // Check all saved source character settings.
		check(paragraph_signature(frame) === old_paragraphs, "The preview changed source paragraph formatting."); // Check all saved source paragraph settings.
		check(line_signature(frame) === old_lines, "The preview changed source line endings."); // Check the original source composition.
		check(frame.geometricBounds.join(",") === old_bounds, "The preview moved or resized the source frame."); // Check the source frame geometry.
		check(source_doc.allPageItems.length === old_items && source_doc.layers.length === old_layers, "The preview added source objects or layers."); // Check that no source objects were added.
		check(source_doc.activeLayer.id === old_layer_id, "The preview changed the source active layer."); // Check the source layer selection.
		check(app.scriptPreferences.measurementUnit == MeasurementUnits.MILLIMETERS, "The preview did not restore script units."); // Check the original script units.
		check(app.scriptPreferences.enableRedraw === false, "The preview did not restore redraw."); // Check the original screen update setting.
		check(source_doc.viewPreferences.horizontalMeasurementUnits == MeasurementUnits.MILLIMETERS, "The horizontal source units changed."); // Check the horizontal source ruler.
		check(source_doc.viewPreferences.verticalMeasurementUnits == MeasurementUnits.PICAS, "The vertical source units changed."); // Check the vertical source ruler.
		var roles = ["original", "baseline", "optimized"]; // Name the three required content frames.
		for (var role_index = 0; role_index < roles.length; role_index++) { // Check each required frame.
			var role = roles[role_index]; // Read the next comparison role.
			var copy = result.frames[role]; // Read the matching result frame.
			check(copy && copy.isValid, "Missing " + role + " frame."); // Check that the frame exists.
			check(copy.extractLabel("org.flattersatz.preview.role") === role, "Wrong " + role + " label."); // Check the frame role label.
			check(copy.parentStory.contents === contents, role + " changed the text or added a line break."); // Check that every original character is preserved.
			check(character_signature(copy, false) === old_formatting, role + " changed preserved character formatting."); // Check fonts, size and local tracking in the copy.
			check(copy.parentStory.characters.item(5).noBreak === true, role + " removed the original protected word group."); // Check that the original No Break space stays protected.
			check(!copy.overflows, role + " is overset."); // Check that the copy displays all text.
			check_plain_page(copy, role); // Check that the page has no wrap shapes.
		} // End the required frame loop.
		check(line_signature(result.frames.original) === old_lines, "The original copy has different line endings."); // Check that the original copy is a valid comparison.
		check(result.lines === result.frames.optimized.lines.length, "The reported optimized line count is wrong."); // Check the measured result count.
		for (var paragraph_index = 0; paragraph_index < result.plans.length; paragraph_index++) { // Check each planned paragraph against the real text.
			var planned = result.plans[paragraph_index].lines; // Read the line groups chosen by the planner.
			var actual_paragraph = result.frames.optimized.parentStory.paragraphs.item(paragraph_index); // Read the actual composed paragraph.
			var paragraph_text = String(actual_paragraph.contents).replace(/\r$/, ""); // Read its text without the final paragraph return.
			check(actual_paragraph.lines.length === planned.length, "The actual paragraph line count differs from its plan."); // Check that InDesign used the planned line count.
			for (var line_index = 0; line_index < planned.length; line_index++) { // Check the words on every real line.
				var actual_text = String(actual_paragraph.lines.item(line_index).contents).replace(/[ \r]+$/, ""); // Ignore only trailing spaces and the paragraph return.
				check(actual_text === paragraph_text.substring(planned[line_index].start, planned[line_index].end), "InDesign used different line endings from the plan."); // Compare actual and planned words on this line.
			} // End the line comparison loop.
		} // End the paragraph comparison loop.
		var constrained = false; // Start without a found word group constraint.
		for (var character_index = 0; character_index < result.frames.optimized.parentStory.characters.length; character_index++) { // Read all optimized characters.
			if (result.frames.optimized.parentStory.characters.item(character_index).noBreak) { // Look for a planned group kept together.
				constrained = true; // Remember that the optimization uses No Break.
				break; // Stop after finding the first constraint.
			} // End the constraint check.
		} // End the optimized character loop.
		check(constrained, "The optimized frame has no No Break constraints."); // Check that the new method actually applied its plan.
		if (result.frames.historical) { // Check the old method when a comparison was possible.
			check(result.frames.historical.parentStory.contents === contents, "The historical comparison changed the text."); // Check that the old method also preserves the words.
			check(!result.frames.historical.overflows, "The historical comparison is overset."); // Check that the historical comparison fits.
		} else { // Check the explanation when the old method was unavailable.
			check(Boolean(result.legacy_message), "The missing historical comparison has no explanation."); // Require a reason for skipping that comparison.
		} // End the historical comparison check.
	} catch (error) { // Keep a test failure for the final message.
		failure = error.message || String(error); // Save the most useful failure description.
	} finally { // Restore the user's state after every result.
		close_test_doc(preview_doc, "the comparison document"); // Close only the comparison document created by the test.
		close_test_doc(source_doc, "the source test document"); // Close only the disposable source document.
		if (app.documents.length !== old_document_count) { // Report any extra document left after cleanup.
			failure = (failure ? failure + "\r" : "") + "The number of open documents changed after cleanup."; // Keep the leak visible without closing any user document.
		} // End the document count check.
		app.scriptPreferences.measurementUnit = old_units; // Restore the script units used before this test.
		app.scriptPreferences.enableRedraw = old_redraw; // Restore the original screen update setting.
		if (old_window && old_window.isValid) { // Restore the previous window if it still exists.
			app.activeWindow = old_window; // Make the previous window active again.
			app.select(old_selection); // Restore the previous selection.
		} // End the window restoration check.
	} // End the test and cleanup blocks.

	alert(failure ? "FAILED on InDesign " + app.version + ":\r" + failure : // Show the failure and the tested InDesign version.
		"PASS on InDesign " + app.version + ": " + assertions + " preview assertions.", "Flattersatz preview smoke test"); // Otherwise report the number of passed checks.
})(); // Run the smoke test now.
