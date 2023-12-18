import {MessageHeader, MessageAddressTableLookup} from './index';
import {AccountKeysFromLookups} from './account-keys';
import {AddressLookupTableAccount} from '../programs';
import {TransactionInstruction,XTransactionInstruction} from '../transaction';
import assert from '../utils/assert';
import {PublicKey} from '../publickey';

export type CompiledKeyMeta = {
  isSigner: boolean;
  isWritable: boolean;
  isInvoked: boolean;
};

type KeyMetaMap = Map<string, CompiledKeyMeta>;

export class CompiledKeys {
  payer: PublicKey;
  keyMetaMap: KeyMetaMap;

  constructor(payer: PublicKey, keyMetaMap: KeyMetaMap) {
    this.payer = payer;
    this.keyMetaMap = keyMetaMap;
  }

  static compile(
    instructions: Array<TransactionInstruction>,
    payer: PublicKey,
  ): CompiledKeys {
    const keyMetaMap: KeyMetaMap = new Map();
    const getOrInsertDefault = (pubkey: PublicKey): CompiledKeyMeta => {
      const address = pubkey.toBase58();
      let keyMeta = keyMetaMap.get(address);
      if (keyMeta === undefined) {
        keyMeta = {
          isSigner: false,
          isWritable: false,
          isInvoked: false,
        };
        keyMetaMap.set(address, keyMeta);
      }
      return keyMeta;
    };

    const payerKeyMeta = getOrInsertDefault(payer);
    payerKeyMeta.isSigner = true;
    payerKeyMeta.isWritable = true;

    for (const ix of instructions) {
      getOrInsertDefault(ix.programId).isInvoked = true;
      for (const accountMeta of ix.keys) {
        const keyMeta = getOrInsertDefault(accountMeta.pubkey);
        keyMeta.isSigner ||= accountMeta.isSigner;
        keyMeta.isWritable ||= accountMeta.isWritable;
      }
    }

    return new CompiledKeys(payer, keyMetaMap);
  }

  

  getMessageComponents(): [MessageHeader, Array<PublicKey>] {
    const mapEntries = [...this.keyMetaMap.entries()];
    assert(mapEntries.length <= 256, 'Max static account keys length exceeded');

    const writableSigners = mapEntries.filter(
      ([, meta]) => meta.isSigner && meta.isWritable,
    );
    const readonlySigners = mapEntries.filter(
      ([, meta]) => meta.isSigner && !meta.isWritable,
    );
    const writableNonSigners = mapEntries.filter(
      ([, meta]) => !meta.isSigner && meta.isWritable,
    );
    const readonlyNonSigners = mapEntries.filter(
      ([, meta]) => !meta.isSigner && !meta.isWritable,
    );

    const header: MessageHeader = {
      numRequiredSignatures: writableSigners.length + readonlySigners.length,
      numReadonlySignedAccounts: readonlySigners.length,
      numReadonlyUnsignedAccounts: readonlyNonSigners.length,
    };

    // sanity checks
    {
      assert(
        writableSigners.length > 0,
        'Expected at least one writable signer key',
      );
      const [payerAddress] = writableSigners[0];
      assert(
        payerAddress === this.payer.toBase58(),
        'Expected first writable signer key to be the fee payer',
      );
    }

    const staticAccountKeys = [
      ...writableSigners.map(([address]) => new PublicKey(address)),
      ...readonlySigners.map(([address]) => new PublicKey(address)),
      ...writableNonSigners.map(([address]) => new PublicKey(address)),
      ...readonlyNonSigners.map(([address]) => new PublicKey(address)),
    ];

    return [header, staticAccountKeys];
  }

  extractTableLookup(
    lookupTable: AddressLookupTableAccount,
  ): [MessageAddressTableLookup, AccountKeysFromLookups] | undefined {
    const [writableIndexes, drainedWritableKeys] =
      this.drainKeysFoundInLookupTable(
        lookupTable.state.addresses,
        keyMeta =>
          !keyMeta.isSigner && !keyMeta.isInvoked && keyMeta.isWritable,
      );
    const [readonlyIndexes, drainedReadonlyKeys] =
      this.drainKeysFoundInLookupTable(
        lookupTable.state.addresses,
        keyMeta =>
          !keyMeta.isSigner && !keyMeta.isInvoked && !keyMeta.isWritable,
      );

    // Don't extract lookup if no keys were found
    if (writableIndexes.length === 0 && readonlyIndexes.length === 0) {
      return;
    }

    return [
      {
        accountKey: lookupTable.key,
        writableIndexes,
        readonlyIndexes,
      },
      {
        writable: drainedWritableKeys,
        readonly: drainedReadonlyKeys,
      },
    ];
  }

