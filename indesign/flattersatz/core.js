// Calculate shapes with JavaScript that InDesign can run.
var FlattersatzCore = (function() { // Keep the calculation functions together.
	function number(value, name) { // Check that a value is a usable number.
		if (typeof value !== "number" || !isFinite(value)) { // Reject missing numbers and infinity.
			throw new Error(name + " must be a finite number."); // Explain which value is invalid.
		} // Finish checking the number.
		return value; // Give back the checked number.
	} // Finish the number check.

	function validate_options(options) { // Check the chosen action and percentages.
		if (!options || (options.action !== "apply" && options.action !== "remove")) { // Accept only the two known actions.
			throw new Error("Choose Apply or Remove."); // Ask for a valid action.
		} // Finish checking the action.
		if (options.action === "remove") { // Removal does not need percentages.
			return options; // Keep the removal settings.
		} // Finish handling removal.
		var names = ["zone", "randomness"]; // List the two percentage settings.
		for (var i = 0; i < names.length; i++) { // Check each percentage.
			var value = number(options[names[i]], names[i]); // Read a valid number for this setting.
			if (value < 0 || value > 100) { // Reject values outside the allowed range.
				throw new Error(names[i] + " must be between 0 and 100 percent."); // Explain the allowed range.
			} // Finish checking this range.
		} // Finish checking both percentages.
		return options; // Give back the checked settings.
	} // Finish the settings check.

	// Use the same random value whenever the frame and row are the same.
	function sample(frame_id, row) { // Make a repeatable value for one row.
		var seed = (Math.abs(number(frame_id, "Frame ID")) + 1) % 2147483647; // Start with the frame number.
		seed = (seed * 48271 + (row + 1) * 69621) % 2147483647; // Mix in the row number.
		return ((seed * 48271) % 2147483647) / 2147483647; // Return a value from zero up to one.
	} // Finish making the repeatable value.

	function make_plan(metrics, options, frame_id) { // Plan the shapes that shorten the text lines.
		validate_options(options); // Check the settings before calculating shapes.
		var plan = []; // Start with no shapes.
		if (options.action === "remove" || options.zone === 0) { // Do not add shapes for removal or a zero zone.
			return plan; // Return the empty plan.
		} // Finish handling an empty effect.
		for (var i = 0; i < metrics.length; i++) { // Plan each text row.
			var line = metrics[i]; // Read the measurements for this row.
			var fields = ["baseline", "ascent", "descent", "left", "right", "outer_right"]; // List the needed measurements.
			for (var j = 0; j < fields.length; j++) { // Check each measurement.
				number(line[fields[j]], fields[j]); // Reject any measurement that is not a valid number.
			} // Finish checking the measurements.
			var width = line.right - line.left; // Find the width available for text.
			if (width <= 0 || line.ascent <= 0 || line.descent < 0 || line.outer_right < line.right) { // Reject shapes that cannot hold this row.
				throw new Error("The composed line has unsupported geometry."); // Explain that the row cannot be handled.
			} // Finish checking the row shape.
			var zone = width * options.zone / 100; // Convert the zone percentage to a width.
			var jitter = options.randomness / 100; // Convert randomness to a fraction.
			var random = sample(frame_id, i); // Get the repeatable value for this row.
			var depth = i % 2 === 0 ? zone * jitter * random : zone * (1 + jitter * (2 * random - 1)); // Alternate long and short rows with the chosen variation.
			// Always leave enough space for text.
			var minimum_width = Math.max(12, 2 * (line.ascent + line.descent)); // Keep at least twelve points or twice the text height.
			depth = Math.max(0, Math.min(depth, width * 0.95, width - minimum_width)); // Limit how far the shape enters the text.
			if (depth < 0.01) { // Skip shapes that would be almost empty.
				continue; // Move to the next row.
			} // Finish checking the shape width.
			var top = line.baseline - line.ascent / 2; // Place the shape halfway up the letters.
			plan.push({bounds: [top, line.right - depth, top + Math.min(0.1, line.ascent / 4), line.outer_right], row: i}); // Save the thin shape and its row number.
		} // Finish planning all rows.
		return plan; // Give back the complete list of shapes.
	} // Finish making the plan.

	function metrics_equal(first, second) { // Check whether the text layout has stopped changing.
		if (first.length !== second.length) { // Compare the number of rows.
			return false; // A different row count means the layout changed.
		} // Finish checking the row count.
		var fields = ["baseline", "ascent", "descent", "left", "right", "outer_right"]; // List the measurements to compare.
		for (var i = 0; i < first.length; i++) { // Compare each row.
			if (first[i].start !== second[i].start || first[i].end !== second[i].end) { // Check whether the row contains the same text.
				return false; // Different text means the layout changed.
			} // Finish checking the row text.
			for (var j = 0; j < fields.length; j++) { // Compare each measurement for this row.
				var a = first[i][fields[j]], b = second[i][fields[j]]; // Read the old and new values.
				if (typeof a !== "number" || typeof b !== "number" || !isFinite(a) || !isFinite(b) || Math.abs(a - b) > 0.01) { // Reject invalid values or changes larger than a hundredth of a point.
					return false; // The row measurements do not match.
				} // Finish checking this measurement.
			} // Finish comparing the row measurements.
		} // Finish comparing all rows.
		return true; // All rows have the same text and measurements.
	} // Finish checking the layout.

	return {validate_options: validate_options, make_plan: make_plan, metrics_equal: metrics_equal}; // Share the three functions used by the script.
})(); // Create the calculation helper.
