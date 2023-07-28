import { Client, StageChannel } from "discord.js-selfbot-v13";
import { command, streamLivestreamVideo, VoiceUdp, setStreamOpts, streamOpts, getInputMetadata, inputHasAudio } from "@dank074/discord-video-stream";
import { launch, getStream } from 'puppeteer-stream';
import config from "./config.json";
import { Readable } from "stream";
import { executablePath } from 'puppeteer';

const client = new Client();

client.patchVoiceEvents(); //this is necessary to register event handlers

setStreamOpts({
    width: config.streamOpts.width, 
    height: config.streamOpts.height, 
    fps: config.streamOpts.fps, 
    bitrateKbps: config.streamOpts.bitrateKbps, 
    hardware_encoding: config.streamOpts.hardware_acc
})

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

        const channel = msg.author.voice.channel;

        if(!channel) return;

        console.log(`Attempting to join voice channel ${msg.guildId}/${channel.id}`);
        await client.joinVoice(msg.guildId, channel.id);

        if(channel instanceof StageChannel)
        {
            await client.user.voice.setSuppressed(false);
        }

        const streamUdpConn = await client.createStream();

        await playVideo(args.url, streamUdpConn);

        client.stopStream();
        return;
    } else if (msg.content.startsWith("$play-cam")) {
        const args = parseArgs(msg.content);
        if (!args) return;

        const channel = msg.author.voice.channel;

        if(!channel) return;

        console.log(`Attempting to join voice channel ${msg.guildId}/${channel.id}`);
        const vc = await client.joinVoice(msg.guildId, channel.id);

        if(channel instanceof StageChannel)
        {
            await client.user.voice.setSuppressed(false);
        }

        client.signalVideo(msg.guildId, channel.id, true);

        playVideo(args.url, vc);

        return;
    } else if(msg.content.startsWith("$play-screen")) {
        const args = parseArgs(msg.content)
        if (!args) return;

        const channel = msg.author.voice.channel;

        if(!channel) return;

        console.log(`Attempting to join voice channel ${msg.guildId}/${channel.id}`);
        await client.joinVoice(msg.guildId, channel.id);

        if(channel instanceof StageChannel)
        {
            await client.user.voice.setSuppressed(false);
        }
        
        const streamUdpConn = await client.createStream();

        await streamPuppeteer(args.url, streamUdpConn);

        client.stopStream();

        return;
    } else if (msg.content.startsWith("$disconnect")) {
        command?.kill("SIGINT");

        client.leaveVoice();
    } else if(msg.content.startsWith("$stop-stream")) {
        command?.kill('SIGINT');

        const stream = client.voiceConnection?.screenShareConn;

        if(!stream) return;

        client.stopStream();
    }
});

// login
client.login(config.token);

async function playVideo(video: string, udpConn: VoiceUdp) {
    let includeAudio = true;

    try {
        const metadata = await getInputMetadata(video);
        //console.log(JSON.stringify(metadata.streams));
        includeAudio = inputHasAudio(metadata);
    } catch(e) {
        console.log(e);
        return;
    }

    console.log("Started playing video");

    udpConn.voiceConnection.setSpeaking(true);
    udpConn.voiceConnection.setVideoStatus(true);
    try {
        const res = await streamLivestreamVideo(video, udpConn, includeAudio);

        console.log("Finished playing video " + res);
    } catch (e) {
        console.log(e);
    } finally {
        udpConn.voiceConnection.setSpeaking(false);
        udpConn.voiceConnection.setVideoStatus(false);
    }
    command?.kill("SIGINT");
}

async function streamPuppeteer(url: string, udpConn: VoiceUdp) {
    const browser = await launch({
        defaultViewport: {
            width: streamOpts.width,
            height: streamOpts.height,
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
}

function parseArgs(message: string): Args | undefined {
    const args = message.split(" ");
    if (args.length < 2) return;

    const url = args[1];

    return { url }
}

type Args = {
    url: string;
}
