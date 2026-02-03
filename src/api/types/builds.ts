/**
 * Build types
 */
import type { ListResponse, Resource, SingleResponse } from "../../types/base";

export interface BuildAttributes {
	version: string;
	uploadedDate: string;
	expirationDate: string;
	expired: boolean;
	minOsVersion: string;
	lsMinimumSystemVersion?: string;
	computedMinMacOsVersion?: string;
	iconAssetToken?: {
		templateUrl: string;
		width: number;
		height: number;
	};
	processingState: "PROCESSING" | "FAILED" | "INVALID" | "VALID";
	buildAudienceType?: "INTERNAL_ONLY" | "APP_STORE_ELIGIBLE";
	usesNonExemptEncryption?: boolean;
}

export type BuildResource = Resource<BuildAttributes>;
export type BuildsResponse = ListResponse<BuildAttributes>;
export type BuildResponse = SingleResponse<BuildAttributes>;

export interface BuildBetaDetailAttributes {
	autoNotifyEnabled: boolean;
	internalBuildState: string;
	externalBuildState: string;
}

export type BuildBetaDetailResource = Resource<BuildBetaDetailAttributes>;
