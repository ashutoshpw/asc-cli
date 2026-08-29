import { describe, expect, test } from "bun:test";
import type { Client } from "../../../api/client";
import { waitForBuildUpload } from "./upload";

describe("build upload polling", () => {
	test("waits for a related build to become valid", async () => {
		const upload = {
			type: "buildUploads" as const,
			id: "upload-1",
			attributes: { state: { state: "COMPLETE" as const } },
			relationships: { build: { data: { type: "builds", id: "build-1" } } },
		};
		const client = {
			get: async () => ({
				data: {
					type: "builds",
					id: "build-1",
					attributes: { processingState: "VALID" as const },
				},
			}),
		} as unknown as Client;

		const result = await waitForBuildUpload(client, "upload-1", upload, {
			timeoutMs: 100,
			now: () => 0,
			sleepFn: async () => {},
		});

		expect(result.upload.id).toBe("upload-1");
		expect(result.build?.attributes?.processingState).toBe("VALID");
	});

	test("stops immediately when the upload reports a failure", async () => {
		const upload = {
			type: "buildUploads" as const,
			id: "upload-1",
			attributes: {
				state: {
					state: "FAILED" as const,
					errors: [{ description: "Checksum mismatch" }],
				},
			},
		};

		await expect(
			waitForBuildUpload({} as Client, "upload-1", upload, {
				timeoutMs: 100,
				now: () => 0,
				sleepFn: async () => {},
			}),
		).rejects.toThrow("Checksum mismatch");
	});

	test("times out without hiding a still-processing upload", async () => {
		let clock = 0;
		const client = {
			get: async () => ({
				data: {
					type: "buildUploads",
					id: "upload-1",
					attributes: { state: { state: "PROCESSING" as const } },
				},
			}),
		} as unknown as Client;

		await expect(
			waitForBuildUpload(
				client,
				"upload-1",
				{
					type: "buildUploads",
					id: "upload-1",
					attributes: { state: { state: "PROCESSING" as const } },
				},
				{
					timeoutMs: 50,
					now: () => clock,
					sleepFn: async (milliseconds) => {
						clock += milliseconds;
					},
				},
			),
		).rejects.toThrow("Timed out waiting for build upload upload-1");
	});
});
