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


/**
 * The service for storing and retrieving assets in one or several backend storage methods.
 */
class AssetsService {
    assets: Asset[];

    backend: IStorageService;

    public static $inject = [
        'identityService'
    ];

    // dependencies are injected via AngularJS $injector
    constructor(
        private identityService: IdentityService) {

        // TODO: make storageService into a configurable, multi-backend data layer
        // For example, assets can be stored anywhere, but their verification cannot.
        this.backend = new EncryptedLocalStorageService(identityService);

        this.ensureAssets();
    }

    /**
     * Ensure that initial data is loaded.
     */
    ensureAssets(): void {
        if (!this.identityService.IsAuthenticated())
            return;

        if (this.assets != null)
            return;

        this.loadDB();

        if (this.assets == null)
            this.assets = [];
    }

    private saveDB(): void {
        // TODO: encrypt by identityservice
        // TODO: use a unique key for the current account
        // Use angular.copy to strip any internal angular variables like $$hashKey from the data.
        this.backend.SetItem("assets", angular.copy(this.assets));
    }

    private loadDB(): void {
        this.assets = this.backend.GetItem("assets");
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
        asset.id = guid();

        // STUB: dummy security
        //asset.securedOn = {
        //    name: "Premium security",
        //    securityPegs:
        //    [
        //        {
        //            name: "Counterparty",
        //            logoImageFileName: "counterparty-logo.png",
        //            details: [],
        //            transactionUrl: "http://blockscan.com/txInfo/11570794"
        //        },
        //        {
        //            name: "Ethereum",
        //            logoImageFileName: "ethereum-logo.png",
        //            details: [],
        //            transactionUrl: null
        //        }
        //    ]
        //};

        this.assets.push(asset)
        cb(asset);
    }

    update(updatedAsset: Asset, cb: SingleAssetCallback) {
        this.get(updatedAsset.id, function (currentAsset) {
            currentAsset = _(currentAsset).extend(updatedAsset);
            cb(updatedAsset);
        });
    }
}

interface IIdentityProvider {
    /**
     * Get the identifier of the current user on the backend, for example the Ethereum address, Counterparty
     * wallet address, etc.
     */
    GetIdentifier(): string;

    /**
     * Log on at the identity backend. The provider needs to be initialized (with configuration, credentials etc)
     * before calling Logon().
     * @return Whether the logon attempt succeeded.
     */
    Logon(): boolean;

    /**
     * @return Whether the provider is currently logged on.
     */
    IsAuthenticated(): boolean;

    /**
     * Encrypt the given data with the private key of this identity provider.
     */
    Encrypt(unencryptedData: string): string;

    Decrypt(encryptedData: string): string;
}

/**
 * Identity provider for AssetChain, using encrypted local storage.
 */
class AssetChainIdentityProvider {
    /**
     * Hash of the password of the user.
     */
    private _PasswordHash: string;

    /**
     * The unencrypted password of the user. Only stored in-memory.
     */
    private _Password: string;


    GetIdentifier(): string {
        return this._PasswordHash;
    }

    SetPassword(password: string) {
        this._PasswordHash = CryptoJS.SHA256(password);
        this._Password = password;
    }

    IsAuthenticated(): boolean {
        return this._PasswordHash != null;
    }

    Logon(): boolean {
        // We only require a password to function. If it's not empty, we're good to go.
        return this._PasswordHash != null;
    }

    private GetPrivateKey(): string {
        return this._Password;
    }

    Encrypt(unencryptedData: string): string {
        return CryptoJS.AES.encrypt(unencryptedData, this.GetPrivateKey()).toString();
    }

    Decrypt(encryptedData: string): string {
        // TODO: check for errors
        // TODO: handle case that data is unencrypted, or encrypted with different alg
        return CryptoJS.AES.decrypt(encryptedData, this.GetPrivateKey()).toString(CryptoJS.enc.Utf8);
    }

}

interface IStorageService {
    SetItem(key: string, val: any);

    GetItem(key: string): any;
}

/**
 * Storage service using the local browser storage with data encrypted using identity.PrimaryProvider.
 */
class EncryptedLocalStorageService {
    private _IdentityService: IdentityService;

    private _KeyPrefix: string;

    constructor(identityService: IdentityService) {
        this._IdentityService = identityService;
    }

