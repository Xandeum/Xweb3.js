import { assertFixedSizeCodec } from './assertions';
import { Codec, Decoder, Encoder } from './codec';
import { combineCodec } from './combine-codec';

/**
 * Reverses the bytes of a fixed-size encoder.
 */
export function reverseEncoder<T>(encoder: Encoder<T>): Encoder<T> {
    assertFixedSizeCodec(encoder, 'Cannot reverse a codec of variable size.');
    return {
        ...encoder,
        encode: (value: T, bytes, offset) => {
            const newOffset = encoder.encode(value, bytes, offset);
            const slice = bytes.slice(offset, offset + encoder.fixedSize).reverse();
            bytes.set(slice, offset);
            return newOffset;
        },
    };
}

/**
 * Reverses the bytes of a fixed-size decoder.
 */
export function reverseDecoder<T>(decoder: Decoder<T>): Decoder<T> {
    assertFixedSizeCodec(decoder, 'Cannot reverse a codec of variable size.');
    return {
        ...decoder,
        decode: (bytes, offset) => {
            const reverseEnd = offset + decoder.fixedSize;
            if (offset === 0 && bytes.length === reverseEnd) {
                return decoder.decode(bytes.reverse(), offset);
            }
            const reversedBytes = bytes.slice();
            reversedBytes.set(bytes.slice(offset, reverseEnd).reverse(), offset);
            return decoder.decode(reversedBytes, offset);
        },
    };
}

/**
 * Reverses the bytes of a fixed-size codec.
 */
export function reverseCodec<T, U extends T = T>(codec: Codec<T, U>): Codec<T, U> {
    return combineCodec(reverseEncoder(codec), reverseDecoder(codec));
}
