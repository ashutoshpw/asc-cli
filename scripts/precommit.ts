const MAX_FILE_LINES = 500;
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const decoder = new TextDecoder();

type CommandResult = ReturnType<typeof Bun.spawnSync>;

function runCommand(cmd: string[], inheritOutput = false): CommandResult {
	return Bun.spawnSync({
		cmd,
		stdout: inheritOutput ? "inherit" : "pipe",
		stderr: inheritOutput ? "inherit" : "pipe",
	});
}

function decodeOutput(output: Uint8Array): string {
	return decoder.decode(output);
}

function failWithCommandError(cmd: string[], result: CommandResult): never {
	const stderr = decodeOutput(result.stderr).trim();
	console.error(`Failed command: ${cmd.join(" ")}`);
	if (stderr) {
		console.error(stderr);
	}
	process.exit(1);
}

function getStagedFiles(): string[] {
	const cmd = ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"];
	const result = runCommand(cmd);
	if (result.exitCode !== 0) {
		failWithCommandError(cmd, result);
	}

	return decodeOutput(result.stdout)
		.split("\0")
		.map((file) => file.trim())
		.filter(Boolean);
}

function getStagedFileContent(filePath: string): string {
	const cmd = ["git", "show", `:${filePath}`];
	const result = runCommand(cmd);
	if (result.exitCode !== 0) {
		failWithCommandError(cmd, result);
	}
	return decodeOutput(result.stdout);
}

function countLines(content: string): number {
	if (!content) {
		return 0;
	}
	const normalized = content.replace(/\r\n/g, "\n");
	const lines = normalized.split("\n");
	return normalized.endsWith("\n") ? lines.length - 1 : lines.length;
}

function isCodeFile(filePath: string): boolean {
	const extension = filePath.slice(filePath.lastIndexOf("."));
	return CODE_EXTENSIONS.has(extension);
}

function isTestFile(filePath: string): boolean {
	const normalizedPath = filePath.replaceAll("\\", "/");

	if (!/\.[cm]?[jt]sx?$/.test(normalizedPath)) {
		return false;
	}

	return (
		/(^|\/)(__tests__|tests?)\//.test(normalizedPath) ||
		/\.(test|spec)\.[cm]?[jt]sx?$/.test(normalizedPath)
	);
}

function runLineLimitCheck(stagedFiles: string[]): void {
	const oversizedFiles: Array<{ file: string; lines: number }> = [];

	for (const file of stagedFiles) {
		if (!isCodeFile(file)) {
			continue;
		}

		const lineCount = countLines(getStagedFileContent(file));
		if (lineCount > MAX_FILE_LINES) {
			oversizedFiles.push({ file, lines: lineCount });
		}
	}

	if (oversizedFiles.length === 0) {
		console.log(`Line limit check passed (max ${MAX_FILE_LINES} lines per code file).`);
		return;
	}

	console.error(`\nPre-commit failed: some staged files exceed ${MAX_FILE_LINES} lines:`);
	for (const file of oversizedFiles) {
		console.error(`- ${file.file}: ${file.lines} lines`);
	}
	console.error("\nHow to break a large file down:");
	console.error("1. Extract reusable utilities into focused modules.");
	console.error("2. Split command/workflow logic into smaller feature files.");
	console.error("3. Move types/constants/helpers into dedicated files close to usage.");
	console.error("\nReduce file size and re-stage changes before committing.");
	process.exit(1);
}

function runStagedTests(stagedFiles: string[]): void {
	const stagedTestFiles = stagedFiles.filter(isTestFile);

	if (stagedTestFiles.length === 0) {
		console.log("No staged test files detected. Skipping tests.");
		return;
	}

	console.log(`Running tests for staged files (${stagedTestFiles.length}):`);
	for (const file of stagedTestFiles) {
		console.log(`- ${file}`);
	}

	const cmd = ["bun", "test", ...stagedTestFiles];
	const result = runCommand(cmd, true);
	if (result.exitCode !== 0) {
		process.exit(result.exitCode ?? 1);
	}
}

const stagedFiles = getStagedFiles();
if (stagedFiles.length === 0) {
	console.log("No staged files detected. Skipping pre-commit checks.");
	process.exit(0);
}

runLineLimitCheck(stagedFiles);
runStagedTests(stagedFiles);
console.log("Pre-commit checks passed.");
