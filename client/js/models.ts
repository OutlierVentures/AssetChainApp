
/**
 * Class representing an asset (to be) registered on AssetChain.
 */
class Asset {
    id: string;
    name: string;
    category: string;
    comments: string;
    IsPendingClaim: boolean = true;
    Verifications: Verification[];
    securedOn: AssetSecurity;
}

class AssetSecurity {
    name: string;
    ledgers: LedgerSecurityPeg[];
}

/**
 * Pointer to a transaction on a backend ledger where this asset was secured.
 */
class LedgerSecurityPeg {
    name: string;
    logoImageFileName: string;
    transactionUrl: string;
}

class Verification {
    id: string;
    name: string;
    address: string;
    date: string;
    comments: string;
    IsPending: boolean;
    defects: string;
}

class EthereumConfiguration {
    JsonRpcUrl: string;
    CurrentAddress: string;
}

class Configuration {
    Ethereum: EthereumConfiguration;

    constructor() {
        this.Ethereum = new EthereumConfiguration();
    }
}