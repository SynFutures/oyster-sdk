import { SynFuturesError } from './synFuture.error';

export class SdkError extends SynFuturesError {
    readonly name: string = 'SdkError';

    constructor(message: string, cause?: Error) {
        super(message, 'sdk', undefined, cause);
    }
}
