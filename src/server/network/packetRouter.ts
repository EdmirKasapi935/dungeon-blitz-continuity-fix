import { Client } from '../core/Client';
import { DebugLogger } from '../core/Debug';
import { GameLog } from '../core/GameLog';

type PacketHandler = (client: Client, data: Buffer) => void | Promise<void>;

export class PacketRouter {
    private handlers: Map<number, PacketHandler> = new Map();

    public register(packetId: number, handler: PacketHandler): void {
        this.handlers.set(packetId, handler);
    }

    public async handle(client: Client, packetId: number, data: Buffer): Promise<void> {
        const handler = this.handlers.get(packetId);
        if (handler) {
            try {
                DebugLogger.logRouter(client, packetId, handler.name, data);
                await handler(client, data);
            } catch (err) {
                GameLog.error(`[Router] Error in handler for 0x${packetId.toString(16)}:`, err);
            }
        } else {
            DebugLogger.logUnhandledPacket(client, packetId, data);
        }
    }
}
