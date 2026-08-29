/**
 * HTTP debug logging helpers. Credentials are never included in log output.
 */
export function logRequest(
	method: string,
	url: string,
	body?: unknown,
	debug = false,
): void {
	console.error(`[http] ${method} ${redactUrl(url)}`);
	if (body && debug) {
		console.error(`[http] Body: ${JSON.stringify(body, null, 2)}`);
	}
}

export function logResponse(response: Response): void {
	console.error(`[http] ${response.status} ${response.statusText}`);
}

export function redactUrl(url: string): string {
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
