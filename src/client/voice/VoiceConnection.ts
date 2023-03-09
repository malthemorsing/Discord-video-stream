import WebSocket from 'ws';

import { VoiceUdp } from "./VoiceUdp";
import config from '../../example/config.json';
import { StreamConnection } from '../stream/StreamConnection';

export enum voiceOpCodes {
    identify = 0,
    select_protocol = 1,
    ready = 2,
    heartbeat = 3,
    select_protocol_ack = 4,
    speaking = 5,
    heartbeat_ack = 6,
    resume = 7,
    hello = 8,
    resumed = 9,
    sources = 12,
    client_disconnect = 13,
    session_update = 14,
    media_sink_wants = 15,
    voice_backend_version = 16,
    channel_options_update = 17
}

type VoiceConnectionStatus =
{
    hasSession: boolean;
    hasToken: boolean;
    started: boolean;
    resuming: boolean;
}

export class VoiceConnection {
    private interval: NodeJS.Timer;
    public udp: VoiceUdp;
    public guild: string;
    public channelId: string;
    public botId: string;
    public ws: WebSocket;
    public ready: (udp: VoiceUdp) => void;
    public status: VoiceConnectionStatus;
    public server: string;//websocket url
    public token: string;
    public session_id: string;
    public self_ip: string;
    public self_port: number;
    public address: string;
    public port: number;
    public ssrc: number;
    public videoSsrc: number;
    public modes: string[];
    public secretkey: Uint8Array;
    public server_id: string

    public screenShareConn: StreamConnection;

    constructor(guildId: string, botId: string, channelId: string, callback: (udp: VoiceUdp) => void) {
        this.status = {
            hasSession: false,
            hasToken: false,
            started: false,
            resuming: false
        }

        // make udp client
        this.udp = new VoiceUdp(this);

        this.guild = guildId;
        this.channelId = channelId;
        this.botId = botId;
        this.server_id = guildId;
        this.ready = callback;
    }

    stop(): void {
        clearInterval(this.interval);
        this.status.started = false;
        this.ws.close();
        this.udp.stop();
    }

    setSession(session_id: string): void {
        this.session_id = session_id;

        this.status.hasSession = true;
        this.start();
    }
    
    setTokens(server: string, token: string): void {
        this.token = token;
        this.server = server;

        this.status.hasToken = true;
        this.start();
    }

    start(): void {
        /*
        ** Connection can only start once both
        ** session description and tokens have been gathered 
        */
        if (this.status.hasSession && this.status.hasToken) {
            if (this.status.started)
                return
            this.status.started = true;

            this.ws = new WebSocket("wss://" + this.server + "/?v=7", {
                followRedirects: true
            });
            this.ws.on("open", () => {
                if(this.status.resuming) {
                    this.status.resuming = false;
                    this.resume();
                } else {
                    this.identify();
                }
            })
            this.ws.on("error", (err) => {
                console.error(err);
            })
            this.ws.on("close", (code) => {
                const wasStarted = this.status.started;

                this.status.started = false;
                this.udp.ready = false;

                const canResume = code === 4_015 || code < 4_000;

                if (canResume && wasStarted) {
                    this.status.resuming = true;
                    this.start();
                }
            })
            this.setupEvents();
        }
    }

    handleReady(d: any): void {
        this.ssrc = d.ssrc;
        this.address = d.ip;
        this.port = d.port;
        this.modes = d.modes;
        this.videoSsrc = this.ssrc + 1; // todo: set it from packet streams object
    }

    handleSession(d: any): void {
        this.secretkey = new Uint8Array(d.secret_key);

        this.ready(this.udp);
        this.udp.ready = true;
    }

    setupEvents(): void {
        this.ws.on('message', (data: any) => {
            const { op, d } = JSON.parse(data);

            if (op == voiceOpCodes.ready) { // ready
                this.handleReady(d);
                this.sendVoice();
                this.setVideoStatus(false);
            }
            else if (op >= 4000) {
                console.error("Error voice connection", d);
            }
            else if (op === voiceOpCodes.hello) {
                this.setupHeartbeat(d.heartbeat_interval);
            }
            else if (op === voiceOpCodes.select_protocol_ack) { // session description
                this.handleSession(d);
            }
            else if (op === voiceOpCodes.speaking) {
                // ignore speaking updates
            }
            else if (op === voiceOpCodes.heartbeat_ack) {
                // ignore heartbeat acknowledgements
            }
            else if (op === voiceOpCodes.resumed) {
                this.status.started = true;
                this.udp.ready = true;
            }
            else {
                //console.log("unhandled voice event", {op, d});
            }
        });
    }

    setupHeartbeat(interval: number): void {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.interval = setInterval(() => {
            this.sendOpcode(voiceOpCodes.heartbeat, 42069);
        }, interval);
    }

    sendOpcode(code:number, data:any): void {
        this.ws.send(JSON.stringify({
            op: code,
            d: data
        }));
    }

    /*
    ** identifies with media server with credentials
    */
    identify(): void {
        this.sendOpcode(voiceOpCodes.identify, {
            server_id: this.server_id,
            user_id: this.botId,
            session_id: this.session_id,
            token: this.token,
            video: true,
            streams: [
                {type:"screen", rid:"100",quality:100}
            ]
        });
    }

    resume(): void {
        this.sendOpcode(voiceOpCodes.resume, {
            server_id: this.server_id,
            session_id: this.session_id,
            token: this.token,
        });
    }

    /*
    ** Sets protocols and ip data used for video and audio.
    ** Uses vp8 for video
    ** Uses opus for audio
    */
    setProtocols(): void {
        this.sendOpcode(voiceOpCodes.select_protocol, {
            protocol: "udp",
            codecs: [
                { name: "opus", type: "audio", priority: 1000, payload_type: 120 },
                //{ name: "H264", type: "video", priority: 1000, payload_type: 101, rtx_payload_type: 102},
                { name: "VP8", type: "video", priority: 3000, payload_type: 103, rtx_payload_type: 104, encode: true, decode: true }
                //{ name: "VP9", type: "video", priority: 3000, payload_type: 105, rtx_payload_type: 106 },
            ],
            data: {
                address: this.self_ip,
                port: this.self_port,
                mode: "xsalsa20_poly1305_lite"
            }
        });
    }

    /*
    ** Sets video status.
    ** bool -> video on or off
    ** video and rtx sources are set to ssrc + 1 and ssrc + 2
    */
    public setVideoStatus(bool: boolean): void {
        this.sendOpcode(voiceOpCodes.sources, {
            audio_ssrc: this.ssrc,
            video_ssrc: bool ? this.videoSsrc : 0,
            rtx_ssrc: bool ? this.ssrc + 2 : 0,
            streams: [
                { 
                    type:"video",
                    rid:"100",
                    ssrc: bool ? this.videoSsrc : 0,
                    active:true,
                    quality:100,
                    rtx_ssrc:bool ? this.ssrc + 2 : 0,
                    max_bitrate:2500000,
                    max_framerate: config.streamResolution.fps,
                    max_resolution: {
                        type:"fixed",
                        width: config.streamResolution.width,
                        height: config.streamResolution.height
                    }
                }
            ]
        });
    }

    /*
    ** Set speaking status
    ** speaking -> speaking status on or off
    */
   public setSpeaking(speaking: boolean): void {
        this.sendOpcode(voiceOpCodes.speaking, {
            delay: 0,
            speaking: speaking ? 1 : 0,
            ssrc: this.ssrc
        });
    }

    /*
    ** Start media connection
    */
    public sendVoice(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.udp.createUdp().then(() => {
                resolve();
            });
        })
    }
}
