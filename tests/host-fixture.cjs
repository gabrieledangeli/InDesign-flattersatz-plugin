// Deliberately small DOM doubles: these test control flow, not Adobe's compositor.
const fs = require("node:fs"); // Load the file reader.
const path = require("node:path"); // Load the path helpers.
const vm = require("node:vm"); // Load the isolated JavaScript runner.

const enums = { // Prepare the fake Adobe named values.
	PathType: { CLOSED_PATH: "closed" }, // Set this value on the fake object or test case.
	CornerOptions: { NONE: "none" }, // Set this value on the fake object or test case.
	Flip: { NONE: "none" }, // Set this value on the fake object or test case.
	AutoSizingTypeEnum: { OFF: "off" }, // Set this value on the fake object or test case.
	VerticalJustification: { TOP_ALIGN: "top" }, // Set this value on the fake object or test case.
	StoryDirectionOptions: { LEFT_TO_RIGHT_DIRECTION: "ltr" }, // Set this value on the fake object or test case.
	StoryHorizontalOrVertical: { HORIZONTAL: "horizontal" }, // Set this value on the fake object or test case.
	Justification: { LEFT_JUSTIFIED: "left-justified", FULLY_JUSTIFIED: "fully-justified" }, // Set this value on the fake object or test case.
	ParagraphDirectionOptions: { LEFT_TO_RIGHT_DIRECTION: "ltr" }, // Set this value on the fake object or test case.
	SpanColumnTypeOptions: { SINGLE_COLUMN: "single" }, // Set this value on the fake object or test case.
	FontStatus: { INSTALLED: "installed" }, // Set this value on the fake object or test case.
	TextWrapModes: { NONE: "no-wrap", BOUNDING_BOX_TEXT_WRAP: "bounding-box" }, // Set this value on the fake object or test case.
	TextWrapSideOptions: { LEFT_SIDE: "left" }, // Set this value on the fake object or test case.
	MeasurementUnits: { POINTS: "points" }, // Set this value on the fake object or test case.
	RulerOrigin: { SPREAD_ORIGIN: "spread" }, // Set this value on the fake object or test case.
	ScriptLanguage: { JAVASCRIPT: "javascript" }, // Set this value on the fake object or test case.
	UndoModes: { ENTIRE_SCRIPT: "entire-script" } // Set this value on the fake object or test case.
}; // End this block.

class Collection { // Define the fake Collection type used by the host checks.
	constructor(source) { this.source = typeof source === "function" ? source : () => source; } // Save the starting data for this fake object.
	get length() { return this.source().length; } // Read the current value when it is needed.
	item(index) { return this.source()[index]; } // Read one item from the fake collection.
	firstItem() { return this.item(0); } // Read the first item in the fake collection.
	lastItem() { return this.item(this.length - 1); } // Read the last item in the fake collection.
	itemByName(name) { return this.source().find(item => item.name === name) || { isValid: false }; } // Find an item by name or return an invalid item.
} // End this block.

class Labelled { // Define the fake Labelled type used by the host checks.
	constructor() { this.labels = {}; this.isValid = true; } // Save the starting data for this fake object.
	extractLabel(key) { return this.labels[key] || ""; } // Read a stored label or an empty value.
	insertLabel(key, value) { this.labels[key] = value; } // Save a label on this fake object.
} // End this block.
class Spread {} // Define the fake Spread type used by the host checks.
class Page {} // Define the fake Page type used by the host checks.
class TextFrame extends Labelled {} // Define the fake TextFrame type used by the host checks.
class Layer extends Labelled {} // Define the fake Layer type used by the host checks.
class Rectangle extends Labelled {} // Define the fake Rectangle type used by the host checks.

