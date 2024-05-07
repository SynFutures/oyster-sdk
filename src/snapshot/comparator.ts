/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigNumber, ethers } from 'ethers';
import { SynFuturesV3 } from '../synfuturesV3Core';
import { ZERO, leastSignificantBit, ONE } from '../math';
import { PEARL_SPACING } from '../constants';
import { Amm, Pearl, ContractRecord, EMPTY_AMM, AccountState, GateState } from '../types';
import { trimObj } from '../common/util';
import { FundFlowStructOutput, PendingStructOutput } from '../types/typechain/Gate';

const RIGHT_ARROW = '=>';

interface Logger {
    info(...args: any[]): void;
    error(...args: any[]): void;
}

interface Shader {
    bgGreenBright(...args: any[]): string;
    red(...args: any[]): string;
    cyan(...args: any[]): string;
    green(...args: any[]): string;
}

class EmptyLogger implements Logger {
    info(...args: any[]): void {
        void args;
    }

    error(...args: any[]): void {
        void args;
    }
}

class EmptyShader implements Shader {
    bgGreenBright(...args: any[]): string {
        return args.join(' ');
    }

    red(...args: any[]): string {
        return args.join(' ');
    }

    cyan(...args: any[]): string {
        return args.join(' ');
    }

    green(...args: any[]): string {
        return args.join(' ');
    }
}

function getType(obj: any): string {
    const type = typeof obj;
    if (type != 'object') {
        return type;
    }
    return Object.prototype.toString.call(obj).match(/\[object (.*)\]/)![1];
}

function trimBigNumberMap(map: Map<any, BigNumber>): Map<any, BigNumber> {
    for (const key of map.keys()) {
        const ob = map.get(key);
        let valid = false;
        if (!(ob as BigNumber).eq(ZERO)) {
            valid = true;
        }
        if (!valid) map.delete(key);
    }
    return map;
}

export interface ComparatorOptions {
    logger: Logger;
    shader: Shader;
    overrides: ethers.CallOverrides;
    getBlockTimestamp: (blockNumber: number) => Promise<number>;
}

const defaultOptions: Partial<ComparatorOptions> = {
    logger: new EmptyLogger(),
    shader: new EmptyShader(),
    overrides: {},
};

export class Comparator {
    private logger: Logger;
    private shader: Shader;
    private overrides: ethers.CallOverrides;
    private getBlockTimestamp: (blockNumber: number) => Promise<number>;

    constructor(private sdk: SynFuturesV3, options?: Partial<ComparatorOptions>) {
        const _options = {
            ...defaultOptions,
            getBlockTimestamp: (blockNumber: number): Promise<number> =>
                sdk.ctx.retry(() => sdk.ctx.provider.getBlock(blockNumber).then((block) => block.timestamp)),
            ...options,
        } as ComparatorOptions;

        this.logger = _options.logger;
        this.shader = _options.shader;
        this.overrides = _options.overrides;
        this.getBlockTimestamp = _options.getBlockTimestamp;
    }

    async compareBalance(
        quote: string,
        accounts: string[],
        accounts2balance: Map<string, BigNumber>,
    ): Promise<boolean> {
        let diff = false;
        this.logger.info('=============VAULT STATUS======================');
        for (const account of accounts) {
            this.logger.info('=============BALANCE ', this.shader.bgGreenBright(account), '======================');
            const fromContract: BigNumber = await this.getBalanceFromVault(quote, account);
            diff ||= this.compareObj(fromContract, accounts2balance.get(account));
        }
        return diff;
    }

    async compareFundFlow(quote: string, accounts: string[], gate: GateState): Promise<boolean> {
        let diff = false;
        this.logger.info('=============VAULT STATUS======================');
        for (const account of accounts) {
            this.logger.info('=============FUND FLOW ', this.shader.bgGreenBright(account), '======================');
            const fromContract: FundFlowStructOutput = await this.sdk.contracts.gate.fundFlowOf(
                quote,
                account,
                this.overrides,
            );
            diff ||= this.compareObj(trimObj(fromContract), gate.fundFlowOf(quote, account));
        }
        return diff;
    }

