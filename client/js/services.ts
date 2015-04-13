// Interfaces for callbacks.
interface SingleAssetCallback {
    (asset: Asset);
}

interface MultipleAssetCallback {
    (asset: Asset[]);
}

interface SecurityPegCallback {
    (peg: SecurityPeg);
}

interface String {
    capitalizeFirstLetter(): string;
}

String.prototype.capitalizeFirstLetter = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

/**
 * The service for storing and retrieving assets in one or several backend storage methods.
 */
class AssetsService {
    assets: Asset[];

    backend: IStorageService;

    public static $inject = [
        'identityService',
        'ethereumService'
    ];

    // dependencies are injected via AngularJS $injector
    constructor(
        private identityService: IdentityService,
        private ethereumService: EthereumService) {

        // TODO: make storageService into a configurable, multi-backend data layer
        // For example, assets can be stored anywhere, but their verification cannot.
        this.backend = new EncryptedLocalStorageService(identityService);

        this.ensureAssets();
    }

    /**
     * Ensure that initial data is loaded.
     */
    ensureAssets(): void {
        if (!this.identityService.isAuthenticated())
            return;

        if (this.assets == null) {

            this.loadDB();

            if (this.assets == null)
                this.assets = [];
        }

        // Process dangling assets from the security pegs. As this method is called often, this could become 
        // a performance hog. Keep an eye on this.
        // TODO: convert this to active checks from the ledgers (i.e. web3.eth.filter).
        this.processDanglingAssets();

        // Check current ownership of the assets. Same goes for this.
        this.checkAssets();
    }

    /**
     * Check asset and security pegs status.
     */
    checkAssets() {
        var t = this;

        // Does this work by reference?
        _(this.assets).each(function (a) {
            t.ethereumService.checkAssetStatus(a);
        });
    }

    processDanglingAssets() {
        if (this.ethereumService.connect()) {
            if (this.loadDanglingAssets())
                this.saveDB();
        }
    }

    /**
     * Load security pegs from backend ledgers for which no assets exist, and create assets for them.
     * @returns Whether any dangling assets were found and added to the assets collection.
     */
    loadDanglingAssets(): boolean {
        // All pegs for current address.
        var allPegs = this.ethereumService.getAllSecurityPegs();
        var t = this;

        // Get pegs for assets we don't know about.
        var newPegs = _(allPegs).filter(function (p) {
            // See if there's an asset with this ID in our collection.
            var assetWithID = _(t.assets).find(function (a) {
                return a.id == p.details.asset.id;
            });
            return assetWithID == null;
        });

        var anyNew = false;

        _(newPegs).each(function (p) {
            // Create a new asset with the properties from the ledger.
            var newAsset = new Asset();
            newAsset.id = p.details.asset.id;
            newAsset.name = p.details.asset.name;

            // Store the security peg.
            var sec = new AssetSecurity();

            // ATM only one security level.
            // TODO: make configurable.
            sec.name = "Premium";

            var pegs = new Array<SecurityPeg>();
            pegs.push(p);
            sec.securityPegs = pegs;

            newAsset.securedOn = sec;

            // TODO: mark it as incomplete, "needs more info". The asset details package should be loaded.

            t.assets.push(newAsset);
            anyNew = true;
        });

        return anyNew;
    }

    /**
     * Unload the data.
     */
    public unload(): void {
        this.assets = null;
    }

    private saveDB(): void {
        // TODO: encrypt by identityservice
        // TODO: use a unique key for the current account
        // Use angular.copy to strip any internal angular variables like $$hashKey from the data.
        this.backend.setItem("assets", angular.copy(this.assets));
    }

    private loadDB(): void {
        this.assets = this.backend.getItem("assets");
    }

    reload(): void {
        this.loadDB();
    }

    /**
     * Get all assets for the user.
     * @return all assets of the user.
     */
    getAll(cb: MultipleAssetCallback) {
        this.ensureAssets();
        cb(this.assets);
    }

