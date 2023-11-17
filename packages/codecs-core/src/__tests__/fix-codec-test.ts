import { Codec, decode, encode } from '../codec';
import { fixCodec, fixDecoder, fixEncoder } from '../fix-codec';
import { b, getMockCodec } from './__setup__';

describe('fixCodec', () => {
    it('keeps same-sized byte arrays as-is', () => {
        const mockCodec = getMockCodec();

        mockCodec.encode.mockReturnValueOnce(b('08050c0c0f170f120c04'));
        expect(encode('helloworld', fixCodec(mockCodec, 10))).toStrictEqual(b('08050c0c0f170f120c04'));
        expect(mockCodec.encode).toHaveBeenCalledWith('helloworld');

        decode(b('08050c0c0f170f120c04'), fixCodec(mockCodec, 10));
        expect(mockCodec.decode).toHaveBeenCalledWith(b('08050c0c0f170f120c04'), 0);

        fixCodec(mockCodec, 10).decode(b('ffff08050c0c0f170f120c04'), 2);
        expect(mockCodec.decode).toHaveBeenCalledWith(b('08050c0c0f170f120c04'), 0);
    });

    it('truncates over-sized byte arrays', () => {
        const mockCodec = getMockCodec();

        mockCodec.encode.mockReturnValueOnce(b('08050c0c0f170f120c04'));
        expect(encode('helloworld', fixCodec(mockCodec, 5))).toStrictEqual(b('08050c0c0f'));
        expect(mockCodec.encode).toHaveBeenCalledWith('helloworld');

        decode(b('08050c0c0f170f120c04'), fixCodec(mockCodec, 5));
        expect(mockCodec.decode).toHaveBeenCalledWith(b('08050c0c0f'), 0);

        fixCodec(mockCodec, 5).decode(b('ffff08050c0c0f170f120c04'), 2);
        expect(mockCodec.decode).toHaveBeenCalledWith(b('08050c0c0f'), 0);
    });

    it('pads under-sized byte arrays', () => {
        const mockCodec = getMockCodec();

        mockCodec.encode.mockReturnValueOnce(b('08050c0c0f'));
        expect(encode('hello', fixCodec(mockCodec, 10))).toStrictEqual(b('08050c0c0f0000000000'));
        expect(mockCodec.encode).toHaveBeenCalledWith('hello');

        decode(b('08050c0c0f0000000000'), fixCodec(mockCodec, 10));
        expect(mockCodec.decode).toHaveBeenCalledWith(b('08050c0c0f0000000000'), 0);

        fixCodec(mockCodec, 10).decode(b('ffff08050c0c0f0000000000'), 2);
        expect(mockCodec.decode).toHaveBeenCalledWith(b('08050c0c0f0000000000'), 0);

        expect(() => decode(b('08050c0c0f'), fixCodec(mockCodec, 10))).toThrow(
            'Codec [fixCodec] expected 10 bytes, got 5.'
        );
    });

    it('has the right description', () => {
        const mockCodec = getMockCodec({ description: 'mock' });

        // Description matches the fixed definition.
        expect(fixCodec(mockCodec, 42).description).toBe('fixed(42, mock)');

        // Description can be overridden.
        expect(fixCodec(mockCodec, 42, 'my fixed').description).toBe('my fixed');
    });

    it('has the right sizes', () => {
        const mockCodec = getMockCodec({ size: null });
        expect(fixCodec(mockCodec, 12).fixedSize).toBe(12);
        expect(fixCodec(mockCodec, 42).fixedSize).toBe(42);
    });

    it('can fix a codec that requires a minimum amount of bytes', () => {
        // Given a mock `u32` codec that ensures the byte array is 4 bytes long.
        const u32: Codec<number> = {
            decode(bytes, offset = 0): [number, number] {
                // eslint-disable-next-line jest/no-conditional-in-test
                if (bytes.slice(offset).length < offset + 4) {
                    throw new Error('Not enough bytes to decode a u32.');
                }
                return [bytes.slice(offset)[0], offset + 4];
            },
            description: 'u32',
            encode: (value: number, bytes, offset) => {
                bytes.set([value], offset);
                return offset + 4;
            },
            fixedSize: 4,
        };

        // When we synthesize a `u24` from that `u32` using `fixCodec`.
        const u24 = fixCodec(u32, 3);

        // Then we can encode a `u24`.
        const buf = encode(42, u24);
        expect(buf).toStrictEqual(new Uint8Array([42, 0, 0]));

        // And we can decode it back.
        const hydrated = decode(buf, u24);
        expect(hydrated).toStrictEqual([42, 3]);
    });
});

describe('fixEncoder', () => {
    it('can fix an encoder to a given amount of bytes', () => {
        const mockCodec = getMockCodec();

        mockCodec.encode.mockReturnValueOnce(b('08050c0c0f170f120c04'));
        expect(encode('helloworld', fixEncoder(mockCodec, 10))).toStrictEqual(b('08050c0c0f170f120c04'));
        expect(mockCodec.encode).toHaveBeenCalledWith('helloworld');

        mockCodec.encode.mockReturnValueOnce(b('08050c0c0f170f120c04'));
        expect(encode('helloworld', fixEncoder(mockCodec, 5))).toStrictEqual(b('08050c0c0f'));
        expect(mockCodec.encode).toHaveBeenCalledWith('helloworld');

        mockCodec.encode.mockReturnValueOnce(b('08050c0c0f'));
        expect(encode('hello', fixEncoder(mockCodec, 10))).toStrictEqual(b('08050c0c0f0000000000'));
        expect(mockCodec.encode).toHaveBeenCalledWith('hello');
    });
});

describe('fixDecoder', () => {
    it('can fix a decoder to a given amount of bytes', () => {
        const mockCodec = getMockCodec();

        decode(b('08050c0c0f170f120c04'), fixDecoder(mockCodec, 10));
        expect(mockCodec.decode).toHaveBeenCalledWith(b('08050c0c0f170f120c04'), 0);

        decode(b('08050c0c0f170f120c04'), fixDecoder(mockCodec, 5));
        expect(mockCodec.decode).toHaveBeenCalledWith(b('08050c0c0f'), 0);

        decode(b('08050c0c0f0000000000'), fixDecoder(mockCodec, 10));
        expect(mockCodec.decode).toHaveBeenCalledWith(b('08050c0c0f0000000000'), 0);

        expect(() => decode(b('08050c0c0f'), fixDecoder(mockCodec, 10))).toThrow(
            'Codec [fixCodec] expected 10 bytes, got 5.'
        );
    });
});
