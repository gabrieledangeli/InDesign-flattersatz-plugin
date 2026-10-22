const fs = require("node:fs"); // Load the file reader.
const path = require("node:path"); // Load the path helpers.
const vm = require("node:vm"); // Load the separate JavaScript runner.

class Collection { // Give fake lists the small part of the Adobe API used here.
	constructor(read) { this.read = typeof read === "function" ? read : () => read; } // Save the list or its reader.
	get length() { return this.read().length; } // Read the current list length.
	item(index) { const items = this.read(); return items[index < 0 ? items.length + index : index]; } // Read one item by index.
	firstItem() { return this.item(0); } // Read the first item.
	lastItem() { return this.item(-1); } // Read the last item.
	everyItem() { return { getElements: () => this.read().slice() }; } // Return a fixed copy of the list.
	getElements() { return this.read().slice(); } // Return the current list items.
} // End the list type.

function records(text) { // Make styled character records for fake text.
	return Array.from(text, (contents, index) => ({ contents, noBreak: false, width: contents === " " ? 3 : 6, pointSize: 12, leading: 16, fontStyle: "Regular", appliedFont: { name: "Source font" }, appliedCharacterStyle: { name: "Source character style" }, tracking: 0, baselineShift: 0, horizontalScale: 100, verticalScale: 100, kerningMethod: "Metrics", ligatures: true, index })); // Give every character text, width, and style data.
} // End the character record helper.

function clone_records(items) { // Copy character data without changing style references.
	return items.map(item => ({ ...item })); // Return a new record for each character.
} // End the copy helper.

class Character { // Represent one character in the fake story.
	constructor(frame, index) { this.frame = frame; this.index = index; } // Keep the frame and story index.
} // End the character type.

for (const name of ["contents", "noBreak", "pointSize", "leading", "fontStyle", "appliedFont", "appliedCharacterStyle", "tracking", "baselineShift", "horizontalScale", "verticalScale", "kerningMethod", "ligatures", "width"]) { // Add the character properties used by the preview.
	Object.defineProperty(Character.prototype, name, { get() { return this.frame.data[this.index][name]; }, set(value) { this.frame.data[this.index][name] = value; } }); // Read and write the stored character value.
} // End the property list.

class TextRange { // Represent one whole text range instead of many separate characters.
	constructor(frame, start, end) { this.frame = frame; this.start = start; this.end = end; } // Keep the range with an exclusive end index.
	get contents() { return this.frame.data.slice(this.start, this.end).map(item => item.contents).join(""); } // Read the text in the range.
	get characters() { return new Collection(() => this.frame.data.slice(this.start, this.end).map((item, index) => new Character(this.frame, this.start + index))); } // Read the characters in the range.
	get insertionPoints() { return new Collection(Array.from({ length: this.end - this.start + 1 }, (_, index) => ({ frame: this.frame, index: this.start + index, horizontalOffset: this.frame.offset(this.start + index) }))); } // Return positions with the fake composed text offsets.
	set noBreak(value) { for (let index = this.start; index < this.end; index++) { this.frame.data[index].noBreak = value; } } // Set the flag across the whole range.
	duplicate(where, target) { // Copy the range to the start of a measurement frame.
		const fixture = this.frame.fixture; // Read the fake document controls.
		fixture.rangeCopies++; // Count whole-range copies.
		if (fixture.onRangeCopy) { fixture.onRangeCopy(this, target); } // Allow a copy failure to be tested.
		const copied = clone_records(this.frame.data.slice(this.start, this.end)); // Copy text and all stored character styles.
		target.frame.data.splice(target.index, 0, ...copied); // Insert characters in their original order.
		return new TextRange(target.frame, target.index, target.index + copied.length); // Return the copied text range.
	} // End the copy method.
} // End the text range type.

