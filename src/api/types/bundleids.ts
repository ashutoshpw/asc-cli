/**
 * Bundle ID API types
 */
import type {
	JSONAPICollectionResponse,
	JSONAPIResource,
	JSONAPIResponse,
} from "./base";

export type BundleIdPlatform = "IOS" | "MAC_OS" | "UNIVERSAL";

export interface BundleIdAttributes {
	name: string;
	identifier: string;
	platform: BundleIdPlatform;
	seedId: string;
}

export interface BundleIdRelationships {
	bundleIdCapabilities?: {
		data: Array<{ type: "bundleIdCapabilities"; id: string }>;
		links?: { related?: string; self?: string };
		meta?: { paging?: { total: number; limit: number } };
	};
	profiles?: {
		data: Array<{ type: "profiles"; id: string }>;
		links?: { related?: string; self?: string };
		meta?: { paging?: { total: number; limit: number } };
	};
	app?: {
		data: { type: "apps"; id: string } | null;
		links?: { related?: string; self?: string };
	};
}

export type BundleId = JSONAPIResource<
	"bundleIds",
	BundleIdAttributes,
	BundleIdRelationships
>;
export type BundleIdResponse = JSONAPIResponse<BundleId>;
export type BundleIdsResponse = JSONAPICollectionResponse<BundleId>;

// Capability types
export type CapabilityType =
	| "ICLOUD"
	| "IN_APP_PURCHASE"
	| "GAME_CENTER"
	| "PUSH_NOTIFICATIONS"
	| "WALLET"
	| "INTER_APP_AUDIO"
	| "MAPS"
	| "ASSOCIATED_DOMAINS"
	| "PERSONAL_VPN"
	| "APP_GROUPS"
	| "HEALTHKIT"
	| "HOMEKIT"
	| "WIRELESS_ACCESSORY_CONFIGURATION"
	| "APPLE_PAY"
	| "DATA_PROTECTION"
	| "SIRIKIT"
	| "NETWORK_EXTENSIONS"
	| "MULTIPATH"
	| "HOT_SPOT"
	| "NFC_TAG_READING"
	| "CLASSKIT"
	| "AUTOFILL_CREDENTIAL_PROVIDER"
	| "ACCESS_WIFI_INFORMATION"
	| "NETWORK_CUSTOM_PROTOCOL"
	| "COREMEDIA_HLS_LOW_LATENCY"
	| "SYSTEM_EXTENSION_INSTALL"
	| "USER_MANAGEMENT"
	| "APPLE_ID_AUTH"
	| "FONT_INSTALLATION"
	| "EXTENDED_VIRTUAL_ADDRESSING"
	| "INCREASED_MEMORY_LIMIT"
	| "MEMORY_TO_MEMORY_TRANSFER"
	| "SHALLOW_DEPTH_AND_PRESSURE"
	| "DRIVER_KIT"
	| "DRIVER_KIT_ENDPOINT_SECURITY"
	| "DRIVER_KIT_FAMILY_HID_DEVICE"
	| "DRIVER_KIT_FAMILY_NETWORKING"
	| "DRIVER_KIT_FAMILY_SERIAL"
	| "DRIVER_KIT_HID_EVENT_SERVICE"
	| "DRIVER_KIT_TRANSPORT_HID"
	| "APP_ATTEST"
	| "DRIVERKIT_USB_TRANSPORT"
	| "COMMUNICATES_WITH_DRIVERS"
	| "GROUP_ACTIVITIES"
	| "FAMILY_CONTROLS"
	| "TIME_SENSITIVE_NOTIFICATIONS"
	| "PUSH_TO_TALK"
	| "APPLE_PAY_LATER_MERCHANT"
	| "CONTENT_AVAILABILITY"
	| "EXTERNAL_ACCESSORY_COMMUNICATION"
	| "FILEPROVIDER_TESTING_MODE"
	| "MATTER_ALLOW_SETUP_PAYLOAD";

export interface BundleIdCapabilityAttributes {
	capabilityType: CapabilityType;
	settings?: Array<{
		key: string;
		name: string;
		description: string;
		enabledByDefault: boolean;
		visible: boolean;
		allowedInstances: string;
		minInstances: number;
		options: Array<{
			key: string;
			name: string;
			description: string;
			enabledByDefault: boolean;
			enabled: boolean;
			supportsWildcard: boolean;
		}>;
	}>;
}

export type BundleIdCapability = JSONAPIResource<
	"bundleIdCapabilities",
	BundleIdCapabilityAttributes
>;
export type BundleIdCapabilityResponse = JSONAPIResponse<BundleIdCapability>;
export type BundleIdCapabilitiesResponse =
	JSONAPICollectionResponse<BundleIdCapability>;
