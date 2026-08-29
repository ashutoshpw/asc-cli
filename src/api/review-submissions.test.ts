import { describe, expect, test } from "bun:test";
import type { Client } from "./client";
import { submitCommerceVersionForReview } from "./review-submissions";

function resource(
	type: string,
	id: string,
	attributes: Record<string, unknown> = {},
	relationships?: Record<string, unknown>,
) {
	return { type, id, attributes, ...(relationships ? { relationships } : {}) };
}

function fakeClient(responses: Record<string, unknown>) {
	const calls: Array<{ method: string; path: string; body?: unknown }> = [];
	const request = async (method: string, path: string, body?: unknown) => {
		calls.push({ method, path, ...(body === undefined ? {} : { body }) });
		const key = `${method} ${path}`;
		if (!(key in responses)) throw new Error(`Unexpected ${key}`);
		return responses[key];
	};
	const client = {
		get: (path: string) => request("GET", path),
		post: (path: string, body: unknown) => request("POST", path, body),
		patch: (path: string, body: unknown) => request("PATCH", path, body),
	};
	return { client: client as unknown as Client, calls };
}

describe("review submission workflows", () => {
	test("reuses an existing item and submits an explicit ready submission", async () => {
		const { client, calls } = fakeClient({
			"GET /v1/subscriptionVersions/version-1": {
				data: resource("subscriptionVersions", "version-1", {
					version: 2,
					state: "READY_FOR_REVIEW",
				}),
			},
			"GET /v1/reviewSubmissions/submission-1": {
				data: resource("reviewSubmissions", "submission-1", {
					state: "READY_FOR_REVIEW",
				}),
			},
			"GET /v1/reviewSubmissions/submission-1/items?limit=200": {
				data: [
					resource(
						"reviewSubmissionItems",
						"item-1",
						{},
						{
							subscriptionVersion: {
								data: { type: "subscriptionVersions", id: "version-1" },
							},
						},
					),
				],
			},
			"PATCH /v1/reviewSubmissions/submission-1": {
				data: resource("reviewSubmissions", "submission-1", {
					state: "WAITING_FOR_REVIEW",
				}),
			},
		});

		const result = await submitCommerceVersionForReview(client, {
			kind: "subscription",
			ownerId: "subscription-1",
			versionId: "version-1",
			submissionId: "submission-1",
		});

		expect(result.versionId).toBe("version-1");
		expect(result.item.id).toBe("item-1");
		expect(result.submission.attributes?.state).toBe("WAITING_FOR_REVIEW");
		expect(calls.map(({ method, path }) => `${method} ${path}`)).toEqual([
			"GET /v1/subscriptionVersions/version-1",
			"GET /v1/reviewSubmissions/submission-1",
			"GET /v1/reviewSubmissions/submission-1/items?limit=200",
			"PATCH /v1/reviewSubmissions/submission-1",
		]);
		expect(calls[3]?.body).toEqual({
			data: {
				type: "reviewSubmissions",
				id: "submission-1",
				attributes: { submitted: true },
			},
		});
	});

	test("uses the app override, creates a submission, and adds a missing IAP item", async () => {
		const { client, calls } = fakeClient({
			"GET /v2/inAppPurchases/iap-1/versions?limit=200": {
				data: [
					resource("inAppPurchaseVersions", "iap-version-1", {
						version: 1,
						state: "PREPARE_FOR_SUBMISSION",
					}),
				],
			},
			"GET /v1/apps/app-1/reviewSubmissions?limit=200": { data: [] },
			"POST /v1/reviewSubmissions": {
				data: resource("reviewSubmissions", "submission-2", {
					state: "READY_FOR_REVIEW",
				}),
			},
			"GET /v1/reviewSubmissions/submission-2/items?limit=200": { data: [] },
			"POST /v1/reviewSubmissionItems": {
				data: resource("reviewSubmissionItems", "item-2"),
			},
			"PATCH /v1/reviewSubmissions/submission-2": {
				data: resource("reviewSubmissions", "submission-2", {
					state: "WAITING_FOR_REVIEW",
				}),
			},
		});

		const result = await submitCommerceVersionForReview(client, {
			kind: "iap",
			ownerId: "iap-1",
			appId: "app-1",
			platform: "IOS",
		});

		expect(result.item.id).toBe("item-2");
		expect(calls.map(({ method, path }) => `${method} ${path}`)).toEqual([
			"GET /v2/inAppPurchases/iap-1/versions?limit=200",
			"GET /v1/apps/app-1/reviewSubmissions?limit=200",
			"POST /v1/reviewSubmissions",
			"GET /v1/reviewSubmissions/submission-2/items?limit=200",
			"POST /v1/reviewSubmissionItems",
			"PATCH /v1/reviewSubmissions/submission-2",
		]);
		expect(calls[2]?.body).toEqual({
			data: {
				type: "reviewSubmissions",
				attributes: { platform: "IOS" },
				relationships: {
					app: { data: { type: "apps", id: "app-1" } },
				},
			},
		});
		expect(calls[4]?.body).toEqual({
			data: {
				type: "reviewSubmissionItems",
				relationships: {
					reviewSubmission: {
						data: { type: "reviewSubmissions", id: "submission-2" },
					},
					inAppPurchaseVersion: {
						data: {
							type: "inAppPurchaseVersions",
							id: "iap-version-1",
						},
					},
				},
			},
		});
	});

	test("requires an app when it must find or create a submission", async () => {
		const { client, calls } = fakeClient({
			"GET /v2/inAppPurchases/iap-1/versions?limit=200": {
				data: [
					resource("inAppPurchaseVersions", "iap-version-1", {
						version: 1,
						state: "PREPARE_FOR_SUBMISSION",
					}),
				],
			},
		});

		await expect(
			submitCommerceVersionForReview(client, {
				kind: "iap",
				ownerId: "iap-1",
			}),
		).rejects.toThrow("--app is required");
		expect(calls).toHaveLength(1);
	});
});
