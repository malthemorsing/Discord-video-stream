import { VoiceConnection, voiceOpCodes } from "../voice/VoiceConnection";


export class StreamConnection extends VoiceConnection
{
    public streamKey: string;

    public override setSpeaking(speaking: boolean): void {
        this.sendOpcode(voiceOpCodes.speaking, {
            delay: 0,
            speaking: speaking ? 2 : 0,
            ssrc: this.ssrc
        });
    }
}