import {
	defaultRetryOptions,
	isRetryableStatus,
	parseRetryAfter,
	type RetryOptions,
	withRetry,
} from "../utils/retry";

import {
	createAnalyticsReportRequest,
	downloadAnalyticsReport as downloadAnalyticsReportFromUrl,
	getAnalyticsReportInstances,
	getAnalyticsReportRequest,
	getAnalyticsReportRequests,
	getAnalyticsReportSegments,
	getAnalyticsReports,
} from "./analytics";
import { uploadBinary as uploadBinaryToUrl } from "./binary-upload";
import {
	APP_STORE_CONNECT_BASE_URL,
	AppStoreConnectError,
	type BinaryUploadOperation,
	type ClientConfig,
	type RequestOptions,
} from "./client-types";
/**
 * App Store Connect API Client
 * Handles HTTP requests with JWT auth, retry logic, and error handling
 */
import {
	decodePrivateKeyBase64,
	generateJWT,
	isValidPrivateKey,
	loadPrivateKey,
	tokenCache,
} from "./jwt";
import { logRequest, logResponse } from "./logging";
import type { ErrorResponse, ListResponse, Resource } from "./types/base";
import { isAppleHostedUrl } from "./url";

export type { ClientConfig, RequestOptions } from "./client-types";
export {
	APP_STORE_CONNECT_BASE_URL,
	AppStoreConnectError,
} from "./client-types";
export type {
	BinaryUploadOperation,
	UploadRequestHeader,
} from "./client-types";

/**
 * App Store Connect API Client
 */
export class Client {
	private readonly keyId: string;
	private readonly issuerId: string;
	private readonly privateKey: string;
	private readonly baseUrl: string;
	private readonly timeout: number;
	private readonly retryOptions: RetryOptions;
	private readonly debug: boolean;
	private readonly apiDebug: boolean;
	private readonly fetchImpl: typeof fetch;

	constructor(config: ClientConfig) {
		this.keyId = config.keyId;
		this.issuerId = config.issuerId;
		this.privateKey = config.privateKey;
		this.baseUrl = config.baseUrl || APP_STORE_CONNECT_BASE_URL;
		this.timeout = config.timeout || 90000;
		this.debug = config.debug || false;
		this.apiDebug = config.apiDebug || false;
		this.fetchImpl = config.fetchImpl || globalThis.fetch;

		this.retryOptions = {
			...defaultRetryOptions,
			maxRetries: config.maxRetries ?? defaultRetryOptions.maxRetries,
			baseDelay: config.baseDelay ?? defaultRetryOptions.baseDelay,
			maxDelay: config.maxDelay ?? defaultRetryOptions.maxDelay,
			jitter: config.jitter ?? defaultRetryOptions.jitter,
			onRetry: (attempt, error, delay) => {
				if (this.debug) {
					console.error(
						`[retry] Attempt ${attempt}, waiting ${delay}ms: ${error.message}`,
					);
				}
			},
		};

		// Validate private key
		if (!isValidPrivateKey(this.privateKey)) {
			throw new Error("Invalid private key format. Expected PEM format.");
		}
	}

	/**
	 * Create a client from credential sources
	 */
	static async fromCredentials(
		creds: {
			keyId: string;
			issuerId: string;
			privateKeyPath?: string;
			privateKey?: string;
			privateKeyBase64?: string;
		},
		options?: Partial<ClientConfig>,
	): Promise<Client> {
		let privateKey: string;

		if (creds.privateKey) {
			privateKey = creds.privateKey;
		} else if (creds.privateKeyBase64) {
			privateKey = decodePrivateKeyBase64(creds.privateKeyBase64);
		} else if (creds.privateKeyPath) {
			privateKey = await loadPrivateKey(creds.privateKeyPath);
		} else {
			throw new Error("No private key provided");
		}

		return new Client({
			keyId: creds.keyId,
			issuerId: creds.issuerId,
			privateKey,
			...options,
		});
	}

	/**
	 * Get JWT token (cached when possible)
	 */
	private async getToken(): Promise<string> {
		const cached = tokenCache.get(this.keyId, this.issuerId);
		if (cached) {
			return cached;
		}

		const token = await generateJWT(this.keyId, this.issuerId, this.privateKey);
		tokenCache.set(this.keyId, this.issuerId, token);
		return token;
	}

	/**
	 * Make an API request
	 */
	async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
		const method = options.method || "GET";
		const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;

		// Validate URL for security
		if (!isAppleHostedUrl(url)) {
			throw new Error(`Invalid URL: ${url}`);
		}

		const doRequest = async (): Promise<T> => {
			const token = await this.getToken();

			const headers: Record<string, string> = {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				Accept: "application/json",
				...options.headers,
			};

			const requestInit: RequestInit = {
				method,
				headers,
				signal: AbortSignal.timeout(options.timeout || this.timeout),
			};

			if (options.body) {
				requestInit.body = JSON.stringify(options.body);
			}

			if (this.apiDebug) {
				logRequest(method, url, options.body, this.debug);
			}

			const response: Response = await this.fetchImpl(url, requestInit);

			if (this.apiDebug) {
				logResponse(response);
			}

			// Handle non-JSON responses (like 204 No Content)
			if (response.status === 204) {
				return undefined as T;
			}

			// Parse response
			const contentType = response.headers.get("content-type");
			let data: unknown;

			if (contentType?.includes("application/json")) {
				data = await response.json();
			} else {
				data = await response.text();
			}

			// Handle errors
			if (!response.ok) {
				// Parse error response
				if (typeof data === "object" && data !== null && "errors" in data) {
					throw new AppStoreConnectError(
						response.status,
						(data as ErrorResponse).errors,
						undefined,
						isRetryableStatus(response.status) && method === "GET"
							? parseRetryAfter(response.headers.get("Retry-After"))
							: undefined,
					);
				}

				throw new AppStoreConnectError(
					response.status,
					[
						{
							status: String(response.status),
							code: "UNKNOWN",
							title: String(data),
						},
					],
					undefined,
					isRetryableStatus(response.status) && method === "GET"
						? parseRetryAfter(response.headers.get("Retry-After"))
						: undefined,
				);
			}

			return data as T;
		};

