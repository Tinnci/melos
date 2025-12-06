import { describe, it, expect } from "bun:test";
import { MusicXMLToMNX } from "../src/index";
import * as fs from "fs";
import * as path from "path";

// Define paths
const DATA_DIR = path.join(import.meta.dir, "data/musicxml");
const SNAPSHOT_DIR = path.join(import.meta.dir, "snapshots");

// Ensure snapshot directory exists
if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

describe("W3C MNX Snapshot Suite", () => {
    const converter = new MusicXMLToMNX();

    // Read all XML files from the data directory
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".xml"));

    if (files.length === 0) {
        console.warn("No MusicXML files found in test/data/musicxml. Skipping snapshot tests.");
    }

    files.forEach(file => {
        it(`should match snapshot for ${file}`, () => {
            const xmlPath = path.join(DATA_DIR, file);
            const xmlContent = fs.readFileSync(xmlPath, "utf-8");

            try {
                // Convert to MNX
                const mnx = converter.convert(xmlContent);

                // Serialize deterministically
                const mnxJson = JSON.stringify(mnx, null, 2);

                // Define snapshot path
                const snapshotPath = path.join(SNAPSHOT_DIR, `${file}.mnx`);

                // If snapshot doesn't exist, create it (Update mode)
                // In a real CI env, we might want to fail if missing, but for dev setup we create.
                // Or we can use Bun's expect(mnx).toMatchSnapshot() but that uses internal format.
                // Using explicit files allows interoperability checks.
                if (!fs.existsSync(snapshotPath)) {
                    console.log(`Creating new snapshot for ${file}...`);
                    fs.writeFileSync(snapshotPath, mnxJson);
                }

                // Read expected snapshot
                const expectedMnxJson = fs.readFileSync(snapshotPath, "utf-8");

                // We compare parsed objects to avoid newline/spacing issues
                const actualObj = JSON.parse(mnxJson);
                const expectedObj = JSON.parse(expectedMnxJson);

                expect(actualObj).toEqual(expectedObj);

            } catch (err) {
                console.error(`Failed to convert or check ${file}:`, err);
                throw err;
            }
        });
    });
});
