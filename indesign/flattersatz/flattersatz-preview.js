// Ask ExtendScript to check this script carefully.
#strict on
// Run the preview in InDesign.
#target "InDesign";
#include "core.js"; // Load the historical geometry tools for comparison.
#include "host.js"; // Load the shared frame checks and historical effect.
#include "rag-core.js"; // Load the word-break planner.
#include "preview.js"; // Load the separate-document preview tools.
#include "preview-ui.js"; // Load the small trial dialog.

(function() { // Keep entry variables private.
	try { // Report a useful message if the trial cannot finish.
		if (!app.documents.length || app.selection.length !== 1 || app.selection[0].constructor.name !== "TextFrame") { // Require one full text frame before opening the dialog.
			alert("Open a document and select one text frame with the Selection tool.", "Flattersatz preview"); // Explain the required selection.
			return; // Leave the document untouched.
		} // End this check.
		var settings = FlattersatzPreviewUI.settings(); // Read the trial setting.
		if (settings === null) { return; } // Stop when the user cancels.
		var result = FlattersatzPreview.run(app, settings); // Create and verify the separate comparison document.
		alert("Preview ready: " + result.paragraphs + " paragraph(s), " + result.lines + " planned lines.\r" + // Report the completed work.
			"Compare pages 1 to 4. Close this new document to discard the trial.\r" + // Explain how to review and remove the preview.
			"The original document was not changed." + (result.legacy_message ? "\rHistorical comparison unavailable:\r" + result.legacy_message : ""), "Flattersatz preview"); // Include any limit of the historical comparison.
	} catch (error) { // Handle a failed trial after its cleanup.
		alert("The preview could not finish.\r" + (error.message || String(error)), "Flattersatz preview"); // Show the reason in simple words.
	} // End error handling.
})(); // Start the preview command.