    /**
     * Get a specific asset by ID.
     * @param params array of parameters, including "id", the ID of the asset to get.
     * @param cb a callback taking a response object. The return value is in property "content" like $resource.
     * @returns the asset with the given ID, or null if non-existing.
     */
    get(id: string, cb: SingleAssetCallback) {
        this.ensureAssets();

        cb(_(this.assets).find(
            function (asset: Asset) {
                return asset.id === id;
            }));
    }

    /**
     * Update or add an asset.
     * params: the asset data. When ID is not present, a new item is created.
     */
    save(asset: Asset, cb: SingleAssetCallback) {
        this.ensureAssets();

        if (asset.id === undefined)
            this.create(asset, cb);
        else
            this.update(asset, cb);

        this.saveDB();
    }

    create(asset: Asset, cb: SingleAssetCallback) {
        asset.id = guid(true);

        this.assets.push(asset)
        cb(asset);
    }

    update(updatedAsset: Asset, cb: SingleAssetCallback) {
        this.get(updatedAsset.id, function (currentAsset) {
            currentAsset = _(currentAsset).extend(updatedAsset);
            cb(updatedAsset);
        });
    }

    /**
     * Returns whether any backend ledgers are active.
     */
    hasLedgers(): boolean {
        return this.ethereumService.isActive();
    }

    /**
     * Create a transfer request for an asset of another user.
     */
    createTransferRequest(request: TransferRequest) {
        // TODO: wait for result; error handling
        this.ethereumService.createTransferRequest(request.assetID);
    }

    /**
     * Confirm a received transfer request.
     */
    confirmTransferRequest(request: TransferRequest) {
        // TODO: wait for result; error handling
        this.ethereumService.confirmTransferRequest(request);

        // TODO: update local asset collection to show this asset is transferred. Archived? Grayed out?
    }

    /**
     * Ignore/deny a received transfer request.
     */
    ignoreTransferRequest(request: TransferRequest) {
        // TODO: wait for result; error handling
        this.ethereumService.ignoreTransferRequest(request);

        // TODO: update local asset collection to show this asset is transferred. Archived? Grayed out?
    }

    /**
     * Load and return any incoming transfer requests for the given asset.
     */
    getTransferRequests(asset: Asset): Array<TransferRequest> {
        return this.ethereumService.getTransferRequests(asset);
    }
}

interface IIdentityProvider {
    /**
     * Get the identifier of the current user on the backend, for example the Ethereum address, Counterparty
     * wallet address, etc.
     */
    getIdentifier(): string;

    /**
     * Log on at the identity backend. The provider needs to be initialized (with configuration, credentials etc)
     * before calling Logon().
     * @return Whether the logon attempt succeeded.
     */
    logon(): boolean;

    /**
     * @return Whether the provider is currently logged on.
     */
    isAuthenticated(): boolean;

    /**
     * Encrypt the given data with the private key of this identity provider.
     */
    encrypt(unencryptedData: string): string;

    decrypt(encryptedData: string): string;
}

/**
 * Identity provider for AssetChain, using encrypted local storage.
 */
class AssetChainIdentityProvider {
    /**
     * Hash of the password of the user.
     */
    private _passwordHash: string;

    /**
     * The unencrypted password of the user. Only stored in-memory.
     */
    private _password: string;

    getIdentifier(): string {
        return this._passwordHash;
    }

    setPassword(password: string) {
        this._passwordHash = CryptoJS.SHA256(password);
        this._password = password;
    }

    isAuthenticated(): boolean {
        return this._passwordHash != null;
    }

    logon(): boolean {
        // We only require a password to function. If it's not empty, we're good to go.
        return this._passwordHash != null;
    }

    private getPrivateKey(): string {
        return this._password;
    }

    encrypt(unencryptedData: string): string {
        return CryptoJS.AES.encrypt(unencryptedData, this.getPrivateKey()).toString();
    }

    decrypt(encryptedData: string): string {
        // TODO: check for errors
        // TODO: handle case that data is unencrypted, or encrypted with different alg
        return CryptoJS.AES.decrypt(encryptedData, this.getPrivateKey()).toString(CryptoJS.enc.Utf8);
    }

}

interface IStorageService {
    setItem(key: string, val: any);