    private GetFullKey(key: string): string {
        // Use the identifier of the identityService as a prefix for the local storage keys.
        // Effectively that means prefixing with SHA256 hashes, for example:
        // a5a28cfe2786537d28d4f57d4a15fe5813a973d3d6f9b9186033b8df50fac56b_assets

        // This can only be done once _IdentityService.PrimaryProvider is logged on, i.e.
        // when we're good to go.
        // TODO: include checks for this.
        this._KeyPrefix = this._IdentityService.PrimaryProvider.GetIdentifier();

        return this._KeyPrefix + "_" + key;
    }

    SetItem(key: string, val: any) {
        var stringVar = JSON.stringify(val);

        stringVar = this._IdentityService.PrimaryProvider.Encrypt(stringVar);

        localStorage.setItem(this.GetFullKey(key), stringVar);
    }

    GetItem(key: string): any {
        var stringVar: string = localStorage.getItem(this.GetFullKey(key));
        if (stringVar === null)
            return null;

        stringVar = this._IdentityService.PrimaryProvider.Decrypt(stringVar);

        return JSON.parse(stringVar);
    }
}


/**
 * Service managing the identity of the user on the various backends.
 */
class IdentityService {
    //
    Providers: IIdentityProvider[];

    /**
     * The main identity provider. If this is null, we're not authenticated.
     */
    PrimaryProvider: IIdentityProvider;

    $inject = ['$rootScope'];

    constructor(
        private $rootScope: AssetChainRootScope
        ) {
        this.Providers = [];
    }

    /**
     * Logon with this provider.
     */
    Logon(provider: IIdentityProvider): boolean {
        if (!provider.Logon())
            return false;
        this.Providers.push(provider)
        // The first successful provider is the primary one.
        if (this.PrimaryProvider === undefined)
            this.PrimaryProvider = provider;

        this.$rootScope.IsLoggedIn = true;

        return true;
    }

    IsAuthenticated(): boolean {
        return this.PrimaryProvider != null && this.PrimaryProvider.IsAuthenticated();
    }
}

/**
 * Service around experts who execute verifications of assets.
 */
