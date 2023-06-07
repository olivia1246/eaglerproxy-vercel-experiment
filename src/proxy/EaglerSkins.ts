import { Constants } from "./Constants.js"
import { Enums } from "./Enums.js"
import { MineProtocol } from "./Protocol.js"
import { Util } from "./Util.js"
import sharp from "sharp"
import { Proxy } from "./Proxy.js"
import { Player } from "./Player.js"
import { CSChannelMessagePacket } from "./packets/channel/CSChannelMessage.js"
import { SCChannelMessagePacket } from "./packets/channel/SCChannelMessage.js"
import { Logger } from "../logger.js"

// TODO: convert all functions to use MineProtocol's UUID manipulation functions

export namespace EaglerSkins {
    export type ClientFetchEaglerSkin = {
        id: Enums.EaglerSkinPacketId.CFetchSkinEaglerPlayerReq,
        uuid: string
    }
    
    export type ServerFetchSkinResultBuiltIn = {
        id: Enums.EaglerSkinPacketId.SFetchSkinBuiltInRes,
        uuid: string,
        skinId: number
    }
    
    export type ServerFetchSkinResultCustom = {
        id: Enums.EaglerSkinPacketId.SFetchSkinRes,
        uuid: string,
        skin: Util.BoundedBuffer<typeof Constants.EAGLERCRAFT_SKIN_CUSTOM_LENGTH>
    }
    
    export type ClientDownloadSkinRequest = {
        id: Enums.EaglerSkinPacketId.CFetchSkinReq,
        uuid: string,
        url: string
    }

    export function downloadSkin(skinUrl: string): Promise<Buffer> {
        const url = new URL(skinUrl)
        if (url.protocol != "https:" && url.protocol != "http:")
            throw new Error("Invalid skin URL protocol!")
        return new Promise<Buffer>(async (res, rej) => {
            const skin = await fetch(skinUrl)
            if (skin.status != 200) {
                rej(`Tried to fetch ${skinUrl}, got HTTP ${skin.status} instead!`)
                return
            } else {
                res(Buffer.from(await skin.arrayBuffer()))
            }
        })
    }

    export function readClientDownloadSkinRequestPacket(message: Buffer): ClientDownloadSkinRequest {
        const ret: ClientDownloadSkinRequest = {
            id: null,
            uuid: null,
            url: null
        }
        const id = MineProtocol.readVarInt(message),
            uuid = MineProtocol.readUUID(id.newBuffer),
            url = MineProtocol.readString(uuid.newBuffer, 1)
        ret.id = id.value
        ret.uuid = uuid.value
        ret.url = url.value
        return ret
    }

    export function writeClientDownloadSkinRequestPacket(uuid: string | Buffer, url: string): Buffer {
        return Buffer.concat([
            [Enums.EaglerSkinPacketId.CFetchSkinReq],
            MineProtocol.writeUUID(uuid), 
            [0x0],
            MineProtocol.writeString(url)
        ].map(arr => arr instanceof Uint8Array ? arr : Buffer.from(arr)))
    }

    export function readServerFetchSkinResultBuiltInPacket(message: Buffer): ServerFetchSkinResultBuiltIn {
        const ret: ServerFetchSkinResultBuiltIn = {
            id: null,
            uuid: null,
            skinId: null
        }
        const id = MineProtocol.readVarInt(message),
            uuid = MineProtocol.readUUID(id.newBuffer),
            skinId = MineProtocol.readVarInt(id.newBuffer.subarray(id.newBuffer.length))
        ret.id = id.value
        ret.uuid = uuid.value
        ret.skinId = skinId.value
        return this
    }

    export function writeServerFetchSkinResultBuiltInPacket(uuid: string | Buffer, skinId: number): Buffer {
        uuid = typeof uuid == 'string' ? Util.uuidStringToBuffer(uuid) : uuid
        console.log(1)
        return Buffer.concat([
            Buffer.from([Enums.EaglerSkinPacketId.SFetchSkinBuiltInRes]),
            uuid as Buffer,
            Buffer.from([
                skinId >> 24,
                skinId >> 16,
                skinId >> 8,
                skinId & 0xFF
            ])
        ])
    }

    export function readServerFetchSkinResultCustomPacket(message: Buffer): ServerFetchSkinResultCustom {
        const ret: ServerFetchSkinResultCustom = {
            id: null,
            uuid: null,
            skin: null
        }
        const id = MineProtocol.readVarInt(message),
            uuid = MineProtocol.readUUID(id.newBuffer),
            skin = uuid.newBuffer.subarray(0, Constants.EAGLERCRAFT_SKIN_CUSTOM_LENGTH)
        ret.id = id.value
        ret.uuid = uuid.value
        ret.skin = skin
        return this
    }

    // TODO: fix bug where some people are missing left arm and leg
    export function writeServerFetchSkinResultCustomPacket(uuid: string | Buffer, skin: Buffer, downloaded: boolean): Buffer {
        uuid = typeof uuid == 'string' ? Util.uuidStringToBuffer(uuid) : uuid
        return Buffer.concat([
            [Enums.EaglerSkinPacketId.SFetchSkinRes],
            uuid,
            !downloaded ? [0x01] : [0x01], // TODO: if buggy, use 0xff instead
            skin.subarray(0, Constants.EAGLERCRAFT_SKIN_CUSTOM_LENGTH)
        ].map(arr => arr instanceof Uint8Array ? arr : Buffer.from(arr)))
    }

