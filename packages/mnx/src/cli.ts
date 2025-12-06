import { MnxParser } from "./parser";
import { MnxValidator } from "./validator";
import * as fs from "fs";
import * as path from "path";

const args = process.argv.slice(2);

if (args.length === 0) {
    console.error("Usage: melos-check <path-to-mnx-json>");
    process.exit(1);
}

const filePath = args[0];
const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
}

try {
    console.log(`Reading ${absolutePath}...`);
    const fileContent = fs.readFileSync(absolutePath, "utf-8");

    console.log(`Parsing MNX...`);
    const score = MnxParser.parse(fileContent);

    console.log(`Validating...`);
    const issues = MnxValidator.validate(score);

    if (issues.length === 0) {
        console.log("✅ No issues found. The MNX score is valid.");
        process.exit(0);
    } else {
        console.log(`⚠️ Found ${issues.length} issues:`);
        issues.forEach((issue) => {
            const icon = issue.type === "error" ? "❌" : "⚠️";
            console.log(`${icon} [${issue.type.toUpperCase()}] ${issue.message}`);
            console.log(`   Path: ${issue.path}`);
        });
        process.exit(1);
    }

} catch (err) {
    console.error("❌ Fatal Error:", err);
    process.exit(1);
}
