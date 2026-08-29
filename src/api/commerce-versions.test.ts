import { describe, expect, test } from "bun:test";
import type { Client } from "./client";
import {
	createCommerceVersion,
	getCommerceVersion,
	ownerVersionsPath,
	resolveCommerceVersion,
} from "./commerce-versions";

function fakeClient(responses: Record<string, unknown>) {
	const calls: Array<{ method: string; path: string; body?: unknown }> = [];
	const client = {
		get: async (path: string) => {
			calls.push({ method: "GET", path });
			if (!(path in responses)) throw new Error(`Unexpected GET ${path}`);
			return responses[path];
		},
		post: async (path: string, body: unknown) => {
			calls.push({ method: "POST", path, body });
			if (!(path in responses)) throw new Error(`Unexpected POST ${path}`);
			return responses[path];
		},
	};
	return { client: client as unknown as Client, calls };
}

function version(
	id: string,
	number: number,
	state: "PREPARE_FOR_SUBMISSION" | "READY_FOR_REVIEW" | "APPROVED",
) {
	return {
		type: "subscriptionVersions" as const,
		id,
		attributes: { version: number, state },
	};
}

describe("commerce version API helpers", () => {
	test("uses the current owner relationship routes", () => {
		expect(ownerVersionsPath("iap", "iap-1")).toBe(
			"/v2/inAppPurchases/iap-1/versions?limit=200",
		);
		expect(ownerVersionsPath("subscription", "sub-1", 25)).toBe(
			"/v1/subscriptions/sub-1/versions?limit=25",
		);
		expect(ownerVersionsPath("subscription-group", "group-1")).toBe(
			"/v1/subscriptionGroups/group-1/versions?limit=200",
		);
	});

	test("resolves the highest editable version instead of an approved version", async () => {
		const versions = [
			version("approved", 9, "APPROVED"),
			version("editable", 8, "READY_FOR_REVIEW"),
			version("older", 7, "PREPARE_FOR_SUBMISSION"),
		];
		const { client, calls } = fakeClient({
			"/v1/subscriptions/sub-1/versions?limit=200": { data: versions },
		});

		const result = await resolveCommerceVersion(
			client,
			"subscription",
			"sub-1",
			undefined,
			true,
		);

		expect(result.id).toBe("editable");
		expect(calls).toEqual([
			{
				method: "GET",
				path: "/v1/subscriptions/sub-1/versions?limit=200",
			},
		]);
	});

	test("uses an explicit version ID without listing the owner", async () => {
		const { client, calls } = fakeClient({
			"/v1/subscriptionVersions/version-1": {
				data: version("version-1", 2, "READY_FOR_REVIEW"),
			},
		});

		const result = await resolveCommerceVersion(
			client,
			"subscription",
			"sub-1",
			"version-1",
			true,
		);

		expect(result.id).toBe("version-1");
		expect(calls).toEqual([
			{ method: "GET", path: "/v1/subscriptionVersions/version-1" },
		]);
	});

	test("requires an editable version for mutations", async () => {
		const { client } = fakeClient({
			"/v1/subscriptions/sub-1/versions?limit=200": {
				data: [version("approved", 1, "APPROVED")],
			},
		});

		await expect(
			resolveCommerceVersion(client, "subscription", "sub-1", undefined, true),
		).rejects.toThrow("No editable subscription version found");
	});

	test("creates a version using the official relationship type", async () => {
		const created = {
			data: {
				type: "inAppPurchaseVersions",
				id: "version-1",
				attributes: { version: 1, state: "PREPARE_FOR_SUBMISSION" },
			},
		};
		const { client, calls } = fakeClient({
			"/v1/inAppPurchaseVersions": created,
		});

		const result = await createCommerceVersion(client, "iap", "iap-1");

		expect(result.id).toBe("version-1");
		expect(calls[0]).toEqual({
			method: "POST",
			path: "/v1/inAppPurchaseVersions",
			body: {
				data: {
					type: "inAppPurchaseVersions",
					relationships: {
						inAppPurchase: {
							data: { type: "inAppPurchases", id: "iap-1" },
						},
					},
				},
			},
		});
	});

	test("gets a version through its v1 resource path", async () => {
		const { client, calls } = fakeClient({
			"/v1/subscriptionGroupVersions/group-version-1": {
				data: {
					type: "subscriptionGroupVersions",
					id: "group-version-1",
					attributes: { version: 1, state: "READY_FOR_REVIEW" },
				},
			},
		});

		const result = await getCommerceVersion(
			client,
			"subscription-group",
			"group-version-1",
		);

		expect(result.id).toBe("group-version-1");
		expect(calls[0]?.path).toBe(
			"/v1/subscriptionGroupVersions/group-version-1",
		);
	});
});
