import { BigNumber } from 'ethers';
import { Position, Side } from '../types';
import { r2w, wdiv, safeWDiv, wmul, wmulUp, ZERO, WAD } from '../math';
import { ONE_RATIO, PERP_EXPIRY } from '../constants';
import { calcFundingFee, calcLiquidationPrice, calcPnl } from '../common';

import { PairModel, PairModelBase, WrappedPairModel } from './pair.model';
import { InstrumentModel, InstrumentModelBase, WrappedInstrumentModel } from './instrument.model';

export interface PositionData {
    rootPair: PairModel;
    balance: BigNumber;
    size: BigNumber;
    entryNotional: BigNumber;
    entrySocialLossIndex: BigNumber;
    entryFundingIndex: BigNumber;
}

abstract class PositionModelBase<U extends InstrumentModelBase, T extends PairModelBase<U>> {
    constructor(protected readonly data: PositionData) {}

    abstract get rootPair(): T;

    get balance(): BigNumber {
        return this.data.balance;
    }

    set balance(value: BigNumber) {
        this.data.balance = value;
    }

    get size(): BigNumber {
        return this.data.size;
    }

    get entryNotional(): BigNumber {
        return this.data.entryNotional;
    }

    get entrySocialLossIndex(): BigNumber {
        return this.data.entrySocialLossIndex;
    }

    get entryFundingIndex(): BigNumber {
        return this.data.entryFundingIndex;
    }

    get isInverse(): boolean {
        return this.rootPair.isInverse;
    }

    get side(): Side {
        if (this.size.isNegative()) {
            return Side.SHORT;
        } else if (this.size.isZero()) {
            return Side.FLAT;
        } else {
            return Side.LONG;
        }
    }

    get leverageWad(): BigNumber {
        const value = wmul(this.rootPair.markPrice, this.size.abs());
        const equity = this.getEquity();
        if (equity.isZero()) {
            return ZERO;
        }
        return wdiv(value, equity);
    }

    get entryPrice(): BigNumber {
        return this.size.eq(ZERO) ? ZERO : wdiv(this.entryNotional, this.size.abs());
    }

    // calculate the desired mark price
    get liquidationPrice(): BigNumber {
        if (this.size.isZero() || this.balance.isZero()) return ZERO;
        return calcLiquidationPrice(
            this.rootPair.amm,
            this,
            this.rootPair.rootInstrument.setting.maintenanceMarginRatio,
        );
    }

    get unrealizedPnl(): BigNumber {
        return calcPnl(this.rootPair.amm, this, this.rootPair.markPrice);
    }

    get unrealizedFundingFee(): BigNumber {
        if (this.rootPair.amm.expiry === PERP_EXPIRY) return calcFundingFee(this.rootPair.amm, this);
        return ZERO;
    }

    getMaxWithdrawableMargin(): BigNumber {
        const unrealizedPnl = this.unrealizedPnl;
        const unrealizedLoss = unrealizedPnl.gt(ZERO) ? ZERO : unrealizedPnl;

        const value = wmulUp(this.rootPair.markPrice, this.size.abs());
        const imRequirement = wmulUp(value, r2w(this.rootPair.rootInstrument.setting.initialMarginRatio));
        const maxWithdrawableMargin = this.balance.add(unrealizedLoss).sub(imRequirement);
        return maxWithdrawableMargin.gt(ZERO) ? maxWithdrawableMargin : ZERO;
    }

    getEquity(): BigNumber {
        return this.balance.add(this.unrealizedPnl);
    }

    getAdditionMarginToIMRSafe(increase: boolean, slippage?: number): BigNumber {
        const ratio = this.rootPair.rootInstrument.setting.initialMarginRatio;
        const positionValue = wmul(this.rootPair.markPrice, this.size.abs());
        let imrValue = wmulUp(positionValue, r2w(ratio));
        if (slippage) {
            imrValue = imrValue.mul(ONE_RATIO + slippage).div(ONE_RATIO);
        }
        let equity;
        if (increase) {
            const unrealizedLoss = this.unrealizedPnl.lt(ZERO) ? this.unrealizedPnl : ZERO;
            equity = this.balance.add(unrealizedLoss);
        } else {
            equity = this.getEquity();
        }
        const additionMargin = imrValue.sub(equity);
        return additionMargin.gt(ZERO) ? additionMargin : ZERO;
    }

    isPositionIMSafe(increase: boolean): boolean {
        let equity;
        if (increase) {
            const unrealizedLoss = this.unrealizedPnl.lt(ZERO) ? this.unrealizedPnl : ZERO;
            equity = this.balance.add(unrealizedLoss);
        } else {
            equity = this.getEquity();
        }

        if (equity.isNegative()) return false;
        const positionValue = wmulUp(this.rootPair.markPrice, this.size.abs());
        const ratio = this.rootPair.rootInstrument.setting.initialMarginRatio;
        return equity.gte(wmulUp(positionValue, r2w(ratio)));
    }

    isPositionMMSafe(): boolean {
        const equity = this.getEquity();
        if (equity.isNegative()) return false;
        const positionValue = wmulUp(this.rootPair.markPrice, this.size.abs());
        const ratio = this.rootPair.rootInstrument.setting.maintenanceMarginRatio;
        return equity.gte(wmulUp(positionValue, r2w(ratio)));
    }
}

export class PositionModel extends PositionModelBase<InstrumentModel, PairModel> implements Position {
    static fromRawPosition(rootPair: PairModel, pos: Position): PositionModel {
        return new PositionModel({
            rootPair,
            balance: pos.balance,
            size: pos.size,
            entryNotional: pos.entryNotional,
            entrySocialLossIndex: pos.entrySocialLossIndex,
            entryFundingIndex: pos.entryFundingIndex,
        });
    }

    static fromEmptyPosition(rootPair: PairModel): PositionModel {
        return new PositionModel({
            rootPair,
            balance: ZERO,
            size: ZERO,
            entryNotional: ZERO,
            entrySocialLossIndex: ZERO,
            entryFundingIndex: ZERO,
        });
    }

    get rootPair(): PairModel {
        return this.data.rootPair;
    }

    get wrap(): WrappedPositionModel {
        return new WrappedPositionModel(this.data);
    }
}

export class WrappedPositionModel extends PositionModelBase<WrappedInstrumentModel, WrappedPairModel> {
    get rootPair(): WrappedPairModel {
        return this.data.rootPair.wrap;
    }

    get unWrap(): PositionModel {
        return new PositionModel(this.data);
    }

    get size(): BigNumber {
        return this.isInverse ? super.size.mul(-1) : super.size;
    }

    get side(): Side {
        return this.isInverse
            ? super.side === Side.LONG
                ? Side.SHORT
                : super.side === Side.SHORT
                ? Side.LONG
                : Side.FLAT
            : super.side;
    }

    get entryPrice(): BigNumber {
        return this.isInverse ? safeWDiv(WAD, super.entryPrice) : super.entryPrice;
    }

    get liquidationPrice(): BigNumber {
        return this.isInverse ? safeWDiv(WAD, super.liquidationPrice) : super.liquidationPrice;
    }
}
