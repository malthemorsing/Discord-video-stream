import udpCon from 'dgram';
import { isIPv4 } from 'net';
import { AudioPacketizer } from '../packet/AudioPacketizer';
import { max_int32bit } from '../packet/BaseMediaPacketizer';
import { VideoPacketizer } from '../packet/VideoPacketizer';
import { VoiceConnection } from './VoiceConnection';

// credit to discord.js
function parseLocalPacket(message: Buffer) {
    const packet = Buffer.from(message);

	const ip = packet.subarray(8, packet.indexOf(0, 8)).toString('utf8');

	if (!isIPv4(ip)) {
		throw new Error('Malformed IP address');
	}

	const port = packet.readUInt16BE(packet.length - 2);

	return { ip, port };
}
  

export class VoiceUdp {
    private _voiceConnection: VoiceConnection;
    private _nonce: number;
    private _socket: udpCon.Socket;
    private _ready: boolean;
    private _audioPacketizer: AudioPacketizer;
    private _videoPacketizer: VideoPacketizer;

    constructor(voiceConnection: VoiceConnection) {
        this._nonce = 0;

        this._voiceConnection = voiceConnection;
        this._audioPacketizer = new AudioPacketizer(this);
        this._videoPacketizer = new VideoPacketizer(this);
    }

    public getNewNonceBuffer(): Buffer {
        const nonceBuffer = Buffer.alloc(24)
        this._nonce++;
        if (this._nonce > max_int32bit) this._nonce = 0;
        
        nonceBuffer.writeUInt32BE(this._nonce, 0);
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
            this._socket.send(packet, 0, packet.length, this._voiceConnection.port, this._voiceConnection.address, (error, bytes) => {
                if (error) {
                    console.log("ERROR", error);
                    reject(error);
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
            this._socket?.disconnect();
        }catch(e) {}
    }

    public createUdp(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._socket = udpCon.createSocket('udp4');

            this._socket.on('error', (error: Error) => {
                console.error("Error connecting to media udp server", error);
                reject(error);
            });

            this._socket.once('message', (message) => {
                if (message.readUInt16BE(0) !== 2) {
                    reject('wrong handshake packet for udp')
                }
                try {
                    const packet = parseLocalPacket(message);

                    this._voiceConnection.self_ip = packet.ip;
                    this._voiceConnection.self_port = packet.port;
                    this._voiceConnection.setProtocols();
                } catch(e) { reject(e) }
                
                resolve();
                this._socket.on('message', this.handleIncoming);
            });

            const blank = Buffer.alloc(74);
            
            blank.writeUInt16BE(1, 0);
			blank.writeUInt16BE(70, 2);
            blank.writeUInt32BE(this._voiceConnection.ssrc, 4);

            this._socket.send(blank, 0, blank.length, this._voiceConnection.port, this._voiceConnection.address, (error, bytes) => {
                if (error) {
                    reject(error)
                }
            });
        });
    }
}
