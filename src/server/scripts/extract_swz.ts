import * as fs from "fs";
import * as path from "path";
import { parseSwz } from "./swzPatchUtils";

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

const outputDir = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "temp",
    "Game.en"
);

fs.mkdirSync(outputDir, { recursive: true });

const swz = parseSwz(swzPath);

console.log(`Found ${swz.chunks.length} chunks.`);

for (const chunk of swz.chunks) {
    const outputPath = path.join(
        outputDir,
        `chunk_${chunk.index}.xml`
    );

    fs.writeFileSync(outputPath, chunk.xml, "utf8");

    console.log(`Extracted chunk ${chunk.index}`);
}

console.log(`\nExtracted to: ${outputDir}`);