  /** @internal */
  private drainKeysFoundInLookupTable(
    lookupTableEntries: Array<PublicKey>,
    keyMetaFilter: (keyMeta: CompiledKeyMeta) => boolean,
  ): [Array<number>, Array<PublicKey>] {
    const lookupTableIndexes = new Array();
    const drainedKeys = new Array();

    for (const [address, keyMeta] of this.keyMetaMap.entries()) {
      if (keyMetaFilter(keyMeta)) {
        const key = new PublicKey(address);
        const lookupTableIndex = lookupTableEntries.findIndex(entry =>
          entry.equals(key),
        );
        if (lookupTableIndex >= 0) {
          assert(lookupTableIndex < 256, 'Max lookup table index exceeded');
          lookupTableIndexes.push(lookupTableIndex);
          drainedKeys.push(key);
          this.keyMetaMap.delete(address);
        }
      }
    }

    return [lookupTableIndexes, drainedKeys];
  }
}

export class CompiledXKeys {
  payer: PublicKey;
  keyMetaMap: KeyMetaMap;
  xKeyMetaMap: KeyMetaMap;

  constructor(payer: PublicKey, keyMetaMap: KeyMetaMap,xKeyMetaMap: KeyMetaMap) {
    this.payer = payer;
    this.keyMetaMap = keyMetaMap;
    this.xKeyMetaMap = xKeyMetaMap;
  }

  static compile(
    instructions: Array<XTransactionInstruction>,
    payer: PublicKey,
  ): CompiledXKeys {
    const keyMetaMap: KeyMetaMap = new Map();
    const xKeyMetaMap: KeyMetaMap = new Map();
    const getOrInsertDefault = (pubkey: PublicKey): CompiledKeyMeta => {
      const address = pubkey.toBase58();
      let keyMeta = keyMetaMap.get(address);
      if (keyMeta === undefined) {
        keyMeta = {
          isSigner: false,
          isWritable: false,
          isInvoked: false,
        };
        keyMetaMap.set(address, keyMeta);
      }
      return keyMeta;
    };
    //Function to get the same key meta array for xKeys
    const xGetOrInsertDefault = (pubkey: PublicKey): CompiledKeyMeta => {
      const address = pubkey.toBase58();
      let keyMeta = xKeyMetaMap.get(address);
      if (keyMeta === undefined) {
        keyMeta = {
          isSigner: false,
          isWritable: false,
          isInvoked: false,
        };
        xKeyMetaMap.set(address, keyMeta);
      }
      return keyMeta;
    };

    const payerKeyMeta = getOrInsertDefault(payer);
    payerKeyMeta.isSigner = true;
    payerKeyMeta.isWritable = true;

    for (const ix of instructions) {
      getOrInsertDefault(ix.programId).isInvoked = true;
      for (const accountMeta of ix.keys) {
        const keyMeta = getOrInsertDefault(accountMeta.pubkey);
        keyMeta.isSigner ||= accountMeta.isSigner;
        keyMeta.isWritable ||= accountMeta.isWritable;
      }
      for (const accountMeta of ix.xKeys) {
        const keyMeta = xGetOrInsertDefault(accountMeta.pubkey);
        keyMeta.isSigner ||= accountMeta.isSigner;
        keyMeta.isWritable ||= accountMeta.isWritable;
      }
    }

    return new CompiledXKeys(payer, keyMetaMap,xKeyMetaMap);
  }

