import { StreamerClient } from "../client/StreamerClient";
import { command, streamLivestreamVideo } from "../media/streamLivestreamVideo";
import { launch, getStream } from 'puppeteer-stream';
import config from "./config.json";
import { VoiceUdp } from "../client/voice/VoiceUdp";
import { Readable } from "stream";
import { executablePath } from 'puppeteer';

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
        const args = parseArgs(msg.content)
        if (!args) return;

        console.log(`Attempting to join voice channel ${args.guildId}/${args.channelId}`);
        await client.joinVoice(args.guildId, args.channelId);

        const streamUdpConn = await client.createStream();

        playVideo(args.url, streamUdpConn);
        return;
    } else if (msg.content.startsWith("$play-cam")) {
        const args = parseArgs(msg.content);
        if (!args) return;

        console.log(`Attempting to join voice channel ${args.guildId}/${args.channelId}`);
        const vc = await client.joinVoice(args.guildId, args.channelId);

        client.signalVideo(args.guildId, args.channelId, true);

        playVideo(args.url, vc);

        return;
    } else if(msg.content.startsWith("$play-screen")) {
        const args = parseArgs(msg.content)
        if (!args) return;

        console.log(`Attempting to join voice channel ${args.guildId}/${args.channelId}`);
        await client.joinVoice(args.guildId, args.channelId);

        const streamUdpConn = await client.createStream();

        streamPuppeteer(args.url, streamUdpConn);

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

async function streamPuppeteer(url: string, udpConn: VoiceUdp) {
    const browser = await launch({
        defaultViewport: {
            width: config.streamResolution.width,
            height: config.streamResolution.height,
        },
        executablePath: executablePath()
    });

    const page = await browser.newPage();
    await page.goto(url);

    // node typings are fucked, not sure why
    const stream: any = await getStream(page, { audio: true, video: true, mimeType: "video/webm;codecs=vp8,opus" }); 

    udpConn.voiceConnection.setSpeaking(true);
    udpConn.voiceConnection.setVideoStatus(true);
    try {
        // is there a way to distinguish audio from video chunks so we dont have to use ffmpeg ???
        const res = await streamLivestreamVideo((stream as Readable), udpConn);

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

function parseArgs(message: string): Args | undefined {
    const args = message.split(" ");
    if (args.length < 3) return;

    const url = args[1];

    const channelUrl = args[2].split("/");

    if (channelUrl.length < 6) {
        console.log("invalid url");
        return;
    }

    const guildId = channelUrl[4];

    const channelId = channelUrl[5];

    return { url, guildId, channelId }
}

type Args = {
    url: string;
    guildId: string;
    channelId: string;
}
