import { EventEmitter } from 'events';
import { Client } from 'discord.js-selfbot-v13';
import { VoiceConnection } from "./voice/VoiceConnection";
import { StreamConnection } from './stream/StreamConnection';
import { VoiceUdp } from './voice/VoiceUdp';

export enum gatewayOpCodes {
    dispatch = 0,
    heartbeat = 1,
    identify = 2,
    presence_update = 3,
    voice_state_update = 4,
    voice_server_ping = 5,
    resume = 6,
    reconnect = 7,
    request_guild_members = 8,
    invalid_session = 9,
    hello = 10,
    heartbeat_ack = 11,
    call_connect = 13,
    guild_subscriptions = 14,
    lobby_connect = 15,
    lobby_disconnect = 16,
    lobby_voice_states_update = 17,
    stream_create = 18,
    stream_delete = 19,
    stream_watch = 20,
    stream_ping = 21,
    stream_set_paused = 22,
    request_guild_application_commands = 24,
    embedded_activity_launch = 25,
    embedded_activity_close = 26,
    embedded_activity_update = 27,
    request_forum_unreads = 28,
    remote_command = 29
}

export class StreamerClient extends Client {
    private _events: EventEmitter;
    private _voiceConnection: VoiceConnection;

    constructor(token?: string) {
        super();
        this.token = token;
        this._events = new EventEmitter();

        // listen for events
        this.on('raw', packet => {
            this.handleGatewayEvent(packet.t, packet.d);
        });
    }

    private handleGatewayEvent(event: string, data: any): void {
        if (event === "VOICE_STATE_UPDATE") {
            if (data.user_id === this.user.id) {
                // transfer session data to voice connection
                this.voiceConnection?.setSession(data.session_id);
            }
        } else if (event === "VOICE_SERVER_UPDATE") {
            // transfer voice server update to voice connection
            if(data.guild_id != this.voiceConnection?.guild) return;
    
            this.voiceConnection?.setTokens(data.endpoint, data.token);
        } else if (event === "STREAM_CREATE") {
            const [type, guildId, channelId, userId] = data.stream_key.split(":");
    
            if(this.voiceConnection?.guild != guildId) return;

            if(userId === this.user.id) {
                this.voiceConnection.screenShareConn.server_id = data.rtc_server_id;
        
                this.voiceConnection.screenShareConn.streamKey = data.stream_key;
                this.voiceConnection.screenShareConn.setSession(this.voiceConnection.session_id);
            }        
        } else if (event === "STREAM_SERVER_UPDATE") {
            const [type, guildId, channelId, userId] = data.stream_key.split(":");
    
            if(this.voiceConnection?.guild != guildId) return;
    
            if(userId === this.user.id) {
                this.voiceConnection.screenShareConn.setTokens(data.endpoint, data.token);
            }
        }
    }

    private sendOpcode(code: number, data:any): void {
        // @ts-ignore
        this.ws.broadcast({
            op: code,
            d: data,
        })
    }

    public get voiceConnection() {
        return this._voiceConnection;
    }

    public set voiceConnection(conn: VoiceConnection) {
        this._voiceConnection = conn;
    }

    /*
    ** set status of bot
    ** text -> Text of game the bot is playing
    */
    public setStatus(text: string): void {
        this.sendOpcode(gatewayOpCodes.presence_update, {
            afk: false,
            status: 'online',
            game: {
                name: text,
                type: 0
            },
            since: null
        });
    }

    /*
    ** send message to channel
    ** text -> message to send
    ** channelId -> channel id
    */
    public sendMessage(text: string, channelId: string): void {
        // @ts-ignore
        this.channels.cache.get(channelId).send(text);
    }

    /*
    ** Join a voice channel
    ** guild_id -> guild id
    ** channel_id -> channel id
    */
    public joinVoice(guild_id: string, channel_id:string) : Promise<VoiceUdp> {
        return new Promise<VoiceUdp>((resolve, reject) => {
            this._voiceConnection = new VoiceConnection(guild_id, this.user.id, channel_id, (voiceUdp) => {
                
                resolve(voiceUdp);
            });
            this.signalVideo(guild_id, channel_id, false);
        })
    }

    public createStream(): Promise<VoiceUdp> {
        return new Promise<VoiceUdp>((resolve, reject) => {
            if(!this._voiceConnection) reject('cannot start stream without first joining voice channel');

            this.signalStream(this.voiceConnection.guild, this.voiceConnection.channelId);

            this._voiceConnection.screenShareConn = new StreamConnection(this.voiceConnection.guild, this.user.id, this.voiceConnection.channelId, (voiceUdp) => {
                resolve(voiceUdp);
            });
        })
    }

    public leaveVoice(): void {
        this.voiceConnection?.stop();

        this.voiceConnection?.screenShareConn?.stop();

        this.signalLeaveVoice();
        
        this.voiceConnection = undefined;
    }

    public signalVideo(guild_id: string, channel_id:string, video_enabled: boolean): void {
        this.sendOpcode(gatewayOpCodes.voice_state_update, {
            guild_id,
            channel_id,
            self_mute: false,
            self_deaf: true,
            self_video: video_enabled,
        });
    }

    public signalStream(guild_id: string, channel_id:string): void {
        this.sendOpcode(gatewayOpCodes.stream_create, {
            type:"guild",
            guild_id,
            channel_id,
            preferred_region:null
        });

        this.sendOpcode(gatewayOpCodes.stream_set_paused, {
            stream_key:`guild:${guild_id}:${channel_id}:${this.user.id}`,
            paused:false
        });
    }

    public signalLeaveVoice(): void {
        this.sendOpcode(gatewayOpCodes.voice_state_update, {
            guild_id: null,
            channel_id: null,
            self_mute: true,
            self_deaf: false,
            self_video: false,
        });
    }
}
