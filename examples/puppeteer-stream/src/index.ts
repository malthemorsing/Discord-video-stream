import { MediaUdp, Streamer, command, setStreamOpts, streamLivestreamVideo, streamOpts } from '@dank074/discord-video-stream';
import { Client, StageChannel } from 'discord.js-selfbot-v13';
import { executablePath } from 'puppeteer';
import { launch, getStream } from 'puppeteer-stream';
import config from "./config.json";
import { Readable } from 'node:stream';

const streamer = new Streamer(new Client());

setStreamOpts({
    width: config.streamOpts.width, 
    height: config.streamOpts.height, 
    fps: config.streamOpts.fps, 
    bitrateKbps: config.streamOpts.bitrateKbps,
    maxBitrateKbps: config.streamOpts.maxBitrateKbps, 
    hardware_acceleration: config.streamOpts.hardware_acceleration,
    video_codec: config.streamOpts.videoCodec === 'H264' ? 'H264' : 'VP8'
})

// ready event
streamer.client.on("ready", () => {
    console.log(`--- ${streamer.client.user.tag} is ready ---`);
});

// message event
streamer.client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    if (!config.acceptedAuthors.includes(msg.author.id)) return;

    if (!msg.content) return;

    if(msg.content.startsWith("$play-screen")) {
        const args = msg.content.split(" ");
        if (args.length < 2) return;

        const url = args[1];

        if (!url) return;

        const channel = msg.author.voice.channel;

        if(!channel) return;

        console.log(`Attempting to join voice channel ${msg.guildId}/${channel.id}`);
        await streamer.joinVoice(msg.guildId, channel.id);

        if(channel instanceof StageChannel)
        {
            await streamer.client.user.voice.setSuppressed(false);
        }
        
        const streamUdpConn = await streamer.createStream();

        await streamPuppeteer(url, streamUdpConn);

        streamer.stopStream();

        return;
    } else if (msg.content.startsWith("$disconnect")) {
        command?.kill("SIGINT");

        streamer.leaveVoice();
    } 
})

async function streamPuppeteer(url: string, udpConn: MediaUdp) {
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

    udpConn.mediaConnection.setSpeaking(true);
    udpConn.mediaConnection.setVideoStatus(true);
    try {
        // is there a way to distinguish audio from video chunks so we dont have to use ffmpeg ???
        const res = await streamLivestreamVideo((stream as Readable), udpConn);

        console.log("Finished playing video " + res);
    } catch (e) {
        console.log(e);
    } finally {
        udpConn.mediaConnection.setSpeaking(false);
        udpConn.mediaConnection.setVideoStatus(false);
    }
    command?.kill("SIGINT");
}