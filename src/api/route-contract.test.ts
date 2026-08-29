import { describe, expect, test } from "bun:test";
import routeContract from "../../spec/api-4.4.1-routes.json";
import {
	DEPRECATED_API_ROUTES,
	extractRoutesFromSource,
	routeKey,
	uniqueRoutes,
} from "./route-contract";
import type { ApiRoute } from "./route-contract-types";

describe("App Store Connect API route contract", () => {
	test("uses the pinned 4.4.1 contract metadata", () => {
		expect(routeContract.apiVersion).toBe("4.4.1");
		expect(routeContract.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
	});

	test("normalizes source routes without missing the modern IAP endpoint", () => {
		const routes = uniqueRoutes(
			extractRoutesFromSource(
				'client.get(`/v1/apps/${"app"}/inAppPurchasesV2?limit=50`);',
			),
		);
		expect(routes).toEqual([
			{ method: "GET", path: "/v1/apps/{id}/inAppPurchasesV2" },
		]);
	});

	test("keeps the deprecated route denylist explicit", () => {
		expect(DEPRECATED_API_ROUTES).toContain(
			"POST /v1/inAppPurchaseSubmissions",
		);
		expect(DEPRECATED_API_ROUTES).toContain(
			"POST /v1/subscriptionAvailabilities",
		);
	});

	test("contains every route needed by the new resource flows", () => {
		const routes = new Set(
			routeContract.routes.map((route) => routeKey(route as ApiRoute)),
		);
		for (const route of [
			"GET /v1/subscriptions/{id}/versions",
			"POST /v1/reviewSubmissions",
			"POST /v1/buildUploads",
			"POST /v1/buildUploadFiles",
			"POST /v2/inAppPurchaseLocalizations",
		]) {
			expect(routes.has(route)).toBe(true);
		}
	});
});
