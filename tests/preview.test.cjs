const assert = require("node:assert/strict"); // Load the strict test checks.
const test = require("node:test"); // Load the test runner.
const { create_preview_fixture } = require("./preview-fixture.cjs"); // Load the separate fake InDesign document.

function restored(fixture, source_before, app_before) { // Check every source and app value after a failed preview.
	assert.deepEqual(fixture.snapshot(), source_before); // Check that source text, styles, and document settings did not change.
	assert.deepEqual(fixture.app.scriptPreferences, app_before); // Check that app preferences were restored.
	assert.equal(fixture.app.activeDocument, fixture.sourceDocument); // Check that the source document is shown again.
	assert.deepEqual(fixture.app.selection, [fixture.source]); // Check that the source frame is selected again.
	assert.equal(fixture.app.documents.length, 1); // Check that only the source document remains open.
	assert.ok(fixture.documents.slice(1).every(doc => !doc.isValid && doc.closeOption === "no")); // Check that every failed result was closed without saving.
} // End the common recovery check.

test("preview makes four independent pages and leaves all source data unchanged", () => { // Check the complete normal preview path.
	const fixture = create_preview_fixture(); // Make a styled source frame.
	fixture.app.scriptPreferences.enableRedraw = false; // Start with screen updates already off.
	const source_before = fixture.snapshot(); // Save all source data before the preview.
	const app_before = { ...fixture.app.scriptPreferences }; // Save the app preferences.
	const result = fixture.run(); // Build the comparison document.
	assert.equal(result.source_id, fixture.source.id); // Check that the result names the original frame.
	assert.equal(result.document.pages.length, 4); // Check that only the four comparison pages remain.
	assert.equal(fixture.app.activeDocument, result.document); // Check that the comparison document is shown.
	assert.deepEqual(fixture.app.selection, [result.frames.optimized]); // Check that the optimized sample is selected.
	assert.deepEqual(fixture.snapshot(), source_before); // Check that source text, flags, styles, and settings did not change.
	assert.deepEqual(fixture.app.scriptPreferences, app_before); // Check that the original app preferences were restored.
	assert.equal(fixture.validations.length, 1); // Check that the source passes the shared frame checks once.
	assert.equal(fixture.validations[0].frame, fixture.source); // Check that validation used the actual source frame.
	assert.equal(fixture.validations[0].allow_left, true); // Check that a left-aligned source is allowed for this trial.
	assert.equal(fixture.hostCalls.length, 1); // Check that the historical method runs only for its own comparison.
	for (const role of ["original", "baseline", "optimized", "historical"]) { // Check each live sample separately.
		const frame = result.frames[role]; // Read this sample frame.
		assert.notEqual(frame, fixture.source); // Check that the sample is an independent frame.
		assert.equal(frame.contents, source_before.text); // Check that the sample contains the original text.
		assert.equal(frame.extractLabel("org.flattersatz.preview.role"), role); // Check its visible role matches its stored label.
		assert.equal(frame.parentPage.parent, result.document); // Check that the sample belongs to the new document.
	} // End the sample checks.
	assert.ok(result.document.allPageItems.every(frame => frame.extractLabel("org.flattersatz.preview.role") !== "measurement")); // Check that no measuring frame is left behind.
	assert.equal(result.frames.original.paragraphs.item(0).hyphenation, true); // Check that the original comparison keeps the source paragraph settings.
	assert.equal(result.frames.baseline.paragraphs.item(0).justification, "left"); // Check that the natural comparison uses left alignment.
	assert.equal(result.frames.baseline.paragraphs.item(0).hyphenation, false); // Check that the natural comparison uses whole words.
	assert.equal(result.frames.optimized.paragraphs.item(0).composer, "Source composer"); // Check that the selected composer is preserved.
	result.document.close("no"); // Discard the disposable comparison.
	assert.equal(fixture.sourceDocument.isValid, true); // Check that closing the comparison leaves the source open.
	assert.deepEqual(fixture.snapshot(), source_before); // Check that discarding the comparison leaves the source unchanged.
}); // End the normal preview test.

