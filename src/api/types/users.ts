/**
 * User API types
 */
import type {
	JSONAPICollectionResponse,
	JSONAPIResource,
	JSONAPIResponse,
} from "./base";

export type UserRole =
	| "ADMIN"
	| "FINANCE"
	| "ACCOUNT_HOLDER"
	| "SALES"
	| "MARKETING"
	| "APP_MANAGER"
	| "DEVELOPER"
	| "ACCESS_TO_REPORTS"
	| "CUSTOMER_SUPPORT"
	| "IMAGE_MANAGER"
	| "CREATE_APPS"
	| "CLOUD_MANAGED_DEVELOPER_ID"
	| "CLOUD_MANAGED_APP_DISTRIBUTION"
	| "GENERATE_INDIVIDUAL_KEYS";

export interface UserAttributes {
	username: string;
	firstName: string;
	lastName: string;
	roles: UserRole[];
	allAppsVisible: boolean;
	provisioningAllowed: boolean;
	expirationDate?: string;
}

export interface UserRelationships {
	visibleApps?: {
		data: Array<{ type: "apps"; id: string }>;
		links?: { related?: string; self?: string };
		meta?: { paging?: { total: number; limit: number } };
	};
}

export type User = JSONAPIResource<"users", UserAttributes, UserRelationships>;
export type UserResponse = JSONAPIResponse<User>;
export type UsersResponse = JSONAPICollectionResponse<User>;

// User Invitation types
export interface UserInvitationAttributes {
	email: string;
	firstName: string;
	lastName: string;
	roles: UserRole[];
	allAppsVisible: boolean;
	provisioningAllowed: boolean;
	expirationDate?: string;
}

export interface UserInvitationRelationships {
	visibleApps?: {
		data: Array<{ type: "apps"; id: string }>;
		links?: { related?: string; self?: string };
	};
}

export type UserInvitation = JSONAPIResource<
	"userInvitations",
	UserInvitationAttributes,
	UserInvitationRelationships
>;
export type UserInvitationResponse = JSONAPIResponse<UserInvitation>;
export type UserInvitationsResponse = JSONAPICollectionResponse<UserInvitation>;
