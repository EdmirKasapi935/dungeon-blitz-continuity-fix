import type { Client } from './Client';

// Centralized, color-coded logging for the events that matter most when
// diagnosing a live-server issue: area changes, dungeon start/end, loot
// drops, and errors/warnings. Every category gets its own color and a
// consistent `[HH:MM:SS] [CATEGORY] message  key=value ...` shape so a
// scrollback full of packet noise still lets these jump out.
//
// This intentionally mirrors the env-toggle pattern already used by
// DebugConfig in ./Debug.ts, so the same conventions apply to both.

function parseBooleanEnv(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (raw === undefined) {
        return fallback;
    }

    switch (String(raw).trim().toLowerCase()) {
        case '1':
        case 'true':
        case 'yes':
        case 'on':
            return true;
        case '0':
        case 'false':
        case 'no':
        case 'off':
            return false;
        default:
            return fallback;
    }
}

export const GameLogConfig = {
    enabled: parseBooleanEnv('GAMELOG_ENABLED', true),
    area: parseBooleanEnv('GAMELOG_AREA', true),
    dungeon: parseBooleanEnv('GAMELOG_DUNGEON', true),
    loot: parseBooleanEnv('GAMELOG_LOOT', true),
    // Errors/warnings are intentionally not gate-able independently of the
    // master switch - they should not be easy to silence by accident.
    // The raw per-packet multiplayer-hp-sync / loot-sync trace (very high
    // volume, only useful when actively hunting a sync bug). Off by default
    // so day-to-day logs stay readable; flip GAMELOG_SYNC_NOISE=1 when you
    // need it back.
    syncNoise: parseBooleanEnv('GAMELOG_SYNC_NOISE', false),
    // Step-by-step dungeon-completion decision trace (boss-defeated state,
    // what's still alive and blocking completion, etc). On by default - this
    // has turned out to be the single most useful signal for diagnosing
    // "dungeon won't end" bugs, so it's not worth having to remember to flip
    // on each time. Set GAMELOG_DUNGEON_TRACE=0 to quiet it down if it ever
    // gets in the way.
    dungeonTrace: parseBooleanEnv('GAMELOG_DUNGEON_TRACE', true)
};

const ANSI = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    blue: '\x1b[94m',
    green: '\x1b[32m',
    brightGreen: '\x1b[92m',
    yellow: '\x1b[33m',
    amber: '\x1b[38;5;214m',
    magenta: '\x1b[38;5;170m',
    orange: '\x1b[38;5;208m',
    red: '\x1b[31m',
    gray: '\x1b[90m',
    brightWhite: '\x1b[97m',
    skyBlue1: '\x1b[38;5;117m'
} as const;

type LogCategory = 'AREA' | 'DUNGEON_START' | 'DUNGEON_END' | 'DUNGEON_TRACE' | 'LOOT' | 'WARN' | 'ERROR';

const CATEGORY_COLOR: Record<LogCategory, string> = {
    AREA: ANSI.cyan,
    DUNGEON_START: ANSI.green,
    DUNGEON_END: ANSI.brightGreen,
    DUNGEON_TRACE: ANSI.skyBlue1,
    LOOT: ANSI.yellow,
    WARN: ANSI.orange,
    ERROR: ANSI.red
};

// DUNGEON_TRACE is high-volume and purely supplementary (only prints at all
// when someone opts in via GAMELOG_DUNGEON_TRACE) - keep it un-bold so it
// reads as background detail and doesn't visually compete with genuine
// alerts (WARN/ERROR) or discrete events (AREA/DUNGEON_START/END/LOOT).
const CATEGORY_BOLD: Record<LogCategory, boolean> = {
    AREA: true,
    DUNGEON_START: true,
    DUNGEON_END: true,
    DUNGEON_TRACE: false,
    LOOT: true,
    WARN: true,
    ERROR: true
};

// WARN has grown into a catch-all for several very different domains
// (multiplayer-sync desyncs, loot getting blocked, dungeon-completion data
// gaps). Rather than touch every call site, pick the color from the
// message's own leading `[Tag]` so each domain reads distinctly at a glance
// while still going through the one `GameLog.warn` entry point. Order
// matters - first match wins - so put more specific tags first.
const WARN_DOMAIN_COLORS: ReadonlyArray<{ prefix: string; color: string }> = [
    { prefix: '[DungeonCompletion]', color: ANSI.magenta },
    { prefix: '[LootSync]', color: ANSI.amber },
    { prefix: '[MultiplayerSync]', color: ANSI.orange }
];

