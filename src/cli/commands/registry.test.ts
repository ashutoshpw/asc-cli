import { describe, expect, test } from "bun:test";
import { registry } from "../router";
import { registerAnalyticsCommands } from "./analytics";
import { registerAppsCommands } from "./apps";
import { registerAuthCommands } from "./auth";
import { registerBuildsCommands } from "./builds";
import { registerBundleIdsCommands } from "./bundleids";
import { registerCertificatesCommands } from "./certificates";
import { registerDevicesCommands } from "./devices";
import { registerIapCommands } from "./iap";
import { registerProfilesCommands } from "./profiles";
import { registerReviewsCommands } from "./reviews";
import { registerSubscriptionsCommands } from "./subscriptions";
import { registerTestflightCommands } from "./testflight";
import { registerUsersCommands } from "./users";
import { registerVersionsCommands } from "./versions";

describe("CLI command registry", () => {
	test("registers every supported top-level command", () => {
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
		registerAnalyticsCommands();
		registerReviewsCommands();

		const expectedNames = [
			"analytics",
			"apps",
			"auth",
			"builds",
			"bundle-ids",
			"certificates",
			"devices",
			"iap",
			"profiles",
			"reviews",
			"subscriptions",
			"testflight",
			"users",
			"versions",
		];

		for (const name of expectedNames) {
			expect(registry.get(name)).toBeDefined();
		}
	});

	test("exposes executable leaf commands", () => {
		for (const command of registry.all()) {
			expect(command.description.length).toBeGreaterThan(0);
			expect(command.subcommands || command.execute).toBeTruthy();
		}
	});
});
