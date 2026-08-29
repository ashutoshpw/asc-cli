import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { exportPKCS8, generateKeyPair } from "jose";
import { AppStoreConnectError, Client, type RequestOptions } from "./client";
import { tokenCache } from "./jwt";

type FetchHandler = (
	url: string,
	init?: RequestInit,
) => Response | Promise<Response>;

let privateKey: string;

beforeAll(async () => {
	const keyPair = await generateKeyPair("ES256", { extractable: true });
	privateKey = await exportPKCS8(keyPair.privateKey);
});

beforeEach(() => {
	tokenCache.clear();
});

function jsonResponse(
	body: unknown,
	status = 200,
	extraHeaders: Record<string, string> = {},
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json",
			...extraHeaders,
		},
	});
}

function makeClient(
	handler: FetchHandler,
	options: Partial<RequestOptions> & {
		maxRetries?: number;
		baseDelay?: number;
		maxDelay?: number;
		jitter?: boolean;
	} = {},
): { client: Client; calls: Array<{ url: string; init?: RequestInit }> } {
	const calls: Array<{ url: string; init?: RequestInit }> = [];
	const fetchImpl = (async (
		input: string | URL | Request,
		init?: RequestInit,
	) => {
		const url = String(input);
		calls.push({ url, init });
		return handler(url, init);
	}) as unknown as typeof fetch;

	return {
		client: new Client({
			keyId: "KEY123",
			issuerId: "ISSUER123",
			privateKey,
			fetchImpl,
			maxRetries: options.maxRetries,
			baseDelay: options.baseDelay,
			maxDelay: options.maxDelay,
			jitter: options.jitter,
		}),
		calls,
	};
}

