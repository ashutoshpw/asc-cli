/**
 * Device API types
 */
import type {
	JSONAPICollectionResponse,
	JSONAPIResource,
	JSONAPIResponse,
} from "./base";

export type DevicePlatform = "IOS" | "MAC_OS" | "TV_OS" | "VISION_OS";
export type DeviceStatus = "ENABLED" | "DISABLED";
export type DeviceClass =
	| "APPLE_WATCH"
	| "IPAD"
	| "IPHONE"
	| "IPOD"
	| "APPLE_TV"
	| "MAC"
	| "APPLE_VISION_PRO";

export interface DeviceAttributes {
	name: string;
	platform: DevicePlatform;
	udid: string;
	deviceClass: DeviceClass;
	status: DeviceStatus;
	model: string;
	addedDate: string;
}

export type Device = JSONAPIResource<"devices", DeviceAttributes>;
export type DeviceResponse = JSONAPIResponse<Device>;
export type DevicesResponse = JSONAPICollectionResponse<Device>;