class Paragraph { // Represent one paragraph inside a fake frame.
	constructor(frame, start, end, number) { this.frame = frame; this.start = start; this.end = end; this.number = number; } // Keep the paragraph's place in the story.
	get contents() { return new TextRange(this.frame, this.start, this.end).contents; } // Read this paragraph's text.
	get characters() { return new TextRange(this.frame, this.start, this.end).characters; } // Read this paragraph's characters.
	get texts() { return { itemByRange: (first, last) => new TextRange(this.frame, first.index, last.index + 1), item: () => new TextRange(this.frame, this.start, this.end), firstItem: () => new TextRange(this.frame, this.start, this.end) }; } // Return one continuous text range.
	get insertionPoints() { return new Collection(Array.from({ length: this.end - this.start + 1 }, (_, index) => ({ frame: this.frame, index: this.start + index }))); } // Read insertion positions around this paragraph.
	get lines() { return new Collection(() => this.frame.composed().filter(line => line.start >= this.start && line.start < this.end)); } // Read only the lines from this paragraph.
	get noBreak() { return this.characters.getElements().every(character => character.noBreak); } // Read whether the whole paragraph cannot break.
	set noBreak(value) { new TextRange(this.frame, this.start, this.end).noBreak = value; } // Change the flag on the paragraph text.
} // End the paragraph type.

for (const name of ["justification", "hyphenation", "leftIndent", "rightIndent", "firstLineIndent", "lastLineIndent", "spaceBefore", "spaceAfter", "alignToBaseline", "gridAlignment", "bulletsAndNumberingListType", "composer", "appliedParagraphStyle", "nestedStyles", "nestedGrepStyles", "nestedLineStyles", "keepAllLinesTogether", "keepWithNext", "keepFirstLines", "keepLastLines", "startParagraph", "balanceRaggedLines", "minimumWordSpacing", "maximumWordSpacing", "desiredWordSpacing", "minimumLetterSpacing", "maximumLetterSpacing", "desiredLetterSpacing", "minimumGlyphScaling", "maximumGlyphScaling", "desiredGlyphScaling"]) { // Add the paragraph settings that may be checked or copied.
	Object.defineProperty(Paragraph.prototype, name, { get() { return this.frame.paragraphSettings[this.number][name]; }, set(value) { this.frame.paragraphSettings[this.number][name] = value; } }); // Read and write this paragraph's saved settings.
} // End the paragraph property list.

function paragraph_settings() { // Make plain source paragraph settings.
	return { justification: "left-justified", hyphenation: true, leftIndent: 0, rightIndent: 0, firstLineIndent: 0, lastLineIndent: 0, spaceBefore: 0, spaceAfter: 0, alignToBaseline: false, gridAlignment: "none", bulletsAndNumberingListType: "none", composer: "Source composer", appliedParagraphStyle: { name: "Source paragraph style" }, nestedStyles: [], nestedGrepStyles: [], nestedLineStyles: [], keepAllLinesTogether: false, keepWithNext: 0, keepFirstLines: 1, keepLastLines: 1, startParagraph: "anywhere" }; // Return settings without special layout rules.
} // End the paragraph defaults.

