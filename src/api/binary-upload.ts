import {
	type RetryOptions,
	isRetryableStatus,
	parseRetryAfter,
	withRetry,
} from "../utils/retry";
import {
	AppStoreConnectError,
	type BinaryUploadOperation,
} from "./client-types";
import { logRequest, logResponse } from "./logging";
import { isSecureUploadUrl } from "./url";

export interface BinaryUploadClientOptions {
	fetchImpl: typeof fetch;
	timeout: number;
	retryOptions: RetryOptions;
	debug: boolean;
	apiDebug: boolean;
}

/** Upload one chunk to an App Store Connect signed URL without API credentials. */
export async function uploadBinary(
	client: BinaryUploadClientOptions,
	operation: BinaryUploadOperation,
	body: Uint8Array,
	options: { timeout?: number } = {},
): Promise<Response> {
	if (!isSecureUploadUrl(operation.url)) {
		throw new Error("Invalid signed upload URL: HTTPS is required");
	}
	if (
		!Number.isSafeInteger(operation.offset) ||
		operation.offset < 0 ||
		!Number.isSafeInteger(operation.length) ||
		operation.length < 1
	) {
		throw new Error("Invalid signed upload operation bounds");
	}
	if (body.byteLength !== operation.length) {
		throw new Error(
			`Signed upload body length ${body.byteLength} does not match operation length ${operation.length}`,
		);
	}

	const method = operation.method.toUpperCase();
	if (method !== "PUT") {
		throw new Error(`Unsupported signed upload method: ${operation.method}`);
	}

	const headers: Record<string, string> = {};
	for (const header of operation.requestHeaders ?? []) {
		const name = header.name.trim();
		if (!name) continue;
		if (
			name.toLowerCase() === "authorization" ||
			name.toLowerCase() === "cookie"
		) {
			throw new Error(`Signed upload returned a forbidden ${name} header`);
		}
		headers[name] = header.value;
	}
	if (
		!Object.keys(headers).some(
			(name) => name.toLowerCase() === "content-length",
		)
	) {
		headers["Content-Length"] = String(body.byteLength);
	}

	const doRequest = async (): Promise<Response> => {
		if (client.apiDebug) {
			logRequest(method, operation.url, undefined, client.debug);
		}

		const response = await client.fetchImpl(operation.url, {
			method,
			headers,
			body: body as unknown as Bun.XMLHttpRequestBodyInit,
			signal: AbortSignal.timeout(options.timeout || client.timeout),
		});

		if (client.apiDebug) logResponse(response);

		if (!response.ok) {
			let detail =
				response.statusText || `Upload failed with ${response.status}`;
			try {
				const text = await response.text();
				if (text) detail = text;
			} catch {
				// Preserve the HTTP status when the delivery service has no body.
			}
			throw new AppStoreConnectError(
				response.status,
				[
					{
						status: String(response.status),
						code: "BINARY_UPLOAD_FAILED",
						title: detail,
					},
				],
				undefined,
				isRetryableStatus(response.status)
					? parseRetryAfter(response.headers.get("Retry-After"))
					: undefined,
			);
		}

		return response;
	};

	return withRetry(doRequest, client.retryOptions);
}
