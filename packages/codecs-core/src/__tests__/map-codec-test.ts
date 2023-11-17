import { Codec, decode, Decoder, encode, Encoder } from '../codec';
import { mapCodec, mapDecoder, mapEncoder } from '../map-codec';

const numberCodec: Codec<number> = {
    decode: (bytes: Uint8Array): [number, number] => [bytes[0], 1],
    description: 'number',
    encode: (value: number, bytes, offset) => {
        bytes.set([value], offset);
        return offset + 1;
    },
    fixedSize: 1,
};

describe('mapCodec', () => {
    it('can loosen the codec input with a map', () => {
        // From <number> to <number | string, number>.
        const mappedCodec: Codec<number | string, number> = mapCodec(numberCodec, (value: number | string) =>
            // eslint-disable-next-line jest/no-conditional-in-test
            typeof value === 'number' ? value : value.length
        );

        const bytesA = encode(42, mappedCodec);
        expect(decode(bytesA, mappedCodec)).toBe(42);

        const bytesB = encode('Hello world', mappedCodec);
        expect(decode(bytesB, mappedCodec)).toBe(11);
    });

    it('can map both the input and output of a codec', () => {
        // From <number> to <number | string, string>.
        const mappedCodec: Codec<number | string, string> = mapCodec(
            numberCodec,
            // eslint-disable-next-line jest/no-conditional-in-test
            (value: number | string) => (typeof value === 'number' ? value : value.length),
            (value: number) => 'x'.repeat(value)
        );

        const bytesA = encode(42, mappedCodec);
        expect(decode(bytesA, mappedCodec)).toBe('x'.repeat(42));

        const bytesB = encode('Hello world', mappedCodec);
        expect(decode(bytesB, mappedCodec)).toBe('x'.repeat(11));
    });

    it('can map the input and output of a codec to the same type', () => {
        // From <number> to <string>.
        const mappedCodec: Codec<string> = mapCodec(
            numberCodec,
            (value: string) => value.length,
            (value: number) => 'x'.repeat(value)
        );

        const bytesA = encode('42', mappedCodec);
        expect(decode(bytesA, mappedCodec)).toBe('xx');

        const bytesB = encode('Hello world', mappedCodec);
        expect(decode(bytesB, mappedCodec)).toBe('xxxxxxxxxxx');
    });

    it('can wrap a codec type in an object using a map', () => {
        // From <number> to <{ value: number }>.
        type Wrap<T> = { value: T };
        const mappedCodec: Codec<Wrap<number>> = mapCodec(
            numberCodec,
            (value: Wrap<number>) => value.value,
            (value: number): Wrap<number> => ({ value })
        );

        const bytes = encode({ value: 42 }, mappedCodec);
        expect(decode(bytes, mappedCodec)).toStrictEqual({ value: 42 });
    });

    it('map a codec to loosen its input by providing default values', () => {
        // Create Codec<Strict>.
        type Strict = { discriminator: number; label: string };
        const strictCodec: Codec<Strict> = {
            decode: (bytes: Uint8Array): [Strict, number] => [
                { discriminator: bytes[0], label: 'x'.repeat(bytes[1]) },
                1,
            ],
            description: 'Strict',
            encode: (value: Strict, bytes, offset) => {
                bytes.set([value.discriminator, value.label.length], offset);
                return offset + 2;
            },
            fixedSize: 2,
        };

        const bytesA = encode({ discriminator: 5, label: 'Hello world' }, strictCodec);
        expect(decode(bytesA, strictCodec)).toStrictEqual({
            discriminator: 5,
            label: 'xxxxxxxxxxx',
        });

        // From <Strict> to <Loose, Strict>.
        type Loose = { discriminator?: number; label: string };
        const looseCodec: Codec<Loose, Strict> = mapCodec(
            strictCodec,
            (value: Loose): Strict => ({
                discriminator: 42, // <- Default value.
                ...value,
            })
        );

        // With explicit discriminator.
        const bytesB = encode({ discriminator: 5, label: 'Hello world' }, looseCodec);
        expect(decode(bytesB, looseCodec)).toStrictEqual({
            discriminator: 5,
            label: 'xxxxxxxxxxx',
        });

        // With implicit discriminator.
        const bytesC = encode({ label: 'Hello world' }, looseCodec);
        expect(decode(bytesC, looseCodec)).toStrictEqual({
            discriminator: 42,
            label: 'xxxxxxxxxxx',
        });
    });

    it('can loosen a tuple codec', () => {
        const codec: Codec<[number, string]> = {
            decode: (bytes: Uint8Array): [[number, string], number] => [[bytes[0], 'x'.repeat(bytes[1])], 2],
            description: 'Tuple',
            encode: (value: [number, string], bytes, offset) => {
                bytes.set([value[0], value[1].length], offset);
                return offset + 2;
            },
            fixedSize: 2,
        };

        const bytesA = encode([42, 'Hello world'], codec);
        expect(decode(bytesA, codec)).toStrictEqual([42, 'xxxxxxxxxxx']);

        const mappedCodec = mapCodec(codec, (value: [number | null, string]): [number, string] => [
            // eslint-disable-next-line jest/no-conditional-in-test
            value[0] ?? value[1].length,
            value[1],
        ]);

        const bytesB = encode([null, 'Hello world'], mappedCodec);
        expect(decode(bytesB, mappedCodec)).toStrictEqual([11, 'xxxxxxxxxxx']);

        const bytesC = encode([42, 'Hello world'], mappedCodec);
        expect(decode(bytesC, mappedCodec)).toStrictEqual([42, 'xxxxxxxxxxx']);
    });
});

describe('mapEncoder', () => {
    it('can map an encoder to another encoder', () => {
        const encoderA: Encoder<number> = {
            description: 'A',
            encode: (value: number, bytes, offset) => {
                bytes.set([value], offset);
                return offset + 1;
            },
            fixedSize: 1,
        };

        const encoderB = mapEncoder(encoderA, (value: string): number => value.length);

        expect(encoderB.description).toBe('A');
        expect(encoderB.fixedSize).toBe(1);
        expect(encode('helloworld', encoderB)).toStrictEqual(new Uint8Array([10]));
    });
});

describe('mapDecoder', () => {
    it('can map an encoder to another encoder', () => {
        const decoder: Decoder<number> = {
            decode: (bytes: Uint8Array, offset = 0) => [bytes[offset], offset + 1],
            description: 'A',
            fixedSize: 1,
        };

        const decoderB = mapDecoder(decoder, (value: number): string => 'x'.repeat(value));

        expect(decoderB.description).toBe('A');
        expect(decoderB.fixedSize).toBe(1);
        expect(decoderB.decode(new Uint8Array([10]), 0)).toStrictEqual(['xxxxxxxxxx', 1]);
    });
});