test("whole-range measurements preserve character styling and existing No Break flags", () => { // Check style-safe copies and exact fake native widths.
	const fixture = create_preview_fixture(); // Make the source text.
	fixture.source.data[5].noBreak = true; // Keep the first two words joined by the author's original rule.
	for (let index = 0; index < fixture.source.data.length; index++) { // Give the source uneven glyph widths and mixed styles.
		const character = fixture.source.data[index]; // Read the current source character.
		character.width = character.contents === " " ? 2 : index % 3 === 0 ? 8 : 4; // Use widths that cannot be guessed from the number of characters.
		if (index % 4 === 0) { character.fontStyle = "Italic"; character.pointSize = 13; } // Add mixed character formatting.
	} // End the source style setup.
	const source_before = fixture.snapshot(); // Save all source formatting and flags.
	const result = fixture.run(); // Build the style-preserving preview.
	assert.equal(fixture.rangeCopies, result.measurements); // Check that each measurement duplicates one continuous styled span.
	assert.ok(result.measurements > 0); // Check that the planner used real measurement calls.
	assert.deepEqual(fixture.snapshot(), source_before); // Check that measurement did not edit the source.
	assert.equal(result.plans[0].tokens[0].text, "Alpha beta"); // Check that the protected gap remains one group.
	for (let index = 0; index < fixture.source.data.length; index++) { // Check each copied character.
		const original = fixture.source.data[index]; // Read the original character record.
		const optimized = result.frames.optimized.data[index]; // Read its optimized copy.
		assert.equal(optimized.contents, original.contents); // Check that no text character was added or replaced.
		assert.equal(optimized.appliedCharacterStyle, original.appliedCharacterStyle); // Check that the original character style reference is retained.
		assert.equal(optimized.fontStyle, original.fontStyle); // Check that font style was preserved.
		assert.equal(optimized.pointSize, original.pointSize); // Check that font size was preserved.
		if (original.noBreak) { assert.equal(optimized.noBreak, true); } // Check that the preview never clears an existing No Break flag.
	} // End the character checks.
	for (const line of result.plans[0].lines) { // Check each chosen width against the fake native glyph values.
		const width = fixture.source.data.slice(line.start, line.end).reduce((sum, character) => sum + character.width, 0); // Measure the same whole span from the fake glyph data.
		assert.equal(line.width, width); // Check that the planner uses measured widths rather than text length estimates.
	} // End the measured width checks.
}); // End the styled measurement test.

test("multiple paragraphs and empty paragraphs keep their original characters", () => { // Check paragraph-local indexes and blank paragraphs.
	const fixture = create_preview_fixture("Alpha beta gamma delta epsilon\r\rOne two three four five six seven eight"); // Make text with a blank middle paragraph.
	const before = fixture.snapshot(); // Save the exact paragraph returns and source flags.
	const result = fixture.run(); // Build all paragraph plans.
	assert.equal(result.paragraphs, 3); // Check that the blank paragraph is counted.
	assert.equal(result.plans.length, 3); // Check that every paragraph has a plan entry.
	assert.equal(result.plans[1].lines.length, 0); // Check that the blank paragraph has no word groups.
	assert.equal(result.frames.optimized.contents, before.text); // Check that all paragraph returns remain in place.
	assert.deepEqual(fixture.snapshot(), before); // Check that the source text and style data remain unchanged.
	assert.equal(result.lines, result.plans.reduce((sum, plan) => sum + plan.lines.length, 0)); // Check that the result counts only planned nonblank lines.
}); // End the paragraph test.

test("each measurement uses the composer of its own source paragraph", () => { // Check that the shared probe does not reuse the first paragraph's composer.
	const fixture = create_preview_fixture("Alpha beta gamma delta\rOne two three four five"); // Make two paragraphs with separate text.
	fixture.source.paragraphSettings[0].composer = "First composer"; // Choose a composer for the first paragraph.
	fixture.source.paragraphSettings[1].composer = "Second composer"; // Choose a different composer for the next paragraph.
	fixture.onRangeCopy = (range, target) => { target.frame.expectedComposer = range.frame.paragraphs.getElements().find(paragraph => range.start >= paragraph.start && range.start < paragraph.end).composer; }; // Remember which source paragraph supplied this candidate.
	fixture.onRecompose = doc => { // Inspect each candidate when the preview asks for native composition.
		for (const frame of doc.allPageItems) { // Read every live fake frame.
			if (frame.extractLabel("org.flattersatz.preview.role") === "measurement" && frame.contents.length) { assert.equal(frame.paragraphs.item(0).composer, frame.expectedComposer); } // Check the candidate uses its source paragraph's composer.
		} // End the frame checks.
	}; // End the fake composition check.
	const result = fixture.run(); // Build the multi-composer preview.
	assert.equal(result.plans.length, 2); // Check that both paragraphs were planned successfully.
}); // End the composer preservation test.

