import udpCon from 'dgram';
import { AudioPacketizer } from '../packet/AudioPacketizer';
import { max_int32bit } from '../packet/BaseMediaPacketizer';
import { VideoPacketizer } from '../packet/VideoPacketizer';
import { VoiceConnection } from './VoiceConnection';

// credit to discord.js
function parseLocalPacket(message: Buffer) {
    try {
        const packet = Buffer.from(message);
        let address = '';
        for (let i = 4; i < packet.indexOf(0, i); i++) address += String.fromCharCode(packet[i]);
        const port = parseInt(packet.readUIntLE(packet.length - 2, 2).toString(10), 10);
        return { address, port };
    } catch (error) {
        return { error };
    }
}
  

export class VoiceUdp {
    private _voiceConnection: VoiceConnection;
    private nonce: number;
    private socket: udpCon.Socket;
    private _ready: boolean;
    private _audioPacketizer: AudioPacketizer;
    private _videoPacketizer: VideoPacketizer;

    constructor(voiceConnection: VoiceConnection) {
        this.nonce = 0;

        this._voiceConnection = voiceConnection;
        this._audioPacketizer = new AudioPacketizer(this);
        this._videoPacketizer = new VideoPacketizer(this);
    }

    public getNewNonceBuffer(): Buffer {
        const nonceBuffer = Buffer.alloc(24)
        this.nonce++;
        if (this.nonce > max_int32bit) this.nonce = 0;
        
        nonceBuffer.writeUInt32BE(this.nonce, 0);
        return nonceBuffer;
    }

    public get audioPacketizer(): AudioPacketizer {
        return this._audioPacketizer;
    }

    public get videoPacketizer(): VideoPacketizer {
        return this._videoPacketizer;
    }

    public get voiceConnection(): VoiceConnection {
        return this._voiceConnection;
    }

    public sendAudioFrame(frame: any): void{
        if(!this.ready) return;

       const packet = this.audioPacketizer.createPacket(frame);
        this.sendPacket(packet);

        this.audioPacketizer.onFrameSent();
    }

    /**
     * Sends packets after partitioning the video frame into
     * MTU-sized chunks
     * @param frame 
     */
    public sendVideoFrame(frame: any): void {
        if(!this.ready) return;

        const data = this.videoPacketizer.partitionVideoData(frame);

        for (let i = 0; i < data.length; i++) {
            const packet = this.videoPacketizer.createPacket(data[i], i === (data.length - 1), i === 0);

            this.sendPacket(packet);
        }

        this.videoPacketizer.onFrameSent();
    }

    private sendPacket(packet: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            try {
            this.socket.send(packet, 0, packet.length, this._voiceConnection.port, this._voiceConnection.address, (error, bytes) => {
                if (error) {
                    console.log("ERROR", error);
                    return reject(error);
                }
                resolve();
            });
        } catch(e) {reject(e)}
        });
    }

    handleIncoming(buf: any): void {
        //console.log("RECEIVED PACKET", buf);
    }

    public get ready(): boolean {
        return this._ready;
    }

    public set ready(val: boolean) {
        this._ready = val;
    }

    public stop(): void {
        try {
            this.ready = false;
            this.socket.disconnect();
        }catch(e) {}
    }

    public createUdp(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.socket = udpCon.createSocket('udp4');
            this.socket.on('error', e => {
                console.error("Error connecting to media udp server", e);
                reject(e);
            });
            this.socket.once('message', (message) => {
                
                const packet = parseLocalPacket(message);
                if (packet.error) {
                    return reject(packet.error);
                }

                this._voiceConnection.self_ip = packet.address;
                this._voiceConnection.self_port = packet.port;
                this._voiceConnection.setProtocols();

                resolve();
                this.socket.on('message', this.handleIncoming);
            });

            const blank = Buffer.alloc(70);
            blank.writeUIntBE(this._voiceConnection.ssrc, 0, 4);

            this.socket.send(blank, 0, blank.length, this._voiceConnection.port, this._voiceConnection.address, (error, bytes) => {
                if (error) {
                    return reject(error)
                }
            });
        });
    }
}
