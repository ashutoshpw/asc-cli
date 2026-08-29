import type {
	JSONAPICollectionResponse,
	JSONAPIResource,
	JSONAPIResponse,
	ResourceIdentifier,
} from "./base";
import type { AppStorePlatform } from "./commerce-versions";

export type BuildUploadState =
	| "AWAITING_UPLOAD"
	| "PROCESSING"
	| "FAILED"
	| "COMPLETE";

export interface BuildUploadStateDetails {
	state?: BuildUploadState;
	errors?: Array<StateDetail>;
	warnings?: Array<StateDetail>;
	infos?: Array<StateDetail>;
}

export interface StateDetail {
	code?: string;
	description?: string;
}

export interface BuildUploadAttributes {
	cfBundleShortVersionString?: string;
	cfBundleVersion?: string;
	createdDate?: string;
	uploadedDate?: string;
	platform?: AppStorePlatform;
	state?: BuildUploadStateDetails;
}

export interface BuildUploadRelationships {
	app?: { data?: ResourceIdentifier };
	build?: { data?: ResourceIdentifier };
	assetFile?: { data?: ResourceIdentifier };
	assetDescriptionFile?: { data?: ResourceIdentifier };
	assetSpiFile?: { data?: ResourceIdentifier };
	buildUploadFiles?: { links?: { related?: string; self?: string } };
}

export type BuildUpload = JSONAPIResource<
	"buildUploads",
	BuildUploadAttributes,
	BuildUploadRelationships
>;
export type BuildUploadResponse = JSONAPIResponse<BuildUpload>;
export type BuildUploadsResponse = JSONAPICollectionResponse<BuildUpload>;

export type BuildUploadAssetType = "ASSET" | "ASSET_DESCRIPTION" | "ASSET_SPI";
export type BuildUploadFileUti =
	| "com.apple.binary-property-list"
	| "com.apple.ipa"
	| "com.apple.pkg"
	| "com.apple.xml-property-list"
	| "com.pkware.zip-archive";

export interface UploadOperationHeader {
	name: string;
	value: string;
}

export interface BuildUploadOperation {
	method: string;
	url: string;
	length: number;
	offset: number;
	requestHeaders?: UploadOperationHeader[];
	expiration?: string;
	partNumber?: number;
	entityTag?: string;
}

export interface BuildUploadFileAttributes {
	assetDeliveryState?: string;
	assetToken?: string;
	assetType?: BuildUploadAssetType;
	fileName?: string;
	fileSize?: number;
	sourceFileChecksums?: {
		file?: { hash?: string; algorithm?: "MD5" | "SHA256" | "SHA512" };
		composite?: { hash?: string; algorithm?: "MD5" };
	};
	uploadOperations?: BuildUploadOperation[];
	uti?: BuildUploadFileUti;
}

export interface BuildUploadFileRelationships {
	buildUpload?: { data?: ResourceIdentifier };
}

export type BuildUploadFile = JSONAPIResource<
	"buildUploadFiles",
	BuildUploadFileAttributes,
	BuildUploadFileRelationships
>;
export type BuildUploadFileResponse = JSONAPIResponse<BuildUploadFile>;
