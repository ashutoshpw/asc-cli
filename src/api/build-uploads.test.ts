import { describe, expect, test } from "bun:test";
import {
	commitBuildUploadFile,
	createBuildUpload,
	createBuildUploadFile,
	getBuildUpload,
} from "./build-uploads";
import type { Client } from "./client";

function fakeClient(responses: Record<string, unknown>) {
	const calls: Array<{ method: string; path: string; body?: unknown }> = [];
	const request = async (method: string, path: string, body?: unknown) => {
		calls.push({ method, path, ...(body === undefined ? {} : { body }) });
		const key = `${method} ${path}`;
		if (!(key in responses)) throw new Error(`Unexpected ${key}`);
		return responses[key];
	};
	const client = {
		get: (path: string) => request("GET", path),
		post: (path: string, body: unknown) => request("POST", path, body),
		patch: (path: string, body: unknown) => request("PATCH", path, body),
	};
	return { client: client as unknown as Client, calls };
}

describe("build upload API helpers", () => {
	test("creates an upload and its IPA asset using JSON API relationships", async () => {
		const { client, calls } = fakeClient({
			"POST /v1/buildUploads": {
				data: { type: "buildUploads", id: "upload-1", attributes: {} },
			},
			"POST /v1/buildUploadFiles": {
				data: {
					type: "buildUploadFiles",
					id: "file-1",
					attributes: {
						uploadOperations: [
							{
								method: "PUT",
								url: "https://upload.example.test/1",
								length: 10,
								offset: 0,
							},
						],
					},
				},
			},
		});

		const upload = await createBuildUpload(client, {
			appId: "app-1",
			marketingVersion: "1.2.3",
			buildNumber: "45",
			platform: "IOS",
		});
		const file = await createBuildUploadFile(client, {
			uploadId: upload.id,
			fileName: "Demo.ipa",
			fileSize: 10,
			uti: "com.apple.ipa",
		});

		expect(file.id).toBe("file-1");
		expect(calls[0]?.body).toEqual({
			data: {
				type: "buildUploads",
				attributes: {
					cfBundleShortVersionString: "1.2.3",
					cfBundleVersion: "45",
					platform: "IOS",
				},
				relationships: {
					app: { data: { type: "apps", id: "app-1" } },
				},
			},
		});
		expect(calls[1]?.body).toEqual({
			data: {
				type: "buildUploadFiles",
				attributes: {
					fileName: "Demo.ipa",
					fileSize: 10,
					uti: "com.apple.ipa",
					assetType: "ASSET",
				},
				relationships: {
					buildUpload: {
						data: { type: "buildUploads", id: "upload-1" },
					},
				},
			},
		});
	});

	test("commits a SHA-256 checksum and can fetch upload state", async () => {
		const { client, calls } = fakeClient({
			"PATCH /v1/buildUploadFiles/file-1": {
				data: { type: "buildUploadFiles", id: "file-1", attributes: {} },
			},
			"GET /v1/buildUploads/upload-1": {
				data: { type: "buildUploads", id: "upload-1", attributes: {} },
			},
		});

		await commitBuildUploadFile(client, "file-1", "a".repeat(64));
		const upload = await getBuildUpload(client, "upload-1");

		expect(upload.id).toBe("upload-1");
		expect(calls[0]?.body).toEqual({
			data: {
				type: "buildUploadFiles",
				id: "file-1",
				attributes: {
					sourceFileChecksums: {
						file: { hash: "a".repeat(64), algorithm: "SHA256" },
					},
					uploaded: true,
				},
			},
		});
	});
});