    getItem(key: string): any;
}

/**
 * Storage service using the local browser storage with data encrypted using identity.PrimaryProvider.
 */
class EncryptedLocalStorageService {
    private _identityService: IdentityService;

    private _keyPrefix: string;

    constructor(identityService: IdentityService) {
        this._identityService = identityService;
    }

    private getFullKey(key: string): string {
        // Use the identifier of the identityService as a prefix for the local storage keys.
        // Effectively that means prefixing with SHA256 hashes, for example:
        // a5a28cfe2786537d28d4f57d4a15fe5813a973d3d6f9b9186033b8df50fac56b_assets

        // This can only be done once _IdentityService.PrimaryProvider is logged on, i.e.
        // when we're good to go.
        // TODO: include checks for this.
        this._keyPrefix = this._identityService.primaryProvider.getIdentifier();

        return this._keyPrefix + "_" + key;
    }

    setItem(key: string, val: any) {
        var stringVar = JSON.stringify(val);

        stringVar = this._identityService.primaryProvider.encrypt(stringVar);

        localStorage.setItem(this.getFullKey(key), stringVar);
    }

    getItem(key: string): any {
        var stringVar: string = localStorage.getItem(this.getFullKey(key));
        if (stringVar === null)
            return null;

        stringVar = this._identityService.primaryProvider.decrypt(stringVar);

        return JSON.parse(stringVar);
    }
}


/**
 * Service managing the identity of the user on the various backends.
 */
class IdentityService {
    /**
     * All active providers.
     */
    providers: IIdentityProvider[];

    /**
     * The main identity provider. If this is null, we're not authenticated.
     */
    primaryProvider: IIdentityProvider;

    $inject = ['$rootScope'];

    constructor(
        private $rootScope: AssetChainRootScope
        ) {
        this.providers = [];
    }

    /**
     * Logon with this provider.
     */
    logon(provider: IIdentityProvider): boolean {
        if (!provider.logon())
            return false;
        this.providers.push(provider)
        // The first successful provider is the primary one.
        if (!this.primaryProvider)
            this.primaryProvider = provider;

        this.$rootScope.isLoggedIn = true;

        return true;
    }

    logoff() {
        this.primaryProvider = null;
        this.providers = new Array<IIdentityProvider>();
    }

    isAuthenticated(): boolean {
        return this.primaryProvider && this.primaryProvider.isAuthenticated();
    }
}

/**
 * Service around experts who execute verifications of assets.
 */
class ExpertsService {
    /**
     * Returns a set of experts by search criteria.
     */
    getExperts(location: string, category: string): Array<ExpertCollection> {
        // Provide stub data, distinguished by category.
        // TODO: implement
        if (category == "Watch") {
            return [{
                name: "London",
                experts: [
                    {
                        id: "1859159",
                        name: "The Watch Gallery (Rolex Boutique)"
                    },
                    {
                        id: "41859189",
                        name: "Watches of Switzerland"
                    }]
            }];
        }
        else if (category == "Necklace" || category == "Diamond") {
            return [{
                name: "London",
                experts: [
                    {
                        id: "5615641",
                        name: "Royal Exchange Jewellers"
                    },
                    {
                        id: "1564156",
                        name: "Jonathan Geeves Jewellers"
                    },
                    {
                        id: "9486451",
                        name: "Tawny Phillips"
                    }]
            }];
        } else {
            return [{
                name: "London",
                experts: [
                    {
                        id: "5615641",
                        name: "Royal Exchange Jewellers"
                    },
                    {
                        id: "1564156",
                        name: "Jonathan Geeves Jewellers"
                    },
                    {
                        id: "9486451",
                        name: "Tawny Phillips"
                    }]
            }];

        }
    }
}

/**
 * The service for storing and retrieving application configuration.
 */
class ConfigurationService {
    configuration: Configuration;

    private backend: IStorageService;

    public static $inject = [
        'identityService'
    ];

    // dependencies are injected via AngularJS $injector
    constructor(
        private identityService: IdentityService) {

        this.backend = new EncryptedLocalStorageService(identityService);

        // TODO: make sure configuration is loaded once identityService is initialized.
    }