    export function readClientFetchEaglerSkinPacket(buff: Buffer): ClientFetchEaglerSkin {
        const ret: ClientFetchEaglerSkin = {
            id: null,
            uuid: null
        }
        const id = MineProtocol.readVarInt(buff),
            uuid = MineProtocol.readUUID(id.newBuffer)
        ret.id = id.value
        ret.uuid = uuid.value
        return ret
    }

    export function writeClientFetchEaglerSkin(uuid: string | Buffer, url: string): Buffer {
        uuid = typeof uuid == 'string' ? Util.uuidStringToBuffer(uuid) : uuid
        return Buffer.concat([
            [Enums.EaglerSkinPacketId.CFetchSkinEaglerPlayerReq],
            uuid,
            [0x00],
            MineProtocol.writeString(url)
        ].map(arr => arr instanceof Uint8Array ? arr : Buffer.from(arr)))
    }

    export async function toEaglerSkin(image: Buffer): Promise<Util.BoundedBuffer<typeof Constants.EAGLERCRAFT_SKIN_CUSTOM_LENGTH>> {
        const r = await sharp(image).extractChannel('red').raw({ depth: 'uchar' }).toBuffer()
        const g = await sharp(image).extractChannel('green').raw({ depth: 'uchar' }).toBuffer()
        const b = await sharp(image).extractChannel('blue').raw({ depth: 'uchar' }).toBuffer()
        const a = await sharp(image).ensureAlpha().extractChannel(3).toColorspace('b-w').raw({ depth: 'uchar' }).toBuffer()
        const newBuff = Buffer.alloc(Constants.EAGLERCRAFT_SKIN_CUSTOM_LENGTH)
        for (let i = 1; i < 64 ** 2; i++) {
            const bytePos = i * 4
            newBuff[bytePos] = a[i]
            newBuff[bytePos + 1] = b[i]
            newBuff[bytePos + 2] = g[i]
            newBuff[bytePos + 3] = r[i]
        }
        return newBuff
    }

    export class SkinServer {
        public allowedSkinDomains: string[]
        public proxy: Proxy
        private _logger: Logger

        constructor(proxy: Proxy, allowedSkinDomains?: string[]) {
            this.allowedSkinDomains = allowedSkinDomains ?? ['textures.minecraft.net']
            this.proxy = proxy ?? PROXY
            this._logger = new Logger("SkinServer")
            this._logger.info("Started EaglercraftX skin server.")
        }

        public async handleRequest(packet: CSChannelMessagePacket, caller: Player) {
            if (packet.messageType == Enums.ChannelMessageType.SERVER)
                throw new Error("Server message was passed to client message handler!")
            else if (packet.channel != Constants.EAGLERCRAFT_SKIN_CHANNEL_NAME)
                throw new Error("Cannot handle non-EaglerX skin channel messages!")
            switch(packet.data[0] as Enums.EaglerSkinPacketId) {
                default:
                    throw new Error("Unknown operation!")
                    break
                case Enums.EaglerSkinPacketId.CFetchSkinEaglerPlayerReq:
                    const parsedPacket_0 = EaglerSkins.readClientFetchEaglerSkinPacket(packet.data)
                    const player = this.proxy.fetchUserByUUID(parsedPacket_0.uuid)
                    if (player) {
                        if (player.skin.type == Enums.SkinType.BUILTIN) {
                            const response = new SCChannelMessagePacket()
                            response.channel = Constants.EAGLERCRAFT_SKIN_CHANNEL_NAME
                            response.data = EaglerSkins.writeServerFetchSkinResultBuiltInPacket(player.uuid, player.skin.builtInSkin)
                            caller.write(response)
                        } else if (player.skin.type == Enums.SkinType.CUSTOM) {
                            const response = new SCChannelMessagePacket()
                            response.channel = Constants.EAGLERCRAFT_SKIN_CHANNEL_NAME
                            response.data = EaglerSkins.writeServerFetchSkinResultCustomPacket(player.uuid, player.skin.skin, false)
                            caller.write(response)
                        } else this._logger.warn(`Player ${caller.username} attempted to fetch player ${player.uuid}'s skin, but their skin hasn't loaded yet!`)
                    }
                    break
                case Enums.EaglerSkinPacketId.CFetchSkinReq:
                    const parsedPacket_1 = EaglerSkins.readClientDownloadSkinRequestPacket(packet.data), url = new URL(parsedPacket_1.url).hostname
                    if (!this.allowedSkinDomains.some(domain => Util.areDomainsEqual(domain, url))) {
                        this._logger.warn(`Player ${caller.username} tried to download a skin with a disallowed domain name(${url})!`)
                        break
                    }
                    try {
                        const fetched = await EaglerSkins.downloadSkin(parsedPacket_1.url),
                            processed = await EaglerSkins.toEaglerSkin(fetched),
                            response = new SCChannelMessagePacket()
                        response.channel = Constants.EAGLERCRAFT_SKIN_CHANNEL_NAME
                        response.data = EaglerSkins.writeServerFetchSkinResultCustomPacket(parsedPacket_1.uuid, processed, true)
                        caller.write(response)
                    } catch (err) {
                        this._logger.warn(`Failed to fetch skin URL ${parsedPacket_1.url} for player ${caller.username}: ${err.stack ?? err}`)
                    }
            }
        }
    }

    export class EaglerSkin {
        owner: Player
        type: Enums.SkinType
        // update this over time
        builtInSkin?: Util.Range<0, 23>
        skin?: Util.BoundedBuffer<typeof Constants.EAGLERCRAFT_SKIN_CUSTOM_LENGTH>
    }
}