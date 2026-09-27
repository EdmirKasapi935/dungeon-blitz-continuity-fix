/**
 * reset-forge-tutorial.ts
 *
 * Lets you re-test the tutorial charm-forge free-speedup fix on an existing
 * character, instead of leveling a brand new one every time.
 *
 * Usage (run from src/server, server should be stopped while you use this):
 *
 *   npx ts-node tools/reset-forge-tutorial.ts <characterName> [options]
 *
 * Options:
 *   --show                 Just print the current eligibility-relevant state,
 *                          don't change anything.
 *   --clear-charms         Remove all owned charms (so the next craft counts
 *                          as their "first" charm again).
 *   --no-clear-used-flag   Skip resetting the tutorial_charm free-speedup
 *                          used flag (it's reset by default).
 *   --set-quest-tracker N  Force questTrackerState to N.
 *   --set-house-state N    Force the ClearYourHouse mission state to N
 *                          (0 = not started, 1 or 2 = in progress/eligible,
 *                          3 = claimed).
 *   --set-forge-rank N     Force the CraftTown forge building rank
 *                          (magicForge.stats_by_building['2']) to N.
 *
 * With no flags at all, it resets the "used" flag and clears any in-progress
 * forge craft, then prints the current state of every condition the tutorial
 * free-speedup eligibility check looks at - so you can see at a glance
 * whether the next craft attempt should qualify, before even starting the
 * server.
 */

import * as fs from 'fs';
import * as path from 'path';

const CLEAR_YOUR_HOUSE_MISSION_ID = 5;
const FORGE_BUILDING_ID = '2';

function parseArgs(argv: string[]): {
    characterName: string;
    show: boolean;
    clearCharms: boolean;
    clearUsedFlag: boolean;
    setQuestTracker: number | null;
    setHouseState: number | null;
    setForgeRank: number | null;
} {
    const positional: string[] = [];
    const result = {
        characterName: '',
        show: false,
        clearCharms: false,
        clearUsedFlag: true,
        setQuestTracker: null as number | null,
        setHouseState: null as number | null,
        setForgeRank: null as number | null
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        switch (arg) {
            case '--show':
                result.show = true;
                break;
            case '--clear-charms':
                result.clearCharms = true;
                break;
            case '--no-clear-used-flag':
                result.clearUsedFlag = false;
                break;
            case '--set-quest-tracker':
                result.setQuestTracker = Number(argv[++i]);
                break;
            case '--set-house-state':
                result.setHouseState = Number(argv[++i]);
                break;
            case '--set-forge-rank':
                result.setForgeRank = Number(argv[++i]);
                break;
            default:
                positional.push(arg);
        }
    }

    result.characterName = positional[0] || '';
    return result;
}

function findSaveFiles(savesDir: string): string[] {
    return fs.readdirSync(savesDir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => path.join(savesDir, name));
}

function main(): void {
    const args = parseArgs(process.argv.slice(2));
    if (!args.characterName) {
        console.log('Usage: npx ts-node tools/reset-forge-tutorial.ts <characterName> [options]');
        console.log('Run with no character name for full option list (see file header comment).');
        process.exit(1);
    }

    const savesDir = path.resolve(__dirname, '..', 'data', 'saves');
    if (!fs.existsSync(savesDir)) {
        console.error(`Saves directory not found at ${savesDir}`);
        process.exit(1);
    }

    const target = args.characterName.toLowerCase();
    let found = false;

    for (const filePath of findSaveFiles(savesDir)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        let parsed: { user_id: number; characters: any[] };
        try {
            parsed = JSON.parse(raw);
        } catch {
            continue;
        }

        if (!Array.isArray(parsed.characters)) {
            continue;
        }

        const character = parsed.characters.find((c) => String(c?.name ?? '').toLowerCase() === target);
        if (!character) {
            continue;
        }

        found = true;
        console.log(`Found "${character.name}" in ${path.basename(filePath)} (user_id=${parsed.user_id})`);

        if (!args.show) {
            if (args.clearUsedFlag) {
                if (character.forgeFreeSpeedupUses && typeof character.forgeFreeSpeedupUses === 'object') {
                    delete character.forgeFreeSpeedupUses.tutorial_charm;
                }
            }

            if (args.clearCharms) {
                character.charms = [];
            }

            // Clear any in-progress craft so the next start-forge request is clean.
            if (character.magicForge && typeof character.magicForge === 'object') {
                character.magicForge.primary = 0;
                character.magicForge.secondary = 0;
                character.magicForge.ReadyTime = 0;
                character.magicForge.secondary_tier = 0;
                character.magicForge.usedlist = 0;
                character.magicForge.forge_roll_a = 0;
                character.magicForge.forge_roll_b = 0;
                character.magicForge.is_extended_forge = false;
                character.magicForge.free_speedup_reason = '';
            }

            if (args.setQuestTracker !== null && Number.isFinite(args.setQuestTracker)) {
                character.questTrackerState = args.setQuestTracker;
            }

            if (args.setHouseState !== null && Number.isFinite(args.setHouseState)) {
                if (!character.missions || typeof character.missions !== 'object' || Array.isArray(character.missions)) {
                    character.missions = {};
                }
                const key = String(CLEAR_YOUR_HOUSE_MISSION_ID);
                const existing = character.missions[key] && typeof character.missions[key] === 'object'
                    ? character.missions[key]
                    : {};
                character.missions[key] = { ...existing, state: args.setHouseState };
            }

            if (args.setForgeRank !== null && Number.isFinite(args.setForgeRank)) {
                if (!character.magicForge || typeof character.magicForge !== 'object') {
                    character.magicForge = {};
                }
                if (!character.magicForge.stats_by_building || typeof character.magicForge.stats_by_building !== 'object') {
                    character.magicForge.stats_by_building = {};
                }
                character.magicForge.stats_by_building[FORGE_BUILDING_ID] = args.setForgeRank;
            }

            fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2));
            console.log('Save updated.');
        }

        // Print the current state of every condition the tutorial free-speedup
        // eligibility check looks at, so you know what to expect before testing.
        const houseState = character.missions?.[String(CLEAR_YOUR_HOUSE_MISSION_ID)]?.state ?? 0;
        const forgeRank = character.magicForge?.stats_by_building?.[FORGE_BUILDING_ID] ?? 0;
        const alreadyUsed = Boolean(character.forgeFreeSpeedupUses?.tutorial_charm);
        const charmCount = Array.isArray(character.charms) ? character.charms.length : 0;

        console.log('');
        console.log('Current eligibility-relevant state:');
        console.log(`  questTrackerState:        ${character.questTrackerState ?? 0}  (needs >= 100)`);
        console.log(`  ClearYourHouse state:     ${houseState}  (needs to be 1 or 2, not 0 and not 3)`);
        console.log(`  Forge building rank:      ${forgeRank}  (needs >= 1)`);
        console.log(`  tutorial_charm used flag: ${alreadyUsed}  (needs to be false)`);
        console.log(`  Owned charm count:        ${charmCount}`);
        break;
    }

    if (!found) {
        console.error(`No character named "${args.characterName}" found in any save file under ${savesDir}`);
        process.exit(1);
    }
}

main();
