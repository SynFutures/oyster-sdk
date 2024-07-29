import { calcFundingFee, calcLiquidationPrice, calcPnl, Position, Side } from '../types';
import { BigNumber } from 'ethers';
import { r2w, wdiv, wmul, wmulUp, ZERO } from '../math';
import { ONE_RATIO, PERP_EXPIRY } from '../constants';
import { PairModel } from './pair.model';

export class PositionModel implements Position {
    public readonly rootPair: PairModel;

    balance: BigNumber;
    size: BigNumber;
    entryNotional: BigNumber;
    entrySocialLossIndex: BigNumber;
    entryFundingIndex: BigNumber;

    constructor(
        rootPair: PairModel,
        balance: BigNumber,
        size: BigNumber,
        entryNotional: BigNumber,
        entrySocialLossIndex: BigNumber,
        entryFundingIndex: BigNumber,
    ) {
        this.rootPair = rootPair;
        this.balance = balance;
        this.size = size;
        this.entryNotional = entryNotional;
        this.entrySocialLossIndex = entrySocialLossIndex;
        this.entryFundingIndex = entryFundingIndex;
    }

    public static fromRawPosition(rootPair: PairModel, pos: Position): PositionModel {
        return new PositionModel(
            rootPair,
            pos.balance,
            pos.size,
            pos.entryNotional,
            pos.entrySocialLossIndex,
            pos.entryFundingIndex,
        );
    }

    public static fromEmptyPosition(rootPair: PairModel): PositionModel {
        return new PositionModel(rootPair, ZERO, ZERO, ZERO, ZERO, ZERO);
    }

    public getMaxWithdrawableMargin(): BigNumber {
        const unrealizedPnl = this.unrealizedPnl;
        const unrealizedLoss = unrealizedPnl.gt(ZERO) ? ZERO : unrealizedPnl;

        const value = wmulUp(this.rootPair.markPrice, this.size.abs());
        const imRequirement = wmulUp(value, r2w(this.rootPair.rootInstrument.setting.initialMarginRatio));
        const maxWithdrawableMargin = this.balance.add(unrealizedLoss).sub(imRequirement);
        return maxWithdrawableMargin.gt(ZERO) ? maxWithdrawableMargin : ZERO;
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

    public getEquity(): BigNumber {
        return this.balance.add(this.unrealizedPnl);
    }

    public getAdditionMarginToIMRSafe(increase: boolean, slippage?: number): BigNumber {
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

    public isPositionIMSafe(increase: boolean): boolean {
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

    public isPositionMMSafe(): boolean {
        const equity = this.getEquity();
        if (equity.isNegative()) return false;
        const positionValue = wmulUp(this.rootPair.markPrice, this.size.abs());
        const ratio = this.rootPair.rootInstrument.setting.maintenanceMarginRatio;
        return equity.gte(wmulUp(positionValue, r2w(ratio)));
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
}
