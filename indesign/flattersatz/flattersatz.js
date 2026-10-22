// Ask ExtendScript to check the code more strictly.
#strict on
// Run this script inside Adobe InDesign.
#target "InDesign";
#include "core.js"; // Load the shared geometry functions.
#include "host.js"; // Load the code that works with InDesign objects.
#include "ui.js"; // Load the settings dialog and message functions.

(function() { // Keep the script variables inside this function.
	try { // Start work that may report an error.
		if (app.documents.length === 0) { // Check whether an InDesign document is open.
			FlattersatzUI.message("Open a document and select a text frame first."); // Ask the user to open a document and select a frame.
			return; // Leave this function without doing more work.
		} // End this block.
		if (app.selection.length === 0) { // Check whether the user selected any objects.
			FlattersatzUI.message("Select one or more text frames first."); // Ask the user to select one or more text frames.
			return; // Leave this function without doing more work.
		} // End this block.

		var settings = FlattersatzUI.settings(); // Show the dialog and read the chosen settings.
		if (settings === null) { // Stop when the user cancels the dialog.
			return; // Leave this function without doing more work.
		} // End this block.
		var result = FlattersatzHost.run(app, settings); // Apply or remove the effect through the InDesign code.
		if (result && result.message) { // Check whether the operation returned a message.
			FlattersatzUI.message(result.message); // Show the result of the operation.
		} // End this block.
	} catch (e) { // Handle an error from the preceding work.
		FlattersatzUI.message("Flattersatz could not finish.\r" + (e.message || String(e))); // Explain the error if the operation could not finish.
	} // End this block.
})(); // Run this function now.
