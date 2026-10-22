// Keep these helpers for older scripts that still use them.
function log(msg) { // Write a message for the script developer.
	$.writeln(msg); // Send the message to the script console.
} // Finish writing the message.
function warn(msg) { // Write a warning message.
	log("WARNING: " + msg); // Add a warning label to the message.
} // Finish writing the warning.
function error(msg) { // Write an error message.
	log("ERROR: " + msg); // Add an error label to the message.
} // Finish writing the error.

function redraw_on(previous) { // Restore screen updates or turn them on.
	app.scriptPreferences.enableRedraw = typeof previous === "boolean" ? previous : true; // Use the saved setting when one was provided.
} // Finish restoring screen updates.
function redraw_off() { // Pause screen updates while a script works.
	var previous = app.scriptPreferences.enableRedraw; // Save the current screen update setting.
	app.scriptPreferences.enableRedraw = false; // Stop updating the screen for now.
	return previous; // Give back the setting that should be restored later.
} // Finish pausing screen updates.

// Keep the returned settings and pass them to the restore function later.
function store_measurement_units(doc) { // Save the ruler units and switch to points.
	var state = { // Start a small record of the current units.
		x: doc.viewPreferences.horizontalMeasurementUnits, // Save the horizontal ruler unit.
		y: doc.viewPreferences.verticalMeasurementUnits // Save the vertical ruler unit.
	}; // Finish the saved unit record.
	try { // Try changing both ruler units.
		doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.POINTS; // Use points along the horizontal ruler.
		doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.POINTS; // Use points along the vertical ruler.
	} catch (problem) { // Handle a failure while changing the units.
		restore_measurement_units(doc, state); // Restore the original ruler units.
		throw problem; // Report the original failure to the caller.
	} // Finish changing the ruler units.
	return state; // Give back the original units for later restoration.
} // Finish saving and changing the units.

function restore_measurement_units(doc, state) { // Restore the ruler units saved earlier.
	if (!state) { // Make sure the caller supplied the saved units.
		throw new Error("Pass the saved measurement-unit state to restore_measurement_units."); // Explain which argument is missing.
	} // Finish checking the saved units.
	try { // Try restoring the horizontal ruler first.
		doc.viewPreferences.horizontalMeasurementUnits = state.x; // Put back the original horizontal unit.
	} finally { // Restore the vertical unit even if the first change failed.
		doc.viewPreferences.verticalMeasurementUnits = state.y; // Put back the original vertical unit.
	} // Finish restoring both ruler units.
} // Finish the unit restore function.

function create_layer(doc, name) { // Find a named layer or create it.
	var layer = doc.layers.itemByName(name); // Look for the requested layer name.
	return layer.isValid ? layer : doc.layers.add({name: name}); // Reuse an existing layer or add a new one.
} // Finish finding or creating the layer.

function current_page_number() { // Read the page label in the active layout window.
	if (!app.documents.length || !app.layoutWindows.length || app.activeWindow.constructor.name !== "LayoutWindow") { // Require the active window to show a document layout.
		throw new Error("Open a document layout window first."); // Explain why a page cannot be read.
	} // Finish checking for a layout window.
	return app.activeWindow.activePage.name; // Return the current page label.
} // Finish reading the page label.

function get_filename(path) { // Find the file name at the end of a path.
	var parts = String(path).split(/[\\/]/); // Split paths that use either slash style.
	return parts[parts.length - 1]; // Return the final part of the path.
} // Finish reading the file name.

function remove_file_extension(filename) { // Remove the final file extension.
	var name = String(filename); // Read the file name as text.
	var dot = name.lastIndexOf("."); // Find the last dot in the name.
	return dot > 0 && dot < name.length - 1 ? name.slice(0, dot) : name; // Keep hidden names and trailing dots unchanged.
} // Finish removing the extension.

function get_path_delimiter() { // Choose the slash used by the current operating system.
	return $.os.match(/Windows/i) ? "\\" : "/"; // Use a backslash on Windows and a slash elsewhere.
} // Finish choosing the path separator.
