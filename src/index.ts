#!/usr/bin/env bun
import { registerAppsCommands } from "./cli/commands/apps";
import { registerAuthCommands } from "./cli/commands/auth";
import { registerBuildsCommands } from "./cli/commands/builds";
import { registerBundleIdsCommands } from "./cli/commands/bundleids";
import { registerCertificatesCommands } from "./cli/commands/certificates";
import { registerDevicesCommands } from "./cli/commands/devices";
import { registerIapCommands } from "./cli/commands/iap";
import { registerProfilesCommands } from "./cli/commands/profiles";
import { registerSubscriptionsCommands } from "./cli/commands/subscriptions";
import { registerTestflightCommands } from "./cli/commands/testflight";
import { registerUsersCommands } from "./cli/commands/users";
import { registerVersionsCommands } from "./cli/commands/versions";
/**
 * App Store Connect CLI
 * Main entry point
 */
import { getGlobalOptions, parseArgs } from "./cli/parser";
import { registry, routeCommand } from "./cli/router";

// Register all commands
registerAuthCommands();
registerAppsCommands();
registerBuildsCommands();
registerVersionsCommands();
registerTestflightCommands();
registerCertificatesCommands();
registerProfilesCommands();
registerBundleIdsCommands();
registerDevicesCommands();
registerUsersCommands();
registerIapCommands();
registerSubscriptionsCommands();

// Parse arguments and run
async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	const global = getGlobalOptions(args.options);

	await routeCommand(args, global);
}

// Run
main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
