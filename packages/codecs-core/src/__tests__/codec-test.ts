import { Codec, decode, Decoder, encode, Encoder } from '../codec';

describe('Encoder', () => {
    it('can define Encoder instances', () => {
        const myEncoder: Encoder<string> = {
            description: 'myEncoder',
            encode: (value: string, bytes, offset) => {
                const charCodes = [...value.slice(0, 32)].map(char => Math.min(char.charCodeAt(0), 255));
                bytes.set(charCodes, offset);
                return offset + 32;
            },
            fixedSize: 32,
        };

        expect(myEncoder.description).toBe('myEncoder');
        expect(myEncoder.fixedSize).toBe(32);

        const expectedBytes = new Uint8Array(32).fill(0);
        expectedBytes.set(new Uint8Array([104, 101, 108, 108, 111]));
        expect(encode('hello', myEncoder)).toStrictEqual(expectedBytes);

        const writtenBytes = new Uint8Array(32).fill(0);
        expect(myEncoder.encode('hello', writtenBytes, 0)).toBe(32);
        expect(writtenBytes).toStrictEqual(expectedBytes);
    });
});

describe('Decoder', () => {
    it('can define Decoder instances', () => {
        const myDecoder: Decoder<string> = {
            decode: (bytes: Uint8Array, offset) => {
                const slice = bytes.slice(offset, offset + 32);
                const str = [...slice].map(charCode => String.fromCharCode(charCode)).join('');
                return [str, offset + 32];
            },
            description: 'myDecoder',
            fixedSize: 32,
        };

        expect(myDecoder.description).toBe('myDecoder');
        expect(myDecoder.fixedSize).toBe(32);

        expect(decode(new Uint8Array([104, 101, 108, 108, 111]), myDecoder)).toBe('hello');
        expect(myDecoder.decode(new Uint8Array([104, 101, 108, 108, 111]), 0)).toStrictEqual(['hello', 32]);
    });
});

describe('Codec', () => {
    it('can define Codec instances', () => {
        const myCodec: Codec<string> = {
            decode: (bytes: Uint8Array, offset) => {
                const slice = bytes.slice(offset, offset + 32);
                const str = [...slice].map(charCode => String.fromCharCode(charCode)).join('');
                return [str, offset + 32];
            },
            description: 'myCodec',
            encode: (value: string, bytes, offset) => {
                const charCodes = [...value.slice(0, 32)].map(char => Math.min(char.charCodeAt(0), 255));
                bytes.set(charCodes, offset);
                return offset + 32;
            },
            fixedSize: 32,
        };

        expect(myCodec.description).toBe('myCodec');
        expect(myCodec.fixedSize).toBe(32);

        const expectedBytes = new Uint8Array(32).fill(0);
        expectedBytes.set(new Uint8Array([104, 101, 108, 108, 111]));
        expect(encode('hello', myCodec)).toStrictEqual(expectedBytes);

        const writtenBytes = new Uint8Array(32).fill(0);
        expect(myCodec.encode('hello', writtenBytes, 0)).toBe(32);
        expect(writtenBytes).toStrictEqual(expectedBytes);

        expect(decode(new Uint8Array([104, 101, 108, 108, 111]), myCodec)).toBe('hello');
        expect(myCodec.decode(new Uint8Array([104, 101, 108, 108, 111]), 0)).toStrictEqual(['hello', 32]);
    });
});
