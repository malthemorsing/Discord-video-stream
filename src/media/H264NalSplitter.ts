import { Transform, TransformCallback } from "stream";

const emptyBuffer = Buffer.allocUnsafe(0);
const epbPrefix = Buffer.from([0x00, 0x00, 0x03]);
const nalSuffix = Buffer.from([0x00, 0x00, 0x01]);

/**
 * Outputs a buffer containing length-delimited nalu units
 * that belong to the same access unit.
 * Expects an AnnexB H264 bytestream as input.
 * 
 * In a h264 stream, 1 frame is equal to 1 access unit, and an access
 * unit is composed of 1 to n Nal units
 */
export class H264NalSplitter extends Transform {
    private _buffer: Buffer;
    private _accessUnit: Buffer[] = [];
    
    /**
     * Removes emulation prevention bytes from a nalu frame
     * @description there are chances that 0x000001 or 0x00000001 exists in the bitstream of a NAL unit. 
     * So a emulation prevention bytes, 0x03, is presented when there is 0x000000, 0x000001, 0x000002 and 0x000003 
     * to make them become 0x00000300, 0x00000301, 0x00000302 and 0x00000303 respectively
     * @param data 
     * @returns frame with emulation prevention bytes removed
     */
    rbsp(data: Buffer): Buffer
    {
        const newData = Buffer.allocUnsafe(data.length);
        let newLength = 0;

        while (true)
        {
            const epbsPos = data.indexOf(epbPrefix);
            if (epbsPos == -1)
            {
                data.copy(newData, newLength);
                newLength += data.length;
                break;
            }
            let copyRange = epbsPos + 3;
            if (data[epbsPos + 3] <= 0x03)
            {
                copyRange--;
            }
            data.copy(newData, newLength, 0, copyRange);
            newLength += copyRange;
            data = data.subarray(epbsPos + 3);
        }

        return newData.subarray(0, newLength);
    }

    /**
     * Finds the first NAL unit header in a buffer as efficient as possible
     * @param buf buffer of data
     * @returns the index of the first NAL unit header and its length
     */
    findNalStart(buf: Buffer): { index: number, length: number } | null
    {
        const pos = buf.indexOf(nalSuffix);
        if (pos == -1) return null;
        if (pos > 0 && buf[pos - 1] == 0)
            return { index: pos - 1, length: 4 };
        return { index: pos, length: 3 };
    }

    processFrame(frame: Buffer): void {
        if (frame.length == 0) return;
        const header = frame[0];

        const unitType = header & 0x1f;

        if (unitType === NalUnitTypes.AccessUnitDelimiter) {
            if (this._accessUnit.length > 0) {
                // total length is sum of all nalu lengths, plus 4 bytes for each nalu
                let sizeOfAccessUnit = this._accessUnit.reduce((acc, nalu) => acc + nalu.length + 4, 0);
                const accessUnitBuf = Buffer.allocUnsafe(sizeOfAccessUnit);

                let offset = 0;
                for (let nalu of this._accessUnit) {
                    // hacky way of outputting several nal units that belong to the same access unit
                    accessUnitBuf.writeUint32BE(nalu.length, offset);
                    offset += 4;
                    nalu.copy(accessUnitBuf, offset)
                    offset += nalu.length;
                }

                this.push(accessUnitBuf);
                this._accessUnit = [];
            }
        } else {
            // remove emulation bytes from frame (only importannt ones like SPS and SEI since its costly operation)
            if (unitType === NalUnitTypes.SPS || unitType === NalUnitTypes.SEI) {
                const rbspFrame = this.rbsp(frame);
                this._accessUnit.push(rbspFrame);
            } else {
                this._accessUnit.push(frame);
            }
        }
    }

    _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback): void {
        let nalStart = this.findNalStart(chunk);
        if (!this._buffer)
        {
            // We just started processing, ignore everything until we find a NAL start
            if (!nalStart)
            {
                callback();
                return;
            }
            chunk = chunk.subarray(nalStart.index + nalStart.length);
            this._buffer = emptyBuffer;
        }
        while (nalStart = this.findNalStart(chunk))
        {
            const frame = Buffer.concat([
                this._buffer,
                chunk.subarray(0, nalStart.index)
            ]);
            this.processFrame(frame);
            chunk = chunk.subarray(nalStart.index + nalStart.length);
            this._buffer = emptyBuffer;
        }
        this._buffer = Buffer.concat([this._buffer, chunk]);
        callback();
    }
}

enum NalUnitTypes {
    Unspecified,
    CodedSliceNonIDR,
    CodedSlicePartitionA,
    CodedSlicePartitionB,
    CodedSlicePartitionC,
    CodedSliceIdr,
    SEI,
    SPS,
    PPS,
    AccessUnitDelimiter,
    EndOfSequence,
    EndOfStream,
    FillerData,
    SEIExtenstion,
    PrefixNalUnit,
    SubsetSPS,
}