export interface StreamOpts {
    width?: number;
    height?: number;
    fps?: number;
    bitrateKbps?: number;
    hardware_encoding?: boolean;
    video_codec?: 'H264' | 'VP8';
}

export const streamOpts: StreamOpts = {
    width: 1080,
    height: 720,
    fps: 30,
    bitrateKbps: 1000,
    hardware_encoding: false,
    video_codec: 'H264'
}

export const setStreamOpts = (opts: StreamOpts) => {
    streamOpts.width = opts.width ?? streamOpts.width;
    streamOpts.height = opts.height ?? streamOpts.height;
    streamOpts.fps = opts.fps ?? streamOpts.fps;
    streamOpts.bitrateKbps = opts.bitrateKbps ?? streamOpts.bitrateKbps;
    streamOpts.hardware_encoding = opts.hardware_encoding ?? streamOpts.hardware_encoding;
    streamOpts.video_codec = opts.video_codec ?? streamOpts.video_codec;
}