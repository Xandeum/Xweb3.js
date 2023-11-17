import { Codec, encode } from '../codec';

export const b = (s: string) => encode(s, base16);

export const base16: Codec<string> = {
    decode(bytes, offset) {
        const value = bytes.slice(offset).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
        return [value, bytes.length];
    },
    description: 'base16',
    encode(value: string, bytes, offset) {
        const matches = value.toLowerCase().match(/.{1,2}/g);
        const hexBytes = matches ? matches.map((byte: string) => parseInt(byte, 16)) : [];
        bytes.set(hexBytes, offset);
        return offset + hexBytes.length;
    },
    fixedSize: null,
    variableSize: (value: string) => Math.ceil(value.length / 2),
};

export const getMockCodec = (
    config: {
        defaultValue?: string;
        description?: string;
        size?: number | null;
    } = {}
) => ({
    decode: jest.fn().mockReturnValue([config.defaultValue ?? '', 0]),
    description: config.description ?? 'mock',
    encode: jest.fn().mockReturnValue(0),
    fixedSize: config.size ?? null,
    maxSize: config.size ?? undefined,
    variableSize: jest.fn().mockReturnValue(config.size ?? 0),
});