    load() {
        this.configuration = this.backend.getItem("configuration");
        if (this.configuration == null)
            this.configuration = new Configuration();
    }

    save() {
        this.backend.setItem("configuration", this.configuration);
    }
}

/**
 * Service for communicating with the AssetVault Ethereum contracts.
 */
class EthereumService {
    public config: EthereumConfiguration;

    public static $inject = [
        'configurationService'
    ];

    // dependencies are injected via AngularJS $injector
    constructor(
        private configurationService: ConfigurationService) {

        // The service is constructed when the app is loaded, e.g. before the configuration is unlocked.
        // So don't try to connect yet. Currently connection has to be done manually after logging in.
        // TODO: lazy load this service, connect when initialized. Or listen to the configurationService
        // being initialized.
        //        this.connect();
    }

    /**
     * The AssetVault contract from ABI.
     */
    private assetVaultContract: any;

    connect(): boolean {
        try {
            this.configurationService.load();
            this.config = this.configurationService.configuration.ethereum;

            // We'll be using JSON-RPC to talk to eth.
            var rpcUrl = this.configurationService.configuration.ethereum.jsonRpcUrl;

            // No configuration? Don't try connecting.
            if (rpcUrl == null || rpcUrl == "")
                return false;

            web3.setProvider(new web3.providers.HttpSyncProvider(rpcUrl));
            // For new version of ethereum.js
            //web3.setProvider(new web3.providers.HttpProvider(rpcUrl));

            var coinbase: string;
            var firstAddress: string;

            coinbase = web3.eth.coinbase;

            this._isActive = true;
        }
        catch (e) {
            console.log("Exception while trying to connect to Ethereum node: " + e);
        }

        if (this._isActive) {
            // Further configuration now that we know the connection to the node is successful.
            if (this.config.currentAddress == null || this.config.currentAddress == "") {
                this.config.currentAddress = coinbase;
            }

            if (!_(web3.eth.accounts).contains(this.config.currentAddress)) {
                // The configured address is not in the accounts of the eth node. That's probably an
                // error.
                // For now: just change it.
                console.log("Configured address '" + this.config.currentAddress + "' is not present in the current Ethereum node. Switching to default.");
                this.config.currentAddress = coinbase;
                this.configurationService.save();
            }

            this.loadContract();
            return true;
        }
        return false;
    }

    /**
     * Disconnect from the Ethereum node.
     */
    disconnect() {
        // Does this have any effect?
        web3.setProvider(null);

        // TODO: remove/deactivate any active watches/filters.
    }

    private loadContract() {
        // The line below is generated by AlethZero when creating the contract. Copy/paste.
        // New syntax PoC9: .contract(...)
        var AssetVault = web3.eth.contractFromAbi([{ "constant": true, "inputs": [{ "name": "", "type": "uint256" }], "name": "owners", "outputs": [{ "name": "", "type": "address" }], "type": "function" }, { "constant": true, "inputs": [{ "name": "", "type": "uint256" }], "name": "transferRequests", "outputs": [{ "name": "assetID", "type": "string32" }, { "name": "requester", "type": "address" }], "type": "function" }, { "constant": true, "inputs": [{ "name": "", "type": "address" }], "name": "assetsByOwner", "outputs": [{ "name": "assetCount", "type": "uint256" }], "type": "function" }, { "constant": true, "inputs": [], "name": "ownerCount", "outputs": [{ "name": "", "type": "uint256" }], "type": "function" }, { "constant": false, "inputs": [], "name": "cleanTransferRequests", "outputs": [], "type": "function" }, { "constant": false, "inputs": [{ "name": "ownerAddress", "type": "address" }, { "name": "assetIndex", "type": "uint256" }], "name": "getAssetID", "outputs": [{ "name": "id", "type": "string32" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "assetID", "type": "string32" }], "name": "requestTransfer", "outputs": [], "type": "function" }, { "constant": false, "inputs": [{ "name": "id", "type": "string32" }, { "name": "name", "type": "string32" }], "name": "createAsset", "outputs": [], "type": "function" }, { "constant": false, "inputs": [{ "name": "assetID", "type": "string32" }, { "name": "newOwner", "type": "address" }, { "name": "confirm", "type": "bool" }], "name": "processTransfer", "outputs": [], "type": "function" }, { "constant": true, "inputs": [{ "name": "", "type": "string32" }], "name": "ownerByAssetID", "outputs": [{ "name": "", "type": "address" }], "type": "function" }, { "constant": true, "inputs": [], "name": "transferRequestCount", "outputs": [{ "name": "", "type": "uint256" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "ownerAddress", "type": "address" }, { "name": "assetIndex", "type": "uint256" }], "name": "getAssetName", "outputs": [{ "name": "name", "type": "string32" }], "type": "function" }]);

        // TODO: make address configurable
        this.assetVaultContract = AssetVault("0x9254f061b65cbef1b0908f2882babe6f654e5765");
    }

