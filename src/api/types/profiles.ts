/**
 * Provisioning Profile API types
 */
import type {
	JSONAPICollectionResponse,
	JSONAPIResource,
	JSONAPIResponse,
} from "./base";

export type ProfileType =
	| "IOS_APP_DEVELOPMENT"
	| "IOS_APP_STORE"
	| "IOS_APP_ADHOC"
	| "IOS_APP_INHOUSE"
	| "MAC_APP_DEVELOPMENT"
	| "MAC_APP_STORE"
	| "MAC_APP_DIRECT"
	| "TVOS_APP_DEVELOPMENT"
	| "TVOS_APP_STORE"
	| "TVOS_APP_ADHOC"
	| "TVOS_APP_INHOUSE"
	| "MAC_CATALYST_APP_DEVELOPMENT"
	| "MAC_CATALYST_APP_STORE"
	| "MAC_CATALYST_APP_DIRECT";

export type ProfileState = "ACTIVE" | "INVALID";

export interface ProfileAttributes {
	name: string;
	platform: "IOS" | "MAC_OS" | "TV_OS" | null;
	profileType: ProfileType;
	profileState: ProfileState;
	profileContent: string;
	uuid: string;
	createdDate: string;
	expirationDate: string;
}

export interface ProfileRelationships {
	bundleId?: {
		data: { type: "bundleIds"; id: string } | null;
		links?: { related?: string; self?: string };
	};
	certificates?: {
		data: Array<{ type: "certificates"; id: string }>;
		links?: { related?: string; self?: string };
		meta?: { paging?: { total: number; limit: number } };
	};
	devices?: {
		data: Array<{ type: "devices"; id: string }>;
		links?: { related?: string; self?: string };
		meta?: { paging?: { total: number; limit: number } };
	};
}

export type Profile = JSONAPIResource<
	"profiles",
	ProfileAttributes,
	ProfileRelationships
>;
export type ProfileResponse = JSONAPIResponse<Profile>;
export type ProfilesResponse = JSONAPICollectionResponse<Profile>;
