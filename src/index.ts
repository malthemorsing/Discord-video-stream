import { Client } from 'discord.js-selfbot-v13';
import { GatewayOpCodes } from './client/GatewayOpCodes';
import { StreamConnection, VoiceConnection, VoiceUdp } from './client/index';

declare module "discord.js-selfbot-v13" {
    interface Client {
        voiceConnection: VoiceConnection;
        handleGatewayEvent(event: string, data: any): void;
        sendOpcode(code: number, data: any): void;
        joinVoice(guild_id: string, channel_id: string): Promise<VoiceUdp>;
        createStream(): Promise<VoiceUdp>;
        leaveVoice(): void;
        signalVideo(
            guild_id: string,
            channel_id: string,
            video_enabled: boolean
        ): void;
        signalStream(guild_id: string, channel_id: string): void;
        signalStopStream(guild_id: string, channel_id: string): void;
        signalLeaveVoice(): void;
        patchVoiceEvents(): void;
    }
}

Client.prototype.voiceConnection = undefined;

Client.prototype.patchVoiceEvents = function() {
    this.on('raw', (packet: any) => {
        this.handleGatewayEvent(packet.t, packet.d);
    });
}

Client.prototype.handleGatewayEvent = function(event: string, data: any): void {
    if (event === "VOICE_STATE_UPDATE") {
        if (data.user_id === this.user.id) {
            // transfer session data to voice connection
            this.voiceConnection?.setSession(data.session_id);
        }
    } else if (event === "VOICE_SERVER_UPDATE") {
        // transfer voice server update to voice connection
        if (data.guild_id != this.voiceConnection?.guildId) return;

        this.voiceConnection?.setTokens(data.endpoint, data.token);
    } else if (event === "STREAM_CREATE") {
        const [type, guildId, channelId, userId] = data.stream_key.split(":");

        if (this.voiceConnection?.guildId != guildId) return;

        if (userId === this.user.id) {
            this.voiceConnection.screenShareConn.serverId =
                data.rtc_server_id;

            this.voiceConnection.screenShareConn.streamKey =
                data.stream_key;
            this.voiceConnection.screenShareConn.setSession(
                this.voiceConnection.session_id
            );
        }
    } else if (event === "STREAM_SERVER_UPDATE") {
        const [type, guildId, channelId, userId] = data.stream_key.split(":");

        if (this.voiceConnection?.guildId != guildId) return;

        if (userId === this.user.id) {
            this.voiceConnection.screenShareConn.setTokens(
                data.endpoint,
                data.token
            );
        }
    }
};

Client.prototype.sendOpcode = function(code: number, data: any): void {
    // @ts-ignore
    this.ws.broadcast({
        op: code,
        d: data,
    });
};

/*
 ** Join a voice channel
 ** guild_id -> guild id
 ** channel_id -> channel id
 */
Client.prototype.joinVoice = function (
    guild_id: string,
    channel_id: string
): Promise<VoiceUdp> {
    return new Promise<VoiceUdp>((resolve, reject) => {
        this.voiceConnection = new VoiceConnection(
            guild_id,
            this.user.id,
            channel_id,
            (voiceUdp) => {
                resolve(voiceUdp);
            }
        );
        this.signalVideo(guild_id, channel_id, false);
    });
};

Client.prototype.createStream = function(): Promise<VoiceUdp> {
    return new Promise<VoiceUdp>((resolve, reject) => {
        if (!this.voiceConnection)
            reject("cannot start stream without first joining voice channel");

        this.signalStream(
            this.voiceConnection.guildId,
            this.voiceConnection.channelId
        );

        this.voiceConnection.screenShareConn = new StreamConnection(
            this.voiceConnection.guildId,
            this.user.id,
            this.voiceConnection.channelId,
            (voiceUdp) => {
                resolve(voiceUdp);
            }
        );
    });
};

Client.prototype.leaveVoice = function(): void {
    this.voiceConnection?.stop();

    this.voiceConnection?.screenShareConn?.stop();

    this.signalLeaveVoice();

    this.voiceConnection = undefined;
};

Client.prototype.signalVideo = function(
    guild_id: string,
    channel_id: string,
    video_enabled: boolean
): void {
    this.sendOpcode(GatewayOpCodes.VOICE_STATE_UPDATE, {
        guild_id,
        channel_id,
        self_mute: false,
        self_deaf: true,
        self_video: video_enabled,
    });
};

Client.prototype.signalStream = function(
    guild_id: string,
    channel_id: string
): void {
    this.sendOpcode(GatewayOpCodes.STREAM_CREATE, {
        type: "guild",
        guild_id,
        channel_id,
        preferred_region: null,
    });

    this.sendOpcode(GatewayOpCodes.STREAM_SET_PAUSED, {
        stream_key: `guild:${guild_id}:${channel_id}:${this.user.id}`,
        paused: false,
    });
};

Client.prototype.signalStopStream = function(guild_id: string, channel_id: string): void {
    this.sendOpcode(GatewayOpCodes.STREAM_DELETE, {
        stream_key: `guild:${guild_id}:${channel_id}:${this.user.id}`
    });
};

Client.prototype.signalLeaveVoice = function(): void {
    this.sendOpcode(GatewayOpCodes.VOICE_STATE_UPDATE, {
        guild_id: null,
        channel_id: null,
        self_mute: true,
        self_deaf: false,
        self_video: false,
    });
};

export * from './client/index';
export * from "./media/index";