class ExpertsService {
    /**
     * Returns a set of experts by search criteria.
     */
    GetExperts(location: string, category: string) {
        // Provide stub data, distinguished by category.
        // TODO: implement
        if (category == "Jewelry/Watch") {
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
        else if (category.indexOf("Jewelry") > 0) {
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
    Configuration: Configuration;

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
        this.Configuration = this.backend.GetItem("configuration");
        if (this.Configuration == null)
            this.Configuration = new Configuration();
    }

    save() {
        this.backend.SetItem("configuration", this.Configuration);
    }
}

/**
 * Service for communicating with the AssetVault Ethereum contracts.
 */
class EthereumService {
    public Config: EthereumConfiguration;

    public static $inject = [
        'configurationService'
    ];

    // dependencies are injected via AngularJS $injector
    constructor(
        private configurationService: ConfigurationService) {

        this.Connect();
    }

    /**
     * The AssetVault contract from ABI.
     */
    private AssetVaultContract: any;

    Connect(): boolean {
        try {
            this.configurationService.load();
            this.Config = this.configurationService.Configuration.Ethereum;

            // We'll be using JSON-RPC to talk to eth.
            var rpcUrl = this.configurationService.Configuration.Ethereum.JsonRpcUrl;

            web3.setProvider(new web3.providers.HttpSyncProvider(rpcUrl));

            var coinbase: string;

            coinbase = web3.eth.coinbase;
            this._IsActive = true;
        }
        catch (e) {
            console.log("Exception while trying to connect to Ethereum node: " + e);
        }

        if (this._IsActive) {
            // Further configuration now that we know the connection to the node is successful.
            if (this.Config.CurrentAddress == null || this.Config.CurrentAddress == "") {
                this.Config.CurrentAddress = coinbase;
            }

            if (!_(web3.eth.accounts).contains(this.Config.CurrentAddress)) {
                // The configured address is not in the accounts of the eth node. That's probably an
                // error.
                // For now: just change it.
                console.log("Configured address '" + this.Config.CurrentAddress + "' is not present in the current Ethereum node. Switching to default.");
                this.Config.CurrentAddress = coinbase;
            }

            this.LoadContract();
            return true;
        }
        return false;
    }

    private LoadContract() {
        // The line below is generated by AlethZero when creating the contract.
        var AssetVault = web3.eth.contractFromAbi([{ "constant": false, "inputs": [{ "name": "id", "type": "string32" }, { "name": "name", "type": "string32" }], "name": "CreateAsset", "outputs": [], "type": "function" }, { "constant": false, "inputs": [{ "name": "index", "type": "uint256" }], "name": "GetOwnerAt", "outputs": [{ "name": "ownerAddress", "type": "address" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "ownerAddress", "type": "address" }, { "name": "assetIndex", "type": "uint256" }], "name": "GetAssetName", "outputs": [{ "name": "name", "type": "string32" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "assetID", "type": "string32" }], "name": "GetOwnerOf", "outputs": [{ "name": "ownerAddress", "type": "address" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "ownerAddress", "type": "address" }], "name": "GetAssetCount", "outputs": [{ "name": "assetCount", "type": "uint256" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "ownerAddress", "type": "address" }, { "name": "assetIndex", "type": "uint256" }], "name": "GetAsset", "outputs": [{ "name": "b", "type": "structAsset" }], "type": "function" }, { "constant": true, "inputs": [], "name": "OwnerCount", "outputs": [{ "name": "", "type": "uint256" }], "type": "function" }, { "constant": true, "inputs": [{ "name": "", "type": "address" }], "name": "AssetsByOwner", "outputs": [{ "name": "AssetCount", "type": "uint256" }], "type": "function" }, { "constant": true, "inputs": [{ "name": "", "type": "uint256" }], "name": "Owners", "outputs": [{ "name": "", "type": "address" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "ownerAddress", "type": "address" }, { "name": "assetIndex", "type": "uint256" }], "name": "GetAssetID", "outputs": [{ "name": "id", "type": "string32" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "AssetID", "type": "string32" }, { "name": "newOwner", "type": "address" }], "name": "TransferAssetTo", "outputs": [], "type": "function" }, { "constant": true, "inputs": [{ "name": "", "type": "string32" }], "name": "OwnerByAssetID", "outputs": [{ "name": "", "type": "address" }], "type": "function" }]);

        // TODO: make address configurable
        this.AssetVaultContract = AssetVault("0x011109ed1e18a6d2a0360b81bc838997964a7879");

        // Send transactions from coinbase as we allow choosing it through the UX.
        this.AssetVaultContract._options["from"] = this.Config.CurrentAddress;
    }

    _IsActive: boolean;

    /**
     * Returns whether there is an active connection to an Ethereum node.
     */
    IsActive(): boolean {
        return this._IsActive;
    }

    /**
     * Returns whether the Ethereum ledger is enabled. Currently always true.
     */
    IsEnabled(): boolean {
        // Always enabled.
        // TODO: make configurable.
        return true;
    }

    /**
     * Ensure that we're connected, by calling Connect() if necessary.
     */
    EnsureConnect(): boolean {
        if (this._IsActive)
            // Already connected.
            return true;

        return this.Connect();
    }

    /**
     * Register the passed asset on this ledger.
     */
    SecureAsset(asset: Asset, cb: SecurityPegCallback) {
        this.AssetVaultContract.CreateAsset(asset.id, asset.name);
        var t = this;
        // Watch until the transaction is processed.
        // TODO: apply web3.eth.filter once it's fully available.
        web3.eth.watch('pending').changed(function () {
            // TODO: determine whether the transaction was actually processed, and in which block. This callback is called
            // on any change of the ledger. We want to be notified just of the completion of our transaction.

            var peg: SecurityPeg = {
                name: "Ethereum",
                details: {
                    Address: t.Config.CurrentAddress,
                    // TODO: determine the transaction ID (hash). Not 100% possible from the call to the ABI yet, but
                    // will be in the future when web3.eth.filter is finished.
                    // TransactionHash: ...
                },
                // TODO: don't store this data with the asset in the vault; the logo can be added on load.
                logoImageFileName: "ethereum-logo.png",
                // Currently a dummy URL as there is no working block explorer.
                transactionUrl: "http://ether.fund/block/1507",
            }

            if (web3.eth.blockNumber !== undefined)
                peg.details.BlockNumber = web3.eth.blockNumber;
            else
                // Deprecated JS API
                peg.details.BlockNumber = web3.eth.number;

            

            // TODO: remove this watch after we got the result. How?
            // TODO: update to latest JavaScript API web3.eth.filter (once backend is updated).
            cb(peg);
        });
    }

    /**
     * Returns whether the specified asset is secured on this ledger.
     */
    IsSecured(asset: Asset): boolean {
        // TODO: implement.
        return false;
    }

    /**
     * For an asset currently secured on this ledger, returns the SecurityPeg.
     */
    GetSecurityPeg(asset: Asset): SecurityPeg {
        // TODO: implement
        return null;
    }
}