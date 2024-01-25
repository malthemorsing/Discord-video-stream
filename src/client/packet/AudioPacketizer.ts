import { MediaUdp } from "../voice/MediaUdp";
import { BaseMediaPacketizer } from "./BaseMediaPacketizer";

const time_inc = (48000 / 100) * 2;

export class AudioPacketizer extends BaseMediaPacketizer {
    constructor(connection: MediaUdp) {
        super(connection, 0x78);
    }

    public override sendFrame(frame:any): void {
        super.sendFrame(frame);
        const packet = this.createPacket(frame);
        this.mediaUdp.sendPacket(packet);
        this.onFrameSent(packet.length);
    }

    public createPacket(chunk: any): Buffer {
        const header = this.makeRtpHeader();

        const nonceBuffer = this.mediaUdp.getNewNonceBuffer();
        return Buffer.concat([header, this.encryptData(chunk, nonceBuffer), nonceBuffer.subarray(0, 4)]);
    }

    public override onFrameSent(bytesSent: number): void {
        super.onFrameSent(1, bytesSent);
        this.incrementTimestamp(time_inc);
    }
}