test("invalid settings and selections create no comparison document", () => { // Check the simple entry guards before copying.
	for (const input of [{ zone: -1 }, { zone: 101 }, { zone: NaN }, { zone: "15" }]) { // Try each wrong zone value.
		const fixture = create_preview_fixture(); // Make a valid source for this settings check.
		assert.throws(() => fixture.run(input), /ragged zone/); // Check that the wrong zone is reported.
		assert.equal(fixture.documents.length, 1); // Check that no comparison was created.
	} // End the wrong zone checks.
	for (const selection of [[], [{ isValid: true }]]) { // Try no frame and a wrong selected object.
		const fixture = create_preview_fixture(); // Make the source app for this selection check.
		fixture.app.selection = selection; // Set the unsupported selection.
		assert.throws(() => fixture.run(), /select one independent text frame/); // Check that the user is told to select one frame.
		assert.equal(fixture.documents.length, 1); // Check that selection errors create no documents.
	} // End the selection checks.
}); // End the entry guard test.

test("unsupported source features fail before copying and restore app preferences", () => { // Check the preview's own source limits.
	const cases = [ // List independent unsupported source cases.
		fixture => { fixture.source.paragraphSettings[0].firstLineIndent = 5; }, // Reject different first-line widths.
		fixture => { fixture.source.paragraphSettings[0].alignToBaseline = true; }, // Reject baseline grid alignment.
		fixture => { fixture.source.paragraphSettings[0].nestedStyles.push({}); }, // Reject layout-driven nested styles.
		fixture => { fixture.source.paragraphSettings[0].bulletsAndNumberingListType = "bullets"; }, // Reject generated list markers.
		fixture => { fixture.source.parentStory.textVariableInstances.push({}); }, // Reject changing text variables.
		fixture => { fixture.source.parentStory.notes.push({}); }, // Reject editorial notes.
		fixture => { fixture.source.contents = "Alpha\tbeta"; }, // Reject tab characters.
		fixture => { fixture.source.contents = "Alpha beta "; }, // Reject a trailing ordinary space.
		fixture => { fixture.source.geometricBounds[3] = 50; }, // Reject a frame below the supported sample width.
		fixture => { fixture.source.geometricBounds[3] = NaN; }, // Reject a missing source frame width.
		fixture => { fixture.source.contents = Array(22).fill("One").join("\r"); fixture.source.geometricBounds[2] = 1000; } // Reject more than twenty paragraphs.
	]; // End the unsupported case list.
	for (const setup of cases) { // Try each unsupported source independently.
		const fixture = create_preview_fixture(); // Make a fresh source document.
		setup(fixture); // Apply this source limitation.
		const before = fixture.snapshot(); // Save the source after test setup.
		const app_before = { ...fixture.app.scriptPreferences }; // Save app preferences before the action.
		assert.throws(() => fixture.run()); // Check that the preview refuses this source.
		assert.equal(fixture.documents.length, 1); // Check that no comparison was created.
		restored(fixture, before, app_before); // Check that source and app state were preserved.
	} // End the unsupported case checks.
}); // End the source guard test.

test("copy and measurement failures close the new document and restore the source window", () => { // Check recovery at different creation stages.
	for (const phase of ["document", "page", "frame", "range", "copyStyle", "copyParagraph"]) { // Try each failure boundary independently.
		const fixture = create_preview_fixture(); // Make a fresh source frame.
		const before = fixture.snapshot(); // Save the source text and settings.
		const app_before = { ...fixture.app.scriptPreferences }; // Save the app preferences.
		if (phase === "document") { fixture.onDocumentAdd = () => { throw new Error("document failed"); }; } // Fail before a new document is returned.
		if (phase === "page") { fixture.onPageAdd = doc => { if (doc.pageList.length > 1) { throw new Error("page failed"); } }; } // Fail after some comparison pages exist.
		if (phase === "frame") { fixture.onDuplicate = () => { throw new Error("frame failed"); }; } // Fail when copying the source frame.
		if (phase === "range") { fixture.onRangeCopy = () => { throw new Error("range failed"); }; } // Fail when copying a measurement span.
		if (phase === "copyStyle") { fixture.onCopied = copy => { copy.data[0].fontStyle = "Changed"; }; } // Simulate a cross-document style change.
		if (phase === "copyParagraph") { fixture.onCopied = copy => { copy.paragraphSettings[0].composer = "Changed composer"; }; } // Simulate a paragraph change that keeps the same line ends.
		assert.throws(() => fixture.run(), phase === "copyStyle" ? /changed text or character settings/ : phase === "copyParagraph" ? /changed paragraph settings/ : /failed/); // Check that the original failure is reported.
		restored(fixture, before, app_before); // Check full source and app recovery.
	} // End the creation failure checks.
}); // End the failure recovery test.

