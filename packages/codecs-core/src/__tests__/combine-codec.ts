import { Codec, decode, Decoder, encode, Encoder } from '../codec';
import { combineCodec } from '../combine-codec';

describe('combineCodec', () => {
    it('can join encoders and decoders with the same type', () => {
        const u8Encoder: Encoder<number> = {
            description: 'u8',
            encode: (value: number, buffer, offset) => {
                buffer.set([value], offset);
                return offset + 1;
            },
            fixedSize: 1,
        };

        const u8Decoder: Decoder<number> = {
            decode: (bytes: Uint8Array, offset = 0) => [bytes[offset], offset + 1],
            description: 'u8',
            fixedSize: 1,
        };

        const u8Codec: Codec<number> = combineCodec(u8Encoder, u8Decoder);

        expect(u8Codec.description).toBe('u8');
        expect(u8Codec.fixedSize).toBe(1);
        expect(encode(42, u8Codec)).toStrictEqual(new Uint8Array([42]));
        expect(decode(new Uint8Array([42]), u8Codec)).toBe(42);
    });

    it('can join encoders and decoders with different but matching types', () => {
        const u8Encoder: Encoder<number | bigint> = {
            description: 'u8',
            encode: (value: number | bigint, buffer, offset) => {
                buffer.set([Number(value)], offset);
                return offset + 1;
            },
            fixedSize: 1,
        };

        const u8Decoder: Decoder<bigint> = {
            decode: (bytes: Uint8Array, offset = 0) => [BigInt(bytes[offset]), offset + 1],
            description: 'u8',
            fixedSize: 1,
        };

        const u8Codec: Codec<number | bigint, bigint> = combineCodec(u8Encoder, u8Decoder);

        expect(u8Codec.description).toBe('u8');
        expect(u8Codec.fixedSize).toBe(1);
        expect(encode(42, u8Codec)).toStrictEqual(new Uint8Array([42]));
        expect(encode(42n, u8Codec)).toStrictEqual(new Uint8Array([42]));
        expect(decode(new Uint8Array([42]), u8Codec)).toBe(42n);
    });

    it('cannot join encoders and decoders with sizes or descriptions', () => {
        expect(() => combineCodec({ encode: jest.fn(), fixedSize: 1 }, { decode: jest.fn(), fixedSize: 2 })).toThrow(
            'Encoder and decoder must have the same fixed size, got [1] and [2]'
        );

        expect(() =>
            combineCodec(
                { encode: jest.fn(), fixedSize: null, maxSize: 1, variableSize: jest.fn() },
                { decode: jest.fn(), fixedSize: null }
            )
        ).toThrow('Encoder and decoder must have the same max size, got [1] and [undefined]');

        expect(() =>
            combineCodec(
                { description: 'u8', encode: jest.fn(), fixedSize: 1 },
                { decode: jest.fn(), description: 'u16', fixedSize: 1 }
            )
        ).toThrow('Encoder and decoder must have the same description, got [u8] and [u16]');
    });

    it('can override the description of the joined codec', () => {
        const myCodec = combineCodec(
            { description: 'u8', encode: jest.fn(), fixedSize: 1 },
            { decode: jest.fn(), description: 'u16', fixedSize: 1 },
            'myCustomDescription'
        );

        expect(myCodec.description).toBe('myCustomDescription');
    });
});
