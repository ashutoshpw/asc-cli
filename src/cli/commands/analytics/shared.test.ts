import { describe, expect, test } from "bun:test";
import { readStreamToBuffer } from "./shared";

describe("analytics stream helpers", () => {
	test("reads all chunks into a single buffer", async () => {
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("part-1"));
				controller.enqueue(new TextEncoder().encode("part-2"));
				controller.close();
			},
		});

		expect(await readStreamToBuffer(stream)).toEqual(
			Buffer.from("part-1part-2"),
		);
	});
});