    _ledgerName = "ethereum";

    _isActive: boolean;

    /**
     * Returns whether there is an active connection to an Ethereum node.
     */
    isActive(): boolean {
        return this._isActive;
    }

    /**
     * Returns whether the Ethereum ledger is enabled. Currently always true.
     */
    isEnabled(): boolean {
        // Always enabled.
        // TODO: make configurable.
        return true;
    }

    /**
     * Ensure that we're connected, by calling Connect() if necessary.
     */
    ensureConnect(): boolean {
        if (this._isActive)
            // Already connected.
            return true;

        return this.connect();
    }

    /**
     * Register the passed asset on this ledger.
     */
    secureAsset(asset: Asset, cb: SecurityPegCallback) {
        var t = this;

        // COULD DO: Check whether the asset is secured on the ledger, but we don't have a SecurityPeg yet.
        // Currently done within the controller. And calling the contract twice has no impact. So low prio.

        // Send transactions from the currently active address. This has to be done
        // before every transaction, because contract._options are cleared after every call.
        // DISABLED because it gave problems, transactions wouldn't pass anymore.
        //this.AssetVaultContract._options["from"] = this.Config.CurrentAddress;

        // Watch until the transaction is processed.
        // TODO: apply web3.eth.filter once it's fully available.

        // Save current block number so we can see:
        // 1. whether a new block has been mined at all and 
        // 2. if the peg wasn't processed, whether we should keep waiting for it
        var blockAtStart = web3.eth.number;
        var maxWaitBlocks = 5;

        var waitingForTransactionFilter = web3.eth.watch('pending');
        waitingForTransactionFilter.changed(function () {
            // TODO: determine whether the transaction was actually processed, and in which block. This callback is called
            // on any change of the ledger. We want to be notified just of the completion of our transaction.
            if (blockAtStart == web3.eth.number)
                // We're on the same block. Definitely not processed.
                return;

            if (!t.isSecured(asset)) {
                // The asset hasn't been secured yet. This could mean:
                // - The transaction wasn't processed.
                // - The transaction was processed, but something went wrong. Invalid data, already registered, etc.
                // As we can't distinguish between the both, we wait maxWaitBlocks to see if it does get registered.
                if (blockAtStart + maxWaitBlocks > web3.eth.number) {
                    // This took too long, something must have gone wrong.
                    // TODO: further handle the error (notify user)
                    waitingForTransactionFilter.uninstall();
                    return;
                }
            }

            var peg = new SecurityPeg();

            peg.name = t._ledgerName.capitalizeFirstLetter();
            peg.details = {
                asset: {
                    id: asset.id,
                    name: asset.name
                },
                address: t.config.currentAddress,
                // TODO: determine the transaction ID (hash). Not 100% possible from the call to the ABI yet, but
                // will be in the future when web3.eth.filter is finished.
                // TransactionHash: ...
            };
            // TODO: don't store this data with the asset in the vault; the logo can be added on load.
            peg.logoImageFileName = "ethereum-logo.png";
            // Currently a dummy URL as there is no working block explorer.
            peg.transactionUrl = "http://ether.fund/block/" + web3.eth.number;

            peg.isOwned = true;

            if (web3.eth.blockNumber !== undefined)
                peg.details.blockNumber = web3.eth.blockNumber;
            else
                // Deprecated JS API
                peg.details.blockNumber = web3.eth.number;

            // Remove this watch after we got the result.
            waitingForTransactionFilter.uninstall();

            cb(peg);
        });

        // The call to the transaction gives no result and doesn't support callbacks.
        this.assetVaultContract.createAsset(asset.id, asset.name);

        // TODO: immediately make a SecurityPeg, but make it pending. Then send an update to show it as processed or failed.

    }

