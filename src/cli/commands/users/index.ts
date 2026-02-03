import { Client } from "../../../api/client";
import type {
	UserInvitationResponse,
	UserInvitationsResponse,
	UserResponse,
	UsersResponse,
} from "../../../api/types/users";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
/**
 * Users commands
 * asc users list/get/update/delete/invite
 */
import { type Command, type CommandContext, registry } from "../../router";

const ROLES = [
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

const usersCommand: Command = {
	name: "users",
	description: "Manage App Store Connect users",
	subcommands: {
		list: {
			name: "list",
			description: "List users",
			options: {
				email: {
					type: "string",
					short: "e",
					description: "Filter by email/username",
				},
				role: {
					type: "string",
					short: "r",
					description: "Filter by role(s), comma-separated",
				},
				limit: {
					type: "string",
					short: "l",
					description: "Maximum number of results (1-200)",
					default: "50",
				},
				paginate: {
					type: "boolean",
					description: "Fetch all pages automatically",
					default: false,
				},
			},
			execute: listUsers,
		},
		get: {
			name: "get",
			description: "Get user by ID",
			options: {
				id: {
					type: "string",
					description: "User ID",
					required: true,
				},
				include: {
					type: "string",
					description: "Include related resources: visibleApps",
				},
			},
			execute: getUser,
		},
		update: {
			name: "update",
			description: "Update a user",
			options: {
				id: {
					type: "string",
					description: "User ID",
					required: true,
				},
				roles: {
					type: "string",
					short: "r",
					description: "Comma-separated role IDs",
					required: true,
				},
				"all-apps": {
					type: "boolean",
					description: "Grant access to all apps",
				},
			},
			execute: updateUser,
		},
		delete: {
			name: "delete",
			description: "Remove a user",
			options: {
				id: {
					type: "string",
					description: "User ID",
					required: true,
				},
				confirm: {
					type: "boolean",
					description: "Confirm deletion",
					default: false,
				},
			},
			execute: deleteUser,
		},
		invite: {
			name: "invite",
			description: "Invite a new user",
			options: {
				email: {
					type: "string",
					short: "e",
					description: "Email address to invite",
					required: true,
				},
				"first-name": {
					type: "string",
					description: "First name",
					required: true,
				},
				"last-name": {
					type: "string",
					description: "Last name",
					required: true,
				},
				roles: {
					type: "string",
					short: "r",
					description: "Comma-separated role IDs",
					required: true,
				},
				"all-apps": {
					type: "boolean",
					description: "Grant access to all apps",
					default: false,
				},
			},
			execute: inviteUser,
		},
		invites: {
			name: "invites",
			description: "Manage user invitations",
			subcommands: {
				list: {
					name: "list",
					description: "List pending invitations",
					options: {
						limit: {
							type: "string",
							short: "l",
							description: "Maximum number of results (1-200)",
							default: "50",
						},
						paginate: {
							type: "boolean",
							description: "Fetch all pages automatically",
							default: false,
						},
					},
					execute: listInvites,
				},
				get: {
					name: "get",
					description: "Get invitation by ID",
					options: {
						id: {
							type: "string",
							description: "Invitation ID",
							required: true,
						},
					},
					execute: getInvite,
				},
				revoke: {
					name: "revoke",
					description: "Revoke an invitation",
					options: {
						id: {
							type: "string",
							description: "Invitation ID",
							required: true,
						},
						confirm: {
							type: "boolean",
							description: "Confirm revocation",
							default: false,
						},
					},
					execute: revokeInvite,
				},
			},
		},
	},
};

async function listUsers(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const limit = Number.parseInt(ctx.args.options.limit as string, 10) || 50;
	const paginate = ctx.args.options.paginate === true;

	const params = new URLSearchParams();
	params.set("limit", String(Math.min(limit, 200)));

	if (ctx.args.options.email) {
		params.set("filter[username]", ctx.args.options.email as string);
	}

	if (ctx.args.options.role) {
		const roles = (ctx.args.options.role as string)
			.split(",")
			.map((r) => r.trim().toUpperCase())
			.filter(Boolean);
		if (roles.length > 0) {
			params.set("filter[roles]", roles.join(","));
		}
	}

	const path = `/v1/users?${params.toString()}`;

	if (paginate) {
		const users = await client.paginate(path);
		printOutput({ data: users }, format);
	} else {
		const response = await client.get<UsersResponse>(path);
		printOutput(response, format);
	}
}

async function getUser(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = ctx.args.options.id as string;

	if (!id) {
		printError("--id is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	let path = `/v1/users/${id}`;
	if (ctx.args.options.include) {
		path += `?include=${encodeURIComponent(ctx.args.options.include as string)}`;
	}

	const response = await client.get<UserResponse>(path);
	printOutput(response, format);
}

async function updateUser(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = ctx.args.options.id as string;
	const rolesStr = ctx.args.options.roles as string;
	const allApps = ctx.args.options["all-apps"] === true;

	if (!id) {
		printError("--id is required");
		process.exit(1);
	}
	if (!rolesStr) {
		printError("--roles is required");
		process.exit(1);
	}

	const roles = rolesStr
		.split(",")
		.map((r) => r.trim().toUpperCase())
		.filter(Boolean);
	for (const role of roles) {
		if (!ROLES.includes(role)) {
			printError(`Invalid role: ${role}. Valid roles: ${ROLES.join(", ")}`);
			process.exit(1);
		}
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.patch<UserResponse>(`/v1/users/${id}`, {
		data: {
			type: "users",
			id,
			attributes: {
				roles,
				allAppsVisible: allApps,
			},
		},
	});

	printSuccess(`Updated user: ${response.data.attributes.username}`);
	printOutput(response, format);
}

async function deleteUser(ctx: CommandContext): Promise<void> {
	const id = ctx.args.options.id as string;
	const confirm = ctx.args.options.confirm === true;

	if (!id) {
		printError("--id is required");
		process.exit(1);
	}
	if (!confirm) {
		printError("Use --confirm to delete. This action cannot be undone.");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	await client.delete(`/v1/users/${id}`);
	printSuccess(`Deleted user ${id}`);
}

async function inviteUser(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const email = ctx.args.options.email as string;
	const firstName = ctx.args.options["first-name"] as string;
	const lastName = ctx.args.options["last-name"] as string;
	const rolesStr = ctx.args.options.roles as string;
	const allApps = ctx.args.options["all-apps"] === true;

	if (!email) {
		printError("--email is required");
		process.exit(1);
	}
	if (!firstName) {
		printError("--first-name is required");
		process.exit(1);
	}
	if (!lastName) {
		printError("--last-name is required");
		process.exit(1);
	}
	if (!rolesStr) {
		printError("--roles is required");
		process.exit(1);
	}

	const roles = rolesStr
		.split(",")
		.map((r) => r.trim().toUpperCase())
		.filter(Boolean);
	for (const role of roles) {
		if (!ROLES.includes(role)) {
			printError(`Invalid role: ${role}. Valid roles: ${ROLES.join(", ")}`);
			process.exit(1);
		}
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.post<UserInvitationResponse>(
		"/v1/userInvitations",
		{
			data: {
				type: "userInvitations",
				attributes: {
					email,
					firstName,
					lastName,
					roles,
					allAppsVisible: allApps,
				},
			},
		},
	);

	printSuccess(`Invited user: ${email}`);
	printOutput(response, format);
}

async function listInvites(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const limit = Number.parseInt(ctx.args.options.limit as string, 10) || 50;
	const paginate = ctx.args.options.paginate === true;

	const params = new URLSearchParams();
	params.set("limit", String(Math.min(limit, 200)));

	const path = `/v1/userInvitations?${params.toString()}`;

	if (paginate) {
		const invites = await client.paginate(path);
		printOutput({ data: invites }, format);
	} else {
		const response = await client.get<UserInvitationsResponse>(path);
		printOutput(response, format);
	}
}

async function getInvite(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const id = ctx.args.options.id as string;

	if (!id) {
		printError("--id is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.get<UserInvitationResponse>(
		`/v1/userInvitations/${id}`,
	);
	printOutput(response, format);
}

async function revokeInvite(ctx: CommandContext): Promise<void> {
	const id = ctx.args.options.id as string;
	const confirm = ctx.args.options.confirm === true;

	if (!id) {
		printError("--id is required");
		process.exit(1);
	}
	if (!confirm) {
		printError("Use --confirm to revoke. This action cannot be undone.");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	await client.delete(`/v1/userInvitations/${id}`);
	printSuccess(`Revoked invitation ${id}`);
}

export function registerUsersCommands(): void {
	registry.register(usersCommand);
}