test("changed original line breaks reject an inaccurate comparison", () => { // Check the copied starting layout before optimizing it.
	const fixture = create_preview_fixture(); // Make the source text.
	const before = fixture.snapshot(); // Save the source data.
	const app_before = { ...fixture.app.scriptPreferences }; // Save the app preferences.
	fixture.onCompose = (frame, lines) => { if (frame.extractLabel("org.flattersatz.preview.role") === "original") { lines[0].contents += "changed"; } }; // Simulate a changed line break after the source is copied.
	assert.throws(() => fixture.run(), /original copy has different line breaks/); // Check that an inaccurate original sample is rejected.
	restored(fixture, before, app_before); // Check that the failed comparison is discarded.
}); // End the copied line verification test.

test("an oversized candidate produces no accepted plan and cleans all temporary frames", () => { // Check a protected word that cannot fit the source width.
	const fixture = create_preview_fixture(); // Make a source that fits before the simulated measurement failure.
	const before = fixture.snapshot(); // Save the original text and settings.
	const app_before = { ...fixture.app.scriptPreferences }; // Save app preferences.
	fixture.onCompose = (frame, lines) => { if (frame.extractLabel("org.flattersatz.preview.role") === "measurement") { for (const line of lines) { line.tooWide = true; } } }; // Simulate measurement frames whose candidates overflow.
	assert.throws(() => fixture.run(), /No complete rag preview plan fits/); // Check that the overflow sentinel cannot become an accepted line.
	restored(fixture, before, app_before); // Check that the result and scratch frames were all closed.
}); // End the candidate overflow test.

test("a missing or slanted probe baseline rejects the measurement", () => { // Check finite and horizontal native measurement positions.
	for (const baseline of [NaN, 101]) { // Try a missing position and a different end position.
		const fixture = create_preview_fixture(); // Make a normal source sample.
		const before = fixture.snapshot(); // Save the source state.
		const app_before = { ...fixture.app.scriptPreferences }; // Save the app preferences.
		fixture.onCompose = (frame, lines) => { if (frame.extractLabel("org.flattersatz.preview.role") === "measurement") { for (const line of lines) { line.endBaseline = baseline; } } }; // Make the measuring line fail its native geometry check.
		assert.throws(() => fixture.run(), /measuring line is not horizontal/); // Check that the invalid native position is reported.
		restored(fixture, before, app_before); // Check that all temporary data is discarded.
	} // End the baseline checks.
}); // End the native baseline test.

test("final line contents and final text widths must match the measured plan", () => { // Check both native composition verification paths.
	for (const phase of ["text", "width", "missingWidth", "overflow"]) { // Try a changed line, changed width, missing width, and hidden text.
		const fixture = create_preview_fixture(); // Make a source for this verification check.
		const before = fixture.snapshot(); // Save all source state.
		const app_before = { ...fixture.app.scriptPreferences }; // Save app preferences.
		if (phase === "text") { fixture.onCompose = (frame, lines) => { if (frame.extractLabel("org.flattersatz.preview.role") === "optimized" && frame.data.some(character => character.noBreak)) { lines[0].contents = "Different words "; } }; } // Change the composed text only after word groups are applied.
		if (phase === "width") { fixture.onOffset = (frame, index, value) => frame.extractLabel("org.flattersatz.preview.role") === "optimized" ? value + index : value; } // Simulate changed shaping in the final sample.
		if (phase === "missingWidth") { fixture.onOffset = (frame, index, value) => frame.extractLabel("org.flattersatz.preview.role") === "optimized" ? NaN : value; } // Simulate a missing native width that must not pass comparison.
		if (phase === "overflow") { fixture.onRecompose = doc => { for (const frame of doc.allPageItems) { if (frame.extractLabel("org.flattersatz.preview.role") === "optimized" && frame.data.some(character => character.noBreak)) { frame.forceOverflow = true; } } }; } // Simulate overset after applying the chosen groups.
		assert.throws(() => fixture.run(), phase === "text" ? /different word breaks/ : phase === "width" || phase === "missingWidth" ? /Final text widths differ/ : /optimized text does not fit/); // Check the exact verification failure.
		restored(fixture, before, app_before); // Check that no failed sample is accepted.
	} // End the native result checks.
}); // End the final verification test.

