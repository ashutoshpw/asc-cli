import type { ErrorResponse } from "./types/base";

export const APP_STORE_CONNECT_BASE_URL =
	"https://api.appstoreconnect.apple.com";

export interface ClientConfig {
	keyId: string;
	issuerId: string;
	privateKey: string;

	// Optional overrides
	baseUrl?: string;
	timeout?: number;
	maxRetries?: number;
	baseDelay?: number;
	maxDelay?: number;
	jitter?: boolean;
	debug?: boolean;
	apiDebug?: boolean;
	fetchImpl?: typeof fetch;
}

export interface RequestOptions {
	method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
	body?: unknown;
	headers?: Record<string, string>;
	timeout?: number;
}

export interface UploadRequestHeader {
	name: string;
	value: string;
}

export interface BinaryUploadOperation {
	method: string;
	url: string;
	length: number;
	offset: number;
	requestHeaders?: UploadRequestHeader[];
}

/**
 * API Error with status code and details.
 */
export class AppStoreConnectError extends Error {
	constructor(
		public readonly status: number,
		public readonly errors: ErrorResponse["errors"],
		message?: string,
		public readonly retryAfter?: number,
	) {
		super(message || errors.map((e) => e.detail || e.title).join("; "));
		this.name = "AppStoreConnectError";
	}

	/** Get the first error code. */
	get code(): string {
		return this.errors[0]?.code || "UNKNOWN";
	}

	/** Check if the error represents a rate limit response. */
	get isRateLimited(): boolean {
		return this.status === 429;
	}

	/** Check if the error represents an authentication failure. */
	get isAuthError(): boolean {
		return this.status === 401 || this.status === 403;
	}

	/** Check if the requested resource was not found. */
	get isNotFound(): boolean {
		return this.status === 404;
	}
}
