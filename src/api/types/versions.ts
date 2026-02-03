/**
 * Version types
 */
import type { ListResponse, Resource, SingleResponse } from "../../types/base";

export interface AppStoreVersionAttributes {
	platform: "IOS" | "MAC_OS" | "TV_OS" | "VISION_OS";
	versionString: string;
	appStoreState:
		| "ACCEPTED"
		| "DEVELOPER_REJECTED"
		| "DEVELOPER_REMOVED_FROM_SALE"
		| "IN_REVIEW"
		| "INVALID_BINARY"
		| "METADATA_REJECTED"
		| "PENDING_APPLE_RELEASE"
		| "PENDING_CONTRACT"
		| "PENDING_DEVELOPER_RELEASE"
		| "PREPARE_FOR_SUBMISSION"
		| "PREORDER_READY_FOR_SALE"
		| "PROCESSING_FOR_APP_STORE"
		| "READY_FOR_REVIEW"
		| "READY_FOR_SALE"
		| "REJECTED"
		| "REMOVED_FROM_SALE"
		| "WAITING_FOR_EXPORT_COMPLIANCE"
		| "WAITING_FOR_REVIEW"
		| "REPLACED_WITH_NEW_VERSION"
		| "NOT_APPLICABLE";
	appVersionState:
		| "ACCEPTED"
		| "DEVELOPER_REJECTED"
		| "IN_REVIEW"
		| "INVALID_BINARY"
		| "METADATA_REJECTED"
		| "PENDING_APPLE_RELEASE"
		| "PENDING_DEVELOPER_RELEASE"
		| "PREPARE_FOR_SUBMISSION"
		| "PROCESSING_FOR_DISTRIBUTION"
		| "READY_FOR_DISTRIBUTION"
		| "READY_FOR_REVIEW"
		| "REJECTED"
		| "REPLACED_WITH_NEW_VERSION"
		| "WAITING_FOR_EXPORT_COMPLIANCE"
		| "WAITING_FOR_REVIEW";
	copyright?: string;
	reviewType?: "APP_STORE" | "NOTARIZATION";
	releaseType?: "MANUAL" | "AFTER_APPROVAL" | "SCHEDULED";
	earliestReleaseDate?: string;
	downloadable?: boolean;
	createdDate: string;
}

export type AppStoreVersionResource = Resource<AppStoreVersionAttributes>;
export type AppStoreVersionsResponse = ListResponse<AppStoreVersionAttributes>;
export type AppStoreVersionResponse = SingleResponse<AppStoreVersionAttributes>;

export interface AppStoreVersionLocalizationAttributes {
	description?: string;
	locale: string;
	keywords?: string;
	marketingUrl?: string;
	promotionalText?: string;
	supportUrl?: string;
	whatsNew?: string;
}