function create_fixture(frame_count = 1) { // Make a fake InDesign app for the host checks.
	const fixture = { rectangles: [], layers: [], frames: [], creates: 0, recomposes: 0, scripts: [] }; // Prepare a small fake InDesign document.
	const spread = new Spread(); // Prepare the fake spread.
	const page = new Page(); // Prepare the fake page.
	page.isValid = true; // Set this value for the current check.
	page.parent = spread; // Set this value for the current check.
	page.masterPageItems = []; // Set this value for the current check.
	Object.defineProperty(spread, "allPageItems", { get: () => fixture.frames.concat(fixture.rectangles.filter(item => item.isValid)) }); // Give this fake object a live value or an error hook.
	const doc = { // Prepare the fake document.
		viewPreferences: { horizontalMeasurementUnits: "mm", verticalMeasurementUnits: "inches", rulerOrigin: "page" }, // Set this value on the fake object or test case.
		zeroPoint: [17, 29], // Set this value on the fake object or test case.
		textPreferences: { smartTextReflow: true, zOrderTextWrap: false }, // Set this value on the fake object or test case.
		objectStyles: new Collection([{ name: "[None]" }]), // Set this value on the fake object or test case.
		swatches: new Collection([{ name: "[None]" }]), // Set this value on the fake object or test case.
		recompose() { // Define the fake text layout update.
			fixture.recomposes++; // Complete this test step.
			for (const frame of fixture.frames) { // Update every fake text frame.
				for (let row = 0; row < frame.lineData.length; row++) { // Update each fake line end.
					let end = frame.geometricBounds[3] - 5; // Start at the normal right text edge.
					for (const item of fixture.rectangles) { // Look for a live band that affects this line.
						if (!fixture.ignoreWrap && item.isValid && item.geometricBounds && item.textWrapPreferences.textWrapMode === "bounding-box" && item.extractLabel("org.flattersatz.owner") === String(frame.id) && item.extractLabel("org.flattersatz.row") === String(row)) { // Use only an active band for this frame and row.
							end = Math.min(end, item.geometricBounds[1]); // Move the fake line end before the band.
						} // End this band check.
					} // End this band loop.
					frame.lineData[row].endHorizontalOffset = end; // Save the fake line end for the host check.
				} // End this line loop.
			} // End this frame loop.
			if (fixture.onRecompose) { fixture.onRecompose(fixture.recomposes); } // Handle this case when the condition is true.
		} // End this block.
	}; // End this block.
	Object.defineProperty(doc, "allPageItems", { get: () => spread.allPageItems }); // Give this fake object a live value or an error hook.
	fixture.doc = doc; // Set up this fake document value for the check.
	fixture.add_layer = function(name, owned = false) { // Set up this fake document value for the check.
		const layer = new Layer(); // Prepare the layer for this step.
		Object.assign(layer, { name, locked: false, visible: true, ignoreWrap: false }); // Set the starting values on this fake object.
		Object.defineProperty(layer, "index", { get: () => fixture.layers.filter(item => item.isValid).indexOf(layer) }); // Give this fake object a live value or an error hook.
		Object.defineProperty(layer, "pageItems", { get: () => doc.allPageItems.filter(item => item.itemLayer === layer) }); // Give this fake object a live value or an error hook.
		layer.remove = function() { this.isValid = false; }; // Define how to delete this fake layer.
		if (owned) { layer.insertLabel("org.flattersatz.layer", "2"); } // Handle this case when the condition is true.
		fixture.layers.unshift(layer); // Complete this test step.
		doc.activeLayer = layer; // Set this value for the current check.
		return layer; // Return this result to the caller.
	}; // End this block.
	doc.layers = new Collection(() => fixture.layers.filter(layer => layer.isValid)); // Set this value for the current check.
	doc.layers.add = properties => fixture.add_layer(properties.name); // Set this value for the current check.
	const source_layer = fixture.add_layer("Text"); // Prepare the original text layer.
	fixture.add_rectangle = function(layer = source_layer) { // Set up this fake document value for the check.
		const item = new Rectangle(); // Prepare the shape for this step.
		Object.assign(item, { // Set the starting values on this fake object.
			id: 1000 + fixture.rectangles.length, // Set this value on the fake object or test case.
			itemLayer: layer, // Set this value on the fake object or test case.
			locked: false, // Set this value on the fake object or test case.
			textPaths: [], // Set this value on the fake object or test case.
			textWrapPreferences: { textWrapMode: "no-wrap" }, // Set this value on the fake object or test case.
			transparencySettings: { blendingSettings: { opacity: 100 } } // Set this value on the fake object or test case.
		}); // End this block.
		item.applyObjectStyle = function() { if (fixture.onStyle) { fixture.onStyle(this); } }; // Allow a style failure to be tested.
		item.remove = function() { // Define how to delete this fake shape.
			if (fixture.onRemove) { fixture.onRemove(this); } // Handle this case when the condition is true.
			this.isValid = false; // Save this value on the fake object.
		}; // End this block.
		item.duplicate = function() { // Define how to copy this fake shape.
			if (fixture.onDuplicate) { fixture.onDuplicate(this); } // Handle this case when the condition is true.
			const copy = fixture.add_rectangle(this.itemLayer); // Prepare a copy of the old shape.
			copy.labels = { ...this.labels }; // Keep this old shape value in the recovery copy.
			copy.textWrapPreferences = { ...this.textWrapPreferences }; // Keep this old shape value in the recovery copy.
			copy.backupOf = this; // Keep this old shape value in the recovery copy.
			copy.customProperty = this.customProperty; // Keep this old shape value in the recovery copy.
			return copy; // Return this result to the caller.
		}; // End this block.
		fixture.rectangles.push(item); // Keep this object in the fake document.
		return item; // Return this result to the caller.
	}; // End this block.
	page.rectangles = { // Set this value for the current check.
		add(layer) { // Define how this fake collection adds an item.
			fixture.creates++; // Complete this test step.
			if (fixture.onCreate) { fixture.onCreate(fixture.creates); } // Handle this case when the condition is true.
			return fixture.add_rectangle(layer); // Return this result to the caller.
		} // End this block.
	}; // End this block.
	fixture.add_owned = function(frame = fixture.frames[0], layer = source_layer) { // Set up this fake document value for the check.
		const item = fixture.add_rectangle(layer); // Prepare the shape for this step.
		item.insertLabel("org.flattersatz.owner", String(frame.id)); // Mark the shape with its owner or version.
		item.insertLabel("org.flattersatz.version", "2"); // Mark the shape with its owner or version.
		item.textWrapPreferences.textWrapMode = "bounding-box"; // Set this value for the current check.
		item.customProperty = "preserve-this"; // Set this value for the current check.
		return item; // Return this result to the caller.
	}; // End this block.
	for (let i = 0; i < frame_count; i++) { // Visit each value used by this check.
		const frame = new TextFrame(); // Prepare the fake text frame.
		const left = i * 250; // Prepare the left edge of this frame.
		const paragraph = { // Prepare the fake paragraph.
			justification: "left-justified", paragraphDirection: "ltr", spanColumnType: "single", // Set this value on the fake object or test case.
			dropCapCharacters: 0, leftIndent: 0, rightIndent: 0, firstLineIndent: 0, lastLineIndent: 0, // Set this value on the fake object or test case.
			insertionPoints: new Collection([{ index: 0 }]) // Set this value on the fake object or test case.
		}; // End this block.
		const story = { // Prepare the fake story.
			textContainers: [frame], tables: [], footnotes: [], endnotes: [], allPageItems: [], overflows: false, // Set this value on the fake object or test case.
			storyPreferences: { storyDirection: "ltr", storyOrientation: "horizontal" }, // Set this value on the fake object or test case.
			paragraphs: new Collection([paragraph]), // Set this value on the fake object or test case.
			textStyleRanges: new Collection([{ appliedFont: { status: "installed" } }]) // Set this value on the fake object or test case.
		}; // End this block.
		Object.assign(frame, { // Set the starting values on this fake object.
			id: i + 1, parentPage: page, parent: spread, parentStory: story, itemLayer: source_layer, // Set this value on the fake object or test case.
			locked: false, visible: true, absoluteRotationAngle: 0, absoluteShearAngle: 0, // Set this value on the fake object or test case.
			absoluteHorizontalScale: 100, absoluteVerticalScale: 100, absoluteFlip: "none", // Set this value on the fake object or test case.
			topLeftCornerOption: "none", topRightCornerOption: "none", bottomLeftCornerOption: "none", bottomRightCornerOption: "none", // Set this value on the fake object or test case.
			geometricBounds: [0, left, 120, left + 200], // Set this value on the fake object or test case.
			textPaths: [], // Start without extra text on the frame path.
			textFramePreferences: { textColumnCount: 1, autoSizingType: "off", verticalJustification: "top", ignoreWrap: false, insetSpacing: [5, 5, 5, 5] }, // Set this value on the fake object or test case.
			paths: new Collection([{ // Set this value on the fake object or test case.
				pathType: "closed", pathPoints: new Collection([[left, 0], [left + 200, 0], [left + 200, 120], [left, 120]].map(anchor => ({ anchor, leftDirection: anchor.slice(), rightDirection: anchor.slice() }))) // Set this value on the fake object or test case.
			}]) // End this block.
		}); // End this block.
		frame.lineData = Array.from({ length: 4 }, (_, row) => ({ // Set this value for the current check.
			baseline: 20 + row * 20, endBaseline: 20 + row * 20, ascent: 9, descent: 3, // Set this value on the fake object or test case.
			paragraphs: new Collection([paragraph]), // Set this value on the fake object or test case.
			insertionPoints: new Collection([{ index: row * 30 }, { index: row * 30 + 29 }]) // Set this value on the fake object or test case.
		})); // End this block.
		frame.lines = new Collection(() => frame.lineData); // Set this value for the current check.
		fixture.frames.push(frame); // Keep this object in the fake document.
	} // End this block.
	fixture.app = { // Set up this fake document value for the check.
		documents: [doc], activeDocument: doc, selection: fixture.frames.slice(), // Set this value on the fake object or test case.
		scriptPreferences: { enableRedraw: true, measurementUnit: "auto" }, // Set this value on the fake object or test case.
		doScript(callback, ...args) { fixture.scripts.push(args); callback(); } // Record the undo call and run the script.
	}; // End this block.
	fixture.live_rectangles = () => fixture.rectangles.filter(item => item.isValid); // Set up this fake document value for the check.
	fixture.preferences = () => ({ // Set up this fake document value for the check.
		...fixture.app.scriptPreferences, // Copy these values into the saved settings.
		...doc.viewPreferences, // Copy these values into the saved settings.
		...doc.textPreferences, // Copy these values into the saved settings.
		zeroPoint: Array.from(doc.zeroPoint), // Set this value on the fake object or test case.
		activeLayer: doc.activeLayer // Set this value on the fake object or test case.
	}); // End this block.
	const context = vm.createContext({ ...enums }); // Prepare a separate JavaScript space.
	for (const file of ["core.js", "host.js"]) { // Visit each value used by this check.
		vm.runInContext(fs.readFileSync(path.join(__dirname, "../indesign/flattersatz", file), "utf8"), context, { filename: file }); // Run the script inside the separate test space.
	} // End this block.
	fixture.run = options => context.FlattersatzHost.run(fixture.app, { action: "apply", zone: 15, randomness: 0, ...options }); // Set up this fake document value for the check.
	return fixture; // Return this result to the caller.
} // End this block.

module.exports = { create_fixture }; // Share this helper with the host tests.