    async comparePending(quote: string, accounts: string[], gate: GateState): Promise<boolean> {
        let diff = false;
        this.logger.info('=============VAULT STATUS======================');
        for (const account of accounts) {
            this.logger.info(
                '=============PENDING STATUS',
                this.shader.bgGreenBright(account),
                '======================',
            );
            const fromContract: PendingStructOutput = await this.sdk.contracts.gate.pendingOf(
                quote,
                account,
                this.overrides,
            );
            diff ||= this.compareObj(trimObj(fromContract), gate.pendingOf(quote, account));
        }
        return diff;
    }

    async comparePendingDuration(pendingDuration: BigNumber): Promise<boolean> {
        const fromContract = await this.sdk.contracts.gate.pendingDuration(this.overrides);
        this.logger.info('=============VAULT PENDING DURATION STATUS======================');
        return this.compareObj(fromContract, pendingDuration);
    }

    async compareThreshold(quote: string, threshold: BigNumber): Promise<boolean> {
        const fromContract = await this.sdk.contracts.gate.thresholdOf(quote, this.overrides);
        this.logger.info('=============VAULT THRESHOLD STATUS======================');
        return this.compareObj(fromContract, threshold);
    }

    async compareBlacklist(accounts: string[], gate: GateState): Promise<boolean> {
        let diff = false;
        this.logger.info('=============VAULT STATUS======================');
        for (const account of accounts) {
            this.logger.info(
                '=============BLACKLIST STATUS',
                this.shader.bgGreenBright(account),
                '======================',
            );
            const fromContract = await this.sdk.contracts.gate.isBlacklisted(account, this.overrides);
            diff ||= this.compareObj(fromContract, gate.isBlacklistedTrader(account));
        }
        return diff;
    }

    async compareAccounts(
        instrument: string,
        expiry: number,
        accounts: string[],
        accountsMap: Map<string, AccountState>,
    ): Promise<boolean> {
        let diff = false;
        this.logger.info('=============ACC STATUS======================');
        for (const account of accounts) {
            this.logger.info('=============ACC ', this.shader.bgGreenBright(account), expiry, '======================');
            const fromContract = await this.getAccountFromObserver(instrument, expiry, account);
            const res = this.compareObj(fromContract, accountsMap.get(account));

            if (res) {
                console.log('hit');
                this.compareObj(fromContract, accountsMap.get(account));
            }

            diff ||= res;
        }
        return diff;
    }

    async compareAmm(instrument: string, expiry: number, localAmm: Amm): Promise<boolean> {
        let diff = false;
        const fromContractAmm: any = await this.getAmmFromObserver(instrument, expiry);
        this.logger.info(
            '=============AMM STATUS OF',
            instrument,
            expiry,
            this.overrides.blockTag,
            '====================',
        );
        for (const key of Object.keys(EMPTY_AMM)) {
            let localValue: any;

            if (key === 'timestamp') {
                // special case for timestamp
                if (localAmm.timestampUpdatedAt === undefined) {
                    localValue = 0;
                } else {
                    localValue = await this.getBlockTimestamp(localAmm.timestampUpdatedAt!);
                }
            } else {
                localValue = (localAmm as any)[key];
            }

            if (key === 'timestampUpdatedAt') continue;

            if (
                fromContractAmm[key] === undefined ||
                localValue === undefined ||
                getType(fromContractAmm[key]) !== getType(localValue) ||
                this.compareObj(fromContractAmm[key], localValue)
            ) {
                diff = true;
                this.logger.error(
                    this.overrides.blockTag,
                    this.shader.red('FOUND DIFF'),
                    RIGHT_ARROW,
                    'KEY',
                    this.shader.cyan(key),
                    'CONTRACT_VAL',
                    this.shader.green(JSON.stringify(fromContractAmm[key])),
                    'LOCAL_VAL',
                    this.shader.green(JSON.stringify((localAmm as any)[key])),
                );
            }
        }
        return diff;
    }

    async comparePearlsAndBitMap(
        instrument: string,
        expiry: number,
        tBitMapFromLocal: Map<number, BigNumber>,
        pearlsMapFromLocal: Map<number, Pearl>,
    ): Promise<boolean> {
        const tBitMapFromContract: Map<number, BigNumber> = await this.getTBitMapFromObserver(instrument, expiry);
        const pearlsFromContract: Map<number, Pearl> = await this.getPearlsFromObserver(
            instrument,
            expiry,
            tBitMapFromContract,
            Array.from(pearlsMapFromLocal.keys()),
        );
        this.logger.info('=============TICKBITMAP======================');
        let diff = this.compareObj(trimBigNumberMap(tBitMapFromContract), trimBigNumberMap(tBitMapFromLocal));
        this.logger.info('=============PERAL INFO======================');
        diff ||= this.compareObj(pearlsFromContract, pearlsMapFromLocal);
        return diff;
    }

