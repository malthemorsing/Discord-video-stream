import ffmpeg from 'fluent-ffmpeg';
import { getFrameDelayInMilliseconds, IvfTransformer }from "./ivfreader";
import prism from "prism-media";
import { VideoStream } from "./videoStream";
import { AudioStream } from "./audioStream";
import { VoiceUdp } from '../client/voice/VoiceUdp';
import { StreamOutput } from '@dank074/fluent-ffmpeg-multistream-ts';
import config from '../example/config.json';
import { Readable } from 'stream';

export let command: ffmpeg.FfmpegCommand = undefined;

export function streamLivestreamVideo(url: string | Readable, voiceUdp: VoiceUdp) {
    return new Promise<string>((resolve, reject) => {
        const videoStream: VideoStream = new VideoStream( voiceUdp);
        
        const ivfStream = new IvfTransformer();

        const audioStream: AudioStream = new AudioStream( voiceUdp );
        
        // make opus stream
        const opus = new prism.opus.Encoder({ channels: 2, rate: 48000, frameSize: 960 });

        // get header frame time
        ivfStream.on("header", (header) => {
            videoStream.setSleepTime(getFrameDelayInMilliseconds(header));
        });

        audioStream.on("finish", () => {
            resolve("finished audio");
        });
        
        videoStream.on("finish", () => {
            resolve("finished video");
        });

        const headers: map = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.3",
            "Connection": "keep-alive"
        }

        let isHttpUrl = false;
        let isHls = false;

        if(typeof url === "string")
        {
            isHttpUrl = url.startsWith('http') || url.startsWith('https');
            isHls = url.includes('m3u');
        }        

        try {
            command = ffmpeg(url)
            .inputOption('-re')
            .addOption('-loglevel', '0')
            .addOption('-fflags', 'nobuffer')
            .addOption('-analyzeduration', '0')
            .on('end', () => {
                command = undefined;
                resolve("video ended")
            })
            .on("error", (err, stdout, stderr) => {
                command = undefined;
                reject('cannot play video ' + err.message)
            })
            .on('stderr', console.error)
            .output(StreamOutput(ivfStream).url, { end: false })
            .noAudio()
            .size(`${config.streamResolution.width}x${config.streamResolution.height}`)
            .fpsOutput(config.streamResolution.fps)
            .videoBitrate(`${config.streamResolution.bitrateKbps}k`)
            .format('ivf')
            .outputOption('-deadline', 'realtime')
            .output(StreamOutput(opus).url, { end: false})
            .noVideo()
            .audioChannels(2)
            .audioFrequency(48000)
            //.audioBitrate('128k')
            .format('s16le');
            
            if(config.hardware_acc) command.inputOption('-hwaccel', 'auto');
            
            if(isHttpUrl) {
                command.inputOption('-headers', 
                    Object.keys(headers).map(key => key + ": " + headers[key]).join("\r\n")
                );
                if(!isHls)
                    command.inputOptions('-reconnect 1 -reconnect_at_eof 1 -reconnect_streamed 1 -reconnect_delay_max 4294'.split(' '));
            }
            
            command.run();
            
            ivfStream.pipe(videoStream, { end: false});

            opus.pipe(audioStream, {end: false});
        } catch(e) {
            //audioStream.end();
            //videoStream.end();
            command = undefined;
            reject("cannot play video " + e.message);
        }
    })
}

type map = {
    [key: string]: string;
  };