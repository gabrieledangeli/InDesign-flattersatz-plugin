// Build a text-only trial in a new document and leave the source alone.
var FlattersatzPreview = (function(core, legacy) { // Keep the preview tools in one place.
	var ROLE = "org.flattersatz.preview.role"; // Mark each frame with its part in the comparison.
	var MAX_CHARACTERS = 6000, MAX_PARAGRAPHS = 20, MAX_MEASUREMENTS = 6000; // Keep the first trial small enough to review.

	function fail(message) { // Stop the trial with a clear reason.
		throw new Error(message); // Send the reason to the caller.
	} // End this function.

	function text_range(paragraph, start, end) { // Read one text span with an exclusive end.
		return paragraph.texts.itemByRange(paragraph.characters.item(start), paragraph.characters.item(end - 1)); // Get one Text object rather than many separate characters.
	} // End this function.

	function paragraph_text(paragraph) { // Read the words without the final paragraph return.
		return String(paragraph.contents).replace(/\r$/, ""); // Keep every other character in place.
	} // End this function.

	function line_texts(frame) { // Read the actual text on each composed line.
		var result = []; // Start an empty list of lines.
		for (var i = 0; i < frame.lines.length; i++) { // Visit every visible line.
			result.push(String(frame.lines.item(i).contents)); // Keep the exact line contents.
		} // End this loop.
		return result.join("\u0000"); // Join the lines with a marker that normal text cannot contain.
	} // End this function.

	function character_signature(story) { // Read key character settings without changing them.
		var result = [], keys = ["fontStyle", "pointSize", "leading", "tracking", "horizontalScale", "verticalScale", "baselineShift", "kerningMethod", "ligatures", "noBreak"]; // Choose settings that affect text layout.
		for (var i = 0; i < story.characters.length; i++) { // Visit each character in reading order.
			var character = story.characters.item(i), values = [String(character.contents), String(character.appliedFont.name), String(character.appliedCharacterStyle.name)]; // Read the character and its font and style names.
			for (var k = 0; k < keys.length; k++) { values.push(String(character[keys[k]])); } // Read the remaining layout settings.
			result.push(values.join("\u0001")); // Keep the settings for this character together.
		} // End this loop.
		return result.join("\u0000"); // Return a stable record for comparison.
	} // End this function.

	function paragraph_signature(story) { // Check paragraph settings that may change during a copy.
		var result = [], keys = ["composer", "justification", "hyphenation", "balanceRaggedLines", "leftIndent", "rightIndent", "firstLineIndent", "lastLineIndent", "spaceBefore", "spaceAfter", "startParagraph", "keepWithNext", "keepAllLinesTogether", "keepLinesTogether", "keepFirstLines", "keepLastLines", "minimumWordSpacing", "maximumWordSpacing", "desiredWordSpacing", "minimumLetterSpacing", "maximumLetterSpacing", "desiredLetterSpacing", "minimumGlyphScaling", "maximumGlyphScaling", "desiredGlyphScaling"]; // Read the settings that control line layout.
		for (var i = 0; i < story.paragraphs.length; i++) { // Visit the paragraphs in order.
			var paragraph = story.paragraphs.item(i), values = []; // Start a record for this paragraph.
			for (var k = 0; k < keys.length; k++) { values.push(String(paragraph[keys[k]])); } // Read each effective setting without editing it.
			result.push(values.join("\u0001")); // Keep this paragraph's values together.
		} // End this loop.
		return result.join("\u0000"); // Return a record for copy and source checks.
	} // End this function.

	function validate(source) { // Check the limits of this first text-only trial.
		legacy.validate_frame(source, true); // Reuse the checks for simple independent frames.
		var story = source.parentStory, text = String(story.contents); // Read the complete source story.
		if (source.overflows || story.overflows || !text.length || text.length > MAX_CHARACTERS) { // Require a small story that already fits.
			fail("Use a frame with 1 to " + MAX_CHARACTERS + " characters and no overset text."); // Explain the text size limit.
		} // End this check.
		if (story.paragraphs.length > MAX_PARAGRAPHS || story.textVariableInstances.length || story.notes.length) { // Reject long stories and content that can change while copied.
			fail("Use at most 20 paragraphs without text variables or editorial notes."); // Explain the supported story content.
		} // End this check.
		if (/[\u0000-\u000c\u000e-\u001f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ud800-\udfff\ufeff\ufffc]/.test(text)) { // Reject controls and characters whose break or index rules need more work.
			fail("Tabs, forced breaks, soft hyphens, direction marks, emoji and special text markers are not supported in this trial."); // Explain why the text needs a simpler test sample.
		} // End this check.
		if (story.characters.length !== text.length) { fail("This text uses character indexes that the trial cannot map safely."); } // Require matching JavaScript and InDesign character indexes.
		for (var i = 0; i < story.paragraphs.length; i++) { // Check each paragraph before making any copy.
			var paragraph = story.paragraphs.item(i); // Read the next paragraph.
			if (paragraph.firstLineIndent !== 0 || paragraph.alignToBaseline || paragraph.nestedStyles.length || // Require the same width on every line and no layout-driven styles.
				paragraph.nestedGrepStyles.length || paragraph.nestedLineStyles.length || paragraph.bulletsAndNumberingListType !== ListType.NO_LIST) { // Also reject generated list markers and nested styles.
				fail("Use paragraphs without first-line indents, baseline grids, lists or nested styles."); // Explain the paragraph limits.
			} // End this check.
			var flags = [], content = paragraph_text(paragraph); // Prepare the existing word-joining rules.
			for (var c = 0; c < content.length; c++) { flags.push(paragraph.characters.item(c).noBreak === true); } // Keep each existing No Break setting.
			if (core.tokenize(content, flags).length > core.max_tokens) { fail("Use at most 80 word groups in each preview paragraph."); } // Check spaces and word count before creating a document.
		} // End this loop.
	} // End this function.

	function normalize(paragraph) { // Set steady left-aligned text on a copy.
		paragraph.justification = Justification.LEFT_ALIGN; // Align all lines at the left edge.
		paragraph.hyphenation = false; // Use whole words in this first trial.
		paragraph.balanceRaggedLines = false; // Let the chosen groups control the line ends.
		paragraph.minimumWordSpacing = 100; // Keep spaces at their normal width.
		paragraph.maximumWordSpacing = 100; // Prevent spaces from stretching.
		paragraph.desiredWordSpacing = 100; // Ask for normal word spacing.
		paragraph.minimumLetterSpacing = 0; // Keep the normal space between letters.
		paragraph.maximumLetterSpacing = 0; // Prevent added spacing between letters.
		paragraph.desiredLetterSpacing = 0; // Ask for normal letter spacing.
		paragraph.minimumGlyphScaling = 100; // Keep each letter at its original width.
		paragraph.maximumGlyphScaling = 100; // Prevent letter stretching.
		paragraph.desiredGlyphScaling = 100; // Ask for the original letter width.
	} // End this function.

	function normalize_frame(frame) { // Prepare a comparison frame for natural word spacing.
		frame.textFramePreferences.ignoreWrap = true; // Keep the text-only pages free from outside wrap effects.
		for (var i = 0; i < frame.parentStory.paragraphs.length; i++) { normalize(frame.parentStory.paragraphs.item(i)); } // Prepare each paragraph without changing its character styles.
	} // End this function.

	function caption(page, text, width) { // Add a visible label above a comparison frame.
		var frame = page.textFrames.add(); // Create a frame for the page label.
		frame.insertLabel(ROLE, "caption"); // Mark this frame as a label rather than sample text.
		frame.geometricBounds = [12, 36, 66, width + 36]; // Keep the label above the sample.
		frame.textWrapPreferences.textWrapMode = TextWrapModes.NONE; // Keep default wrapping on a label away from the sample text.
		frame.textFramePreferences.ignoreWrap = true; // Keep sample wrapping away from the label.
		frame.textFramePreferences.insetSpacing = 0; // Use the full label area.
		frame.textFramePreferences.textColumnCount = 1; // Keep the label on one plain column.
		frame.textFramePreferences.autoSizingType = AutoSizingTypeEnum.OFF; // Keep a default object style from growing the label over the sample.
		frame.textFramePreferences.verticalJustification = VerticalJustification.TOP_ALIGN; // Start the label at the top of its frame.
		frame.contents = text; // Show the name and any short status message.
		frame.parentStory.texts.item(0).pointSize = 10; // Use small readable label text.
		frame.parentStory.texts.item(0).leading = 12; // Leave room between label lines.
		frame.parentStory.texts.item(0).noBreak = false; // Allow a long label to use more than one line.
		return frame; // Return the label so a status can be added later.
	} // End this function.

	function copy_frame(source, page, role, signature, paragraphs, width) { // Copy the same source onto one comparison page.
		var frame = source.duplicate(page); // Copy the frame and its styled text into the new document.
		frame.insertLabel(ROLE, role); // Record the purpose of this copy.
		frame.move([36, 72]); // Put all samples at the same position on their pages.
		if (String(frame.parentStory.contents) !== String(source.parentStory.contents) || character_signature(frame.parentStory) !== signature) { // Check that cross-document copying kept the text and key settings.
			fail("InDesign changed text or character settings while copying. Try a simpler source frame."); // Stop before showing an inaccurate comparison.
		} // End this check.
		if (paragraph_signature(frame.parentStory) !== paragraphs) { fail("InDesign changed paragraph settings while copying. Try a simpler source frame."); } // Detect style conflicts even when the copied words fit the same lines.
		caption(page, role === "original" ? "1. Original copy" : role === "baseline" ? "2. Natural left alignment" : role === "optimized" ? "3. Optimized word breaks" : "4. Historical wrap method", width); // Give each sample a clear title.
		return frame; // Return the copied sample.
	} // End this function.

	function usable_width(frame, paragraph) { // Find the space available to the words in one paragraph.
		var bounds = frame.geometricBounds, inset = frame.textFramePreferences.insetSpacing; // Read the frame edges and inner margins.
		if (typeof inset === "number") { inset = [inset, inset, inset, inset]; } // Expand one shared inset into four values.
		var width = Number(bounds[3]) - Number(bounds[1]) - Number(inset[1]) - Number(inset[3]) - Number(paragraph.leftIndent) - Number(paragraph.rightIndent); // Remove inner margins and paragraph indents.
		if (!isFinite(width) || width <= 0) { fail("The paragraph has no usable line width."); } // Reject impossible line widths.
		return width; // Return the width in points.
	} // End this function.

	function optimize(doc, frame, probe, zone, result) { // Choose and verify word groups in the text-only sample.
		var story = frame.parentStory; // Read the separate copy being optimized.
		for (var p = 0; p < story.paragraphs.length; p++) { // Work through the paragraphs in order.
			var paragraph = story.paragraphs.item(p), content = paragraph_text(paragraph), flags = []; // Read the text and prepare its existing break rules.
			for (var c = 0; c < content.length; c++) { flags.push(paragraph.characters.item(c).noBreak === true); } // Keep word groups already protected by the author.
			var tokens = core.tokenize(content, flags), width = usable_width(frame, paragraph); // Build legal word groups and read their line width.
			var plan = core.plan({tokens: tokens, width: width, zone: zone, measure: function(first, last) { // Ask the pure planner to compare real InDesign measurements.
				if (++result.measurements > MAX_MEASUREMENTS) { fail("This trial needs too many text measurements. Select a shorter sample."); } // Bound work across all paragraphs.
				probe.parentStory.contents = ""; // Clear only the temporary measuring frame.
				text_range(paragraph, tokens[first].start, tokens[last - 1].end).duplicate(LocationOptions.AT_BEGINNING, probe.insertionPoints.firstItem()); // Copy the candidate with its actual character formatting.
				var measured = probe.parentStory.paragraphs.item(0); // Read the copied candidate paragraph.
				measured.composer = paragraph.composer; // Use this paragraph's actual composer for measurement.
				normalize(measured); // Use the same spacing as the target sample.
				measured.leftIndent = 0; // Start measurement at the frame edge.
				measured.rightIndent = 0; // Use the full measuring width.
				measured.firstLineIndent = 0; // Remove any inherited first-line indent.
				measured.spaceBefore = 0; // Keep the first line inside the measuring frame.
				measured.spaceAfter = 0; // Avoid extra space after the measured words.
				measured.keepWithNext = 0; // Measure this candidate without linking it to another paragraph.
				measured.noBreak = true; // Keep the whole candidate on one line.
				probe.parentStory.recompose(); // Ask InDesign to shape the actual text.
				if (probe.overflows || probe.parentStory.overflows || probe.lines.length !== 1) { return width * 3; } // Mark candidates that cannot fit the large measuring frame as too wide.
				var line = probe.lines.item(0); // Read the single composed line.
				var baseline = Number(line.baseline), end_baseline = Number(line.endBaseline); // Read both vertical positions before comparing them.
				if (!isFinite(baseline) || !isFinite(end_baseline) || Math.abs(baseline - end_baseline) > 0.01) { fail("The measuring line is not horizontal."); } // Reject missing positions as well as a slanted line.
				return Number(line.endHorizontalOffset) - Number(line.horizontalOffset); // Return the actual width rather than a font estimate.
			}}); // Finish planning this paragraph.
			for (var i = 0; i < plan.lines.length; i++) { // Apply the selected word groups to the copy only.
				text_range(paragraph, plan.lines[i].start, plan.lines[i].end).noBreak = true; // Keep each chosen line together without inserting a character.
			} // End this loop.
			result.plans.push(plan); // Keep the plan for tests and review.
			result.lines += plan.lines.length; // Count the planned nonblank lines.
		} // End this loop.
		doc.recompose(); // Let InDesign apply all word-group rules together.
		if (frame.overflows || story.overflows) { fail("The optimized text does not fit. Use a taller source frame and try again."); } // Reject a trial that hides any text.
		for (p = 0; p < story.paragraphs.length; p++) { // Check the final composition against every plan.
			paragraph = story.paragraphs.item(p); // Read the finished paragraph.
			content = paragraph_text(paragraph); // Read the unchanged paragraph text.
			var expected = result.plans[p].lines; // Read the chosen line groups.
			if (!expected.length) { continue; } // Leave blank paragraphs as they were.
			if (paragraph.lines.length !== expected.length) { fail("InDesign did not keep the planned line groups. No result was accepted."); } // Require the planned number of lines.
			for (i = 0; i < expected.length; i++) { // Verify the content and width of each final line.
				var actual = paragraph.lines.item(i), clean = String(actual.contents).replace(/[ \r]+$/, ""); // Ignore only the trailing spaces and paragraph return.
				if (clean !== content.substring(expected[i].start, expected[i].end)) { fail("InDesign chose different word breaks. No result was accepted."); } // Reject a different composition even when the line count matches.
				var span = text_range(paragraph, expected[i].start, expected[i].end); // Read exactly the planned words without trailing spaces.
				var actual_width = Number(span.insertionPoints.lastItem().horizontalOffset) - Number(span.insertionPoints.firstItem().horizontalOffset); // Measure the words after final composition.
				if (!isFinite(actual_width) || Math.abs(actual_width - expected[i].width) > 0.1) { fail("Final text widths differ from the measured words. No result was accepted."); } // Catch missing measurements and changed shaping in the real layout.
			} // End this loop.
		} // End this loop.
	} // End this function.

	function run(app, options) { // Build one disposable comparison document.
		options = options || {}; // Allow the default settings when none are supplied.
		var zone = options.zone === undefined ? 15 : options.zone; // Use a modest default ragged zone.
		if (typeof zone !== "number" || !isFinite(zone) || zone < 0 || zone > 100) { fail("Enter a ragged zone from 0 to 100."); } // Check settings before touching a document.
		if (!app.documents.length || app.selection.length !== 1 || !app.selection[0].isValid || app.selection[0].constructor.name !== "TextFrame") { // Require exactly one complete source frame.
			fail("Open a document and select one independent text frame with the Selection tool."); // Explain how to start the preview.
		} // End this check.
		var source = app.selection[0], state = {unit: app.scriptPreferences.measurementUnit, redraw: app.scriptPreferences.enableRedraw, window: app.activeWindow, selection: app.selection.slice(0)}; // Keep the source and the app state.
		var doc = null, result = null, failure = null; // Prepare to track the new document and any failure.
		try { // Keep the whole trial inside one cleanup boundary.
			app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS; // Measure source and copies in the same unit.
			app.scriptPreferences.enableRedraw = false; // Avoid repeated screen updates during measurement.
			validate(source); // Reject unsupported source text before making a copy.
			var signature = character_signature(source.parentStory), original_paragraphs = paragraph_signature(source.parentStory), original_text = String(source.parentStory.contents), original_lines = line_texts(source); // Save read-only evidence from the source.
			var bounds = source.geometricBounds, width = Number(bounds[3]) - Number(bounds[1]), height = Number(bounds[2]) - Number(bounds[0]); // Read the original frame size.
			if (!isFinite(width) || !isFinite(height) || width < 72 || width > 1200 || height < 72 || height > 2000) { fail("Use a sample frame from 72 to 1200 points wide and 72 to 2000 points tall."); } // Keep comparison pages and measuring frames at practical sizes.
			doc = app.documents.add(); // Track the new document before setting any properties.
			doc.documentPreferences.facingPages = false; // Put each sample on a separate spread.
			doc.documentPreferences.pagesPerDocument = 1; // Start with one comparison page.
			doc.documentPreferences.pageWidth = width + 72; // Leave equal margins beside the samples.
			doc.documentPreferences.pageHeight = height + 108; // Leave space for the sample and its label.
			doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.POINTS; // Use clear units in the comparison document.
			doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.POINTS; // Use points for its vertical ruler too.
			doc.viewPreferences.rulerOrigin = RulerOrigin.PAGE_ORIGIN; // Give every comparison page the same origin.
			doc.zeroPoint = [0, 0]; // Start the page rulers at zero.
			doc.textPreferences.smartTextReflow = false; // Keep the preview at its planned number of pages.
			doc.insertLabel("org.flattersatz.preview", "1"); // Mark this document as a disposable preview.
			result = {document: doc, source_id: source.id, frames: {}, plans: [], paragraphs: source.parentStory.paragraphs.length, lines: 0, measurements: 0, legacy_message: ""}; // Prepare the review result.
			var roles = ["original", "baseline", "optimized", "historical"]; // Choose a fixed order for the four samples.
			for (var i = 0; i < roles.length; i++) { // Build one page for each sample.
				var page = i === 0 ? doc.pages.item(0) : doc.pages.add(); // Reuse the first page and add the others.
				result.frames[roles[i]] = copy_frame(source, page, roles[i], signature, original_paragraphs, width); // Copy the same source with a clear role.
			} // End this loop.
			doc.recompose(); // Check the copied original before changing any text settings.
			if (result.frames.original.overflows || line_texts(result.frames.original) !== original_lines) { // Detect source features that did not survive the copy.
				fail("The original copy has different line breaks. Remove outside wraps or use a simpler sample."); // Reject a comparison with a changed starting point.
			} // End this check.
			normalize_frame(result.frames.baseline); // Prepare the normal left-aligned sample.
			normalize_frame(result.frames.optimized); // Give the optimizer the same starting settings.
			doc.recompose(); // Compose both text-only samples.
			if (result.frames.baseline.overflows) { fail("The natural left-aligned sample does not fit. Use a taller source frame."); } // Keep every comparison readable.
			var scratch = doc.pages.add(), probe = result.frames.baseline.duplicate(scratch); // Put the measuring frame on a temporary separate page.
			probe.insertLabel(ROLE, "measurement"); // Distinguish temporary text from review samples.
			probe.geometricBounds = [0, 0, 2000, Math.max(1000, width * 3)]; // Give candidate lines plenty of room to compose.
			probe.textFramePreferences.insetSpacing = 0; // Measure from the exact frame edge.
			optimize(doc, result.frames.optimized, probe, zone, result); // Build and verify the word-group layout.
			scratch.remove(); // Remove all measuring text before showing the result.
			app.select(result.frames.historical); // Select only the historical sample for the old method.
			try { legacy.run(app, {action: "apply", zone: zone, randomness: 0}); } // Run the existing wrap method on its own page.
			catch (legacy_error) { // Keep the useful text-only trial if the historical method cannot run.
				result.legacy_message = legacy_error.message || String(legacy_error); // Save the exact reason for the missing comparison.
				var old_page = result.frames.historical.parentPage; // Find the isolated historical page.
				old_page.remove(); // Remove any partial shapes along with the failed sample.
					caption(doc.pages.add(), "4. Unavailable\rSee the result message.", width); // Mark the missing result without hiding a long error in a small frame.
				result.frames.historical = null; // Make the missing sample explicit to tests and callers.
			} // End the historical comparison.
			if (String(source.parentStory.contents) !== original_text || character_signature(source.parentStory) !== signature || // Check that the source words and character settings stayed the same.
				paragraph_signature(source.parentStory) !== original_paragraphs || line_texts(source) !== original_lines) { // Also check the source paragraph settings and actual lines.
				fail("The source changed during the preview. The comparison was discarded."); // Refuse a result made while the source was changing.
			} // End this check.
			app.select(result.frames.optimized); // Leave the new result selected for inspection.
		} catch (error) { // Save a failure while all cleanup steps still run.
			failure = error; // Keep the first failure message.
		} finally { // Restore the app even when a copy or measurement fails.
			var cleanup = []; // Collect cleanup errors without hiding the original problem.
			function restore(callback) { // Try each cleanup step independently.
				try { callback(); } catch (error) { cleanup.push(error.message || String(error)); } // Keep going after a failed cleanup step.
			} // End this helper.
			restore(function() { app.scriptPreferences.measurementUnit = state.unit; }); // Restore the original measurement units.
			restore(function() { app.scriptPreferences.enableRedraw = state.redraw; }); // Restore the original screen-update setting.
			if (failure || cleanup.length) { // Discard a failed or incompletely restored trial.
				restore(function() { if (doc && doc.isValid) { doc.close(SaveOptions.NO); } }); // Close only the new comparison document without saving.
				restore(function() { if (state.window && state.window.isValid) { app.activeWindow = state.window; app.select(state.selection); } }); // Return to the original window and selection.
			} // End this check.
			if (cleanup.length) { failure = new Error((failure ? failure.message + "\r" : "") + "Cleanup needs attention: " + cleanup.join(". ")); } // Report any cleanup that could not finish.
		} // End cleanup.
		if (failure) { throw failure; } // Report errors after all recovery steps.
		return result; // Return only a fully checked comparison.
	} // End this function.

	return {run: run}; // Share the preview command with the entry script.
})(FlattersatzRagCore, FlattersatzHost); // Connect the planner and the historical comparison method.
