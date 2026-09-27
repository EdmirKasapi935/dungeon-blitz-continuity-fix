import * as fs from "fs";
import * as path from "path";
import { parseSwz, writeSwz, ensureBackup } from "./swzPatchUtils";

const swzPath = path.resolve(
    __dirname,
    "..",
    "..",
    "client",
    "content",
    "localhost",
    "p",
    "cbq",
    "Game.en.swz"
);

const extractedDir = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "temp",
    "Game.en"
);

console.log("SWZ:", swzPath);
console.log("Extracted files:", extractedDir);

if (!fs.existsSync(swzPath)) {
    throw new Error(`SWZ file not found: ${swzPath}`);
}

if (!fs.existsSync(extractedDir)) {
    throw new Error(`Extracted directory not found: ${extractedDir}`);
}

// Make a backup before touching the original.
const backup = ensureBackup(swzPath);
console.log(`Backup: ${backup}`);

// Read the original SWZ so we preserve its key and chunk structure.
const swz = parseSwz(swzPath);

console.log(`Original chunks: ${swz.chunks.length}`);

// Replace every chunk with the edited XML from temp\Game.en.
for (const chunk of swz.chunks) {
    const xmlPath = path.join(
        extractedDir,
        `chunk_${chunk.index}.xml`
    );

    if (!fs.existsSync(xmlPath)) {
        throw new Error(`Missing extracted chunk: ${xmlPath}`);
    }

    chunk.xml = fs.readFileSync(xmlPath, "utf8");
}

writeSwz(swz);

console.log("");
console.log("Successfully repacked Game.en.swz!");
console.log("Backup:", backup);