export interface StreamOpts {
    width: number;
    height: number;
    fps: number;
    bitrateKbps: number;
    hardware_encoding: boolean;
}

export const streamOpts: StreamOpts = {
    width: 1080,
    height: 720,
    fps: 30,
    bitrateKbps: 1000,
    hardware_encoding: false
}