// Type definitions for Ethereum bindings

declare module ethereum {
    interface eth {
        toDecimal(value: string): number;
        toAscii(value: string): string;
        stateAt(contractAddress: string, stateAddress: string): string;
        transact(parameters: TransactionParameters, callback: Function);
        coinbase: string;
        key: string;
        secretToAddress(secret: string): string;
        pad(dataString: string, length: number);
    }

    export class TransactionParameters {
        from: string;
        value: number;
        to: string;
        data: string;
        gas: number;
        gasPrice: number;
    }
}

declare var eth: ethereum.eth;