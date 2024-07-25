import { SynFuturesV3 } from '../synfuturesV3Core';
import { CallOverrides } from 'ethers';
import {
    InstrumentIdentifier,
    InstrumentLevelAccountModel,
    MarketType,
    PairLevelAccountModel,
    PairModel,
    Portfolio,
} from '../types';
import { trimObj } from '../common';

export class AccountModule {
    synfV3: SynFuturesV3;

    constructor(synfV3: SynFuturesV3) {
        this.synfV3 = synfV3;
    }

    // given single trader address, return multiple instrument level account which he/she is involved
    public async getInstrumentLevelAccounts(
        target: string,
        overrides?: CallOverrides,
    ): Promise<InstrumentLevelAccountModel[]> {
        const allInstrumentAddr = [...this.synfV3.cacheModule.instrumentMap.keys()];
        const quotes = Array.from(
            new Set(
                allInstrumentAddr.map(
                    (instrument) =>
                        this.synfV3.cacheModule.instrumentMap.get(instrument.toLowerCase())!.info.quote.address,
                ),
            ),
        );
        await this.synfV3.cacheModule.syncVaultCache(target, quotes);

        const observerInterface = this.synfV3.contracts.observer.interface;
        const calls = [];
        for (const instrument of allInstrumentAddr) {
            calls.push({
                target: this.synfV3.contracts.observer.address,
                callData: observerInterface.encodeFunctionData('getPortfolios', [target, instrument]),
            });
        }
        const rawRet = (await this.synfV3.ctx.getMulticall3().callStatic.aggregate(calls, overrides ?? {})).returnData;

        const map = new Map<string, InstrumentLevelAccountModel>(); // instrument address in lowercase => InstrumentLevelAccount
        for (let i = 0; i < rawRet.length; i++) {
            const decoded = observerInterface.decodeFunctionResult('getPortfolios', rawRet[i]);
            const expiries = decoded.expiries;
            const portfolios = decoded.portfolios;
            const blockInfo = trimObj(decoded.blockInfo);

            const instrumentAddr = allInstrumentAddr[i];
            const instrumentModel = this.synfV3.cacheModule.instrumentMap.get(instrumentAddr);
            if (instrumentModel) {
                for (let j = 0; j < expiries.length; j++) {
                    const portfolio = portfolios[j] as Portfolio;
                    // skip empty portfolio
                    if (synfV3Utils.isEmptyPortfolio(portfolio)) continue;

                    let instrumentLevelAccount = map.get(instrumentAddr);
                    if (!instrumentLevelAccount) {
                        instrumentLevelAccount = new InstrumentLevelAccountModel(
                            instrumentModel,
                            instrumentAddr,
                            target.toLowerCase(),
                        );
                        map.set(instrumentAddr, instrumentLevelAccount);
                    }
                    const pair = instrumentModel.getPairModel(expiries[j]);
                    if (pair) {
                        instrumentLevelAccount.addPairLevelAccount(pair, portfolios[j], blockInfo);
                    }
                }
            }
        }
        return Array.from(map.values());
    }

    public async updatePairLevelAccount(
        target: string,
        instrument: string,
        expiry: number,
        overrides?: CallOverrides,
    ): Promise<PairLevelAccountModel> {
        instrument = instrument.toLowerCase();
        target = target.toLowerCase();
        await this.synfV3.instrumentModel.updateInstrument([{ instrument: instrument, expiries: [expiry] }]);
        const resp = await this.synfV3.contracts.observer.getAcc(instrument, expiry, target, overrides ?? {});
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const pair: PairModel = this.synfV3.cacheModule.instrumentMap.get(instrument)!.getPairModel(expiry);
        const pairLevelAccountModel = PairLevelAccountModel.fromRawPortfolio(
            pair,
            target,
            resp.portfolio,
            trimObj(resp.blockInfo),
        );
        this.synfV3.cacheModule.instrumentMap
            .get(instrument)
            ?.state.setAccountState(target, expiry, pairLevelAccountModel.account);

        // load into cache
        const newTargetInstrumentMap = this.synfV3.cacheModule.accountCache.get(target) || new Map();
        const newInstrumentExpiryMap = newTargetInstrumentMap.get(instrument) || new Map();
        newInstrumentExpiryMap.set(expiry, pairLevelAccountModel);
        newTargetInstrumentMap.set(instrument, newInstrumentExpiryMap);
        this.synfV3.cacheModule.accountCache.set(target, newTargetInstrumentMap);
        return pairLevelAccountModel;
    }

    public async getPairLevelAccount(
        target: string,
        instrument: string,
        expiry: number,
        useCache = false,
    ): Promise<PairLevelAccountModel> {
        instrument = instrument.toLowerCase();
        target = target.toLowerCase();
        if (!useCache) {
            return this.updatePairLevelAccount(target, instrument, expiry);
        }
        // check whether cache has the info
        const targetInstrumentMap = this.synfV3.cacheModule.accountCache.get(target);
        if (targetInstrumentMap) {
            const instrumentExpiryMap = targetInstrumentMap.get(instrument);
            if (instrumentExpiryMap) {
                const pairLevelAccountModel = instrumentExpiryMap.get(expiry);
                if (pairLevelAccountModel) {
                    return pairLevelAccountModel;
                }
            }
        }
        // get info on chain and load into cache
        const pairLevelAccountModel = await this.updatePairLevelAccount(target, instrument, expiry);
        return pairLevelAccountModel;
    }
}

export const synfV3Utils = {
    parseInstrumentSymbol: function (symbol: string): InstrumentIdentifier {
        const [prefix, baseSymbol, quoteSymbol, marketType] = symbol.split('-');
        if (prefix !== 'SynFuturesV3') {
            throw new Error('Technically the instrument symbol should start with SynFuturesV3');
        }
        return {
            marketType: marketType as MarketType,
            baseSymbol: baseSymbol,
            quoteSymbol: quoteSymbol,
        };
    },

    isEmptyPortfolio: function (portfolio: Portfolio): boolean {
        return portfolio.oids.length === 0 && portfolio.rids.length === 0 && portfolio.position.size.isZero();
    },
};
