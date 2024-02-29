import { Transform, TransformCallback } from "stream";

const emptyBuffer = Buffer.allocUnsafe(0);
const epbPrefix = Buffer.from([0x00, 0x00, 0x03]);
const nalSuffix = Buffer.from([0x00, 0x00, 0x01]);

/**
 * Outputs a buffer containing length-delimited nalu units
 * that belong to the same access unit.
 * Expects an Annex B bytestream as input.
 * 
 * In an Annex B stream, 1 frame is equal to 1 access unit, and an access
 * unit is composed of 1 to n Nal units
 */
class AnnexBNalSplitter extends Transform {
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
    rbsp(data: Buffer): Buffer {
        const newData = Buffer.allocUnsafe(data.length);
        let newLength = 0;

        while (true) {
            const epbsPos = data.indexOf(epbPrefix);
            if (epbsPos == -1) {
                data.copy(newData, newLength);
                newLength += data.length;
                break;
            }
            let copyRange = epbsPos + 3;
            if (data[epbsPos + 3] <= 0x03) {
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
    findNalStart(buf: Buffer): { index: number, length: number } | null {
        const pos = buf.indexOf(nalSuffix);
        if (pos == -1) return null;
        if (pos > 0 && buf[pos - 1] == 0)
            return { index: pos - 1, length: 4 };
        return { index: pos, length: 3 };
    }

    getUnitType(frame: Buffer): number {
        throw new Error("Not implemented");
    }

    isAUD(unitType: number): boolean {
        throw new Error("Not implemented");
    }

    removeEpbs(frame: Buffer, unitType: number): Buffer {
        throw new Error("Not implemented");
    }

    processFrame(frame: Buffer): void {
        if (frame.length == 0) return;

        const unitType = this.getUnitType(frame);

        if (this.isAUD(unitType)) {
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
            this._accessUnit.push(this.removeEpbs(frame, unitType));
        }
    }

    _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback): void {
        let nalStart = this.findNalStart(chunk);
        if (!this._buffer) {
            // We just started processing, ignore everything until we find a NAL start
            if (!nalStart) {
                callback();
                return;
            }
            chunk = chunk.subarray(nalStart.index + nalStart.length);
            this._buffer = emptyBuffer;
        }
        chunk = Buffer.concat([this._buffer, chunk]);
        while (nalStart = this.findNalStart(chunk)) {
            const frame = chunk.subarray(0, nalStart.index);
            this.processFrame(frame);
            chunk = chunk.subarray(nalStart.index + nalStart.length);
        }
        this._buffer = chunk;
        callback();
    }
}

enum H264NalUnitTypes {
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

export class H264NalSplitter extends AnnexBNalSplitter {
    getUnitType(frame: Buffer): number {
        return frame[0] & 0x1f;
    }

    isAUD(unitType: number): boolean {
        return unitType === H264NalUnitTypes.AccessUnitDelimiter;
    }

    removeEpbs(frame: Buffer, unitType: number): Buffer {
        if (unitType === H264NalUnitTypes.SPS || unitType === H264NalUnitTypes.SEI)
            return this.rbsp(frame);
        return frame;
    }
}

enum H265NalUnitTypes {
    TRAIL_N = 0,
    TRAIL_R = 1,
    TSA_N = 2,
    TSA_R = 3,
    STSA_N = 4,
    STSA_R = 5,
    RADL_N = 6,
    RADL_R = 7,
    RASL_N = 8,
    RASL_R = 9,
    RSV_VCL_N10 = 10,
    RSV_VCL_R11 = 11,
    RSV_VCL_N12 = 12,
    RSV_VCL_R13 = 13,
    RSV_VCL_N14 = 14,
    RSV_VCL_R15 = 15,
    BLA_W_LP = 16,
    BLA_W_RADL = 17,
    BLA_N_LP = 18,
    IDR_W_RADL = 19,
    IDR_N_LP = 20,
    CRA_NUT = 21,
    RSV_IRAP_VCL22 = 22,
    RSV_IRAP_VCL23 = 23,
    RSV_VCL24 = 24,
    RSV_VCL25 = 25,
    RSV_VCL26 = 26,
    RSV_VCL27 = 27,
    RSV_VCL28 = 28,
    RSV_VCL29 = 29,
    RSV_VCL30 = 30,
    RSV_VCL31 = 31,
    VPS_NUT = 32,
    SPS_NUT = 33,
    PPS_NUT = 34,
    AUD_NUT = 35,
    EOS_NUT = 36,
    EOB_NUT = 37,
    FD_NUT = 38,
    PREFIX_SEI_NUT = 39,
    SUFFIX_SEI_NUT = 40,
    RSV_NVCL41 = 41,
    RSV_NVCL42 = 42,
    RSV_NVCL43 = 43,
    RSV_NVCL44 = 44,
    RSV_NVCL45 = 45,
    RSV_NVCL46 = 46,
    RSV_NVCL47 = 47,
    UNSPEC48 = 48,
    UNSPEC49 = 49,
    UNSPEC50 = 50,
    UNSPEC51 = 51,
    UNSPEC52 = 52,
    UNSPEC53 = 53,
    UNSPEC54 = 54,
    UNSPEC55 = 55,
    UNSPEC56 = 56,
    UNSPEC57 = 57,
    UNSPEC58 = 58,
    UNSPEC59 = 59,
    UNSPEC60 = 60,
    UNSPEC61 = 61,
    UNSPEC62 = 62,
    UNSPEC63 = 63,
};

export class H265NalSplitter extends AnnexBNalSplitter {
    getUnitType(frame: Buffer): number {
        return (frame[0] >> 1) & 0x3f;
    }

    isAUD(unitType: number): boolean {
        return unitType === H265NalUnitTypes.AUD_NUT;
    }

    removeEpbs(frame: Buffer, unitType: number): Buffer {
        if (
            unitType === H265NalUnitTypes.SPS_NUT        ||
            unitType === H265NalUnitTypes.SUFFIX_SEI_NUT ||
            unitType === H265NalUnitTypes.PREFIX_SEI_NUT
        )
            return this.rbsp(frame);
        return frame;
    }
}
