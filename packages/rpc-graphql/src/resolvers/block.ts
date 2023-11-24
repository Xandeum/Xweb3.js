import { Slot } from '@solana/rpc-core/dist/types/rpc-methods/common';
import { GraphQLResolveInfo } from 'graphql';

import { RpcGraphQLContext } from '../context.js';
import { BlockQueryArgs } from '../schema/block.js';

export const resolveBlock = (fieldName: string) => {
    return (
        parent: { [x: string]: Slot },
        args: BlockQueryArgs,
        context: RpcGraphQLContext,
        info: GraphQLResolveInfo | undefined
    ) => (parent[fieldName] === null ? null : context.loaders.block.load({ ...args, slot: parent[fieldName] }, info));
};
