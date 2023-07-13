import ffmpeg from 'fluent-ffmpeg';
import { getFrameDelayInMilliseconds, IvfTransformer }from "./ivfreader";
import prism from "prism-media";
import { VideoStream } from "./videoStream";
import { AudioStream } from "./audioStream";
import { VoiceUdp } from '../client/voice/VoiceUdp';
import { StreamOutput } from '@dank074/fluent-ffmpeg-multistream-ts';
import { streamOpts } from '../client/StreamOpts';
import { Readable } from 'stream';

export let command: ffmpeg.FfmpegCommand;

export function streamLivestreamVideo(input: string | Readable, voiceUdp: VoiceUdp) {
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

        if(typeof input === "string")
        {
            isHttpUrl = input.startsWith('http') || input.startsWith('https');
            isHls = input.includes('m3u');
        }        

        try {
            command = ffmpeg(input)
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
            .size(`${streamOpts.width}x${streamOpts.height}`)
            .fpsOutput(streamOpts.fps)
            .videoBitrate(`${streamOpts.bitrateKbps}k`)
            .format('ivf')
            .outputOption('-deadline', 'realtime')
            .output(StreamOutput(opus).url, { end: false})
            .noVideo()
            .audioChannels(2)
            .audioFrequency(48000)
            //.audioBitrate('128k')
            .format('s16le');
            
            if(streamOpts.hardware_encoding) command.inputOption('-hwaccel', 'auto');
            
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

export function getInputMetadata(input: string | Readable): Promise<ffmpeg.FfprobeData> {
    return new Promise((resolve,reject) => {
        const instance = ffmpeg(input).on('error', (err, stdout, stderr) => reject(err));
        
        instance.ffprobe((err, metadata) => {
            if(err) reject(err);
            instance.removeAllListeners();
            resolve(metadata);
            instance.kill('SIGINT');
        });
    })
}

export function inputHasAudio(metadata: ffmpeg.FfprobeData) {
    return metadata.streams.some( (value) => value.codec_type === 'audio');
}

export function inputHasVideo(metadata: ffmpeg.FfprobeData) {
    return metadata.streams.some( (value) => value.codec_type === 'video');
}

type map = {
    [key: string]: string;
  };