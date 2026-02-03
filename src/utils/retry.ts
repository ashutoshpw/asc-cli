/**
 * Retry utilities with exponential backoff
 */

export interface RetryOptions {
	maxRetries: number;
	baseDelay: number;
	maxDelay: number;
	jitter: boolean;
	onRetry?: (attempt: number, error: Error, delay: number) => void;
}

export const defaultRetryOptions: RetryOptions = {
	maxRetries: 5,
	baseDelay: 1000,
	maxDelay: 60000,
	jitter: true,
};

/**
 * Calculate delay for a given attempt with exponential backoff
 */
export function calculateDelay(
	attempt: number,
	options: RetryOptions,
	retryAfterMs?: number,
): number {
	// If server provided Retry-After, use it (but cap at maxDelay)
	if (retryAfterMs !== undefined && retryAfterMs > 0) {
		return Math.min(retryAfterMs, options.maxDelay);
	}

	// Exponential backoff: baseDelay * 2^attempt
	let delay = options.baseDelay * 2 ** attempt;

	// Cap at maxDelay
	delay = Math.min(delay, options.maxDelay);

	// Add jitter (0-10% extra)
	if (options.jitter) {
		delay = delay * (1 + Math.random() * 0.1);
	}

	return Math.floor(delay);
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
	if (error instanceof Error) {
		// Network errors
		if (
			error.message.includes("fetch failed") ||
			error.message.includes("network") ||
			error.message.includes("ECONNRESET") ||
			error.message.includes("ETIMEDOUT")
		) {
			return true;
		}
	}
	return false;
}

/**
 * Check if an HTTP status code is retryable
 */
export function isRetryableStatus(status: number): boolean {
	return status === 429 || status === 503 || status === 502 || status === 504;
}

/**
 * Parse Retry-After header value to milliseconds
 */
export function parseRetryAfter(value: string | null): number | undefined {
	if (!value) return undefined;

	// Try parsing as seconds (integer)
	const seconds = Number.parseInt(value, 10);
	if (!Number.isNaN(seconds)) {
		return seconds * 1000;
	}

	// Try parsing as HTTP date
	const date = Date.parse(value);
	if (!Number.isNaN(date)) {
		const delay = date - Date.now();
		return delay > 0 ? delay : 0;
	}

	return undefined;
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
	return Bun.sleep(ms);
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	options: Partial<RetryOptions> = {},
): Promise<T> {
	const opts = { ...defaultRetryOptions, ...options };
	let lastError: Error | undefined;

	for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// Don't retry on last attempt
			if (attempt === opts.maxRetries) {
				break;
			}

			// Check if error is retryable
			if (!isRetryableError(error)) {
				throw error;
			}

			const delay = calculateDelay(attempt, opts);
			opts.onRetry?.(attempt + 1, lastError, delay);
			await sleep(delay);
		}
	}

	throw lastError;
}
