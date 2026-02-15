import {
	type RetryOptions,
	calculateDelay,
	defaultRetryOptions,
	isRetryableStatus,
	parseRetryAfter,
	withRetry,
} from "../utils/retry";
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
import type {
	ErrorResponse,
	ListResponse,
	Resource,
	SingleResponse,
} from "./types/base";

const BASE_URL = "https://api.appstoreconnect.apple.com";

export interface ClientConfig {
	keyId: string;
	issuerId: string;
	privateKey: string;

	// Optional overrides
	baseUrl?: string;
	timeout?: number;
	maxRetries?: number;
	debug?: boolean;
	apiDebug?: boolean;
}

export interface RequestOptions {
	method?: "GET" | "POST" | "PATCH" | "DELETE";
	body?: unknown;
	headers?: Record<string, string>;
	timeout?: number;
}

/**
 * API Error with status code and details
 */
export class AppStoreConnectError extends Error {
	constructor(
		public readonly status: number,
		public readonly errors: ErrorResponse["errors"],
		message?: string,
	) {
		super(message || errors.map((e) => e.detail || e.title).join("; "));
		this.name = "AppStoreConnectError";
	}

	/**
	 * Get the first error code
	 */
	get code(): string {
		return this.errors[0]?.code || "UNKNOWN";
	}

	/**
	 * Check if error is a rate limit error
	 */
	get isRateLimited(): boolean {
		return this.status === 429;
	}

	/**
	 * Check if error is an auth error
	 */
	get isAuthError(): boolean {
		return this.status === 401 || this.status === 403;
	}

