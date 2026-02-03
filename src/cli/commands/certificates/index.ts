import { readFile } from "node:fs/promises";
import { Client } from "../../../api/client";
import type {
	CertificateResponse,
	CertificatesResponse,
} from "../../../api/types/certificates";
import { requireCredentials } from "../../../auth/credentials";
import {
	getOutputFormat,
	printError,
	printOutput,
	printSuccess,
} from "../../../output/formatter";
/**
 * Certificates commands
 * asc certificates list/get/create/revoke
 */
import { type Command, type CommandContext, registry } from "../../router";

const certificatesCommand: Command = {
	name: "certificates",
	description: "Manage signing certificates",
	subcommands: {
		list: {
			name: "list",
			description: "List signing certificates",
			options: {
				type: {
					type: "string",
					short: "t",
					description: "Filter by certificate type(s), comma-separated",
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
			execute: listCertificates,
		},
		get: {
			name: "get",
			description: "Get certificate by ID",
			options: {
				id: {
					type: "string",
					description: "Certificate ID",
					required: true,
				},
				include: {
					type: "string",
					description: "Include related resources (passTypeId)",
				},
			},
			execute: getCertificate,
		},
		create: {
			name: "create",
			description: "Create a signing certificate",
			options: {
				type: {
					type: "string",
					short: "t",
					description: "Certificate type (e.g., IOS_DISTRIBUTION)",
					required: true,
				},
				csr: {
					type: "string",
					description: "Path to CSR file",
					required: true,
				},
			},
			execute: createCertificate,
		},
		revoke: {
			name: "revoke",
			description: "Revoke a signing certificate",
			options: {
				id: {
					type: "string",
					description: "Certificate ID",
					required: true,
				},
				confirm: {
					type: "boolean",
					description: "Confirm revocation",
					default: false,
				},
			},
			execute: revokeCertificate,
		},
		download: {
			name: "download",
			description: "Download certificate content",
			options: {
				id: {
					type: "string",
					description: "Certificate ID",
					required: true,
				},
				output: {
					type: "string",
					short: "o",
					description: "Output file path (default: stdout)",
				},
			},
			execute: downloadCertificate,
		},
	},
};

async function listCertificates(ctx: CommandContext): Promise<void> {
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

	if (ctx.args.options.type) {
		const types = (ctx.args.options.type as string)
			.split(",")
			.map((t) => t.trim().toUpperCase())
			.filter(Boolean);
		if (types.length > 0) {
			params.set("filter[certificateType]", types.join(","));
		}
	}

	const path = `/v1/certificates?${params.toString()}`;

	if (paginate) {
		const certificates = await client.paginate(path);
		printOutput({ data: certificates }, format);
	} else {
		const response = await client.get<CertificatesResponse>(path);
		printOutput(response, format);
	}
}

async function getCertificate(ctx: CommandContext): Promise<void> {
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

	let path = `/v1/certificates/${id}`;
	if (ctx.args.options.include) {
		path += `?include=${encodeURIComponent(ctx.args.options.include as string)}`;
	}

	const response = await client.get<CertificateResponse>(path);
	printOutput(response, format);
}

async function createCertificate(ctx: CommandContext): Promise<void> {
	const format = getOutputFormat(ctx.global);
	const certificateType = (ctx.args.options.type as string)?.toUpperCase();
	const csrPath = ctx.args.options.csr as string;

	if (!certificateType) {
		printError("--type is required");
		process.exit(1);
	}
	if (!csrPath) {
		printError("--csr is required");
		process.exit(1);
	}

	// Read and encode CSR
	let csrContent: string;
	try {
		const csrData = await readFile(csrPath, "utf-8");
		// If PEM, extract base64 content
		const pemMatch = csrData.match(
			/-----BEGIN[^-]+-----\s*([\s\S]+?)\s*-----END[^-]+-----/,
		);
		if (pemMatch) {
			csrContent = pemMatch[1].replace(/\s/g, "");
		} else {
			csrContent = csrData.replace(/\s/g, "");
		}
	} catch (error) {
		printError(`Failed to read CSR file: ${(error as Error).message}`);
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.post<CertificateResponse>("/v1/certificates", {
		data: {
			type: "certificates",
			attributes: {
				certificateType,
				csrContent,
			},
		},
	});

	printSuccess(`Created certificate: ${response.data.attributes.name}`);
	printOutput(response, format);
}

async function revokeCertificate(ctx: CommandContext): Promise<void> {
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

	await client.delete(`/v1/certificates/${id}`);
	printSuccess(`Revoked certificate ${id}`);
}

async function downloadCertificate(ctx: CommandContext): Promise<void> {
	const id = ctx.args.options.id as string;
	const outputPath = ctx.args.options.output as string | undefined;

	if (!id) {
		printError("--id is required");
		process.exit(1);
	}

	const creds = await requireCredentials({ profile: ctx.global.profile });
	const client = await Client.fromCredentials(creds, {
		debug: ctx.global.debug,
		apiDebug: ctx.global.apiDebug,
	});

	const response = await client.get<CertificateResponse>(
		`/v1/certificates/${id}`,
	);
	const certContent = response.data.attributes.certificateContent;

	if (!certContent) {
		printError("Certificate has no content");
		process.exit(1);
	}

	// Decode base64 and format as PEM
	const decodedCert = Buffer.from(certContent, "base64");
	const pemCert = `-----BEGIN CERTIFICATE-----\n${certContent.match(/.{1,64}/g)?.join("\n") || certContent}\n-----END CERTIFICATE-----\n`;

	if (outputPath) {
		await Bun.write(outputPath, pemCert);
		printSuccess(`Certificate saved to ${outputPath}`);
	} else {
		console.log(pemCert);
	}
}

export function registerCertificatesCommands(): void {
	registry.register(certificatesCommand);
}