class TextFrame { // Provide a small text frame with a predictable fake line layout.
	constructor(page, data, fixture) { // Make one fake frame on a page.
		this.fixture = fixture; // Keep the failure hooks for these tests.
		this.parentPage = page; // Keep the owning page.
		this.data = clone_records(data); // Keep a separate copy of text and style data.
		this.labels = {}; // Start without preview labels.
		this.isValid = true; // Mark this frame as present.
		this.id = ++fixture.nextId; // Give the frame a stable ID.
		this.geometricBounds = [0, 0, 400, 180]; // Use enough height for normal test paragraphs.
		this.textFramePreferences = { insetSpacing: [0, 0, 0, 0], ignoreWrap: false, textColumnCount: 1 }; // Start with one plain column.
		this.textWrapPreferences = { textWrapMode: "no-wrap" }; // Keep the frame's own wrap setting separate from its text settings.
		this.paragraphSettings = Array.from({ length: this.paragraphSpans().length }, paragraph_settings); // Give each paragraph its own settings.
		const frame = this; // Keep this frame for the story methods.
		this.parentStory = { textVariableInstances: [], notes: [], get contents() { return frame.contents; }, set contents(value) { frame.contents = value; }, get paragraphs() { return frame.paragraphs; }, get characters() { return frame.characters; }, get texts() { return frame.texts; }, get lines() { return frame.lines; }, get overflows() { return frame.overflows; }, recompose() { frame.parentPage.parent.recompose(); } }; // Link the fake story to this independent frame.
		page.frames.push(this); // Add the frame to its page.
	} // End the frame constructor.
	get contents() { return this.data.map(item => item.contents).join(""); } // Read the story text.
	set contents(text) { this.data = records(String(text)); this.paragraphSettings = Array.from({ length: this.paragraphSpans().length }, paragraph_settings); } // Replace the fake story contents.
	get characters() { return new Collection(() => this.data.map((item, index) => new Character(this, index))); } // Read all characters in the story.
	get insertionPoints() { return new Collection(Array.from({ length: this.data.length + 1 }, (_, index) => ({ frame: this, index }))); } // Read positions before and after characters.
	get texts() { return new Collection([new TextRange(this, 0, this.data.length)]); } // Read the whole story as one text range.
	paragraphSpans() { // Find each paragraph, including blank paragraphs.
		const spans = []; // Collect paragraph boundaries.
		let start = 0; // Start at the first character.
		for (let index = 0; index < this.data.length; index++) { // Read each character once.
			if (this.data[index].contents === "\r") { spans.push([start, index + 1]); start = index + 1; } // Finish this paragraph at its return.
		} // End the character scan.
		if (start < this.data.length || !spans.length) { spans.push([start, this.data.length]); } // Keep the last paragraph when it has no return.
		return spans; // Return the paragraph ranges.
	} // End the paragraph scan.
	get paragraphs() { return new Collection(this.paragraphSpans().map(([start, end], number) => new Paragraph(this, start, end, number))); } // Read current paragraph objects.
	get lines() { return new Collection(() => this.composed()); } // Read the current fake lines.
	get overflows() { return this.composed().some(line => line.tooWide) || this.composed().length * 16 > this.geometricBounds[2] - this.geometricBounds[0] || this.forceOverflow; } // Report text that cannot fit in the frame.
	composed() { // Simulate line breaks for tests without pretending to shape fonts.
		const lines = []; // Collect the fake composed lines.
		const inset = typeof this.textFramePreferences.insetSpacing === "number" ? this.textFramePreferences.insetSpacing : this.textFramePreferences.insetSpacing[1]; // Read the fake horizontal inset.
		const left = this.geometricBounds[1] + inset; // Find the start of the text column.
		const width = this.geometricBounds[3] - this.geometricBounds[1] - 2 * inset; // Find the available text width.
		for (const [start, paragraphEnd] of this.paragraphSpans()) { // Compose each paragraph separately.
			const end = paragraphEnd > start && this.data[paragraphEnd - 1].contents === "\r" ? paragraphEnd - 1 : paragraphEnd; // Leave the paragraph return out of width checks.
			let cursor = start; // Start with the first character of this paragraph.
			if (cursor === end) { lines.push(this.makeLine(start, paragraphEnd, left, 0, false)); continue; } // Keep a blank paragraph as a blank line.
			while (cursor < end) { // Add lines until the paragraph is complete.
				let lastBreak = cursor; // Remember the last allowed space break.
				let measured = 0; // Start with an empty line width.
				let index = cursor; // Start measuring at the current line.
				for (; index < end; index++) { // Read each character until the line is full.
					const character = this.data[index]; // Read its width and break flag.
					if (character.contents === " " && !character.noBreak) { lastBreak = index + 1; } // Allow a line break after an ordinary free space.
					measured += character.width; // Add the fake native glyph width.
					if (measured > width && lastBreak > cursor) { break; } // Stop once a legal break can fit the previous words.
				} // End this line measurement.
				const next = index < end ? lastBreak : end; // Pick the legal break or the paragraph end.
				const visibleEnd = this.data[next - 1] && this.data[next - 1].contents === " " ? next - 1 : next; // Leave the break space out of the visible line width.
				const actual = this.data.slice(cursor, visibleEnd).reduce((sum, item) => sum + item.width, 0); // Add the exact fake widths on this line.
				lines.push(this.makeLine(cursor, next === end ? paragraphEnd : next, left, actual, actual > width)); // Keep the fake line and its overflow state.
				cursor = next; // Start the next line after this break.
			} // End this paragraph layout.
		} // End the paragraph loop.
		if (this.fixture.onCompose) { this.fixture.onCompose(this, lines); } // Let a test simulate a bad native result.
		return lines; // Return the current fake lines.
	} // End the fake text layout.
	makeLine(start, end, left, width, tooWide) { // Build one fake line with native-style text offsets.
		return { start, end, contents: this.data.slice(start, end).map(item => item.contents).join(""), baseline: 100, endBaseline: 100, horizontalOffset: left, endHorizontalOffset: left + width, tooWide, characters: new Collection(this.data.slice(start, end).map((item, index) => new Character(this, start + index))), insertionPoints: new Collection([{ frame: this, index: start }, { frame: this, index: end }]) }; // Return text positions and the fake measured width.
	} // End the fake line builder.
	offset(index) { // Read one insertion point in the final fake layout.
		const lines = this.composed(); // Read the current lines.
		const line = lines.find(item => item.start === index) || lines.find(item => index >= item.start && index <= item.end); // Choose the line that owns this insertion point.
		const value = line ? line.horizontalOffset + this.data.slice(line.start, index).reduce((sum, item) => sum + item.width, 0) : this.geometricBounds[1]; // Add the widths before this position.
		return this.fixture.onOffset ? this.fixture.onOffset(this, index, value) : value; // Allow changed final widths to be tested.
	} // End the insertion point reader.
	duplicate(page) { // Copy a source frame to another page.
		if (this.fixture.onDuplicate) { this.fixture.onDuplicate(this, page); } // Allow a duplicate error to be tested.
		const copy = new TextFrame(page, this.data, this.fixture); // Copy the characters into a separate frame.
		copy.geometricBounds = this.geometricBounds.slice(); // Keep the source size and location.
		copy.textFramePreferences = { ...this.textFramePreferences }; // Keep the source frame settings.
		copy.paragraphSettings = this.paragraphSettings.map(settings => ({ ...settings })); // Copy paragraph settings without changing source styles.
		if (this.fixture.onCopied) { this.fixture.onCopied(copy, this); } // Allow a changed cross-document copy to be tested.
		return copy; // Return the new frame.
	} // End the frame copy.
	move(point) { const bounds = this.geometricBounds; this.geometricBounds = [point[1], point[0], point[1] + bounds[2] - bounds[0], point[0] + bounds[3] - bounds[1]]; } // Move the frame while keeping its size.
	insertLabel(key, value) { this.labels[key] = value; } // Save a preview role on this frame.
	extractLabel(key) { return this.labels[key] || ""; } // Read a saved preview role.
	remove() { this.isValid = false; } // Remove this temporary frame from the fake document.
} // End the fake text frame type.

