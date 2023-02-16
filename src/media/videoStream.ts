import { Writable } from "stream";
import { VoiceUdp } from "../client/voice/VoiceUdp";

export class VideoStream extends Writable {
    public udp: VoiceUdp;
    public count: number;
    public sleepTime: number;
    public startTime: number = -1;
    
    constructor(udp: VoiceUdp) {
        super();
        this.udp = udp;
        this.count = 0;
        this.sleepTime = 20;
    }

    public setSleepTime(time: number) {
        this.sleepTime = time;
    }

    _write(frame: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
        this.count++;
        if (this.startTime === -1)
            this.startTime = Date.now();

        this.udp.sendVideoFrame(frame);

        const next = ( (this.count + 1) * this.sleepTime) - (Date.now() - this.startTime);

       setTimeout(() => {
            callback();
        }, next);
    }
}