	/**
	 * Check if error is a not found error
	 */
	get isNotFound(): boolean {
		return this.status === 404;
	}
}

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

	constructor(config: ClientConfig) {
		this.keyId = config.keyId;
		this.issuerId = config.issuerId;
		this.privateKey = config.privateKey;
		this.baseUrl = config.baseUrl || BASE_URL;
		this.timeout = config.timeout || 90000;
		this.debug = config.debug || false;
		this.apiDebug = config.apiDebug || false;

		this.retryOptions = {
			...defaultRetryOptions,
			maxRetries: config.maxRetries ?? defaultRetryOptions.maxRetries,
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
		tokenCache.set(token);
		return token;
	}

	/**
	 * Make an API request
	 */
	async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
		const method = options.method || "GET";
		const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;

		// Validate URL for security
		if (!this.isValidUrl(url)) {
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
				this.logRequest(method, url, options.body);
			}

			const response = await fetch(url, requestInit);

			if (this.apiDebug) {
				this.logResponse(response);
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
				// Check if we should retry
				if (isRetryableStatus(response.status) && method === "GET") {
					const retryAfter = parseRetryAfter(
						response.headers.get("Retry-After"),
					);
					const error = new Error(
						`Request failed with status ${response.status}`,
					);
					(error as Error & { retryAfter?: number }).retryAfter = retryAfter;
					throw error;
				}

				// Parse error response
				if (typeof data === "object" && data !== null && "errors" in data) {
					throw new AppStoreConnectError(
						response.status,
						(data as ErrorResponse).errors,
					);
				}

				throw new AppStoreConnectError(response.status, [
					{
						status: String(response.status),
						code: "UNKNOWN",
						title: String(data),
					},
				]);
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
	 * Fetch all pages of a paginated endpoint
	 */
	async paginate<T>(path: string): Promise<Resource<T>[]> {
		const results: Resource<T>[] = [];
		let nextUrl: string | undefined = path;

		while (nextUrl) {
			const response = await this.get<ListResponse<T>>(nextUrl);
			results.push(...response.data);
			nextUrl = response.links?.next;
		}

		return results;
	}

	/**
	 * Validate URL to prevent credential exfiltration
	 */
	private isValidUrl(url: string): boolean {
		try {
			const parsed = new URL(url);
			const validHosts = [
				"api.appstoreconnect.apple.com",
				"is1-ssl.mzstatic.com",
				"is2-ssl.mzstatic.com",
				"is3-ssl.mzstatic.com",
				"is4-ssl.mzstatic.com",
				"is5-ssl.mzstatic.com",
			];

			// Allow Apple domains
			if (validHosts.includes(parsed.hostname)) {
				return true;
			}

			// Allow signed URLs for analytics/assets
			if (
				parsed.hostname.endsWith(".apple.com") ||
				parsed.hostname.endsWith(".mzstatic.com")
			) {
				return true;
			}

			return false;
		} catch {
			return false;
		}
	}

	/**
	 * Log request (debug mode)
	 */
	private logRequest(method: string, url: string, body?: unknown): void {
		console.error(`[http] ${method} ${this.redactUrl(url)}`);
		if (body && this.debug) {
			console.error(`[http] Body: ${JSON.stringify(body, null, 2)}`);
		}
	}

	/**
	 * Log response (debug mode)
	 */
	private logResponse(response: Response): void {
		console.error(`[http] ${response.status} ${response.statusText}`);
	}

	/**
	 * Redact sensitive query parameters from URL
	 */
	private redactUrl(url: string): string {
		try {
			const parsed = new URL(url);
			const sensitiveParams = ["access_token", "token", "key", "signature"];

			for (const param of sensitiveParams) {
				if (parsed.searchParams.has(param)) {
					parsed.searchParams.set(param, "[REDACTED]");
				}
			}

			return parsed.toString();
		} catch {
			return url;
		}
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
			this.logRequest("GET", url);
		}

		const response = await fetch(url, {
			method: "GET",
			headers,
		});

		if (this.apiDebug) {
			this.logResponse(response);
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

	/**
	 * Create an analytics report request
	 */
	async createAnalyticsReportRequest(
		appId: string,
		accessType: "ONGOING" | "ONE_TIME_SNAPSHOT",
	): Promise<unknown> {
		const body = {
			data: {
				type: "analyticsReportRequests",
				attributes: {
					accessType,
				},
				relationships: {
					app: {
						data: {
							type: "apps",
							id: appId,
						},
					},
				},
			},
		};

		return this.post("/v1/analyticsReportRequests", body);
	}

	/**
	 * List analytics report requests for an app
	 */
	async getAnalyticsReportRequests(appId: string): Promise<unknown> {
		return this.get(`/v1/apps/${appId}/analyticsReportRequests`);
	}

	/**
	 * Get analytics report request by ID
	 */
	async getAnalyticsReportRequest(requestId: string): Promise<unknown> {
		return this.get(`/v1/analyticsReportRequests/${requestId}`);
	}

	/**
	 * Get analytics reports for a request
	 */
	async getAnalyticsReports(requestId: string): Promise<unknown> {
		return this.get(`/v1/analyticsReportRequests/${requestId}/reports`);
	}

	/**
	 * Get analytics report instances
	 */
	async getAnalyticsReportInstances(reportId: string): Promise<unknown> {
		return this.get(`/v1/analyticsReports/${reportId}/instances`);
	}

	/**
	 * Get analytics report segments
	 */
	async getAnalyticsReportSegments(instanceId: string): Promise<unknown> {
		return this.get(`/v1/analyticsReportInstances/${instanceId}/segments`);
	}

	/**
	 * Download analytics report from signed URL
	 */
	async downloadAnalyticsReport(downloadUrl: string): Promise<ReadableStream> {
		if (!this.isValidUrl(downloadUrl)) {
			throw new AppStoreConnectError(400, [
				{
					status: "400",
					code: "INVALID_URL",
					title: "Invalid download URL",
				},
			]);
		}

		const response = await fetch(downloadUrl);

		if (!response.ok) {
			throw new AppStoreConnectError(response.status, [
				{
					status: String(response.status),
					code: "DOWNLOAD_ERROR",
					title: `Failed to download report: ${response.statusText}`,
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
}

// Export a function to create the client (will be initialized with credentials)
export type { ListResponse, SingleResponse, Resource } from "./types/base";