test("a paragraph beyond the word-group limit is rejected before copying", () => { // Check the bounded search limit through the full host.
	const fixture = create_preview_fixture(Array(81).fill("word").join(" ")); // Make a paragraph with too many independent word groups.
	fixture.source.geometricBounds = [0, 0, 1000, 1200]; // Keep the large source sample within the frame limits.
	const before = fixture.snapshot(); // Save the source state.
	const app_before = { ...fixture.app.scriptPreferences }; // Save app preferences.
	assert.throws(() => fixture.run(), /at most 80 word groups/); // Check that the planner stops at its public group limit.
	assert.equal(fixture.documents.length, 1); // Check that an oversized search creates no comparison document.
	restored(fixture, before, app_before); // Check that the source remains unchanged after the stop.
}); // End the search limit test.

test("the whole preview stops before exceeding its total native measurement budget", () => { // Check the shared work limit across many supported paragraphs.
	const paragraph = Array(30).fill("word").join(" "); // Make a paragraph with many candidate spans.
	const fixture = create_preview_fixture(Array(14).fill(paragraph).join("\r")); // Stay below the paragraph limit while requiring more than six thousand candidate measurements.
	fixture.source.geometricBounds = [0, 0, 2000, 700]; // Keep all source paragraphs visible while requiring more than one line each.
	const before = fixture.snapshot(); // Save the source document before the long search.
	const app_before = { ...fixture.app.scriptPreferences }; // Save the app preferences.
	assert.throws(() => fixture.run(), /too many text measurements/); // Check that the preview stops at its shared measurement budget.
	assert.equal(fixture.rangeCopies, 6000); // Check that no native range copy is made beyond the budget.
	restored(fixture, before, app_before); // Check that the source and app are restored after the bounded search stops.
}); // End the total measurement budget test.

test("failure of the historical method keeps the text-only comparison usable", () => { // Check the optional historical page fallback.
	const fixture = create_preview_fixture(); // Make the source text.
	const before = fixture.snapshot(); // Save the source state.
	fixture.onHistorical = () => { throw new Error("Historical method cannot handle this sample"); }; // Simulate an unsupported historical comparison.
	const result = fixture.run(); // Finish the text-only trial despite that failure.
	assert.equal(result.frames.historical, null); // Check that the unavailable historical sample is explicit.
	assert.match(result.legacy_message, /cannot handle this sample/); // Check that the reason is returned.
	assert.equal(result.document.pages.length, 4); // Check that a clean explanation page replaces the failed sample.
	assert.ok(result.document.allPageItems.some(frame => /unavailable/i.test(frame.contents))); // Check that the user can see which comparison is missing.
	assert.equal(fixture.app.selection[0], result.frames.optimized); // Check that the accepted optimized sample remains selected.
	assert.deepEqual(fixture.snapshot(), before); // Check that optional comparison failure never changes the source.
}); // End the historical fallback test.

test("a preference restoration error discards the result but still restores the remaining app state", () => { // Check independent cleanup steps after a preference failure.
	const fixture = create_preview_fixture(); // Make a valid source document.
	const before = fixture.snapshot(); // Save the source state.
	let unit = "auto"; // Keep the fake current measurement unit.
	Object.defineProperty(fixture.app.scriptPreferences, "measurementUnit", { enumerable: true, get() { return unit; }, set(value) { if (value === "auto") { throw new Error("unit restore failed"); } unit = value; } }); // Make restoring this one preference fail.
	assert.throws(() => fixture.run(), /Cleanup needs attention: unit restore failed/); // Check that the cleanup issue is reported.
	assert.equal(fixture.app.scriptPreferences.enableRedraw, true); // Check that redraw restoration still runs.
	assert.equal(fixture.app.activeDocument, fixture.sourceDocument); // Check that the original document is restored.
	assert.deepEqual(fixture.app.selection, [fixture.source]); // Check that the original selection is restored.
	assert.equal(fixture.app.documents.length, 1); // Check that the untrusted comparison was closed.
	assert.deepEqual(fixture.snapshot(), before); // Check that the source itself is still unchanged.
}); // End the cleanup failure test.
