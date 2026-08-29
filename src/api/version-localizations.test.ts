import { describe, expect, test } from "bun:test";
import type { Client } from "./client";
import {
	createVersionLocalization,
	deleteVersionLocalization,
	listVersionLocalizations,
	updateVersionLocalization,
	versionLocalizationsPath,
} from "./version-localizations";

function fakeClient() {
	const calls: Array<{ method: string; path: string; body?: unknown }> = [];
	const response = {
		data: {
			type: "inAppPurchaseLocalizations",
			id: "loc-1",
			attributes: { name: "Name", locale: "en-US" },
		},
	};
	const client = {
		get: async (path: string) => {
			calls.push({ method: "GET", path });
			return response;
		},
		post: async (path: string, body: unknown) => {
			calls.push({ method: "POST", path, body });
			return response;
		},
		patch: async (path: string, body: unknown) => {
			calls.push({ method: "PATCH", path, body });
			return response;
		},
		delete: async (path: string) => {
			calls.push({ method: "DELETE", path });
		},
	};
	return { client: client as unknown as Client, calls };
}

describe("version localization API helpers", () => {
	test("builds version-scoped list paths for all commerce resources", () => {
		expect(versionLocalizationsPath("iap", "iap-version")).toBe(
			"/v1/inAppPurchaseVersions/iap-version/localizations?limit=50",
		);
		expect(versionLocalizationsPath("subscription", "sub-version", 25)).toBe(
			"/v1/subscriptionVersions/sub-version/localizations?limit=25",
		);
		expect(
			versionLocalizationsPath("subscription-group", "group-version", 300),
		).toBe(
			"/v1/subscriptionGroupVersions/group-version/localizations?limit=200",
		);
	});

	test("creates, updates, lists, and deletes v2 localizations", async () => {
		const { client, calls } = fakeClient();

		await listVersionLocalizations(client, "iap", "version-1");
		await createVersionLocalization(client, "iap", "version-1", {
			name: "Name",
			locale: "en-US",
			description: "Description",
		});
		await updateVersionLocalization(client, "iap", "loc-1", {
			name: "Updated",
		});
		await deleteVersionLocalization(client, "iap", "loc-1");

		expect(calls.map(({ method, path }) => `${method} ${path}`)).toEqual([
			"GET /v1/inAppPurchaseVersions/version-1/localizations?limit=50",
			"POST /v2/inAppPurchaseLocalizations",
			"PATCH /v2/inAppPurchaseLocalizations/loc-1",
			"DELETE /v2/inAppPurchaseLocalizations/loc-1",
		]);
		expect(calls[1]?.body).toEqual({
			data: {
				type: "inAppPurchaseLocalizations",
				attributes: {
					name: "Name",
					locale: "en-US",
					description: "Description",
				},
				relationships: {
					version: {
						data: { type: "inAppPurchaseVersions", id: "version-1" },
					},
				},
			},
		});
	});
});
