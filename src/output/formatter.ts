/**
 * Output formatting utilities
 * Default: pretty-printed JSON
 * With --raw: minified JSON
 */
import { colors, getTerminalWidth } from "../utils/terminal";

export type OutputFormat = "pretty" | "raw" | "table" | "markdown";

/**
 * Determine output format from options
 */
export function getOutputFormat(options: {
	raw?: boolean;
	output?: string;
}): OutputFormat {
	if (options.raw) return "raw";

	const output = options.output?.toLowerCase();
	if (output === "table") return "table";
	if (output === "markdown" || output === "md") return "markdown";

	return "pretty"; // Default
}

/**
 * Format and print output based on format
 */
export function printOutput(data: unknown, format: OutputFormat): void {
	switch (format) {
		case "raw":
			console.log(formatRaw(data));
			break;
		case "table":
			console.log(formatTable(data));
			break;
		case "markdown":
			console.log(formatMarkdown(data));
			break;
		default:
			console.log(formatPretty(data));
			break;
	}
}

/**
 * Format as minified JSON (--raw)
 */
export function formatRaw(data: unknown): string {
	return JSON.stringify(data);
}

/**
 * Format as pretty table (default)
 * This provides a simplified, human-readable view
 */
export function formatPretty(data: unknown): string {
	// Use table format with hint for pretty output
	return formatTable(data, true);
}

/**
 * Colorize JSON string
 */
function colorizeJson(json: string): string {
	// Simple regex-based colorization
	return (
		json
			// Strings (but not keys)
			.replace(/: "([^"\\]*(\\.[^"\\]*)*)"/g, `: ${colors.green('"$1"')}`)
			// Keys
			.replace(/"([^"]+)":/g, `${colors.cyan('"$1"')}:`)
			// Numbers
			.replace(/: (\d+\.?\d*)/g, `: ${colors.yellow("$1")}`)
			// Booleans
			.replace(/: (true|false)/g, `: ${colors.magenta("$1")}`)
			// Null
			.replace(/: (null)/g, `: ${colors.gray("$1")}`)
	);
}

/**
 * Format as ASCII table
 */
export function formatTable(data: unknown, showHint = false): string {
	if (!data || typeof data !== "object") {
		return String(data);
	}

	// Handle arrays
	if (Array.isArray(data)) {
		if (data.length === 0) return "(empty)";

		// Try to extract from JSON:API format
		const items = extractItems(data);
		const table = renderTable(items);
		return showHint
			? `${table}\n${colors.gray("\nHint: Use --raw to see full JSON output")}`
			: table;
	}

	// Handle JSON:API response format
	if ("data" in data && Array.isArray((data as Record<string, unknown>).data)) {
		const items = extractItems(
			(data as Record<string, unknown>).data as unknown[],
		);
		const table = renderTable(items);
		return showHint
			? `${table}\n${colors.gray("\nHint: Use --raw to see full JSON output")}`
			: table;
	}

	// Handle single object
	if (
		"data" in data &&
		typeof (data as Record<string, unknown>).data === "object"
	) {
		const item = extractItem(
			(data as Record<string, unknown>).data as Record<string, unknown>,
		);
		const table = renderTable([item]);
		return showHint
			? `${table}\n${colors.gray("\nHint: Use --raw to see full JSON output")}`
			: table;
	}

	// Plain object - render as key-value
	return renderKeyValue(data as Record<string, unknown>);
}

/**
 * Extract items from JSON:API response
 */
function extractItems(data: unknown[]): Record<string, unknown>[] {
	return data.map((item) => extractItem(item as Record<string, unknown>));
}

/**
 * Extract item from JSON:API resource
 */
function extractItem(item: Record<string, unknown>): Record<string, unknown> {
	// JSON:API format: { id, type, attributes: {...} }
	if (item.attributes && typeof item.attributes === "object") {
		const attrs = item.attributes as Record<string, unknown>;

		// For apps, show only essential fields
		if (item.type === "apps") {
			return {
				id: item.id,
				name: attrs.name,
				bundleId: attrs.bundleId,
				sku: attrs.sku,
				primaryLocale: attrs.primaryLocale,
			};
		}

		// For builds, show only essential fields
		if (item.type === "builds") {
			return {
				id: item.id,
				version: attrs.version,
				uploadedDate: attrs.uploadedDate,
				processingState: attrs.processingState,
				minOsVersion: attrs.minOsVersion,
			};
		}

		// For other types, merge id/type with all attributes
		return {
			id: item.id,
			type: item.type,
			...(item.attributes as Record<string, unknown>),
		};
	}
	return item;
}

