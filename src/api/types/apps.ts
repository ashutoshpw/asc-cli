/**
 * Apps types
 */
import type { ListResponse, Resource, SingleResponse } from "../../types/base";

export interface AppAttributes {
	name: string;
	bundleId: string;
	sku: string;
	primaryLocale: string;
	isOrEverWasMadeForKids: boolean;
	subscriptionStatusUrl?: string;
	subscriptionStatusUrlVersion?: string;
	subscriptionStatusUrlForSandbox?: string;
	subscriptionStatusUrlVersionForSandbox?: string;
	contentRightsDeclaration?: string;
	streamlinedPurchasingEnabled?: boolean;
}

export type AppResource = Resource<AppAttributes>;
export type AppsResponse = ListResponse<AppAttributes>;
export type AppResponse = SingleResponse<AppAttributes>;