		// Use retry logic for GET requests
		if (method === "GET") {
			return withRetry(doRequest, this.retryOptions);
		}

		return doRequest();
	}

	/**
	 * GET request
	 */
	async get<T>(
		path: string,
		options?: Omit<RequestOptions, "method">,
	): Promise<T> {
		return this.request<T>(path, { ...options, method: "GET" });
	}

	/**
	 * POST request
	 */
	async post<T>(
		path: string,
		body?: unknown,
		options?: Omit<RequestOptions, "method" | "body">,
	): Promise<T> {
		return this.request<T>(path, { ...options, method: "POST", body });
	}

	/**
	 * PATCH request
	 */
	async patch<T>(
		path: string,
		body?: unknown,
		options?: Omit<RequestOptions, "method" | "body">,
	): Promise<T> {
		return this.request<T>(path, { ...options, method: "PATCH", body });
	}

	/**
	 * DELETE request
	 */
	async delete<T = void>(
		path: string,
		body?: unknown,
		options?: Omit<RequestOptions, "method" | "body">,
	): Promise<T> {
		return this.request<T>(path, { ...options, method: "DELETE", body });
	}

	/**
	 * Upload one binary operation to an App Store Connect signed URL.
	 *
	 * The URL is supplied by the API. It is intentionally handled separately
	 * from request() so a JWT and JSON content headers can never be attached to
	 * the delivery request.
	 */
	async uploadBinary(
		operation: BinaryUploadOperation,
		body: Uint8Array,
		options: { timeout?: number } = {},
	): Promise<Response> {
		return uploadBinaryToUrl(
			{
				fetchImpl: this.fetchImpl,
				timeout: this.timeout,
				retryOptions: this.retryOptions,
				debug: this.debug,
				apiDebug: this.apiDebug,
			},
			operation,
			body,
			options,
		);
	}

	/**
	 * Fetch all pages of a paginated endpoint
	 */
	async paginate<T>(path: string): Promise<Resource<T>[]> {
		const results: Resource<T>[] = [];
		let nextUrl: string | undefined = path;

		while (nextUrl) {
			const response: ListResponse<T> =
				await this.get<ListResponse<T>>(nextUrl);
			results.push(...response.data);
			nextUrl = response.links?.next;
		}

		return results;
	}

	/**
	 * Download sales report as a gzip stream
	 */
	async downloadSalesReport(params: {
		vendorNumber: string;
		reportType: string;
		reportSubType: string;
		frequency: string;
		reportDate: string;
		version: string;
	}): Promise<ReadableStream> {
		const queryParams = new URLSearchParams({
			"filter[vendorNumber]": params.vendorNumber,
			"filter[reportType]": params.reportType,
			"filter[reportSubType]": params.reportSubType,
			"filter[frequency]": params.frequency,
			"filter[reportDate]": params.reportDate,
			"filter[version]": params.version,
		});

		const path = `/v1/salesReports?${queryParams.toString()}`;
		const url = `${this.baseUrl}${path}`;
		const token = await this.getToken();

		const headers: Record<string, string> = {
			Authorization: `Bearer ${token}`,
			Accept: "application/a-gzip",
		};

		if (this.apiDebug) {
			logRequest("GET", url, undefined, this.debug);
		}

		const response = await this.fetchImpl(url, {
			method: "GET",
			headers,
		});

		if (this.apiDebug) {
			logResponse(response);
		}

		if (!response.ok) {
			throw new AppStoreConnectError(response.status, [
				{
					status: String(response.status),
					code: "SALES_REPORT_ERROR",
					title: `Failed to download sales report: ${response.statusText}`,
				},
			]);
		}

		if (!response.body) {
			throw new AppStoreConnectError(500, [
				{
					status: "500",
					code: "NO_RESPONSE_BODY",
					title: "No response body received",
				},
			]);
		}

		return response.body;
	}

	async createAnalyticsReportRequest(
		appId: string,
		accessType: "ONGOING" | "ONE_TIME_SNAPSHOT",
	) {
		return createAnalyticsReportRequest(this, appId, accessType);
	}

	async getAnalyticsReportRequests(appId: string) {
		return getAnalyticsReportRequests(this, appId);
	}

	async getAnalyticsReportRequest(requestId: string) {
		return getAnalyticsReportRequest(this, requestId);
	}

	async getAnalyticsReports(requestId: string) {
		return getAnalyticsReports(this, requestId);
	}

	async getAnalyticsReportInstances(reportId: string) {
		return getAnalyticsReportInstances(this, reportId);
	}

	async getAnalyticsReportSegments(instanceId: string) {
		return getAnalyticsReportSegments(this, instanceId);
	}

	async downloadAnalyticsReport(downloadUrl: string) {
		return downloadAnalyticsReportFromUrl(this.fetchImpl, downloadUrl);
	}
}

// Export a function to create the client (will be initialized with credentials)
export type { ListResponse, Resource, SingleResponse } from "./types/base";
