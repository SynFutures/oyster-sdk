import { TransactionEvent, extractEvents, formatDisplayNumber } from '@derivation-tech/web3-core';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import * as template from './event-mapping-template.json';
import { BigNumber, ethers } from 'ethers';
import { TickMath, wdiv } from '../math';
import { sqrtX96ToWad } from '../math';
import { SynFuturesV3 } from '../synfuturesV3Core';
import { Instrument__factory } from '../types';

// define an clear type for template json
const eventMapping: { [key: string]: { [key: string]: string } } = template;

export interface ParsedTransactionEvent extends TransactionEvent {
    // original template
    template?: string;
    // formatted template arguments
    templateArgs?: { readonly [key: string]: string };
    // text generated from template with filled arguments
    text?: string;
}

export async function parseTransactionEventsByTemplate(
    synfv3: SynFuturesV3,
    receiptOrTxHash: TransactionReceipt | string,
): Promise<ParsedTransactionEvent[]> {
    let receipt: TransactionReceipt;
    if (typeof receiptOrTxHash === 'string') {
        receipt = await synfv3.ctx.retry(() => synfv3.ctx.provider.getTransactionReceipt(receiptOrTxHash), {
            retries: 2,
            onRetry: (error: Error): void => {
                console.error('retrying on error:', error);
            },
        });
    } else {
        receipt = receiptOrTxHash;
    }
    const transactionEvents = extractEvents(receipt, [Instrument__factory.createInterface()]);
    const result: ParsedTransactionEvent[] = [];
    for (const transactionEvent of transactionEvents) {
        result.push(await _parse(synfv3, transactionEvent));
    }
    return result;
}

async function _parse(synfv3: SynFuturesV3, event: TransactionEvent): Promise<ParsedTransactionEvent> {
    if (!eventMapping[event.name]) {
        return event;
    }
    const instrumentInfo = await synfv3.getInstrumentInfo(event.address);

    const symbol = instrumentInfo.symbol;
    const quote = instrumentInfo.quote.symbol;

    let args: { [key: string]: string };
    switch (event.name) {
        case 'Trade': {
            const size = BigNumber.from(event.args['size']);
            const entryNotional = BigNumber.from(event.args['entryNotional']).abs();
            const price = wdiv(entryNotional, size.abs());
            args = {
                symbol: symbol,
                side: size.gt(0) ? 'Bought' : 'Sold',
                size: formatDisplayNumber({ num: ethers.utils.formatEther(size.abs()) }),
                price: formatDisplayNumber({ num: ethers.utils.formatEther(price), type: 'price' }),
            };
            break;
        }
        case 'Adjust': {
            const amount = BigNumber.from(event.args['amount']);
            args = {
                symbol: symbol,
                direction: amount.gt(0) ? 'Added' : 'Removed',
                amount: formatDisplayNumber({ num: ethers.utils.formatEther(amount.abs()) }),
                quote: quote,
            };
            break;
        }
        case 'Add': {
            const tickLower = Number(event.args['tickLower']);
            const tickUpper = Number(event.args['tickUpper']);

            const priceLower = sqrtX96ToWad(TickMath.getSqrtRatioAtTick(tickLower));
            const priceUpper = sqrtX96ToWad(TickMath.getSqrtRatioAtTick(tickUpper));

            const amount = BigNumber.from(event.args['range']['balance']);
            const entryPrice = sqrtX96ToWad(BigNumber.from(event.args['range']['sqrtEntryPX96']));

            args = {
                symbol: symbol,
                amount: formatDisplayNumber({ num: ethers.utils.formatEther(amount.abs()) }),
                quote: quote,
                priceLower: formatDisplayNumber({ num: ethers.utils.formatEther(priceLower), type: 'price' }),
                priceUpper: formatDisplayNumber({ num: ethers.utils.formatEther(priceUpper), type: 'price' }),
                entryPrice: formatDisplayNumber({ num: ethers.utils.formatEther(entryPrice), type: 'price' }),
            };
            break;
        }
        case 'Remove': {
            const tickLower = Number(event.args['tickLower']);
            const tickUpper = Number(event.args['tickUpper']);

            const priceLower = sqrtX96ToWad(TickMath.getSqrtRatioAtTick(tickLower));
            const priceUpper = sqrtX96ToWad(TickMath.getSqrtRatioAtTick(tickUpper));

            const fee = BigNumber.from(event.args['fee']);

            args = {
                symbol: symbol,
                quote: quote,
                priceLower: formatDisplayNumber({ num: ethers.utils.formatEther(priceLower), type: 'price' }),
                priceUpper: formatDisplayNumber({ num: ethers.utils.formatEther(priceUpper), type: 'price' }),
                fee: formatDisplayNumber({ num: ethers.utils.formatEther(fee) }),
            };
            break;
        }
        case 'Place': {
            const size = BigNumber.from(event.args['order']['size']);
            const balance = BigNumber.from(event.args['order']['balance']);
            const side = size.gt(0) ? 'Buy' : 'Sell';
            const tick = Number(event.args['tick']);
            const price = sqrtX96ToWad(TickMath.getSqrtRatioAtTick(tick));
            args = {
                symbol: symbol,
                quote: quote,
                side: side,
                size: formatDisplayNumber({ num: ethers.utils.formatEther(size.abs()) }),
                price: formatDisplayNumber({ num: ethers.utils.formatEther(price), type: 'price' }),
                balance: formatDisplayNumber({ num: ethers.utils.formatEther(balance) }),
            };
            break;
        }
        case 'Cancel': {
            const tick = Number(event.args['tick']);
            const price = sqrtX96ToWad(TickMath.getSqrtRatioAtTick(tick));
            args = {
                symbol: symbol,
                quote: quote,
                price: formatDisplayNumber({ num: ethers.utils.formatEther(price), type: 'price' }),
            };
            break;
        }
        case 'Settle': {
            const settlementPrice = BigNumber.from(event.args['settlement']);
            const balance = BigNumber.from(event.args['balance']);
            args = {
                symbol: symbol,
                quote: quote,
                balance: formatDisplayNumber({ num: ethers.utils.formatEther(balance) }),
                settlementPrice: formatDisplayNumber({ num: ethers.utils.formatEther(settlementPrice), type: 'price' }),
            };
            break;
        }
        default:
            return event;
    }
    const template = eventMapping[event.name]['compact'];
    // generate text from template, replace all ${key} with args[key]
    const text = template.replace(/{{(\w+)}}/g, (match, key) => args[key] || match);
    return {
        ...event,
        template: template,
        templateArgs: args,
        text: text,
    };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function eventTemplateParseDemo() {
    const synfv3 = SynFuturesV3.getInstance('goerli');
    const txHash = '0x7f2408b613b1ba6175070757bb6f19b7b805f8bcbb4e956d36a349a08a1485f9';
    const receipt = await synfv3.ctx.provider.getTransactionReceipt(txHash);
    const result = await parseTransactionEventsByTemplate(synfv3, receipt);
    console.log(result);
}
// eslint-disable-next-line @typescript-eslint/no-floating-promises
// eventTemplateParseDemo();
