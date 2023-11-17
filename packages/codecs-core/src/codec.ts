/**
 * Defines an offset in bytes.
 */
export type Offset = number;

/**
 * An object that can encode a value to a `Uint8Array`.
 */
export type Encoder<T> = {
    /** An optional description for the codec. */
    description?: string;

    /**
     * Writes the encoded value into the provided byte array at the given offset.
     * Returns the offset of the next byte after the encoded value.
     */
    encode: (value: T, bytes: Uint8Array, offset: Offset) => Offset;
} & (
    | {
          /** The fixed size of the encoded value in bytes, if applicable. */
          fixedSize: number;
      }
    | {
          /** Otherwise, a null fixedSize indicates it's a variable size encoder. */
          fixedSize: null;
          /** The maximum size an encoded value can be in bytes, if applicable. */
          maxSize?: number;
          /** The total size of the encoded value in bytes. */
          variableSize: (value: T) => number;
      }
);

/**
 * An object that can decode a value from a `Uint8Array`.
 */
export type Decoder<T> = {
    /**
     * Reads the encoded value from the provided byte array at the given offset.
     * Returns the decoded value and the offset of the next byte after the encoded value.
     */
    decode: (bytes: Uint8Array, offset: Offset) => [T, Offset];
    /** An optional description for the codec. */
    description?: string;
} & (
    | {
          /** The fixed size of the encoded value in bytes, if applicable. */
          fixedSize: number;
      }
    | {
          /** Otherwise, a null fixedSize indicates it's a variable size encoder. */
          fixedSize: null;
          /** The maximum size an encoded value can be in bytes, if applicable. */
          maxSize?: number;
      }
);

/**
 * An object that can encode and decode a value to and from a `Uint8Array`.
 * It supports encoding looser types than it decodes for convenience.
 * For example, a `bigint` encoder will always decode to a `bigint`
 * but can be used to encode a `number`.
 *
 * @typeParam From - The type of the value to encode.
 * @typeParam To - The type of the decoded value. Defaults to `From`.
 */
export type Codec<From, To extends From = From> = Encoder<From> & Decoder<To>;

/**
 * Defines common configurations for codec factories.
 */
export type BaseCodecConfig = {
    /** A custom description for the Codec. */
    description?: string;
};

/**
 * Wraps all the attributes of an object in Codecs.
 */
export type WrapInCodec<T, U extends T = T> = {
    [P in keyof T]: Codec<T[P], U[P]>;
};

/**
 * Get the encoded size of a given value in bytes.
 */
export function getEncodedSize<T>(value: T, encoder: Encoder<T>): number {
    return encoder.fixedSize !== null ? encoder.fixedSize : encoder.variableSize(value);
}

/**
 * Use the provided Encoder to encode the given value to a `Uint8Array`.
 */
export function encode<T>(value: T, encoder: Encoder<T>): Uint8Array {
    const bytes = new Uint8Array(getEncodedSize(value, encoder)).fill(0);
    encoder.encode(value, bytes, 0);
    return bytes;
}

/**
 * Use the provided Decoder to decode a value from a `Uint8Array`.
 */
export function decode<T>(bytes: Uint8Array, decoder: Decoder<T>): T {
    return decoder.decode(bytes, 0)[0];
}
