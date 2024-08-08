import { ConfigInterface } from './config.interface';
import { CallOverrides, ethers } from 'ethers';
import { SynFuturesV3Ctx } from '../synfuturesV3Core';
import { CHAIN_ID } from '@derivation-tech/web3-core';

export class ConfigModule implements ConfigInterface {
    synfV3: SynFuturesV3Ctx;

    constructor(synfV3: SynFuturesV3Ctx) {
        this.synfV3 = synfV3;
    }

    async inWhiteListLps(quoteAddr: string, traders: string[], overrides?: CallOverrides): Promise<boolean[]> {
        let calls = [];
        let results: boolean[] = [];
        let configInterface: ethers.utils.Interface = this.synfV3.cache.contracts.config.interface;
        if (
            (this.synfV3.cache.ctx.chainId === CHAIN_ID.BASE || this.synfV3.cache.ctx.chainId === CHAIN_ID.LOCAL) &&
            quoteAddr
        ) {
            for (const trader of traders) {
                calls.push({
                    target: this.synfV3.cache.contracts.config.address,
                    callData: configInterface.encodeFunctionData('lpWhitelist', [quoteAddr, trader]),
                });
            }
            try {
                const rawData = await this.synfV3.cache.ctx.multicall3.callStatic.aggregate(calls, overrides ?? {});
                for (const data of rawData.returnData) {
                    results.push(configInterface.decodeFunctionResult('lpWhitelist', data)[0]);
                }
                return results;
            } catch (e) {
                // ignore error since the contract on some network may not have this function
            }
        }
        // legacy function for other networks
        calls = [];
        results = [];
        configInterface = new ethers.utils.Interface([
            'function lpWhitelist(address user) external view returns (bool)',
        ]);

        for (const trader of traders) {
            calls.push({
                target: this.synfV3.cache.contracts.config.address,
                callData: configInterface.encodeFunctionData('lpWhitelist', [trader]),
            });
        }
        const rawData = await this.synfV3.cache.ctx.multicall3.callStatic.aggregate(calls, overrides ?? {});
        for (const data of rawData.returnData) {
            results.push(configInterface.decodeFunctionResult('lpWhitelist', data)[0]);
        }
        return results;
    }

    async openLp(quoteAddr?: string, overrides?: CallOverrides): Promise<boolean> {
        if (
            (this.synfV3.cache.ctx.chainId === CHAIN_ID.BASE || this.synfV3.cache.ctx.chainId === CHAIN_ID.LOCAL) &&
            quoteAddr
        ) {
            try {
                const restricted = await this.synfV3.cache.contracts.config.restrictLp(quoteAddr, overrides ?? {});
                return !restricted;
            } catch (e) {
                // ignore error since the contract on some network may not have this function
            }
        }
        return this.synfV3.cache.contracts.config.openLp(overrides ?? {});
    }
}
