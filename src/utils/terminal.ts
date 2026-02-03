/**
 * Terminal utilities for ANSI colors and TTY detection
 */

const isColorSupported = (): boolean => {
	// Check NO_COLOR environment variable (https://no-color.org/)
	if (Bun.env.NO_COLOR !== undefined) {
		return false;
	}
	// Check TERM
	if (Bun.env.TERM === "dumb") {
		return false;
	}
	// Check if stdout is a TTY
	return (
		Bun.stdout.writer().write !== undefined && process.stdout.isTTY === true
	);
};

const supportsColor = isColorSupported();

// ANSI escape codes
const codes = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	italic: "\x1b[3m",
	underline: "\x1b[4m",

	// Foreground colors
	black: "\x1b[30m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	white: "\x1b[37m",
	gray: "\x1b[90m",

	// Bright foreground colors
	brightRed: "\x1b[91m",
	brightGreen: "\x1b[92m",
	brightYellow: "\x1b[93m",
	brightBlue: "\x1b[94m",
	brightMagenta: "\x1b[95m",
	brightCyan: "\x1b[96m",
	brightWhite: "\x1b[97m",
};

const wrap = (code: string, text: string): string => {
	if (!supportsColor) return text;
	return `${code}${text}${codes.reset}`;
};

export const colors = {
	// Check if colors are supported
	enabled: supportsColor,

	// Styles
	bold: (text: string) => wrap(codes.bold, text),
	dim: (text: string) => wrap(codes.dim, text),
	italic: (text: string) => wrap(codes.italic, text),
	underline: (text: string) => wrap(codes.underline, text),

	// Colors
	black: (text: string) => wrap(codes.black, text),
	red: (text: string) => wrap(codes.red, text),
	green: (text: string) => wrap(codes.green, text),
	yellow: (text: string) => wrap(codes.yellow, text),
	blue: (text: string) => wrap(codes.blue, text),
	magenta: (text: string) => wrap(codes.magenta, text),
	cyan: (text: string) => wrap(codes.cyan, text),
	white: (text: string) => wrap(codes.white, text),
	gray: (text: string) => wrap(codes.gray, text),

	// Bright colors
	brightRed: (text: string) => wrap(codes.brightRed, text),
	brightGreen: (text: string) => wrap(codes.brightGreen, text),
	brightYellow: (text: string) => wrap(codes.brightYellow, text),
	brightBlue: (text: string) => wrap(codes.brightBlue, text),
	brightMagenta: (text: string) => wrap(codes.brightMagenta, text),
	brightCyan: (text: string) => wrap(codes.brightCyan, text),
	brightWhite: (text: string) => wrap(codes.brightWhite, text),

	// Semantic colors
	success: (text: string) => wrap(codes.green, text),
	error: (text: string) => wrap(codes.red, text),
	warning: (text: string) => wrap(codes.yellow, text),
	info: (text: string) => wrap(codes.cyan, text),
	muted: (text: string) => wrap(codes.gray, text),
};

/**
 * Check if stderr is a TTY
 */
export const isStderrTTY = (): boolean => {
	return process.stderr.isTTY === true;
};

/**
 * Check if stdout is a TTY
 */
export const isStdoutTTY = (): boolean => {
	return process.stdout.isTTY === true;
};

/**
 * Get terminal width
 */
export const getTerminalWidth = (): number => {
	return process.stdout.columns || 80;
};
