import { stat } from "node:fs/promises";
import {
	type StoredCredential,
	listCredentials,
	loadConfig,
	removeCredential,
	upsertCredential,
} from "../../../auth/config";
import { hasCredentials, resolveCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printInfo,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
/**
 * Auth commands
 * asc auth add/list/remove/switch/status
 */
import { type Command, type CommandContext, registry } from "../../router";
import {
	addCredentialInteractive,
	editCredentialInteractive,
} from "./interactive";

const authCommand: Command = {
	name: "auth",
	description: "Manage API credentials",
	subcommands: {
		add: {
			name: "add",
			description: "Add new API credentials (interactive by default)",
			options: {
				name: {
					type: "string",
					short: "n",
					description: "Name for this credential profile",
				},
				"key-id": {
					type: "string",
					short: "k",
					description: "API Key ID",
				},
				"issuer-id": {
					type: "string",
					short: "i",
					description: "Issuer ID",
				},
				"private-key-path": {
					type: "string",
					short: "p",
					description: "Path to private key (.p8 file)",
				},
				vendor: {
					type: "string",
					description: "Vendor number for sales/financial reports",
				},
				default: {
					type: "boolean",
					short: "d",
					description: "Set as default profile",
					default: false,
				},
			},
			execute: addCredential,
		},
		edit: {
			name: "edit",
			description: "Edit an existing credential profile",
			options: {
				name: {
					type: "string",
					short: "n",
					description: "Name of credential to edit",
					required: true,
				},
				"key-id": {
					type: "string",
					short: "k",
					description: "New API Key ID",
				},
				"issuer-id": {
					type: "string",
					short: "i",
					description: "New Issuer ID",
				},
				"private-key-path": {
					type: "string",
					short: "p",
					description: "New path to private key (.p8 file)",
				},
				vendor: {
					type: "string",
					description: "Vendor number for sales/financial reports",
				},
			},
			execute: editCredential,
		},
		list: {
			name: "list",
			description: "List stored credentials",
			execute: listCredentialsCommand,
		},
		remove: {
			name: "remove",
			description: "Remove a credential",
			options: {
				name: {
					type: "string",
					short: "n",
					description: "Name of credential to remove",
					required: true,
				},
			},
			execute: removeCredentialCommand,
		},
		switch: {
			name: "switch",
			description: "Switch default credential",
			options: {
				name: {
					type: "string",
					short: "n",
					description: "Name of credential to set as default",
					required: true,
				},
			},
			execute: switchCredential,
		},
		status: {
			name: "status",
			description: "Show current authentication status",
			execute: showStatus,
		},
	},
};

async function addCredential(ctx: CommandContext): Promise<void> {
	const { options } = ctx.args;

	const keyId = options["key-id"] as string | undefined;
	const issuerId = options["issuer-id"] as string | undefined;
	const privateKeyPath = options["private-key-path"] as string | undefined;
	const vendorNumber = options.vendor as string | undefined;

	// If no credential flags provided, run interactive mode
	if (!keyId && !issuerId && !privateKeyPath) {
		return addCredentialInteractive(ctx);
	}

	// Non-interactive (scripted) mode - all credential fields required
	if (!keyId) {
		printError(
			"--key-id is required (or run without flags for interactive mode)",
		);
		process.exit(1);
	}
	if (!issuerId) {
		printError(
			"--issuer-id is required (or run without flags for interactive mode)",
		);
		process.exit(1);
	}
	if (!privateKeyPath) {
		printError(
			"--private-key-path is required (or run without flags for interactive mode)",
		);
		process.exit(1);
	}

	const name = (options.name as string) || "default";
	const isDefault = options.default === true;

	// Validate private key path exists
	try {
		await stat(privateKeyPath);
	} catch {
		printError(`Private key file not found: ${privateKeyPath}`);
		process.exit(1);
	}

	const cred: StoredCredential = {
		name,
		key_id: keyId,
		issuer_id: issuerId,
		private_key_path: privateKeyPath,
		is_default: isDefault,
		vendor_number: vendorNumber,
	};

	await upsertCredential(cred);
	printSuccess(`Credential "${name}" added successfully`);

	if (isDefault) {
		printInfo("Set as default profile");
	}
	if (vendorNumber) {
		printInfo(`Vendor number: ${vendorNumber}`);
	}
}

async function listCredentialsCommand(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const creds = await listCredentials();

	if (creds.length === 0) {
		printInfo("No credentials stored. Use 'asc auth add' to add credentials.");
		return;
	}

	// Get current default from config
	const config = await loadConfig();
	const defaultName = config?.default_key_name;

	// Format for display
	// Only use config.default_key_name as the source of truth for which profile is default
	const displayCreds = creds.map((c) => ({
		name: c.name,
		keyId: c.key_id,
		issuerId: `${c.issuer_id.slice(0, 8)}...`,
		keyPath: c.private_key_path || "(inline)",
		vendorNumber: c.vendor_number || "",
		default: c.name === defaultName ? "yes" : "",
	}));

	printOutput(displayCreds, format);
}

async function editCredential(ctx: CommandContext): Promise<void> {
	const { options } = ctx.args;
	const name = options.name as string;

	if (!name) {
		printError("--name is required");
		process.exit(1);
	}

	// Load existing config and find credential
	const config = await loadConfig();
	if (!config) {
		printError("No config file found");
		process.exit(1);
	}

	const existingCred = config.keys?.find((k) => k.name === name);
	if (!existingCred) {
		printError(`Credential "${name}" not found`);
		process.exit(1);
	}

	// Check if any flags provided for non-interactive mode
	const keyId = options["key-id"] as string | undefined;
	const issuerId = options["issuer-id"] as string | undefined;
	const privateKeyPath = options["private-key-path"] as string | undefined;
	const vendorNumber = options.vendor as string | undefined;

	// If no flags provided, run interactive mode
	if (!keyId && !issuerId && !privateKeyPath && !vendorNumber) {
		return editCredentialInteractive(existingCred);
	}

	// Non-interactive mode - update only provided fields
	const updatedCred: StoredCredential = {
		...existingCred,
		key_id: keyId || existingCred.key_id,
		issuer_id: issuerId || existingCred.issuer_id,
		private_key_path: privateKeyPath || existingCred.private_key_path,
		vendor_number: vendorNumber || existingCred.vendor_number,
	};

	// Validate private key path if provided
	if (privateKeyPath) {
		try {
			await stat(privateKeyPath);
		} catch {
			printError(`Private key file not found: ${privateKeyPath}`);
			process.exit(1);
		}
	}

	await upsertCredential(updatedCred);
	printSuccess(`Credential "${name}" updated successfully`);

	if (keyId) printInfo(`Key ID: ${keyId}`);
	if (issuerId) printInfo(`Issuer ID: ${issuerId.slice(0, 8)}...`);
	if (privateKeyPath) printInfo(`Private key path: ${privateKeyPath}`);
	if (vendorNumber) printInfo(`Vendor number: ${vendorNumber}`);
}

async function removeCredentialCommand(ctx: CommandContext): Promise<void> {
	const name = ctx.args.options.name as string;

	if (!name) {
		printError("--name is required");
		process.exit(1);
	}

	const removed = await removeCredential(name);

	if (removed) {
		printSuccess(`Credential "${name}" removed`);
	} else {
		printError(`Credential "${name}" not found`);
		process.exit(1);
	}
}

async function switchCredential(ctx: CommandContext): Promise<void> {
	const name = ctx.args.options.name as string;

	if (!name) {
		printError("--name is required");
		process.exit(1);
	}

	const config = await loadConfig();
	if (!config) {
		printError("No config file found");
		process.exit(1);
	}

	const cred = config.keys?.find((k) => k.name === name);
	if (!cred) {
		printError(`Credential "${name}" not found`);
		process.exit(1);
	}

	// Update with is_default
	await upsertCredential({ ...cred, is_default: true });
	printSuccess(`Switched default to "${name}"`);
}

async function showStatus(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);

	const creds = await resolveCredentials({
		profile: ctx.global.profile,
	});

	if (!creds) {
		printInfo("Not authenticated");
		printInfo("Run 'asc auth add --help' for setup instructions");
		return;
	}

	const status: Record<string, string | boolean> = {
		authenticated: true,
		source: creds.source,
		keyId: creds.keyId,
		issuerId: `${creds.issuerId.slice(0, 8)}...`,
		profile: creds.name || "(unnamed)",
		keyPath: creds.privateKeyPath || "(inline/env)",
	};

	if (creds.vendorNumber) {
		status.vendorNumber = creds.vendorNumber;
	}

	printOutput(status, format);
}

export function registerAuthCommands(): void {
	registry.register(authCommand);
}