    async compareRecords(
        instrument: string,
        expiry: number,
        records: Map<number, Map<number, ContractRecord>>,
    ): Promise<boolean> {
        const fromContract = await this.getRecordsFromObserver(instrument, expiry, records);
        this.logger.info('==============RECORDS======================');
        return this.compareObj(fromContract, records);
    }

    async getRecordsFromObserver(
        instrument: string,
        expiry: number,
        records: Map<number, Map<number, ContractRecord>>,
    ): Promise<Map<number, Map<number, ContractRecord>>> {
        const ticks = new Array<number>();
        const nonces = new Array<number>();
        const observer = this.sdk.contracts.observer;

        for (const tick of records.keys()) {
            const recordMap: Map<number, ContractRecord> = records.get(tick)!;
            for (const nonce of recordMap.keys()) {
                ticks.push(tick);
                nonces.push(nonce);
            }
        }

        let res: any[] = [];
        if (ticks.length > 0) {
            res = await observer.getRecords(instrument, expiry, ticks, nonces, this.overrides);
        }

        const ret: Map<number, Map<number, ContractRecord>> = new Map<number, Map<number, ContractRecord>>();
        for (let i = 0; i < ticks.length; i++) {
            const tick = ticks[i];
            const nonce = nonces[i];
            const record: ContractRecord = {
                taken: res[i].taken,
                fee: res[i].fee,
                entrySocialLossIndex: res[i].entrySocialLossIndex,
                entryFundingIndex: res[i].entryFundingIndex,
            };
            if (!ret.has(tick)) {
                ret.set(tick, new Map<number, ContractRecord>());
            }
            const nonceToRecord = ret.get(tick)!;
            nonceToRecord.set(nonce, record);
        }
        return ret;
    }

    async getTBitMapFromObserver(instrument: string, expiry: number): Promise<Map<number, BigNumber>> {
        const keys: Array<number> = new Array<number>();
        const observer = this.sdk.contracts.observer;
        for (let i = -128; i < 128; i++) {
            keys.push(i);
        }
        const res: BigNumber[] = await observer.getTickBitmaps(instrument, expiry, keys, this.overrides);
        const ret: Map<number, BigNumber> = new Map<number, BigNumber>();
        for (let i = 0; i < keys.length; i++) {
            ret.set(keys[i], res[i]);
        }
        return ret;
    }

    async getPearlsFromObserver(
        instrument: string,
        expiry: number,
        tBitMap: Map<number, BigNumber>,
        referalKeys: number[],
    ): Promise<Map<number, Pearl>> {
        // get all ticks that exist
        let ticks: Array<number> = new Array<number>();
        const observer = this.sdk.contracts.observer;
        const ret = new Map<number, Pearl>();

        for (const wordPos of tBitMap.keys()) {
            let bitMap = tBitMap.get(wordPos)!;
            while (!bitMap.eq(ZERO)) {
                const pbit = leastSignificantBit(bitMap);
                ticks.push((wordPos * 256 + pbit) * PEARL_SPACING);
                bitMap = bitMap.xor(ONE.shl(pbit));
            }
        }
        // as ticks is from contract , it may lack nonce info
        ticks = Array.from(new Set(ticks.concat(referalKeys)));
        const raw = await observer.getPearls(instrument, expiry, ticks, this.overrides);
        for (let i = 0; i < ticks.length; i++) {
            ret.set(ticks[i], trimObj<Pearl>(raw[i]));
        }
        return ret;
    }

    async getAccountFromObserver(instrument: string, expiry: number, account: string): Promise<AccountState> {
        const observer = this.sdk.contracts.observer;
        const portfolio = (await observer.getAcc(instrument, expiry, account, this.overrides)).portfolio;
        return new AccountState(
            trimObj(portfolio.position),
            portfolio.oids,
            portfolio.rids,
            portfolio.orders.map((o) => trimObj(o)),
            portfolio.ranges.map((r) => trimObj(r)),
        );
    }