    /**
     * Returns the ethereum address of the owner of this asset, or undefined if the asset isn't secured.
     */
    getOwnerAddress(asset: Asset): string {
        var ownerAddress = this.assetVaultContract.call().ownerByAssetID(asset.id);
        // For non-existing items the contract mapping returns 0 as 40-char hex. Return
        // null in this case.
        if (ownerAddress == "0x0000000000000000000000000000000000000000")
            ownerAddress = null;
        return ownerAddress;
    }

    /**
     * Returns whether the specified asset is secured on this ledger.
     */
    isSecured(asset: Asset): boolean {
        var ownerAddress = this.getOwnerAddress(asset);
        return ownerAddress != null;
    }

    /**
     * For an asset currently secured on this ledger, returns the SecurityPeg.
     */
    getSecurityPeg(asset: Asset): SecurityPeg {
        var peg = new SecurityPeg();
        peg.name = this._ledgerName.capitalizeFirstLetter();
        peg.details = {
            address: this.getOwnerAddress(asset),
            // TODO: determine block number of transaction. Is that possible? Could be when stored in the contract.
            //blockNumber: 

            asset: {
                id: asset.id,
                name: asset.name
            }

        }
        peg.logoImageFileName = "ethereum-logo.png";
        // Currently a dummy URL as there is no working block explorer.
        // Can't determine the blockNumber from previous assets. Yet.
        peg.transactionUrl = "http://ether.fund/block/" + 1507;

        this.checkStatus(peg);

        return peg;
    }

    /**
     * Check the status of the asset on this ledger.
     */
    checkAssetStatus(a: Asset) {
        var t = this;
        if (a.securedOn) {
            _(a.securedOn.securityPegs).each(function (p) {
                if (p.name.toLowerCase() == t._ledgerName.toLowerCase());
                var newPeg = t.getSecurityPeg(a);

                if (newPeg == null) {
                    p.isOwned = false;
                } else {
                    p.details.address = newPeg.details.address;
                    t.checkStatus(p);
                }
            });
        }
    }

    /**
     * Check status of the peg.
     */
    checkStatus(peg: SecurityPeg) {
        if (peg.details.address == this.config.currentAddress) {
            peg.isOwned = true;
        }
        else {
            peg.isOwned = false;
        }
    }

    /**
     * Generates a list with all security pegs for the current address.
     */
    getAllSecurityPegs(): Array<SecurityPeg> {
        var assetCount = this.assetVaultContract.call().assetsByOwner(this.config.currentAddress);

        var pegs = new Array<SecurityPeg>();

        for (var i = 0; i < assetCount; i++) {
            var assetID = this.assetVaultContract.call().getAssetID(this.config.currentAddress, i);
            if (assetID != "") {
                var assetName = this.assetVaultContract.call().getAssetName(this.config.currentAddress, i);

                // Create a dummy asset, and generate the peg object for it.
                var asset = new Asset();
                asset.id = assetID;
                asset.name = assetName;

                var peg = this.getSecurityPeg(asset);

                pegs.push(peg);
            }
        }

        return pegs;
    }

    /**
     * Create a request to transfer an asset of another owner.
     */
    createTransferRequest(assetID: string) {
        this.assetVaultContract.requestTransfer(assetID);
    }

    /**
     * Confirm a received transfer request.
     */
    confirmTransferRequest(request: TransferRequest) {
        this.assetVaultContract.processTransfer(request.assetID, request.requesterAddress, true);
    }

