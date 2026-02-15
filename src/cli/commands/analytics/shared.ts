export function resolveVendorNumber(
	options: Record<string, string | boolean | undefined>,
	profileVendorNumber: string | undefined,
): string | undefined {
	return (
		(options.vendor as string) ||
		process.env.ASC_VENDOR_NUMBER ||
		process.env.ASC_ANALYTICS_VENDOR_NUMBER ||
		profileVendorNumber
	);
}

export function printMissingVendorHelp(
	printError: (message: string) => void,
): void {
	printError(
		"--vendor is required (or set ASC_VENDOR_NUMBER env, or add to profile with 'asc auth edit')",
	);
	console.error(
		"\nTo find your vendor number:\n" +
			"  1. Go to https://appstoreconnect.apple.com/\n" +
			"  2. Navigate to 'Sales and Trends' or 'Payments and Financial Reports'\n" +
			"  3. Your vendor number is displayed at the top (usually 8 digits)\n" +
			"\nYou can add it to your profile with:\n" +
			"  asc auth edit -n <profile-name> -v <vendor-number>\n",
	);
}

export async function readStreamToBuffer(
	stream: ReadableStream,
): Promise<Buffer> {
	const chunks: Uint8Array[] = [];
	const reader = stream.getReader();

	while (true) {
		const result = await reader.read();
		if (result.done) break;
		chunks.push(result.value);
	}

	return Buffer.concat(chunks);
}
