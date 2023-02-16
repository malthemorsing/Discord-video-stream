import { StreamerClient } from "../client/StreamerClient";
import { command, streamLivestreamVideo } from "../media/streamLivestreamVideo";

import config from "./config.json";
import { VoiceUdp } from "../client/voice/VoiceUdp";

const client = new StreamerClient();

// ready event
client.on("ready", () => {
    console.log(`--- ${client.user.tag} is ready ---`);
});

// message event
client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    if (!config.acceptedAuthors.includes(msg.author.id)) return;

    if (!msg.content) return;

    if (msg.content.startsWith(`$play-live`)) {
        const args = msg.content.split(" ");
        if (args.length < 3) return;

        const channelUrl = args[2].split("/");

        if (channelUrl.length < 6) {
            console.log("invalid url");
            return;
        }

        const guildId = channelUrl[4];

        const channelId = channelUrl[5];

        if (channelId == null || channelId == undefined) return;

        console.log(`Attempting to join voice channel ${guildId}/${channelId}`);
        await client.joinVoice(guildId, channelId);

        const streamUdpConn = await client.createStream();

        playVideo(args[1], streamUdpConn);
        return;
    } else if (msg.content.startsWith("$play-cam")) {
        const args = msg.content.split(" ");
        if (args.length < 3) return;

        // we gonna make them ALL join

        const channelUrl = args[2].split("/");

        if (channelUrl.length < 6) {
            console.log("invalid url");
            return;
        }

        const guildId = channelUrl[4];

        const channelId = channelUrl[5];

        if (channelId == null || channelId == undefined) return;

        console.log(`Attempting to join voice channel ${guildId}/${channelId}`);
        const vc = await client.joinVoice(guildId, channelId);

        client.signalVideo(guildId, channelId, true);

        playVideo(args[1], vc);

        return;
    } else if (msg.content.startsWith("$disconnect")) {
        command?.kill("SIGINT");

        client.leaveVoice();
    }
});

// login
client.login(config.token);

async function playVideo(video: string, udpConn: VoiceUdp) {
    console.log("Started playing video");

    udpConn.voiceConnection.setSpeaking(true);
    udpConn.voiceConnection.setVideoStatus(true);
    try {
        const res = await streamLivestreamVideo(video, udpConn);

        console.log("Finished playing video " + res);
    } catch (e) {
        console.log(e);
    } finally {
        udpConn.voiceConnection.setSpeaking(false);
        udpConn.voiceConnection.setVideoStatus(false);
    }
    command?.kill("SIGINT");

    client.leaveVoice();
}
