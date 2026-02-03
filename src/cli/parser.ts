/**
 * CLI argument parser using native util.parseArgs
 */
import { type ParseArgsConfig, parseArgs as nodeParseArgs } from "node:util";

export interface CommandOption {
	type: "boolean" | "string";
	short?: string;
	description: string;
	default?: string | boolean;
	required?: boolean;
}

export interface ParsedCommand {
	command: string[];
	options: Record<string, string | boolean | undefined>;
	positionals: string[];
}

export interface GlobalOptions {
	help: boolean;
	version: boolean;
	raw: boolean;
	debug: boolean;
	apiDebug: boolean;
	profile?: string;
	output: string;
}

// Global options available on all commands
export const globalOptions: Record<string, CommandOption> = {
	help: {
		type: "boolean",
		short: "h",
		description: "Show help for command",
		default: false,
	},
	version: {
		type: "boolean",
		short: "v",
		description: "Show version number",
		default: false,
	},
	raw: {
		type: "boolean",
		description: "Output raw JSON (minified)",
		default: false,
	},
	debug: {
		type: "boolean",
		description: "Enable debug logging",
		default: false,
	},
	"api-debug": {
		type: "boolean",
		description: "Enable HTTP request/response logging",
		default: false,
	},
	profile: {
		type: "string",
		short: "p",
		description: "Use named authentication profile",
	},
	output: {
		type: "string",
		short: "o",
		description: "Output format: pretty (default), table, markdown",
		default: "pretty",
	},
};

/**
 * Convert our option format to node's parseArgs format
 */
function toParseArgsConfig(
	options: Record<string, CommandOption>,
): ParseArgsConfig["options"] {
	const config: NonNullable<ParseArgsConfig["options"]> = {};

	for (const [name, opt] of Object.entries(options)) {
		const optConfig: {
			type: "boolean" | "string";
			short?: string;
			default?: string | boolean;
		} = {
			type: opt.type,
		};
		// Only include short if defined (parseArgs throws if short is undefined)
		if (opt.short) {
			optConfig.short = opt.short;
		}
		// Only include default if defined
		if (opt.default !== undefined) {
			optConfig.default = opt.default;
		}
		config[name] = optConfig;
	}

	return config;
}

/**
 * Extract command path from args (everything before first flag)
 */
function extractCommand(args: string[]): {
	command: string[];
	remaining: string[];
} {
	const command: string[] = [];
	let i = 0;

	for (; i < args.length; i++) {
		const arg = args[i];
		// Stop at first flag
		if (arg.startsWith("-")) {
			break;
		}
		command.push(arg);
	}

	return {
		command,
		remaining: args.slice(i),
	};
}

/**
 * Parse command line arguments
 */
export function parseArgs(
	args: string[],
	commandOptions: Record<string, CommandOption> = {},
): ParsedCommand {
	// Combine global and command-specific options
	const allOptions = { ...globalOptions, ...commandOptions };

	// Extract command path first
	const { command, remaining } = extractCommand(args);

	// Parse remaining args with parseArgs
	const config: ParseArgsConfig = {
		args: remaining,
		options: toParseArgsConfig(allOptions),
		allowPositionals: true,
		strict: false, // Allow unknown options (they'll be in positionals)
	};

	try {
		const { values, positionals } = nodeParseArgs(config);

		// Normalize option names (convert kebab-case to camelCase for internal use)
		const normalizedOptions: Record<string, string | boolean | undefined> = {};
		for (const [key, value] of Object.entries(values)) {
			normalizedOptions[key] = value as string | boolean | undefined;
		}

		return {
			command,
			options: normalizedOptions,
			positionals,
		};
	} catch (error) {
		// On parse error, return what we can
		return {
			command,
			options: {},
			positionals: remaining,
		};
	}
}

/**
 * Get global options from parsed args
 */
export function getGlobalOptions(
	options: Record<string, string | boolean | undefined>,
): GlobalOptions {
	return {
		help: options.help === true,
		version: options.version === true,
		raw: options.raw === true,
		debug: options.debug === true,
		apiDebug: options["api-debug"] === true,
		profile: options.profile as string | undefined,
		output: (options.output as string) || "pretty",
	};
}