class Page { // Provide the page actions used by the preview builder.
	constructor(doc, fixture) { // Make a blank page in this fake document.
		this.parent = doc; // Keep its owning document.
		this.fixture = fixture; // Keep the failure hooks.
		this.frames = []; // Start without any text frames.
		this.isValid = true; // Mark the page as present.
		this.textFrames = new Collection(() => this.frames.filter(frame => frame.isValid)); // Return only frames still on the page.
		this.textFrames.add = properties => { // Create a caption or other plain frame.
			const frame = new TextFrame(this, records(properties && properties.contents || ""), fixture); // Build the new frame.
			Object.assign(frame, properties || {}); // Apply the requested bounds and contents.
			return frame; // Return the new frame.
		}; // End frame creation.
	} // End the page constructor.
	remove() { this.isValid = false; for (const frame of this.frames) { frame.isValid = false; } } // Remove the page and all temporary frames on it.
} // End the page type.

class Document { // Provide the small document API needed for comparison pages.
	constructor(fixture, name) { // Make one fake document.
		this.fixture = fixture; // Keep the shared test state.
		this.name = name; // Give this document a readable name.
		this.labels = {}; // Start with no document labels.
		this.isValid = true; // Mark the document as open.
		this.pageList = []; // Start with a page list.
		this.documentPreferences = { facingPages: true, pagesPerDocument: 1, pageWidth: 595, pageHeight: 842 }; // Keep page settings separate from source settings.
		this.viewPreferences = { horizontalMeasurementUnits: "mm", verticalMeasurementUnits: "mm", rulerOrigin: "spread" }; // Start with nonpoint units so restoration can be checked.
		this.zeroPoint = [7, 11]; // Keep a visible starting ruler offset.
		this.textPreferences = { smartTextReflow: true }; // Start with automatic page reflow enabled.
		this.pages = new Collection(() => this.pageList.filter(page => page.isValid)); // Read only live pages.
		this.pages.add = () => { // Add one comparison or scratch page.
			if (fixture.onPageAdd) { fixture.onPageAdd(this); } // Allow page creation failures to be tested.
			const page = new Page(this, fixture); // Make the new blank page.
			this.pageList.push(page); // Keep the page in the document.
			return page; // Return the new page.
		}; // End page creation.
		this.pages.add(); // Give a new document its first page.
		this.window = { parent: this, activePage: this.pages.item(0), isValid: true, activate() { fixture.app.activeWindow = this; } }; // Provide a fake layout window that can be restored.
		this.layoutWindows = new Collection([this.window]); // Expose the document's layout window.
	} // End the document constructor.
	get textFrames() { return new Collection(() => this.pageList.flatMap(page => page.frames).filter(frame => frame.isValid)); } // Read live text frames on every page.
	get allPageItems() { return this.textFrames.getElements(); } // Read all fake page objects.
	recompose() { this.fixture.recomposes++; if (this.fixture.onRecompose) { this.fixture.onRecompose(this); } } // Count layout calls and run the chosen test hook.
	close(save) { this.closeOption = save; this.isValid = false; this.window.isValid = false; for (const page of this.pageList) { page.remove(); } } // Close the preview without saving any document.
	activate() { this.fixture.app.activeWindow = this.window; } // Show this fake document.
	insertLabel(key, value) { this.labels[key] = value; } // Mark the comparison document for later inspection.
} // End the document type.