/**
 * Render data as ASCII table
 */
function renderTable(items: Record<string, unknown>[]): string {
	if (items.length === 0) return "(empty)";

	// Get all keys
	const keys = new Set<string>();
	for (const item of items) {
		for (const key of Object.keys(item)) {
			keys.add(key);
		}
	}

	const columns = Array.from(keys);
	const termWidth = getTerminalWidth();

	// Calculate column widths
	const widths: Record<string, number> = {};
	for (const col of columns) {
		widths[col] = col.length;
		for (const item of items) {
			const val = formatCellValue(item[col]);
			widths[col] = Math.max(widths[col], val.length);
		}
		// Cap column width
		widths[col] = Math.min(widths[col], 40);
	}

	// Build table
	const lines: string[] = [];

	// Header
	const header = columns.map((col) => col.padEnd(widths[col])).join(" | ");
	lines.push(header);

	// Separator
	const separator = columns.map((col) => "-".repeat(widths[col])).join("-+-");
	lines.push(separator);

	// Rows
	for (const item of items) {
		const row = columns
			.map((col) => {
				const val = formatCellValue(item[col]);
				return val.slice(0, widths[col]).padEnd(widths[col]);
			})
			.join(" | ");
		lines.push(row);
	}

	return lines.join("\n");
}

/**
 * Format a cell value for table display
 */
function formatCellValue(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean")
		return String(value);
	if (Array.isArray(value)) return `[${value.length} items]`;
	if (typeof value === "object") return "[object]";
	return String(value);
}

/**
 * Render object as key-value pairs
 */
function renderKeyValue(obj: Record<string, unknown>): string {
	const lines: string[] = [];
	const maxKeyLen = Math.max(...Object.keys(obj).map((k) => k.length));

	for (const [key, value] of Object.entries(obj)) {
		const formattedKey = colors.cyan(key.padEnd(maxKeyLen));
		const formattedValue = formatCellValue(value);
		lines.push(`${formattedKey}  ${formattedValue}`);
	}

	return lines.join("\n");
}

/**
 * Format as Markdown table
 */
export function formatMarkdown(data: unknown): string {
	if (!data || typeof data !== "object") {
		return String(data);
	}

	// Handle arrays
	let items: Record<string, unknown>[];

	if (Array.isArray(data)) {
		if (data.length === 0) return "_No data_";
		items = extractItems(data);
	} else if (
		"data" in data &&
		Array.isArray((data as Record<string, unknown>).data)
	) {
		items = extractItems((data as Record<string, unknown>).data as unknown[]);
	} else if (
		"data" in data &&
		typeof (data as Record<string, unknown>).data === "object"
	) {
		items = [
			extractItem(
				(data as Record<string, unknown>).data as Record<string, unknown>,
			),
		];
	} else {
		items = [data as Record<string, unknown>];
	}

	if (items.length === 0) return "_No data_";

	// Get all keys
	const columns = Array.from(
		new Set(items.flatMap((item) => Object.keys(item))),
	);

	// Build markdown table
	const lines: string[] = [];

	// Header
	lines.push(`| ${columns.join(" | ")} |`);
	lines.push(`| ${columns.map(() => "---").join(" | ")} |`);

	// Rows
	for (const item of items) {
		const cells = columns.map((col) =>
			escapeMarkdown(formatCellValue(item[col])),
		);
		lines.push(`| ${cells.join(" | ")} |`);
	}

	return lines.join("\n");
}

/**
 * Escape markdown special characters
 */
function escapeMarkdown(text: string): string {
	return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/**
 * Print success message
 */
export function printSuccess(message: string): void {
	console.log(colors.success(`✓ ${message}`));
}

/**
 * Print error message
 */
export function printError(message: string): void {
	console.error(colors.error(`✗ ${message}`));
}

/**
 * Print warning message
 */
export function printWarning(message: string): void {
	console.error(colors.warning(`⚠ ${message}`));
}

/**
 * Print info message
 */
export function printInfo(message: string): void {
	console.log(colors.info(`ℹ ${message}`));
}
