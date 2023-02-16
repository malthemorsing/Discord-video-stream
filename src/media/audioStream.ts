import { Writable } from "stream";
import { VoiceUdp } from "../client/voice/VoiceUdp";

class AudioStream extends Writable {
    public udp: VoiceUdp;
    public count: number;
    public sleepTime: number;
    public startTime: number;
    
    constructor(udp: VoiceUdp) {
        super();
        this.udp = udp;
        this.count = 0;
        this.sleepTime = 20;
    }

    _write(chunk: any, _: BufferEncoding, callback: (error?: Error | null) => void) {
        this.count++;
        if (!this.startTime)
            this.startTime = Date.now();

        this.udp.sendAudioFrame(chunk);
        
        const next = ((this.count + 1) * this.sleepTime) - (Date.now() - this.startTime);
        setTimeout(() => {
            callback();
        }, next);
    }
}

export {
    AudioStream
};
