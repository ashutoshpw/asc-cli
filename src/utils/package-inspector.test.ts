import { describe, expect, test } from "bun:test";
import { gzipSync, zipSync, zlibSync } from "fflate";
import { buildBinary } from "plist";
import {
	type BuildPackageMetadata,
	inspectBuildPackageBytes,
} from "./package-inspector";

function makeXarPackageInfo(
	contents: string,
	encoding: "raw" | "gzip" = "raw",
): Uint8Array {
	const xmlBytes = new TextEncoder().encode(contents);
	const payload = encoding === "gzip" ? gzipSync(xmlBytes) : xmlBytes;
	const headerSize = 28;
	// XAR offsets are relative to the heap, immediately after the compressed
	// TOC, rather than absolute archive offsets.
	const offset = 0;
	const tocDocument = `<?xml version="1.0" encoding="UTF-8"?><xar><toc><file><name>PackageInfo</name><data><offset>${offset}</offset><size>${xmlBytes.byteLength}</size><length>${payload.byteLength}</length>${encoding === "gzip" ? '<encoding style="application/x-gzip"/>' : ""}</data></file></toc></xar>`;
	const toc = new TextEncoder().encode(tocDocument);
	const compressed = zlibSync(toc);
	const header = new Uint8Array(headerSize);
	header.set(new TextEncoder().encode("xar!"));
	const view = new DataView(header.buffer);
	view.setUint16(4, headerSize, false);
	view.setUint16(6, 1, false);
	view.setBigUint64(8, BigInt(compressed.byteLength), false);
	view.setBigUint64(16, BigInt(toc.byteLength), false);
	view.setUint32(24, 0, false);
	const heapStart = headerSize + compressed.byteLength;
	const archive = new Uint8Array(heapStart + offset + payload.byteLength);
	archive.set(header, 0);
	archive.set(compressed, header.byteLength);
	archive.set(payload, heapStart + offset);
	return archive;
}

describe("build package inspector", () => {
	test("reads version, build number, and platform from a binary-plist IPA", () => {
		const ipa = zipSync({
			"Payload/Demo.app/Info.plist": buildBinary({
				CFBundleShortVersionString: "3.2.1",
				CFBundleVersion: "87",
				DTPlatformName: "iphoneos",
			}),
		});

		const result = inspectBuildPackageBytes(ipa, "Demo.ipa");

		expect(result).toEqual<BuildPackageMetadata>({
			format: "ipa",
			uti: "com.apple.ipa",
			marketingVersion: "3.2.1",
			buildNumber: "87",
			platform: "IOS",
		});
	});

	test("reads version and build number from a gzip-compressed PKG PackageInfo", () => {
		const pkg = makeXarPackageInfo(
			'<pkg-info format-version="2" CFBundleShortVersionString="4.0" CFBundleVersion="12"/>',
			"gzip",
		);

		const result = inspectBuildPackageBytes(pkg, "Demo.pkg");

		expect(result).toEqual<BuildPackageMetadata>({
			format: "pkg",
			uti: "com.apple.pkg",
			marketingVersion: "4.0",
			buildNumber: "12",
			platform: "MAC_OS",
		});
	});

	test("requires a supported extension and exactly one IPA app plist", () => {
		expect(() =>
			inspectBuildPackageBytes(new Uint8Array(), "Demo.zip"),
		).toThrow(".ipa or .pkg");

		const ipa = zipSync({
			"Payload/One.app/Info.plist": buildBinary({}),
			"Payload/Two.app/Info.plist": buildBinary({}),
		});
		expect(() => inspectBuildPackageBytes(ipa, "Demo.ipa")).toThrow(
			"Expected exactly one",
		);
	});
});
