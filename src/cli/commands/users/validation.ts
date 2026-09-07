import { DEPRECATED_USER_ROLES, type UserRole } from "../../../api/types/users";
import { printError } from "../../../output/formatter";

const ASSIGNABLE_USER_ROLES: UserRole[] = [
	"ADMIN",
	"FINANCE",
	"ACCOUNT_HOLDER",
	"SALES",
	"MARKETING",
	"APP_MANAGER",
	"DEVELOPER",
	"ACCESS_TO_REPORTS",
	"CUSTOMER_SUPPORT",
	"IMAGE_MANAGER",
	"CREATE_APPS",
	"CLOUD_MANAGED_DEVELOPER_ID",
	"CLOUD_MANAGED_APP_DISTRIBUTION",
	"GENERATE_INDIVIDUAL_KEYS",
];

export function parseAssignableUserRoles(value: string): UserRole[] {
	const roles = value
		.split(",")
		.map((role) => role.trim().toUpperCase())
		.filter(Boolean);

	for (const role of roles) {
		if (!ASSIGNABLE_USER_ROLES.includes(role as UserRole)) {
			printError(
				`Invalid role: ${role}. Valid roles: ${ASSIGNABLE_USER_ROLES.join(", ")}`,
			);
			process.exit(1);
		}
		if (DEPRECATED_USER_ROLES.includes(role as UserRole)) {
			printError(
				`Role ${role} is deprecated by the current App Store Connect API and cannot be assigned through invitations or updates`,
			);
			process.exit(1);
		}
	}

	return roles as UserRole[];
}
