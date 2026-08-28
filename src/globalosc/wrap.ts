/**
 * Line-wraps a key title: ~9 characters per line, up to 3 lines, words kept
 * whole where possible, overlong words hard-split, overflow ends in an ellipsis.
 */
export function wrapTitle(text: string, maxChars = 9, maxLines = 3): string {
	const words = text.trim().split(/\s+/);
	const lines: string[] = [];
	let current = "";

	const push = (): void => {
		if (current !== "") {
			lines.push(current);
			current = "";
		}
	};

	for (let word of words) {
		while (word.length > maxChars) {
			push();
			lines.push(word.slice(0, maxChars));
			word = word.slice(maxChars);
		}
		if (current === "") {
			current = word;
		} else if (current.length + 1 + word.length <= maxChars) {
			current += ` ${word}`;
		} else {
			push();
			current = word;
		}
	}
	push();

	if (lines.length > maxLines) {
		const kept = lines.slice(0, maxLines);
		const last = kept[maxLines - 1] ?? "";
		kept[maxLines - 1] = `${last.slice(0, Math.max(0, maxChars - 1))}…`;
		return kept.join("\n");
	}
	return lines.join("\n");
}
