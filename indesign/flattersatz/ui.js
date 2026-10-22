// ScriptUI is provided by InDesign's ExtendScript runtime.
var FlattersatzUI = (function() { // Keep the dialog functions together in one object.
	function message(text) { // Define a function that shows a message.
		alert(String(text), "Flattersatz"); // Show the message with the Flattersatz title.
	} // End this block.

	function percent_value(text) { // Read a percentage from text.
		if (!/^\s*(?:\d+(?:\.\d*)?|\.\d+)\s*$/.test(text)) { // Reject text that is not a plain positive number.
			return null; // Return no value when the input is invalid.
		} // End this block.
		var value = Number(text); // Change the input text into a number.
		return isFinite(value) && value >= 0 && value <= 100 ? value : null; // Accept only a real number from zero to one hundred.
	} // End this block.

	function percent_control(parent, label, initial_value) { // Create a label, slider and number field for one percentage.
		var row = parent.add("group"); // Create a group for these controls.
		row.orientation = "row"; // Place the controls beside each other.
		var caption = row.add("statictext", undefined, label); // Add the name of this percentage.
		caption.preferredSize.width = 100; // Give every label the same width.
		var slider = row.add("slider", undefined, initial_value, 0, 100); // Create a slider with values from zero to one hundred.
		slider.preferredSize.width = 180; // Give the slider enough room to drag.
		var field = row.add("edittext", undefined, String(initial_value)); // Add a text field that shows the starting value.
		field.characters = 5; // Leave room for five characters in the number field.
		row.add("statictext", undefined, "%"); // Show a percent sign beside the field.
		slider.onChanging = function() { // Update the number while the user drags the slider.
			field.text = String(Math.round(slider.value)); // Show the slider value as a whole number.
		}; // End this function or group of settings.
		slider.onChange = slider.onChanging; // Also update the number when dragging ends.
		field.onChange = function() { // Update the slider after the user edits the number.
			var value = percent_value(field.text); // Check the number typed in the field.
			if (value !== null) { // Update the slider only when the number is valid.
				slider.value = value; // Move the slider to match the typed number.
			} // End this block.
		}; // End this function or group of settings.
		return field; // Return the field so the dialog can read its value.
	} // End this block.

	function settings() { // Create and show the settings dialog.
		var result = null; // Start with no action selected.
		var dialog = new Window("dialog", "Flattersatz"); // Create a dialog named Flattersatz.
		dialog.orientation = "column"; // Place the dialog groups from top to bottom.
		dialog.alignChildren = "fill"; // Let each group fill the available width.
		dialog.add("statictext", undefined, "Apply or remove the effect on the selected text frames."); // Explain what the dialog will do.
		var zone = percent_control(dialog, "Ragged zone:", 15); // Add the ragged-zone control with a starting value of fifteen percent.
		var randomness = percent_control(dialog, "Randomness:", 0); // Add the randomness control with a starting value of zero.
		var buttons = dialog.add("group"); // Create a group for the action buttons.
		buttons.alignment = "right"; // Place the buttons at the right side.
		var remove_button = buttons.add("button", undefined, "Remove effect"); // Add a button that removes the effect.
		var cancel_button = buttons.add("button", undefined, "Cancel", {name: "cancel"}); // Add a button that closes the dialog without changes.
		var apply_button = buttons.add("button", undefined, "Apply", {name: "ok"}); // Add a button that applies the selected settings.
		dialog.defaultElement = apply_button; // Make the Enter key choose Apply.
		dialog.cancelElement = cancel_button; // Make the Escape key choose Cancel.
		apply_button.onClick = function() { // Read the settings when Apply is clicked.
			var zone_value = percent_value(zone.text); // Check the ragged-zone percentage.
			var randomness_value = percent_value(randomness.text); // Check the randomness percentage.
			if (zone_value === null || randomness_value === null) { // Keep the dialog open if either value is invalid.
				message("Enter a number from 0 to 100 for both percentages."); // Explain the allowed percentage range.
				return; // Leave this function without doing more work.
			} // End this block.
			result = {zone: zone_value, randomness: randomness_value, action: "apply"}; // Save the valid percentages and the apply action.
			dialog.close(1); // Close the dialog after choosing an action.
		}; // End this function or group of settings.
		remove_button.onClick = function() { // Choose removal when its button is clicked.
			result = {zone: 0, randomness: 0, action: "remove"}; // Save the remove action without using the percentage fields.
			dialog.close(1); // Close the dialog after choosing an action.
		}; // End this function or group of settings.
		cancel_button.onClick = function() { // Close the dialog when Cancel is clicked.
			dialog.close(0); // Close the dialog without choosing an action.
		}; // End this function or group of settings.
		dialog.show(); // Wait for the user to apply, remove or cancel.
		return result; // Return the values collected by this function.
	} // End this block.

	return {settings: settings, message: message}; // Make the dialog and message functions available to the script.
})(); // Run this function now.