    async getAmmFromObserver(instrument: string, expiry: number): Promise<Amm> {
        const observer = this.sdk.contracts.observer;
        const amm = await observer.getAmm(instrument, expiry, this.overrides);
        return trimObj(amm) as Amm;
    }

    async getBalanceFromVault(token: string, account: string): Promise<BigNumber> {
        const balance = await this.sdk.contracts.gate.reserveOf(token, account, this.overrides);
        return balance;
    }

    getPbits(pbitmap: BigNumber): number[] {
        let pbitmapCache = BigNumber.from(pbitmap);
        const pbits: number[] = [];
        while (!pbitmapCache.eq(ZERO)) {
            const pbit = leastSignificantBit(pbitmapCache);
            pbits.push(pbit);
            pbitmapCache = pbitmapCache.xor(ONE.shl(pbit));
        }
        return pbits;
    }

    toMap(indexs: Array<number>, entities: Array<any>): Map<number, any> {
        const ret: Map<number, any> = new Map();
        for (let i = 0; i < indexs.length; i++) {
            ret.set(indexs[i], entities[i]);
        }
        return ret;
    }

    // fill ret with zero
    fillZero(ori: Array<any>): Array<any> {
        const targetLength = 30;
        const ret = Array.from(ori);
        for (let i = 0; i < targetLength - ori.length; i++) {
            ret.push(0);
        }
        return ret;
    }

    compareObj(fromContract: any, fromLocal: any): boolean {
        let diff = false;
        const type = getType(fromContract);
        if (type == 'number' || type == 'string') {
            if (fromContract !== fromLocal) {
                diff = true;
                this.logger.error(
                    this.shader.red('FOUND DIFF'),
                    RIGHT_ARROW,
                    'CONTRACT_VAL',
                    this.shader.green(fromContract),
                    'LOCAL_VAL',
                    this.shader.green(fromLocal),
                );
            }
        } else if (type == 'BigNumber' || fromContract instanceof BigNumber) {
            if (!(fromContract as BigNumber).eq(fromLocal as BigNumber)) {
                diff = true;
                this.logger.error(
                    this.shader.red('FOUND DIFF'),
                    RIGHT_ARROW,
                    'CONTRACT_VAL',
                    this.shader.green(ethers.utils.hexlify(fromContract)),
                    'LOCAL_VAL',
                    this.shader.green(ethers.utils.hexlify(fromLocal)),
                );
            }
        } else if (type == 'Array' || Array.isArray(fromContract)) {
            const array1 = fromContract as Array<any>;
            const array2 = fromLocal as Array<any>;
            if (array1.length != array2.length) {
                diff = true;
            }
            for (let i = 0; i < array1.length; i++) {
                if (this.compareObj(array1[i], array2[i])) {
                    diff = true;
                }
            }
        } else if (type == 'Map') {
            const map1 = fromContract as Map<any, any>;
            const map2 = fromLocal as Map<any, any>;
            if (map1.size != map2.size) {
                this.logger.error(
                    this.shader.red('FOUND DIFF'),
                    RIGHT_ARROW,
                    'MAP SIZE',
                    'CONTRACT VAL',
                    this.shader.green(map1.size),
                    'LOCAL VAL',
                    this.shader.green(map2.size),
                );
            }
            for (const key of map1.keys()) {
                if (!map2.has(key) || this.compareObj(map1.get(key), map2.get(key))) {
                    diff = true;
                    this.logger.error(
                        this.shader.red('FOUND DIFF'),
                        RIGHT_ARROW,
                        'KEY',
                        this.shader.cyan(key),
                        'CONTRACT VAL',
                        this.shader.green(JSON.stringify(map1.get(key))),
                        'LOCAL VAL',
                        this.shader.green(JSON.stringify(map2.get(key))),
                    );
                }
            }
        } else {
            // complex type or map
            for (const key in fromContract) {
                if (this.compareObj(fromContract[key], fromLocal[key])) {
                    diff = true;
                    this.logger.error(
                        this.shader.red('FOUND DIFF'),
                        RIGHT_ARROW,
                        'KEY',
                        this.shader.cyan(key),
                        'CONTRACT_VAL',
                        this.shader.green(JSON.stringify(fromContract[key])),
                        'LOCAL_VAL',
                        this.shader.green(JSON.stringify(fromLocal[key])),
                    );
                }
            }
        }
        return diff;
    }
}
