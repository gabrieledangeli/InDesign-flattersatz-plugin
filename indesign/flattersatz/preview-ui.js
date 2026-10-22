var FlattersatzPreviewUI = (function() { // Keep the trial dialog separate from the historical controls.
	function settings() { // Ask for the amount of variation in the trial.
		var result = null, dialog = new Window("dialog", "Flattersatz text-only preview"); // Start with no accepted action.
		dialog.orientation = "column"; // Place the controls from top to bottom.
		dialog.alignChildren = "fill"; // Give all rows the same width.
		dialog.add("statictext", undefined, "Create a separate comparison document from one text frame."); // Explain where the trial will appear.
		dialog.add("statictext", undefined, "The source stays unchanged. Close the preview to discard it."); // Explain how to undo the whole trial.
		dialog.add("statictext", undefined, "Experimental. Whole words only. No automatic updates."); // State the limits before the trial begins.
		var row = dialog.add("group"); // Add a row for the single setting.
		row.add("statictext", undefined, "Ragged zone (%):"); // Name the setting in simple words.
		var zone = row.add("edittext", undefined, "15"); // Show the default amount of variation.
		zone.characters = 6; // Leave enough room to enter a percentage.
		var buttons = dialog.add("group"); // Keep the action buttons together.
		buttons.alignment = "right"; // Place the buttons at the right side.
		var cancel = buttons.add("button", undefined, "Cancel", {name: "cancel"}); // Allow the trial to be cancelled.
		var create = buttons.add("button", undefined, "Create preview", {name: "ok"}); // Add the command that creates the copies.
		dialog.defaultElement = create; // Let Enter start the preview.
		dialog.cancelElement = cancel; // Let Escape cancel the dialog.
		create.onClick = function() { // Check the setting when the user starts the trial.
			var value = Number(zone.text); // Read the entered percentage as a number.
			if (!/^\s*(?:\d+(?:\.\d*)?|\.\d+)\s*$/.test(zone.text) || !isFinite(value) || value < 0 || value > 100) { // Reject missing or invalid percentages.
				alert("Enter a number from 0 to 100.", "Flattersatz preview"); // Explain the allowed range.
				return; // Keep the dialog open for correction.
			} // End this check.
			result = {zone: value}; // Save the accepted setting.
			dialog.close(1); // Close the dialog and start the trial.
		}; // End this click handler.
		cancel.onClick = function() { dialog.close(0); }; // Close without creating a preview.
		dialog.show(); // Wait for the user to choose an action.
		return result; // Return the chosen setting or no action.
	} // End this function.
	return {settings: settings}; // Share the trial dialog with the entry script.
})(); // Create the dialog tools.