describe("App Store Connect client", () => {
	test("sends authenticated JSON requests through the injected fetch", async () => {
		const { client, calls } = makeClient(async () =>
			jsonResponse({ data: [{ id: "app-1" }] }),
		);

		const response = await client.get<{ data: unknown[] }>("/v1/apps?limit=1");

		expect(response.data).toEqual([{ id: "app-1" }]);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe(
			"https://api.appstoreconnect.apple.com/v1/apps?limit=1",
		);
		const headers = calls[0]?.init?.headers as Record<string, string>;
		expect(headers.Authorization).toMatch(/^Bearer /);
		expect(headers.Accept).toBe("application/json");
		expect(headers["Content-Type"]).toBe("application/json");
	});

	test("serializes request bodies and handles 204 responses", async () => {
		const { client, calls } = makeClient(
			async () => new Response(null, { status: 204 }),
		);

		const result = await client.post("/v1/apps", { data: { type: "apps" } });

		expect(result).toBeUndefined();
		expect(calls[0]?.init?.method).toBe("POST");
		expect(calls[0]?.init?.body).toBe(
			JSON.stringify({ data: { type: "apps" } }),
		);
	});

	test("creates analytics requests with the expected JSON API body", async () => {
		const { client, calls } = makeClient(async () =>
			jsonResponse({
				data: {
					type: "analyticsReportRequests",
					id: "request-1",
					attributes: { accessType: "ONGOING" },
				},
			}),
		);

		const response = await client.createAnalyticsReportRequest(
			"app-1",
			"ONGOING",
		);

		expect(response.data.id).toBe("request-1");
		expect(calls[0]?.init?.method).toBe("POST");
		expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
			data: {
				type: "analyticsReportRequests",
				attributes: { accessType: "ONGOING" },
				relationships: { app: { data: { type: "apps", id: "app-1" } } },
			},
		});
	});

	test("types analytics list endpoints and downloads sales streams", async () => {
		let requestCount = 0;
		const { client } = makeClient(async (url) => {
			requestCount++;
			if (url.includes("salesReports")) {
				return new Response("sales-gzip", { status: 200 });
			}
			if (url.includes("analyticsReportRequests/req-1/reports")) {
				return jsonResponse({ data: [] });
			}
			return jsonResponse({ data: [] });
		});

		const reports = await client.getAnalyticsReports("req-1");
		const stream = await client.downloadSalesReport({
			vendorNumber: "123",
			reportType: "SALES",
			reportSubType: "SUMMARY",
			frequency: "DAILY",
			reportDate: "2024-01-01",
			version: "1_0",
		});

		expect(reports.data).toEqual([]);
		expect(await new Response(stream).text()).toBe("sales-gzip");
		expect(requestCount).toBe(2);
	});

	test("turns JSON API errors into AppStoreConnectError", async () => {
		const { client } = makeClient(async () =>
			jsonResponse(
				{
					errors: [
						{
							status: "400",
							code: "INVALID_QUERY",
							title: "Invalid query",
							detail: "The query is invalid",
						},
					],
				},
				400,
			),
		);

		const error = await client.get("/v1/apps").catch((value) => value);

		expect(error).toBeInstanceOf(AppStoreConnectError);
		expect(error).toMatchObject({
			status: 400,
			code: "INVALID_QUERY",
			message: "The query is invalid",
		});
	});

	test("retries retryable GET responses and returns the eventual result", async () => {
		let attempts = 0;
		const { client } = makeClient(
			async () => {
				attempts++;
				if (attempts < 3) {
					return jsonResponse({ errors: [] }, 503);
				}
				return jsonResponse({ data: [] });
			},
			{ maxRetries: 2, baseDelay: 0, maxDelay: 0, jitter: false },
		);

		expect(await client.get<{ data: unknown[] }>("/v1/apps")).toEqual({
			data: [],
		});
		expect(attempts).toBe(3);
	});

	test("does not retry retryable responses for mutations", async () => {
		let attempts = 0;
		const { client } = makeClient(
			async () => {
				attempts++;
				return jsonResponse({ errors: [] }, 503);
			},
			{ maxRetries: 3, baseDelay: 0, maxDelay: 0, jitter: false },
		);

		await expect(client.post("/v1/apps", {})).rejects.toMatchObject({
			status: 503,
		});
		expect(attempts).toBe(1);
	});

	test("does not expose non-JSON error payloads as raw values", async () => {
		const { client } = makeClient(
			async () => new Response("service unavailable", { status: 503 }),
			{ maxRetries: 0, baseDelay: 0, maxDelay: 0, jitter: false },
		);

		await expect(client.get("/v1/apps")).rejects.toMatchObject({
			status: 503,
			code: "UNKNOWN",
		});
	});

	test("follows pagination links", async () => {
		const requestedUrls: string[] = [];
		const { client } = makeClient(async (url) => {
			requestedUrls.push(url);
			if (requestedUrls.length === 1) {
				return jsonResponse({
					data: [{ id: "1", type: "apps", attributes: { name: "One" } }],
					links: { next: "https://api.appstoreconnect.apple.com/page-2" },
				});
			}
			return jsonResponse({
				data: [{ id: "2", type: "apps", attributes: { name: "Two" } }],
			});
		});

		const result = await client.paginate<{ name: string }>("/v1/apps");

		expect(result.map((item) => item.id)).toEqual(["1", "2"]);
		expect(requestedUrls).toEqual([
			"https://api.appstoreconnect.apple.com/v1/apps",
			"https://api.appstoreconnect.apple.com/page-2",
		]);
	});

	test("rejects insecure or non-Apple URLs before sending credentials", async () => {
		const { client, calls } = makeClient(async () => jsonResponse({}));

		await expect(
			client.get("http://api.appstoreconnect.apple.com/v1/apps"),
		).rejects.toThrow("Invalid URL");
		expect(calls).toHaveLength(0);

		await expect(client.get("https://example.com/v1/apps")).rejects.toThrow(
			"Invalid URL",
		);
		expect(calls).toHaveLength(0);
	});

	test("downloads signed analytics streams with the injected fetch", async () => {
		const { client, calls } = makeClient(
			async () => new Response("report-data", { status: 200 }),
		);

		const stream = await client.downloadAnalyticsReport(
			"https://is1-ssl.mzstatic.com/report.csv?signature=secret",
		);
		const body = await new Response(stream).text();

		expect(body).toBe("report-data");
		expect(calls[0]?.url).toContain("signature=secret");
	});

	test("rejects signed downloads without a response body", async () => {
		const { client } = makeClient(
			async () => new Response(null, { status: 200 }),
		);

		await expect(
			client.downloadAnalyticsReport("https://is1-ssl.mzstatic.com/empty"),
		).rejects.toMatchObject({ code: "NO_RESPONSE_BODY" });
	});
});