  getMessageComponents(): [MessageHeader, Array<PublicKey>,Array<PublicKey>] {
    const mapEntries = [...this.keyMetaMap.entries()];
    const xMapEntries = [...this.xKeyMetaMap.entries()];
    
    assert(mapEntries.length <= 256, 'Max static account keys length exceeded');
    assert(xMapEntries.length<=256,'Max static x account keys length exceeded')
    const writableSigners = mapEntries.filter(
      ([, meta]) => meta.isSigner && meta.isWritable,
    );
    const readonlySigners = mapEntries.filter(
      ([, meta]) => meta.isSigner && !meta.isWritable,
    );
    const writableNonSigners = mapEntries.filter(
      ([, meta]) => !meta.isSigner && meta.isWritable,
    );
    const readonlyNonSigners = mapEntries.filter(
      ([, meta]) => !meta.isSigner && !meta.isWritable,
    );
    
    //for the x key filters and add in the header counts
    const xWritableSigners = xMapEntries.filter(
      ([, meta]) => meta.isSigner && meta.isWritable,
    );
    const xReadonlySigners = xMapEntries.filter(
      ([, meta]) => meta.isSigner && !meta.isWritable,
    );
    const xWritableNonSigners = xMapEntries.filter(
      ([, meta]) => !meta.isSigner && meta.isWritable,
    );
    const xReadonlyNonSigners = xMapEntries.filter(
      ([, meta]) => !meta.isSigner && !meta.isWritable,
    );

    const header: MessageHeader = {
      numRequiredSignatures: writableSigners.length + readonlySigners.length+ xWritableSigners.length + xReadonlySigners.length,
      numReadonlySignedAccounts: readonlySigners.length + xReadonlySigners.length,
      numReadonlyUnsignedAccounts: readonlyNonSigners.length + xReadonlyNonSigners.length,
    };

    // sanity checks
    {
      assert(
        writableSigners.length > 0,
        'Expected at least one writable signer key',
      );
      const [payerAddress] = writableSigners[0];
      assert(
        payerAddress === this.payer.toBase58(),
        'Expected first writable signer key to be the fee payer',
      );
    }

    const staticAccountKeys = [
      ...writableSigners.map(([address]) => new PublicKey(address)),
      ...readonlySigners.map(([address]) => new PublicKey(address)),
      ...writableNonSigners.map(([address]) => new PublicKey(address)),
      ...readonlyNonSigners.map(([address]) => new PublicKey(address)),
    ];

    const staticXAccountKeys = [
      ...xWritableSigners.map(([address]) => new PublicKey(address)),
      ...xReadonlySigners.map(([address]) => new PublicKey(address)),
      ...xWritableNonSigners.map(([address]) => new PublicKey(address)),
      ...xReadonlyNonSigners.map(([address]) => new PublicKey(address)),
    
    ]

    return [header, staticAccountKeys,staticXAccountKeys];
  }

  extractTableLookup(
    lookupTable: AddressLookupTableAccount,
  ): [MessageAddressTableLookup, AccountKeysFromLookups] | undefined {
    const [writableIndexes, drainedWritableKeys] =
      this.drainKeysFoundInLookupTable(
        lookupTable.state.addresses,
        keyMeta =>
          !keyMeta.isSigner && !keyMeta.isInvoked && keyMeta.isWritable,
      );
    const [readonlyIndexes, drainedReadonlyKeys] =
      this.drainKeysFoundInLookupTable(
        lookupTable.state.addresses,
        keyMeta =>
          !keyMeta.isSigner && !keyMeta.isInvoked && !keyMeta.isWritable,
      );

    // Don't extract lookup if no keys were found
    if (writableIndexes.length === 0 && readonlyIndexes.length === 0) {
      return;
    }

    return [
      {
        accountKey: lookupTable.key,
        writableIndexes,
        readonlyIndexes,
      },
      {
        writable: drainedWritableKeys,
        readonly: drainedReadonlyKeys,
      },
    ];
  }

  /** @internal */
  private drainKeysFoundInLookupTable(
    lookupTableEntries: Array<PublicKey>,
    keyMetaFilter: (keyMeta: CompiledKeyMeta) => boolean,
  ): [Array<number>, Array<PublicKey>] {
    const lookupTableIndexes = new Array();
    const drainedKeys = new Array();

    for (const [address, keyMeta] of this.keyMetaMap.entries()) {
      if (keyMetaFilter(keyMeta)) {
        const key = new PublicKey(address);
        const lookupTableIndex = lookupTableEntries.findIndex(entry =>
          entry.equals(key),
        );
        if (lookupTableIndex >= 0) {
          assert(lookupTableIndex < 256, 'Max lookup table index exceeded');
          lookupTableIndexes.push(lookupTableIndex);
          drainedKeys.push(key);
          this.keyMetaMap.delete(address);
        }
      }
    }

    return [lookupTableIndexes, drainedKeys];
  }
}

