import type { Client } from "./client";
import type {
	BuildUpload,
	BuildUploadFile,
	BuildUploadFileAttributes,
	BuildUploadFileResponse,
	BuildUploadFileUti,
	BuildUploadResponse,
} from "./types/build-uploads";
import type { AppStorePlatform } from "./types/commerce-versions";

export async function createBuildUpload(
	client: Client,
	input: {
		appId: string;
		marketingVersion: string;
		buildNumber: string;
		platform: AppStorePlatform;
	},
): Promise<BuildUpload> {
	const response = await client.post<BuildUploadResponse>("/v1/buildUploads", {
		data: {
			type: "buildUploads",
			attributes: {
				cfBundleShortVersionString: input.marketingVersion,
				cfBundleVersion: input.buildNumber,
				platform: input.platform,
			},
			relationships: {
				app: { data: { type: "apps", id: input.appId } },
			},
		},
	});
	return response.data;
}

export async function getBuildUpload(
	client: Client,
	uploadId: string,
): Promise<BuildUpload> {
	const response = await client.get<BuildUploadResponse>(
		`/v1/buildUploads/${uploadId}`,
	);
	return response.data;
}

export async function createBuildUploadFile(
	client: Client,
	input: {
		uploadId: string;
		fileName: string;
		fileSize: number;
		uti: BuildUploadFileUti;
		assetType?: "ASSET" | "ASSET_DESCRIPTION" | "ASSET_SPI";
	},
): Promise<BuildUploadFile> {
	const response = await client.post<BuildUploadFileResponse>(
		"/v1/buildUploadFiles",
		{
			data: {
				type: "buildUploadFiles",
				attributes: {
					fileName: input.fileName,
					fileSize: input.fileSize,
					uti: input.uti,
					assetType: input.assetType ?? "ASSET",
				} satisfies BuildUploadFileAttributes,
				relationships: {
					buildUpload: {
						data: { type: "buildUploads", id: input.uploadId },
					},
				},
			},
		},
	);
	return response.data;
}

export async function commitBuildUploadFile(
	client: Client,
	fileId: string,
	checksum: string,
): Promise<BuildUploadFile> {
	const response = await client.patch<BuildUploadFileResponse>(
		`/v1/buildUploadFiles/${fileId}`,
		{
			data: {
				type: "buildUploadFiles",
				id: fileId,
				attributes: {
					sourceFileChecksums: {
						file: { hash: checksum, algorithm: "SHA256" },
					},
					uploaded: true,
				},
			},
		},
	);
	return response.data;
}
