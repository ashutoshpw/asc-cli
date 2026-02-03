/**
 * Certificate API types
 */
import type {
	JSONAPICollectionResponse,
	JSONAPIResource,
	JSONAPIResponse,
} from "./base";

export type CertificateType =
	| "IOS_DEVELOPMENT"
	| "IOS_DISTRIBUTION"
	| "MAC_APP_DEVELOPMENT"
	| "MAC_APP_DISTRIBUTION"
	| "MAC_INSTALLER_DISTRIBUTION"
	| "DEVELOPER_ID_KEXT"
	| "DEVELOPER_ID_APPLICATION"
	| "DEVELOPER_ID_INSTALLER"
	| "DEVELOPMENT"
	| "DISTRIBUTION"
	| "PASS_TYPE_ID"
	| "PASS_TYPE_ID_WITH_NFC";

export interface CertificateAttributes {
	name: string;
	certificateType: CertificateType;
	displayName: string;
	serialNumber: string;
	platform: "IOS" | "MAC_OS" | null;
	expirationDate: string;
	certificateContent: string;
}

export interface CertificateRelationships {
	passTypeId?: {
		data: { type: "passTypeIds"; id: string } | null;
	};
}

export type Certificate = JSONAPIResource<
	"certificates",
	CertificateAttributes,
	CertificateRelationships
>;
export type CertificateResponse = JSONAPIResponse<Certificate>;
export type CertificatesResponse = JSONAPICollectionResponse<Certificate>;
