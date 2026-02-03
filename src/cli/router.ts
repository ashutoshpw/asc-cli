import { colors } from "../utils/terminal";
/**
 * Command router and registry
 */
import type { CommandOption, GlobalOptions, ParsedCommand } from "./parser";

export interface CommandContext {
	global: GlobalOptions;
	args: ParsedCommand;
}

export interface Command {
	name: string;
	description: string;
	longDescription?: string;
	usage?: string;
	options?: Record<string, CommandOption>;
	subcommands?: Record<string, Command>;
	execute?: (ctx: CommandContext) => Promise<void>;
}

/**
 * Command registry - stores all registered commands
 */
class CommandRegistry {
	private commands: Map<string, Command> = new Map();

	/**
	 * Register a top-level command
	 */
	register(command: Command): void {
		this.commands.set(command.name, command);
	}

	/**
	 * Get a command by name
	 */
	get(name: string): Command | undefined {
		return this.commands.get(name);
	}

	/**
	 * Get all registered commands
	 */
	all(): Command[] {
		return Array.from(this.commands.values());
	}

	/**
	 * Find a command by path (e.g., ["apps", "list"])
	 */
	findByPath(
		path: string[],
	): { command: Command; remainingPath: string[] } | undefined {
		if (path.length === 0) {
			return undefined;
		}

		let current = this.commands.get(path[0]);
		if (!current) {
			return undefined;
		}

		let i = 1;
		while (i < path.length && current.subcommands) {
			const sub = current.subcommands[path[i]];
			if (!sub) {
				break;
			}
			current = sub;
			i++;
		}

		return {
			command: current,
			remainingPath: path.slice(i),
		};
	}
}

// Global registry instance
export const registry = new CommandRegistry();

/**
 * Route and execute a command
 */
export async function routeCommand(
	args: ParsedCommand,
	global: GlobalOptions,
): Promise<void> {
	const ctx: CommandContext = { global, args };

	// No command specified - show help
	if (args.command.length === 0) {
		if (global.version) {
			await showVersion();
			return;
		}
		await showHelp();
		return;
	}

	// Find the command
	const result = registry.findByPath(args.command);

	if (!result) {
		console.error(colors.error(`Unknown command: ${args.command.join(" ")}`));
		console.error(`Run ${colors.cyan("asc --help")} for usage.`);
		process.exit(1);
	}

	const { command, remainingPath } = result;

	// Show help for command if requested
	if (global.help) {
		const path =
			remainingPath.length > 0
				? args.command.slice(0, -remainingPath.length)
				: args.command;
		showCommandHelp(command, path);
		return;
	}

	// If command has subcommands but no execute, show help
	if (command.subcommands && !command.execute && remainingPath.length === 0) {
		showCommandHelp(command, args.command);
		return;
	}

	// Execute the command
	if (command.execute) {
		try {
			await command.execute(ctx);
		} catch (error) {
			if (error instanceof Error) {
				console.error(colors.error(`Error: ${error.message}`));
				if (global.debug) {
					console.error(error.stack);
				}
			} else {
				console.error(colors.error(`Error: ${String(error)}`));
			}
			process.exit(1);
		}
	} else {
		console.error(
			colors.error(`Command "${args.command.join(" ")}" has no implementation`),
		);
		process.exit(1);
	}
}

/**
 * Show global help
 */
async function showHelp(): Promise<void> {
	const { version } = await import("./version");

	console.log(`${colors.bold("asc")} - App Store Connect CLI v${version}`);
	console.log();
	console.log(colors.bold("USAGE"));
	console.log("  asc <command> [subcommand] [options]");
	console.log();
	console.log(colors.bold("COMMANDS"));

	const commands = registry.all().sort((a, b) => a.name.localeCompare(b.name));
	const maxLen = Math.max(...commands.map((c) => c.name.length));

	for (const cmd of commands) {
		console.log(
			`  ${colors.cyan(cmd.name.padEnd(maxLen + 2))} ${cmd.description}`,
		);
	}

	console.log();
	console.log(colors.bold("GLOBAL OPTIONS"));
	console.log("  --help, -h       Show help for command");
	console.log("  --version, -v    Show version number");
	console.log("  --raw            Output raw JSON (minified)");
	console.log(
		"  --output, -o     Output format: pretty (default), table, markdown",
	);
	console.log("  --profile, -p    Use named authentication profile");
	console.log("  --debug          Enable debug logging");
	console.log();
	console.log(
		`Run ${colors.cyan("asc <command> --help")} for more information on a command.`,
	);
}

/**
 * Show help for a specific command
 */
function showCommandHelp(command: Command, path: string[]): void {
	const fullName = path.join(" ");

	console.log(colors.bold("DESCRIPTION"));
	console.log(`  ${command.description}`);
	if (command.longDescription) {
		console.log();
		console.log(`  ${command.longDescription}`);
	}
	console.log();

	console.log(colors.bold("USAGE"));
	if (command.usage) {
		console.log(`  ${command.usage}`);
	} else if (command.subcommands) {
		console.log(`  asc ${fullName} <subcommand> [options]`);
	} else {
		console.log(`  asc ${fullName} [options]`);
	}
	console.log();

	if (command.subcommands) {
		console.log(colors.bold("SUBCOMMANDS"));
		const subs = Object.values(command.subcommands).sort((a, b) =>
			a.name.localeCompare(b.name),
		);
		const maxLen = Math.max(...subs.map((c) => c.name.length));

		for (const sub of subs) {
			console.log(
				`  ${colors.cyan(sub.name.padEnd(maxLen + 2))} ${sub.description}`,
			);
		}
		console.log();
	}

	if (command.options && Object.keys(command.options).length > 0) {
		console.log(colors.bold("OPTIONS"));
		for (const [name, opt] of Object.entries(command.options)) {
			const shortFlag = opt.short ? `-${opt.short}, ` : "    ";
			const required = opt.required ? colors.red(" (required)") : "";
			const defaultVal =
				opt.default !== undefined
					? colors.gray(` (default: ${opt.default})`)
					: "";
			console.log(`  ${shortFlag}--${name}${required}${defaultVal}`);
			console.log(`      ${opt.description}`);
		}
		console.log();
	}
}

/**
 * Show version
 */
async function showVersion(): Promise<void> {
	const { version, buildDate, commit } = await import("./version");
	console.log(`asc version ${version}`);
	if (commit) {
		console.log(`commit: ${commit}`);
	}
	if (buildDate) {
		console.log(`built: ${buildDate}`);
	}
}
