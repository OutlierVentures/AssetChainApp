/**
 * Naming conventions:
 * - Classes: PascalCase
 * - Modules: PascalCase
 * - Private properties: _camelCase
 * - Everything else: camelCase
 */


/**
 * Class representing an asset (to be) registered on AssetChain.
 */
class Asset {
    id: string;
    name: string;
    category: string;
    comments: string;
    isPendingClaim: boolean = true;
    verifications: Verification[];
    securedOn: AssetSecurity;
}

class AssetSecurity {
    name: string;
    // The backend ledgers on which this asset has been secured.
    securityPegs: SecurityPeg[];
}

/**
 * Pointer to a transaction on a backend ledger where this asset was secured.
 */
class SecurityPeg {
    /**
     * Ledger name.
     */
    name: string;
    logoImageFileName: string;
    transactionUrl: string;
    /**
     * Ledger-specific details, as an object.
     */
    details: any;
}

/**
 * Verification of an asset by an expert.
 */
class Verification {
    id: string;
    name: string;
    address: string;
    date: string;
    comments: string;
    isPending: boolean;
    defects: string;
}

/**
 * Request for transfer of ownership of an asset.
 */
class TransferRequest {
    /**
     * AssetChain ID of the asset that the requester wants to receive.
     */
    assetID: string;

    /**
     * Address of the requester. Currently an Ethereum address.
     */
    requesterAddress: string;
}

/** BEGIN Application classes **/

class EthereumConfiguration {
    jsonRpcUrl: string;
    currentAddress: string;
}

class Configuration {
    ethereum: EthereumConfiguration;

    constructor() {
        this.ethereum = new EthereumConfiguration();
    }
}

class Credentials {
    password: string;
}

class MenuItem {
    name: string;
    url: string;
    icon: string;
}

class Notification {
    title: string;
    date: string;
    details: string;
    url: string;
    icon: string;
    seen: boolean;
}

/** END Application classes **/
