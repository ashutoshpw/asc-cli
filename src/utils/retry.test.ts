import { describe, expect, test } from "bun:test";
import {
	calculateDelay,
	getRetryAfter,
	isRetryableError,
	isRetryableStatus,
	parseRetryAfter,
	withRetry,
} from "./retry";

describe("retry utilities", () => {
	test("calculates capped exponential delays without jitter", () => {
		const options = {
			maxRetries: 3,
			baseDelay: 100,
			maxDelay: 250,
			jitter: false,
		};

		expect(calculateDelay(0, options)).toBe(100);
		expect(calculateDelay(1, options)).toBe(200);
		expect(calculateDelay(2, options)).toBe(250);
		expect(calculateDelay(0, options, 500)).toBe(250);
	});

	test("recognizes retryable HTTP statuses and attached metadata", () => {
		const error = Object.assign(new Error("service unavailable"), {
			status: 503,
			retryAfter: 1200,
		});

		expect(isRetryableStatus(429)).toBe(true);
		expect(isRetryableStatus(503)).toBe(true);
		expect(isRetryableStatus(400)).toBe(false);
		expect(isRetryableError(error)).toBe(true);
		expect(getRetryAfter(error)).toBe(1200);
		expect(getRetryAfter(new Error("network failure"))).toBeUndefined();
	});

	test("retries status errors and stops after the configured attempts", async () => {
		let attempts = 0;
		const retryAttempts: number[] = [];

		const result = await withRetry(
			async () => {
				attempts++;
				if (attempts < 3) {
					throw Object.assign(new Error("rate limited"), {
						status: 429,
						retryAfter: 0,
					});
				}
				return "success";
			},
			{
				maxRetries: 2,
				baseDelay: 0,
				maxDelay: 0,
				jitter: false,
				onRetry: (attempt) => retryAttempts.push(attempt),
			},
		);

		expect(result).toBe("success");
		expect(attempts).toBe(3);
		expect(retryAttempts).toEqual([1, 2]);
	});

	test("does not retry non-retryable errors", async () => {
		let attempts = 0;

		await expect(
			withRetry(
				async () => {
					attempts++;
					throw new Error("validation failed");
				},
				{ maxRetries: 4, baseDelay: 0, maxDelay: 0, jitter: false },
			),
		).rejects.toThrow("validation failed");
		expect(attempts).toBe(1);
	});

	test("parses seconds and rejects invalid Retry-After values", () => {
		expect(parseRetryAfter("2")).toBe(2000);
		expect(parseRetryAfter("0")).toBe(0);
		expect(parseRetryAfter("not-a-delay")).toBeUndefined();
		expect(parseRetryAfter(null)).toBeUndefined();
	});
});
