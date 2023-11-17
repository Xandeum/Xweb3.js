import { decode, Decoder, encode, Encoder } from '../codec';
import { fixCodec } from '../fix-codec';
import { reverseCodec, reverseDecoder, reverseEncoder } from '../reverse-codec';
import { b, base16 } from './__setup__';

describe('reverseCodec', () => {
    it('can reverse the bytes of a fixed-size codec', () => {
        const s = (size: number) => reverseCodec(fixCodec(base16, size));

        // Encode.
        expect(encode('00', s(1))).toStrictEqual(b('00'));
        expect(encode('00ff', s(2))).toStrictEqual(b('ff00'));
        expect(encode('ff00', s(2))).toStrictEqual(b('00ff'));
        expect(encode('00000001', s(4))).toStrictEqual(b('01000000'));
        expect(encode('01000000', s(4))).toStrictEqual(b('00000001'));
        expect(encode('0000000000000001', s(8))).toStrictEqual(b('0100000000000000'));
        expect(encode('0100000000000000', s(8))).toStrictEqual(b('0000000000000001'));
        expect(encode(`01${'00'.repeat(31)}`, s(32))).toStrictEqual(b(`${'00'.repeat(31)}01`));
        expect(encode(`${'00'.repeat(31)}01`, s(32))).toStrictEqual(b(`01${'00'.repeat(31)}`));

        // Decode.
        expect(decode(b('ff00'), s(2))).toStrictEqual(['00ff', 2]);
        expect(decode(b('00ff'), s(2))).toStrictEqual(['ff00', 2]);
        expect(decode(b('00000001'), s(4))).toStrictEqual(['01000000', 4]);
        expect(decode(b('01000000'), s(4))).toStrictEqual(['00000001', 4]);
        expect(s(4).decode(b('aaaa01000000bbbb'), 2)).toStrictEqual(['00000001', 6]);
        expect(s(4).decode(b('aaaa00000001bbbb'), 2)).toStrictEqual(['01000000', 6]);

        // Variable-size codec.
        expect(() => reverseCodec(base16)).toThrow('Cannot reverse a codec of variable size');
    });
});

describe('reverseEncoder', () => {
    it('can reverse the bytes of a fixed-size encoder', () => {
        const encoder: Encoder<number> = {
            description: 'u16',
            encode: (value: number, bytes, offset) => {
                bytes.set([value, 0], offset);
                return offset + 2;
            },
            fixedSize: 2,
        };

        const reversedEncoder = reverseEncoder(encoder);
        expect(reversedEncoder.description).toBe('u16');
        expect(reversedEncoder.fixedSize).toBe(2);
        expect(encode(42, reversedEncoder)).toStrictEqual(new Uint8Array([0, 42]));
        expect(() => reverseEncoder(base16)).toThrow('Cannot reverse a codec of variable size');
    });
});

describe('reverseDecoder', () => {
    it('can reverse the bytes of a fixed-size decoder', () => {
        const decoder: Decoder<string> = {
            decode: (bytes: Uint8Array, offset = 0) => [`${bytes[offset]}-${bytes[offset + 1]}`, offset + 2],
            description: 'u16',
            fixedSize: 2,
        };

        const reversedDecoder = reverseDecoder(decoder);
        expect(reversedDecoder.description).toBe('u16');
        expect(reversedDecoder.fixedSize).toBe(2);
        expect(reversedDecoder.decode(new Uint8Array([42, 0]), 0)).toStrictEqual(['0-42', 2]);
        expect(() => reverseDecoder(base16)).toThrow('Cannot reverse a codec of variable size');
    });
});
