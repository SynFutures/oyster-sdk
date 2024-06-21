/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ethers } from 'ethers';
import type { ParsedEvent } from './common';

export abstract class EventHandler {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prevHooks: { [key: string]: (event: ParsedEvent<any>, log: ethers.providers.Log) => void } = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    postHooks: { [key: string]: (event: ParsedEvent<any>, log: ethers.providers.Log) => void } = {};

    registerHooks<T>(
        eventName: string,
        hook: (event: ParsedEvent<T>, log: ethers.providers.Log) => void,
        isPost: boolean,
    ): void {
        if (isPost) this.postHooks[eventName] = hook;
        else this.prevHooks[eventName] = hook;
    }

    // entrance for processing eventLogs
    handleEvent(event: ethers.utils.LogDescription, log: ethers.providers.Log): void {
        const handlerFunction = (this as any)[`handle${event.name}`] as
            | ((event: ethers.utils.LogDescription, log: ethers.providers.Log) => void)
            | undefined;

        if (handlerFunction) {
            this.processHook(event, log, false);
            // process for internal methods
            handlerFunction.bind(this)(event, log);
            // post process for business logic out of the class
            this.processHook(event, log, true);
        }
    }

    // post process for business logic out of the class
    processHook(event: ethers.utils.LogDescription, log: ethers.providers.Log, isPost: boolean): void {
        const hook = isPost ? this.postHooks[event.name] : this.prevHooks[event.name];
        if (hook) {
            hook(event, log);
        }
    }
}
