import { stat } from "node:fs/promises";
import {
	type StoredCredential,
	listCredentials,
	upsertCredential,
} from "../../../auth/config";
import { printInfo, printSuccess } from "../../../output/formatter";
import type { CommandContext } from "../../router";

export async function editCredentialInteractive(
	existingCred: StoredCredential,
): Promise<void> {
	console.log(`\n  Editing credential profile: ${existingCred.name}\n`);
	console.log(
		"  Press Enter to keep current value, or type new value to update.\n",
	);

	console.log(`  Current Key ID: ${existingCred.key_id}`);
	const keyIdInput = prompt("  New Key ID (Enter to keep): ");
	const keyId = keyIdInput?.trim() || existingCred.key_id;

	console.log(`  Current Issuer ID: ${existingCred.issuer_id}`);
	const issuerIdInput = prompt("  New Issuer ID (Enter to keep): ");
	const issuerId = issuerIdInput?.trim() || existingCred.issuer_id;

	console.log(
		`  Current Private key path: ${existingCred.private_key_path || "(not set)"}`,
	);
	let privateKeyPath = existingCred.private_key_path;
	const pathInput = prompt("  New Private key path (Enter to keep): ");
	if (pathInput?.trim()) {
		const trimmedPath = pathInput.trim();
		const expandedPath = trimmedPath.startsWith("~")
			? trimmedPath.replace("~", process.env.HOME || "")
			: trimmedPath;

		try {
			await stat(expandedPath);
			privateKeyPath = expandedPath;
		} catch {
			console.log(
				`  Error: File not found: ${expandedPath}. Keeping current value.`,
			);
		}
	}

	console.log(
		`\n  Current Vendor number: ${existingCred.vendor_number || "(not set)"}`,
	);
	if (!existingCred.vendor_number) {
		console.log("  To find your vendor number:");
		console.log("    1. Go to https://appstoreconnect.apple.com/");
		console.log(
			"    2. Navigate to 'Sales and Trends' or 'Payments and Financial Reports'",
		);
		console.log(
			"    3. Your vendor number is displayed at the top (usually 8 digits)",
		);
	}
	const vendorInput = prompt(
		"  New Vendor number (Enter to keep, 'clear' to remove): ",
	);
	let vendorNumber = existingCred.vendor_number;
	if (vendorInput?.trim()) {
		vendorNumber =
			vendorInput.trim().toLowerCase() === "clear"
				? undefined
				: vendorInput.trim();
	}

	const updatedCred: StoredCredential = {
		...existingCred,
		key_id: keyId,
		issuer_id: issuerId,
		private_key_path: privateKeyPath,
		vendor_number: vendorNumber,
	};

	await upsertCredential(updatedCred);

	console.log("");
	printSuccess(`Credential "${existingCred.name}" updated successfully`);
}

export async function addCredentialInteractive(
	_ctx: CommandContext,
): Promise<void> {
	console.log("\n  App Store Connect API Credentials Setup\n");
	console.log(
		"  Generate API keys at: https://appstoreconnect.apple.com/access/integrations/api\n",
	);

	const nameInput = prompt("  Profile name (default): ");
	const name = nameInput?.trim() || "default";

	let issuerId = "";
	while (!issuerId) {
		const issuerInput = prompt("  Issuer ID: ");
		if (issuerInput?.trim()) {
			issuerId = issuerInput.trim();
		} else {
			console.log("  Error: Issuer ID is required");
		}
	}

	let keyId = "";
	while (!keyId) {
		const keyInput = prompt("  Key ID: ");
		if (keyInput?.trim()) {
			keyId = keyInput.trim();
		} else {
			console.log("  Error: Key ID is required");
		}
	}

	let privateKeyPath = "";
	while (!privateKeyPath) {
		const pathInput = prompt("  Private key path (.p8 file): ");
		if (pathInput?.trim()) {
			const trimmedPath = pathInput.trim();
			const expandedPath = trimmedPath.startsWith("~")
				? trimmedPath.replace("~", process.env.HOME || "")
				: trimmedPath;

			try {
				await stat(expandedPath);
				privateKeyPath = expandedPath;
			} catch {
				console.log(`  Error: File not found: ${expandedPath}`);
			}
		} else {
			console.log("  Error: Private key path is required");
		}
	}

	console.log(
		"\n  Vendor Number (optional - required for sales/financial reports)",
	);
	console.log("  To find your vendor number:");
	console.log("    1. Go to https://appstoreconnect.apple.com/");
	console.log(
		"    2. Navigate to 'Sales and Trends' or 'Payments and Financial Reports'",
	);
	console.log(
		"    3. Your vendor number is displayed at the top (usually 8 digits)",
	);
	console.log(
		"  You can also add this later with: asc auth edit -n <profile> -v <vendor>\n",
	);

	const vendorInput = prompt("  Vendor number (press Enter to skip): ");
	const vendorNumber = vendorInput?.trim() || undefined;

	const existingCreds = await listCredentials();
	let isDefault = existingCreds.length === 0;
	if (existingCreds.length > 0) {
		const defaultInput = prompt("  Set as default profile? (y/N): ");
		isDefault =
			defaultInput?.toLowerCase() === "y" ||
			defaultInput?.toLowerCase() === "yes";
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

	console.log("");
	printSuccess(`Credential "${name}" added successfully`);
	if (isDefault) {
		printInfo("Set as default profile");
	}
	if (vendorNumber) {
		printInfo(`Vendor number: ${vendorNumber}`);
	}

	console.log("\n  You can now use the CLI. Try: asc apps list\n");
}