function resolveWarnColor(message: string): string {
    for (const { prefix, color } of WARN_DOMAIN_COLORS) {
        if (message.startsWith(prefix)) {
            return color;
        }
    }
    return ANSI.orange;
}

function timestamp(): string {
    return new Date().toTimeString().slice(0, 8);
}

function formatFieldValue(value: unknown): string {
    if (value === null || value === undefined) {
        return String(value);
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
}

function formatFields(fields: Record<string, unknown> | undefined): string {
    if (!fields) {
        return '';
    }
    const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
    if (entries.length <= 0) {
        return '';
    }
    return ' ' + entries.map(([key, value]) => `${key}=${formatFieldValue(value)}`).join(' ');
}

function formatClientTag(client: Client | null | undefined): string {
    const name = client?.character?.name;
    return name ? String(name) : '-';
}

function build(category: LogCategory, message: string, fields?: Record<string, unknown>, colorOverride?: string): string {
    const color = colorOverride ?? CATEGORY_COLOR[category];
    const weight = CATEGORY_BOLD[category] ? ANSI.bold : ANSI.dim;
    return `${weight}${color}[${timestamp()}] [${category}] ${message}${formatFields(fields)}${ANSI.reset}`;
}

export class GameLog {
    /** A player changed level/zone (non-dungeon area transitions). */
    static area(client: Client | null | undefined, fromLevel: string, toLevel: string, fields: Record<string, unknown> = {}): void {
        if (!GameLogConfig.enabled || !GameLogConfig.area) {
            return;
        }
        const who = formatClientTag(client);
        console.log(build('AREA', `${who} moved ${fromLevel || '-'} -> ${toLevel || '-'}`, fields));
    }

    /** A player entered a dungeon instance. */
    static dungeonStart(client: Client | null | undefined, levelName: string, fields: Record<string, unknown> = {}): void {
        if (!GameLogConfig.enabled || !GameLogConfig.dungeon) {
            return;
        }
        const who = formatClientTag(client);
        console.log(build('DUNGEON_START', `${who} entered ${levelName || '-'}`, fields));
    }

    /** A dungeon was completed/finalized. */
    static dungeonEnd(client: Client | null | undefined, levelName: string, fields: Record<string, unknown> = {}): void {
        if (!GameLogConfig.enabled || !GameLogConfig.dungeon) {
            return;
        }
        const who = formatClientTag(client);
        console.log(build('DUNGEON_END', `${who} completed ${levelName || '-'}`, fields));
    }

    /**
     * Step-by-step dungeon-completion decision trace: is the boss defeated,
     * is something still alive blocking completion, etc. On by default (see
     * GameLogConfig.dungeonTrace) - this replaces writing a new one-off debug
     * probe every time a "dungeon won't end" bug comes up.
     */
    static dungeonTrace(client: Client | null | undefined, message: string, fields: Record<string, unknown> = {}): void {
        if (!GameLogConfig.enabled || !GameLogConfig.dungeonTrace) {
            return;
        }
        const who = formatClientTag(client);
        console.log(build('DUNGEON_TRACE', `${who ? `${who} ` : ''}${message}`, fields));
    }

    /** A loot/reward drop was generated for a player. */
    static loot(client: Client | null | undefined, itemLabel: string, fields: Record<string, unknown> = {}): void {
        if (!GameLogConfig.enabled || !GameLogConfig.loot) {
            return;
        }
        const who = formatClientTag(client);
        console.log(build('LOOT', `${who} received ${itemLabel || '-'}`, fields));
    }

    /**
     * Recoverable oddity worth a second look - not necessarily a failure.
     * Color varies by domain (see WARN_DOMAIN_COLORS) based on the message's
     * own leading [Tag], so e.g. a loot-blocked warning reads visibly
     * differently from a multiplayer-sync desync or a dungeon-config gap,
     * without every call site needing to know about colors at all.
     */
    static warn(message: unknown, ...args: unknown[]): void {
        const text = typeof message === 'string' ? message : String(message);
        console.warn(build('WARN', text, undefined, resolveWarnColor(text)), ...args);
    }

    /** Caught exceptions / rejected or invalid states. Always on. */
    static error(message: unknown, ...args: unknown[]): void {
        const text = typeof message === 'string' ? message : String(message);
        console.error(build('ERROR', text), ...args);
    }
}