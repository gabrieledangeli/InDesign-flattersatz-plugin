// Plan word groups for a left-aligned preview without adding text characters.
var FlattersatzRagCore = (function() { // Keep the planning code separate from InDesign.
	var MAX_TOKENS = 80; // Limit the amount of text in one paragraph.
	var MAX_MEASUREMENTS = 4000; // Limit calls to the InDesign measuring function.
	var EPSILON = 0.001; // Allow a thousandth of a point of measurement noise.

	function number(value, name) { // Require a real finite number.
		if (typeof value !== "number" || !isFinite(value)) { // Reject missing values and infinity.
			throw new Error(name + " must be a finite number."); // Explain which number is invalid.
		} // Finish checking the number.
		return value; // Return the checked number.
	} // Finish the number helper.

	function settings(input) { // Check the page width and rhythm setting.
		if (!input) { // Require a settings object.
			throw new Error("Provide rag preview settings."); // Explain what is missing.
		} // Finish checking for settings.
		var width = number(input.width, "Text width"); // Read the available text width.
		var zone = number(input.zone === undefined ? 15 : input.zone, "Rag zone"); // Use a fifteen percent zone by default.
		if (width <= 0 || zone < 0 || zone > 100) { // Require a positive width and a valid percentage.
			throw new Error("Text width must be positive and the rag zone must be between 0 and 100."); // Explain the valid ranges.
		} // Finish checking the ranges.
		return {width: width, zone: zone}; // Return the checked settings.
	} // Finish checking settings.

	function tokenize(text, no_break_flags) { // Find word groups that may be separated at ordinary spaces.
		if (typeof text !== "string") { // Require the original paragraph text.
			throw new Error("Paragraph text must be a string."); // Explain the required input.
		} // Finish checking the text type.
		if (/[\x00-\x1f\x7f\u0085\u00ad\u200b\u2028\u2029\ufffc]/.test(text)) { // Reject controls and special breaks that this preview cannot handle.
			throw new Error("Rag preview does not support tabs, line breaks, soft hyphens or embedded objects."); // Explain why the paragraph was rejected.
		} // Finish checking special characters.
		var flags = no_break_flags, i; // Keep the optional original No Break values.
		if (flags !== undefined && flags !== null) { // Check supplied character settings.
			if (Object.prototype.toString.call(flags) !== "[object Array]" || flags.length !== text.length) { // Require one setting for each text character.
				throw new Error("No Break flags must match the paragraph length."); // Explain the missing character settings.
			} // Finish checking the flag list length.
			for (i = 0; i < flags.length; i++) { // Check every original character setting.
				if (typeof flags[i] !== "boolean") { // Accept only true and false.
					throw new Error("Each No Break flag must be true or false."); // Reject unclear character settings.
				} // Finish checking this flag.
			} // Finish checking the flag list.
		} // Finish checking optional character settings.
		if (/^ *$/.test(text)) { // Leave empty paragraphs and plain spaces alone.
			return []; // There are no words to arrange.
		} // Finish handling blank paragraphs.
		if (text.charAt(0) === " " || text.charAt(text.length - 1) === " ") { // Avoid guessing the effect of spaces at paragraph edges.
			throw new Error("Remove leading or trailing ordinary spaces before previewing this paragraph."); // Explain the unsupported edge spaces.
		} // Finish checking paragraph edges.
		var tokens = [], start = 0, cursor = 0; // Track the current word group and its original position.
		while (cursor < text.length) { // Read the entire paragraph.
			while (cursor < text.length && text.charAt(cursor) !== " ") { cursor++; } // Find the end of the next word.
			var end = cursor, gap_start = cursor; // Remember the word end and the following gap.
			while (cursor < text.length && text.charAt(cursor) === " ") { cursor++; } // Keep each space run together.
			var protected_gap = false; // Assume the gap is a legal break.
			for (i = gap_start; i < cursor; i++) { // Inspect every space in the gap.
				if (flags && flags[i]) { protected_gap = true; } // Keep the words together if any space is protected.
			} // Finish checking the gap.
			if (cursor === text.length || !protected_gap) { // Close a group only at a legal boundary.
				tokens.push({start: start, end: end, text: text.slice(start, end)}); // Preserve the exact text and original character positions.
				start = cursor; // Start the next group after the boundary spaces.
			} // Finish recording this word group.
		} // Finish reading the paragraph.
		return tokens; // Return groups without changing the text.
	} // Finish finding word groups.

	function line_cost(width, available, zone, final_line) { // Score one natural line width.
		var ratio = width / available, gap = Math.max(0, 1 - ratio); // Measure the unused part of the line.
		var shortfall = Math.max(0, 1 - zone - ratio); // Find how far a body line falls below the preferred band.
		if (final_line) { // Allow a freer ending while discouraging very short final lines.
			return 1 + 45 * Math.pow(Math.max(0, 0.4 - ratio), 2) + gap * gap; // Penalize a last line shorter than forty percent of the width.
		} // Finish handling the final line.
		return 1 + 60 * shortfall * shortfall + 2 * gap * gap; // Favor useful body lines without forcing exact endpoints.
	} // Finish scoring a line.

	function pair_cost(previous, current, available, zone, final_line) { // Score the change between two neighbouring widths.
		var change = Math.abs(previous - current) / available; // Find their difference as a part of the text width.
		var scale = Math.max(0.05, zone); // Keep the calculation safe when the zone is zero.
		var similar = Math.max(0, zone / 3 - change) / scale; // Discourage neighbouring lines that look almost the same.
		var jump = Math.max(0, change - zone); // Notice changes larger than the chosen zone.
		return 12 * similar * similar + (final_line ? 2 : 8) * jump * jump; // Allow a softer ending and avoid a rigid alternating pattern.
	} // Finish scoring neighbouring lines.

	function score_path(input, widths) { // Expose the width score for review and tests.
		var checked = settings(input), cost = 0; // Check the settings and start a new score.
		if (Object.prototype.toString.call(widths) !== "[object Array]") { // Require a list of line widths.
			throw new Error("Provide an array of line widths."); // Explain the required score input.
		} // Finish checking the width list.
		for (var i = 0; i < widths.length; i++) { // Score each supplied line.
			var width = number(widths[i], "Line width"), final_line = i === widths.length - 1; // Read this width and identify the final line.
			if (width <= 0 || width > checked.width + EPSILON) { // Require a line that fits the available width.
				throw new Error("Every scored line must have a positive width that fits."); // Explain the invalid line width.
			} // Finish checking this line width.
			cost += line_cost(width, checked.width, checked.zone / 100, final_line); // Add the cost of this line.
			if (i > 0) { cost += pair_cost(widths[i - 1], width, checked.width, checked.zone / 100, final_line); } // Add the cost of its change from the previous line.
		} // Finish scoring all lines.
		return cost; // Return the complete width score.
	} // Finish the public score helper.

	function plan(input) { // Find the best complete sequence of word groups.
		var checked = settings(input), tokens = input.tokens; // Check the settings and read the original groups.
		if (Object.prototype.toString.call(tokens) !== "[object Array]" || tokens.length > MAX_TOKENS) { // Keep the paragraph within the preview size limit.
			throw new Error("Rag preview accepts at most " + MAX_TOKENS + " word groups per paragraph."); // Explain the paragraph limit.
		} // Finish checking the group list.
		var limit = input.max_measurements === undefined ? MAX_MEASUREMENTS : number(input.max_measurements, "Measurement limit"); // Allow the caller to set a smaller work budget.
		if (limit < 1 || limit > MAX_MEASUREMENTS || limit !== Math.floor(limit)) { // Require a whole number within the fixed safety limit.
			throw new Error("Measurement limit must be an integer from 1 to " + MAX_MEASUREMENTS + "."); // Explain the work limit.
		} // Finish checking the work budget.
		var count = tokens.length, i; // Remember how many groups need lines.
		for (i = 0; i < count; i++) { // Check the original character ranges.
			var token = tokens[i]; // Read this word group.
			if (!token || typeof token.text !== "string" || typeof token.start !== "number" || typeof token.end !== "number" || !isFinite(token.start) || !isFinite(token.end) || token.start !== Math.floor(token.start) || token.end !== Math.floor(token.end) || token.start < 0 || token.end <= token.start || token.end - token.start !== token.text.length || (i && token.start <= tokens[i - 1].end)) { // Reject missing or overlapping character positions.
				throw new Error("Word groups must have valid ordered character ranges."); // Explain the invalid group data.
			} // Finish checking this word group.
		} // Finish checking all groups.
		if (count && typeof input.measure !== "function") { // Require InDesign measurements for nonempty text.
			throw new Error("Provide a function that measures complete text spans in InDesign."); // Reject estimated or missing measurements.
		} // Finish checking the measuring function.
		var measured = [], measurements = 0, endings = []; // Cache measured widths and the best paths to each line ending.
		for (i = 0; i <= count; i++) { measured.push([]); endings.push([]); } // Create storage for each possible group position.

		function measure(first, last) { // Measure one complete span only once.
			if (measured[first][last] !== undefined) { return measured[first][last]; } // Reuse an exact width already measured.
			if (measurements >= limit) { // Stop before exceeding the allowed work.
				throw new Error("Rag preview reached its measurement limit."); // Explain why planning stopped.
			} // Finish checking the remaining work budget.
			measurements++; // Count this call before asking InDesign to work.
			var width = number(input.measure(first, last), "Measured span width"); // Ask for the exact natural width including internal spaces.
			if (width <= 0) { throw new Error("Measured span width must be positive."); } // Reject empty or reversed measurements.
			measured[first][last] = width; // Save the result for future checks.
			return width; // Return the measured span width.
		} // Finish the cached measurement helper.

		if (count) { // Avoid a full search when the whole paragraph already fits.
			var complete_width = measure(0, count); // Measure all words as one natural line.
			if (complete_width <= checked.width + EPSILON) { // Keep a short paragraph on one line.
				return {lines: [{start: tokens[0].start, end: tokens[count - 1].end, first: 0, last: count, width: complete_width}], cost: line_cost(complete_width, checked.width, checked.zone / 100, true), measurements: measurements, tokens: tokens, width: checked.width, zone: checked.zone}; // Return the single possible line without extra host work.
			} // Finish handling a paragraph that already fits.
		} // Finish the quick whole-paragraph check.

		for (var first = 0; first < count; first++) { // Try each reachable start of a new line.
			if (first > 0 && endings[first].length === 0) { continue; } // Skip starts that no complete earlier lines can reach.
			for (var last = first + 1; last <= count; last++) { // Grow this line one word group at a time.
				var width = measure(first, last); // Measure the complete candidate line.
				if (width > checked.width + EPSILON) { break; } // Stop because adding ordinary words is assumed to increase natural width.
				var final_line = last === count, cost = line_cost(width, checked.width, checked.zone / 100, final_line); // Score this candidate line.
				var best = null; // Look for the cheapest compatible previous line.
				if (first === 0) { best = {first: first, last: last, width: width, cost: cost, previous: null}; } // Start a path at the first word.
				for (var p = 0; p < endings[first].length; p++) { // Try every useful previous line ending here.
					var previous = endings[first][p]; // Read the best path that ends with this previous line.
					if (measure(previous.first, last) <= checked.width + EPSILON) { continue; } // Reject neighbours that could merge onto one line.
					var total = previous.cost + cost + pair_cost(previous.width, width, checked.width, checked.zone / 100, final_line); // Score the complete path through these two lines.
					if (!best || total < best.cost) { best = {first: first, last: last, width: width, cost: total, previous: previous}; } // Keep the cheapest path for this exact last line.
				} // Finish checking previous lines.
				if (best) { endings[last].push(best); } // Save a feasible path for later lines.
			} // Finish growing candidates from this start.
		} // Finish searching all reachable starts.
		var winner = null; // Find the cheapest path through the entire paragraph.
		for (i = 0; i < endings[count].length; i++) { // Compare paths that reach the final word.
			if (!winner || endings[count][i].cost < winner.cost) { winner = endings[count][i]; } // Keep the first cheapest result for repeatable output.
		} // Finish comparing complete paths.
		if (count && !winner) { // Report a protected group or word that cannot fit.
			throw new Error("No complete rag preview plan fits. Widen the frame or shorten an unbreakable group."); // Explain how to make planning possible.
		} // Finish checking whether a complete plan exists.
		var lines = [], node = winner; // Follow the chosen path back to its start.
		while (node) { // Copy every chosen line into the result.
			lines.unshift({start: tokens[node.first].start, end: tokens[node.last - 1].end, first: node.first, last: node.last, width: node.width}); // Keep both character ranges and exclusive token ranges.
			node = node.previous; // Move to the earlier line.
		} // Finish rebuilding the line order.
		return {lines: lines, cost: winner ? winner.cost : 0, measurements: measurements, tokens: tokens, width: checked.width, zone: checked.zone}; // Return the plan and the amount of work used.
	} // Finish planning the paragraph.

	return {tokenize: tokenize, plan: plan, score_path: score_path, max_tokens: MAX_TOKENS, max_measurements: MAX_MEASUREMENTS}; // Share the planner and its fixed limits.
})(); // Create the paragraph planning helper.