function create_preview_fixture(text = "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu") { // Make one source frame and an isolated preview runtime.
	const fixture = { nextId: 0, rangeCopies: 0, recomposes: 0, documents: [], hostCalls: [], validations: [] }; // Keep counters and optional failure hooks.
	let active_window; // Keep the current layout window.
	const app = { selection: [], scriptPreferences: { measurementUnit: "auto", enableRedraw: true }, select(value) { this.selection = Array.isArray(value) ? value : [value]; }, doScript(callback) { return callback(); } }; // Provide the app state changed by preview creation.
	Object.defineProperty(app, "activeWindow", { get() { return active_window; }, set(value) { active_window = value; } }); // Allow the old source window to be restored.
	Object.defineProperty(app, "activeDocument", { get() { return active_window.parent; } }); // Read the document shown in the active window.
	fixture.app = app; // Share the app with fake documents and tests.
	app.documents = new Collection(() => fixture.documents.filter(doc => doc.isValid)); // Read the documents still open.
	app.documents.add = () => { // Create the comparison document.
		if (fixture.onDocumentAdd) { fixture.onDocumentAdd(); } // Allow document creation to fail before it changes the app.
		const doc = new Document(fixture, "Comparison"); // Make the new result document.
		fixture.documents.push(doc); // Keep the result for cleanup checks.
		app.activeWindow = doc.window; // Simulate InDesign showing its new document.
		return doc; // Return the created document.
	}; // End comparison document creation.
	const source_document = new Document(fixture, "Original.indd"); // Make the original user document.
	fixture.documents.push(source_document); // Keep the source as the first open document.
	app.activeWindow = source_document.window; // Start with the source visible.
	const source = new TextFrame(source_document.pages.item(0), records(text), fixture); // Add the source frame with styled text.
	app.selection = [source]; // Select the source frame for previewing.
	fixture.source = source; // Expose the source for preservation assertions.
	fixture.sourceDocument = source_document; // Expose the source document for cleanup assertions.
	const context = vm.createContext({ // Make a separate runtime for the preview code.
		Justification: { LEFT_ALIGN: "left", LEFT_JUSTIFIED: "left-justified", FULLY_JUSTIFIED: "fully-justified" }, // Provide normal and justified alignment names.
		MeasurementUnits: { POINTS: "points" }, // Provide the measurement unit used in geometry.
		RulerOrigin: { PAGE_ORIGIN: "page", SPREAD_ORIGIN: "spread" }, // Provide the ruler origin names.
		LocationOptions: { AT_BEGINNING: "beginning", AT_END: "end" }, // Provide text and page insertion names.
		SaveOptions: { NO: "no" }, // Provide the close-without-saving option.
		ListType: { NO_LIST: "none" }, // Provide the plain paragraph list option.
		GridAlignment: { NONE: "none" }, // Provide the no-grid option.
		ParagraphJustification: { LEFT_ALIGN: "left" }, // Keep the plain paragraph alignment option available.
		ScriptLanguage: { JAVASCRIPT: "javascript" }, // Provide the script language name.
		UndoModes: { ENTIRE_SCRIPT: "entire" }, // Provide the undo scope name.
		TextWrapModes: { NONE: "no-wrap" }, // Provide the setting that keeps captions from pushing sample text away.
		AutoSizingTypeEnum: { OFF: "off" }, // Provide the fixed caption size setting.
		VerticalJustification: { TOP_ALIGN: "top" }, // Provide the normal caption alignment setting.
		FlattersatzHost: { // Stub only the historical host because it has separate tests.
			validate_frame(frame, allow_left) { fixture.validations.push({ frame, allow_left }); if (fixture.onValidate) { fixture.onValidate(frame, allow_left); } }, // Record source validation and allow rejection tests.
			run(passed_app, options) { fixture.hostCalls.push({ app: passed_app, options }); if (fixture.onHistorical) { return fixture.onHistorical(passed_app, options); } return { message: "Historical copy ready" }; } // Simulate the optional historical comparison.
		} // End the isolated historical host.
	}); // End the runtime setup.
	for (const file of ["rag-core.js", "preview.js"]) { // Load the real planner and preview control flow.
		vm.runInContext(fs.readFileSync(path.join(__dirname, "../indesign/flattersatz", file), "utf8"), context, { filename: file }); // Run each source file in the fake Adobe environment.
	} // End source loading.
	fixture.run = options => context.FlattersatzPreview.run(app, { zone: 15, ...options }); // Run the preview with a normal zone unless a test changes it.
	fixture.snapshot = () => ({ text: source.contents, records: clone_records(source.data), paragraphSettings: source.paragraphSettings.map(settings => ({ ...settings })), bounds: source.geometricBounds.slice(), framePreferences: { ...source.textFramePreferences }, documentPreferences: { ...source_document.documentPreferences }, viewPreferences: { ...source_document.viewPreferences }, zeroPoint: source_document.zeroPoint.slice(), textPreferences: { ...source_document.textPreferences } }); // Save all source values that must stay unchanged.
	return fixture; // Return the app and test controls.
} // End the complete fixture helper.

module.exports = { create_preview_fixture }; // Share the preview fixture with its tests.