    /**
        * Ignore a received transfer request.
        */
    ignoreTransferRequest(request: TransferRequest) {
        this.assetVaultContract.processTransfer(request.assetID, request.requesterAddress, false);
    }

    /**
     * Load and return any incoming transfer requests for the given asset.
     */
    getTransferRequests(asset: Asset): Array<TransferRequest> {
        // Try to connect before this call.
        // TODO: create a more dependable way of managing the connection. The call could come from anywhere.
        if (!this.connect())
            return null;

        var transferRequestCount: number = this.assetVaultContract.call().transferRequestCount().toNumber();

        var transferRequests = new Array<TransferRequest>();

        for (var i = 0; i < transferRequestCount; i++) {        
            // Get TransferRequest. Accessing the public mapping will always return an array, even if
            // no such TransferRequest exists. For non-existing transferRequestIDs, all its values 
            // will be empty.
            var transferRequestData = this.assetVaultContract.transferRequests(i);
            var assetID: string = transferRequestData[0];

            if (assetID == asset.id) {
                var requesterAddress: string = transferRequestData[1];

                var tr: TransferRequest = {
                    assetID: assetID,
                    requesterAddress: requesterAddress,
                };

                transferRequests.push(tr);
            }
        }

        return transferRequests;
    }
}

/**
 * Service for communicating with the AssetVault Ethereum contracts.
 */
class CoinPrismService {
    public config: CoinPrismConfiguration;

    public static $inject = [
        'configurationService'
    ];

    // dependencies are injected via AngularJS $injector
    constructor(
        private configurationService: ConfigurationService) {

        // The service is constructed when the app is loaded, e.g. before the configuration is unlocked.
        // So don't try to connect yet. Currently connection has to be done manually after logging in.
        // TODO: lazy load this service, connect when initialized. Or listen to the configurationService
        // being initialized.
        //        this.connect();
    }

    connect(): boolean {

        return false;
    }

    /**
     * Disconnect from the API. Not applicable.
     */
    disconnect() {
        // TODO: remove/deactivate any active watches/filters.
    }

    _ledgerName = "coloredcoins";

    _isActive: boolean;

    /**
     * Returns whether there is an active connection to an Ethereum node.
     */
    isActive(): boolean {
        return this._isActive;
    }

    /**
     * Returns whether the Ethereum ledger is enabled. Currently always true.
     */
    isEnabled(): boolean {
        // Always enabled.
        // TODO: make configurable.
        return true;
    }

    /**
     * Ensure that we're connected, by calling Connect() if necessary.
     */
    ensureConnect(): boolean {
        if (this._isActive)
            // Already connected.
            return true;

        return this.connect();
    }

    /**
     * Register the passed asset on this ledger.
     */
    secureAsset(asset: Asset, cb: SecurityPegCallback) {

    }

    /**
     * Returns the ethereum address of the owner of this asset, or undefined if the asset isn't secured.
     */
    getOwnerAddress(asset: Asset): string {
        return null;
    }

    /**
     * Returns whether the specified asset is secured on this ledger.
     */
    isSecured(asset: Asset): boolean {
        return false;
    }

    /**
     * For an asset currently secured on this ledger, returns the SecurityPeg.
     */
    getSecurityPeg(asset: Asset): SecurityPeg {
        return null;
    }

    /**
     * Check the status of the asset on this ledger.
     */
    checkAssetStatus(a: Asset) {

    }

    /**
     * Check status of the peg.
     */
    checkStatus(peg: SecurityPeg) {

    }

    /**
     * Generates a list with all security pegs for the current address.
     */
    getAllSecurityPegs(): Array<SecurityPeg> {
        return null;
    }

    /**
     * Create a request to transfer an asset of another owner.
     */
    createTransferRequest(assetID: string) {

    }

    /**
     * Confirm a received transfer request.
     */
    confirmTransferRequest(request: TransferRequest) {

    }

    /**
        * Ignore a received transfer request.
        */
    ignoreTransferRequest(request: TransferRequest) {

    }

    /**
     * Load and return any incoming transfer requests for the given asset.
     */
    getTransferRequests(asset: Asset): Array<TransferRequest> {

        return null;
    }
}