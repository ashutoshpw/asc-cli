import { DOMParser, type Element } from "@xmldom/xmldom";
import { gunzipSync, strFromU8, unzipSync, unzlibSync } from "fflate";
import { parse } from "plist";
import type { BuildUploadFileUti } from "../api/types/build-uploads";
import type { AppStorePlatform } from "../api/types/commerce-versions";

export interface BuildPackageMetadata {
	format: "ipa" | "pkg";
	uti: Extract<BuildUploadFileUti, "com.apple.ipa" | "com.apple.pkg">;
	marketingVersion?: string;
	buildNumber?: string;
	platform?: AppStorePlatform;
}

export async function inspectBuildPackage(
	filePath: string,
): Promise<BuildPackageMetadata> {
	const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
	return inspectBuildPackageBytes(
		new Uint8Array(await Bun.file(filePath).arrayBuffer()),
		fileName,
	);
}

export function inspectBuildPackageBytes(
	bytes: Uint8Array,
	fileName: string,
): BuildPackageMetadata {
	const extension = fileName.toLowerCase().split(".").pop();
	if (extension === "ipa") return inspectIpa(bytes);
	if (extension === "pkg") return inspectPkg(bytes);
	throw new Error("Build file must have an .ipa or .pkg extension");
}

function inspectIpa(bytes: Uint8Array): BuildPackageMetadata {
	let files: Record<string, Uint8Array>;
	try {
		files = unzipSync(bytes);
	} catch (error) {
		throw new Error(
			`Could not read IPA ZIP archive: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const plistPaths = Object.keys(files).filter((path) =>
		/^Payload\/[^/]+\.app\/Info\.plist$/i.test(path),
	);
	if (plistPaths.length !== 1) {
		throw new Error(
			`Expected exactly one Payload/*.app/Info.plist in IPA, found ${plistPaths.length}`,
		);
	}

	const plist = parsePlist(files[plistPaths[0] as string]);
	return {
		format: "ipa",
		uti: "com.apple.ipa",
		marketingVersion: stringValue(plist.CFBundleShortVersionString),
		buildNumber: stringValue(plist.CFBundleVersion),
		platform: platformFromPlist(plist),
	};
}

function inspectPkg(bytes: Uint8Array): BuildPackageMetadata {
	const packageInfo = extractXarFile(bytes, "PackageInfo");
	const xml = strFromU8(packageInfo);
	const document = new DOMParser().parseFromString(xml, "application/xml");
	const root = document.documentElement;
	if (!root || root.nodeName === "parsererror") {
		throw new Error("PKG PackageInfo is not valid XML");
	}

	const values: Record<string, string> = {};
	walkElements(root, (element) => {
		for (const name of [
			"CFBundleShortVersionString",
			"CFBundleVersion",
			"version",
		]) {
			const value = element.getAttribute(name);
			if (value && !values[name]) values[name] = value;
		}
	});

	return {
		format: "pkg",
		uti: "com.apple.pkg",
		marketingVersion: values.CFBundleShortVersionString || values.version,
		buildNumber: values.CFBundleVersion,
		platform: "MAC_OS",
	};
}

function parsePlist(bytes: Uint8Array): Record<string, unknown> {
	try {
		const value = parse(bytes);
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			throw new Error("root value is not a dictionary");
		}
		return value as Record<string, unknown>;
	} catch (error) {
		throw new Error(
			`Could not parse Info.plist: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

function stringValue(value: unknown): string | undefined {
	if (typeof value === "string") return value;
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return undefined;
}

function platformFromPlist(
	plist: Record<string, unknown>,
): AppStorePlatform | undefined {
	const candidates = [
		stringValue(plist.DTPlatformName),
		stringValue(plist.DTSDKName),
		...(Array.isArray(plist.CFBundleSupportedPlatforms)
			? plist.CFBundleSupportedPlatforms.map(stringValue)
			: []),
	]
		.filter(Boolean)
		.map((value) => value?.toLowerCase() ?? "");

	if (candidates.some((value) => value.includes("iphoneos"))) return "IOS";
	if (candidates.some((value) => value.includes("appletvos"))) return "TV_OS";
	if (candidates.some((value) => value.includes("xros"))) return "VISION_OS";
	if (candidates.some((value) => value.includes("macosx"))) return "MAC_OS";
	return undefined;
}

interface XarEntry {
	name: string;
	offset: number;
	size: number;
	length: number;
	encoding?: string;
}

function extractXarFile(bytes: Uint8Array, requestedName: string): Uint8Array {
	if (bytes.length < 28 || strFromU8(bytes.subarray(0, 4)) !== "xar!") {
		throw new Error("PKG is not a valid XAR archive");
	}

	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const headerSize = view.getUint16(4, false);
	const compressedTocLength = safeNumber(
		view.getBigUint64(8, false),
		"compressed TOC length",
	);
	const uncompressedTocLength = safeNumber(
		view.getBigUint64(16, false),
		"uncompressed TOC length",
	);
	const tocEnd = headerSize + compressedTocLength;
	if (headerSize < 28 || tocEnd > bytes.length) {
		throw new Error("PKG XAR TOC is outside the archive");
	}

	let toc: Uint8Array;
	try {
		toc = unzlibSync(bytes.subarray(headerSize, tocEnd));
	} catch (error) {
		throw new Error(
			`Could not decompress PKG XAR TOC: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	if (toc.length !== uncompressedTocLength) {
		throw new Error("PKG XAR TOC length does not match its header");
	}

	const document = new DOMParser().parseFromString(
		strFromU8(toc),
		"application/xml",
	);
	const entries: XarEntry[] = [];
	for (const node of Array.from(document.getElementsByTagName("file"))) {
		const name = childText(node, "name");
		const data = node.getElementsByTagName("data")[0];
		if (!name || !data) continue;
		const offset = Number(childText(data, "offset"));
		const size = Number(childText(data, "size"));
		const length = Number(childText(data, "length"));
		if (![offset, size, length].every((value) => Number.isSafeInteger(value))) {
			continue;
		}
		entries.push({
			name,
			offset,
			size,
			length,
			encoding:
				data.getElementsByTagName("encoding")[0]?.getAttribute("style") ||
				undefined,
		});
	}

	const entry = entries.find(
		(value) =>
			value.name === requestedName || value.name.endsWith(`/${requestedName}`),
	);
	if (!entry)
		throw new Error(`PKG XAR archive does not contain ${requestedName}`);
	// XAR data offsets are relative to the start of the heap, which follows
	// the header and compressed TOC. Treating them as archive-absolute works
	// only for fixtures that encode non-standard archive-absolute offsets.
	const heapStart = tocEnd;
	const dataStart = heapStart + entry.offset;
	if (
		entry.offset < 0 ||
		entry.size < 0 ||
		entry.length < 0 ||
		!Number.isSafeInteger(dataStart) ||
		dataStart < heapStart ||
		dataStart + entry.length > bytes.length
	) {
		throw new Error(`PKG XAR entry ${requestedName} is outside the archive`);
	}

	const encoded = bytes.subarray(dataStart, dataStart + entry.length);
	try {
		const decoded = entry.encoding?.includes("gzip")
			? gunzipSync(encoded)
			: !entry.encoding || entry.encoding === "application/octet-stream"
				? encoded
				: undefined;
		if (!decoded) throw new Error(`unsupported XAR encoding ${entry.encoding}`);
		if (decoded.byteLength !== entry.size) {
			throw new Error(`XAR entry ${requestedName} size does not match its TOC`);
		}
		return decoded;
	} catch (error) {
		throw new Error(
			`Could not extract PKG ${requestedName}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

function childText(element: Element, name: string): string | undefined {
	const child = Array.from(element.childNodes).find(
		(node) => node.nodeType === 1 && node.nodeName === name,
	);
	return child?.textContent?.trim() || undefined;
}

function walkElements(
	element: Element,
	visitor: (element: Element) => void,
): void {
	visitor(element);
	for (const child of Array.from(element.childNodes)) {
		if (child.nodeType === 1) walkElements(child as Element, visitor);
	}
}

function safeNumber(value: bigint, label: string): number {
	const number = Number(value);
	if (!Number.isSafeInteger(number))
		throw new Error(`PKG ${label} exceeds safe integer range`);
	return number;
}
