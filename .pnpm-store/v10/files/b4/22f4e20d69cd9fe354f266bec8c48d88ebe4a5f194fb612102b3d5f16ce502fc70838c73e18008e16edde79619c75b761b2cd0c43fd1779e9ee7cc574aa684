import type binding from '@rspack/binding';
import type { Compiler } from '../../index.js';
import { RspackBuiltinPlugin } from '../base.js';
import { type Coordinator } from './Coordinator.js';
export type RscServerPluginOptions = {
    coordinator: Coordinator;
    onServerComponentChanges?: () => Promise<void>;
};
export declare class RscServerPlugin extends RspackBuiltinPlugin {
    #private;
    name: string;
    constructor(options: RscServerPluginOptions);
    raw(compiler: Compiler): binding.BuiltinPlugin;
}
