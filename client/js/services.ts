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

    /**
     * The primary storage for asset data.
     */
    backend: IStorageService;

    /**
     * Backend for storing binary data like images and documents. The primary storage
     * contains hashes referring to these files.
     */
    binaryBackend: IStorageService;

    public static $inject = [
        '$http',
        '$q',
        '$rootScope',
        '$window',
        'identityService',
        'ethereumService',
        'configurationService'
    ];

    // dependencies are injected via AngularJS $injector
    constructor(
        private $http: ng.IHttpService,
        private $q: ng.IQService,
        private $rootScope: ng.IRootScopeService,
        private $window: ng.IWindowService,
        private identityService: IdentityService,
        private ethereumService: EthereumService,
        private configurationService: ConfigurationService) {

        // TODO: make storageService into a configurable, multi-backend data layer
        // For example, assets can be stored anywhere, but their verification cannot.
        this.backend = new EncryptedLocalStorageService(identityService);
        this.binaryBackend = new EncryptedIpfsStorageService(identityService, $http, $q, configurationService);

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

            // Emit notification
            var n: Notification = {
                id: guid(true),
                title: "Asset restored from security peg",
                date: moment().toISOString(),
                details: "The asset <strong>" + newAsset.name + "</strong> for which you control the security peg on the <strong>" + p.name + "</strong> ledger has been restored.",
                url: "asset/" + newAsset.id,
                icon: "lock",
                seen: false,
            };
            t.$rootScope.$emit('addNotification', n);

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
        var t = this;

        // Get all binaries from the asset array and store them in the binary backend if necessary.
        var imageSavePromises = new Array();

        _(this.assets).each(function (asset) {
            _(asset.images).each(function (image) {
                if (image.location == "dataUrl") {
                    var saveImage = t.$q.defer();
                    imageSavePromises.push(saveImage.promise);

                    t.binaryBackend.setItem(image.fileName, image.dataUrl).then(function (data) {
                        // The IPFS backend returns the IPFS hash.
                        var hash = data;

                        image.hash = hash;
                        image.location = "ipfs";
                        saveImage.resolve(image);
                    }, function (reason) {
                            saveImage.reject();
                            // Error calling IPFS backend.
                        });
                }
            });
        });

        // Store all verifications that haven't been stored before.
        var verificationSavePromises = new Array();

        _(this.assets).each(function (asset) {
            _(asset.verifications).each(function (verification) {
                // Valid verifications that should be saved to the backend.
                if (verification.shouldBeSaved
                    && verification.verifierAddress
                    && verification.verifierAddress) {
                    var saveVerification = t.$q.defer();

                    verificationSavePromises.push(saveVerification.promise);

                    try {
                        t.ethereumService.requestVerification(asset, verification);
                    
                        // Verification save on blockchain backend was requested. We don't know when it
                        // will be complete.

                        verification.shouldBeSaved = false;
                        //verification.index = vres;

                        saveVerification.resolve(verification);
                    }
                    catch (e) {
                        saveVerification.reject(e);
                        // TODO: handle error.
                    };
                }
            });
        });

        // Save the asset data to the backend after all secondary items have been saved.
        //this.$q.all([imagesSaved.promise, verificationsSaved.promise]).then(
        this.$q.all(imageSavePromises.concat(verificationSavePromises)).then(
            function (data) {
                // Use angular.copy to strip any internal angular variables like $$hashKey from the data.
                var arrayForSave = angular.copy(t.assets);

                // In the array to save, remove image data to keep it lean.
                _(arrayForSave).each(function (asset) {
                    _(asset.images).each(function (image) {
                        if (image.location == "ipfs")
                            image.dataUrl = null;
                    });
                });

                // Save it to the backend.
                t.backend.setItem("assets", arrayForSave);
            });

    }

    private loadDB(): void {
        this.assets = this.backend.getItem("assets");

        var t = this;

        // Load image data for all images stored on backends
        // TODO: do this per image, only on details, get thumbnails first etc
        _(this.assets).each(function (asset) {
            _(asset.images).each(function (image) {
                // The images aren't deserialized as actual AssetImage
                // objects, but as anonymous objects missing the functions. Therefore we
                // copy the method from a prototype.
                // TODO: find a better way to do this (this can't be how it's meant to be done).

                var protoImage = new AssetImage();
                image.isLoaded = protoImage.isLoaded;

                // Only load image if it hasn't been loaded yet.
                // DEV: always try to get it
                if (!image.isLoaded()) {
                    if (image.location === "ipfs" && image.hash) {
                        // TODO: check whether the format of the data is right.
                        // DEV: cat.jpg;

                        //image.hash = "Qmd286K6pohQcTKYqnS1YhWrCiS4gz7Xi34sdwMe9USZ7u";

                        // The IPFS backend returns a promise.
                        t.binaryBackend.getItem(image.hash).then(function (data) {
                            // The IPFS service returns the decrypted image in dataURL format.                            
                            image.dataUrl = data;
                        }, function (reason) {
                                // Error calling IPFS backend.
                            });
                    }
                }
            });
        });
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

        // The callback is called directly after persisting the asset to the in-memory array. Saving 
        // happens afterwards.
        // TODO: change that to a promise, called after saving is complete.
        if (asset.id === undefined)
            this.create(asset, cb);
        else
            this.update(asset, cb);

        this.saveDB();
    }

    create(asset: Asset, cb: SingleAssetCallback) {
        asset.id = guid(true);

        this.assets.push(asset);

        var n: Notification = {
            id: guid(true),
            title: "New asset registered",
            date: moment().toISOString(),
            details: "Your asset <strong>" + asset.name + "</strong> has been registered.",
            url: "asset/" + asset.id,
            icon: "plus-circle",
            seen: false,
        };
        this.$rootScope.$emit('addNotification', n);

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

    getIncomingVerificationRequests(): Array<VerificationRequest> {
        if (this.ethereumService.connect()) {
            return this.ethereumService.getIncomingVerificationRequests();
        }
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
 * Note: this is not an Angular service. It's a class thats instantiated by other objects.
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
 * Storage service using IPFS through Decerver.
 */
class EncryptedIpfsStorageService {

    constructor(
        /**
         * IdentityService used for encryption.
         */
        private identityService: IdentityService,
        private $http: ng.IHttpService,
        private $q: ng.IQService,
        private configurationService: ConfigurationService) {
    }

    setItem(key: string, val: any): ng.IPromise<string> {
        var stringVar = JSON.stringify(val);

        stringVar = this.identityService.primaryProvider.encrypt(stringVar);

        var ipfsHash: string;

        var defer = this.$q.defer();

        var jsonObj = { name: key, data: stringVar };

        this.$http({
            method: "POST",
            url: this.configurationService.configuration.decerver.apiUrl() + '/files',
            data: JSON.stringify(jsonObj)
        }).success(function (data) {
            // The DAPI will return the IPFS hash. Also, the file name and hash are stored in the contract.
            var ipfsHash: string = data["ipfsHash"];
            defer.resolve(ipfsHash);
        }).error(function (error) {
            defer.reject('$http call failed');

        });

        return defer.promise;
    }

    getItem(key: string): ng.IPromise<string> {
        // TODO: get from IPFS through decerver
        var defer = this.$q.defer();
        var t = this;

        this.$http({
            method: "GET",
            url: this.configurationService.configuration.decerver.apiUrl() + '/ipfs/' + key,
        }).success(function (data) {
            var stringVar: string = data["data"];
            if (stringVar === null)
                return null;
            try {
                stringVar = t.identityService.primaryProvider.decrypt(stringVar);
                defer.resolve(JSON.parse(stringVar));
            }
            catch (error) {
                defer.reject("Error decrypting result '" + stringVar + "'.");
            }
        }).error(function () {
            defer.reject('$http call failed');
        });

        return defer.promise;
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

        this.$rootScope.isLoggedOn = true;

        this.$rootScope.$emit('loggedOn');

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
    allExperts: ExpertCollection;
    constructor() {
        // Initialize dummy data.
        // TODO: realize a directory of experts with their blockchain addresses and metadata.

        // TODO: add a blockchain address for each of these dummy experts so we can request verifications.
        this.allExperts = new ExpertCollection();
        this.allExperts.experts = new Array<Expert>();

        this.allExperts.experts.push({
            id: "5615641",
            name: "Royal Exchange Jewellers"
        });
        this.allExperts.experts.push({
            id: "1564156",
            name: "Jonathan Geeves Jewellers"
        });
        this.allExperts.experts.push({
            id: "9486451",
            name: "Tawny Phillips"
        });
        this.allExperts.experts.push({
            id: "1859159",
            name: "The Watch Gallery (Rolex Boutique)"
        });
        this.allExperts.experts.push({
            id: "41859189",
            name: "Watches of Switzerland"
        });
    }

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

    getExpertByID(expertID: string): Expert {
        var es = function (e: Expert) { return e.id == expertID };
        return _(this.allExperts.experts).find(es);
    }
}

/**
 * The service for storing and retrieving application configuration.
 */
class ConfigurationService {
    configuration: Configuration;

    private backend: IStorageService;

    public static $inject = [
        'identityService',
        '$location',
        '$rootScope'
    ];

    // dependencies are injected via AngularJS $injector
    constructor(
        private identityService: IdentityService,
        private $location: ng.ILocationService,
        private $rootScope: ng.IRootScopeService) {

        // Configuration is always stored in the local storage of the browser. This is where
        // the end user stores their private data. 
        this.backend = new EncryptedLocalStorageService(identityService);

        var t = this;

        // Load configuration after logon.
        this.$rootScope.$on('loggedOn', function (event, data) {
            t.load();
        });

        // TODO: The configuration could be stored in a backend service to make it 
        // transferrable to other devices.
        
        // TODO: make sure configuration is loaded once identityService is initialized.
    }

    load() {
        this.configuration = this.backend.getItem("configuration");
        if (this.configuration == null)
            this.configuration = new Configuration();

        // Earlier saved config can miss new properties.
        // TODO: ensure this in Configuration 
        // TODO: there must be a far better way to restore JSON arrays to classes with functions.
        if (this.configuration.decerver == null)
            this.configuration.decerver = new DecerverConfiguration();

        if (this.configuration.decerver.baseUrl == undefined) {
            // Setup Decerver configuration
            this.configuration.decerver.baseUrl = this.$location.protocol() + "://" + this.$location.host() + ":" + this.$location.port();
        }

        if (!this.configuration.decerver.apiUrl) {
            var dummy = new DecerverConfiguration();
            this.configuration.decerver.apiUrl = dummy.apiUrl;
        }
    }

    save() {
        this.backend.setItem("configuration", this.configuration);
    }
}

class NotificationService {
    public static $inject = [
        "$rootScope",
        "identityService",
    ]

    /**
     * Backend for storing notifications.
     */
    backend: IStorageService;

    /**
     * All notifications.
     */
    // Initialized as empty so controllers can bind to it.
    notifications = new Array<Notification>();

    /**
     * Latest notifications
     */
    latestNotifications = new Array<Notification>();

    constructor(
        private $rootScope: ng.IRootScopeService,
        private identityService: IdentityService) {
        this.backend = new EncryptedLocalStorageService(identityService);

        var t = this;
        $rootScope.$on("loggedOn", function () {
            t.load();
            t.ensureNotifications();
            t.updateLatestNotifications();
        });

        $rootScope.$on('addNotification', function (event: ng.IAngularEvent, data) {
            var newNot = new Notification();
            newNot.id = data.id;
            newNot.date = moment().toISOString();
            newNot.details = data.details;
            newNot.icon = data.icon;
            newNot.seen = false;
            newNot.title = data.title;
            newNot.url = data.url;

            t.notifications.push(newNot);

            t.updateLatestNotifications();
            t.save();
        });

    }

    load() {
        this.notifications = this.backend.getItem("notifications");
        this.updateLatestNotifications();
    }

    save() {
        this.backend.setItem("notifications", this.notifications);
    }


    ensureNotifications() {
        // Even though the array is initialized in the members, it happens that it is undefined. Hence 
        // create it.
        if (!this.notifications)
            this.notifications = new Array<Notification>();

        if (this.notifications.length == 0) {
            // No stored notifications yet. This must be a new user. Add an initial notification.
            // TODO: move this to an real "new vault" handling. Currently there is no such
            // thing.
            this.notifications.push(
                {
                    id: guid(true),
                    title: "Entered on AssetChain",
                    date: moment().toISOString(),
                    details: "You became an AssetChain user. Be welcome!",
                    url: '',
                    icon: "home",
                    seen: false,
                });
        }

        // Ensure all current notifications have a non-null ID
        _(this.notifications).each(function (not: Notification) {
            if (!not.id)
                not.id = guid(true);
        });
    }

    // Latest notifications: get first N items.
    updateLatestNotifications() {
        // We can't recreate the latestNotifications array because it's bound by reference. Hence we clear
        // and refill it.
        if (!this.notifications)
            return;

        var latestToShow = Math.min(3, this.notifications.length);

        // Clear the latest notifications.
        this.latestNotifications.length = 0;

        // Take max N items and add them.
        _(this.notifications)
            .last(latestToShow) // Get the last N items
            .reverse() // Sort them newest first
            .forEach((n) => this.latestNotifications.push(n)); // Add them to latestNotifications
    }
}

/**
 * Service for communicating with the AssetVault Ethereum contracts.
 */
class EthereumService {
    public config: EthereumConfiguration;

    public static $inject = [
        '$q',
        'configurationService'
    ];

    // dependencies are injected via AngularJS $injector
    constructor(
        private $q: ng.IQService,
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
        var AssetVault = web3.eth.contractFromAbi([{ "constant": true, "inputs": [{ "name": "", "type": "uint256" }], "name": "owners", "outputs": [{ "name": "", "type": "address" }], "type": "function" }, { "constant": true, "inputs": [{ "name": "", "type": "uint256" }], "name": "transferRequests", "outputs": [{ "name": "assetID", "type": "string32" }, { "name": "requester", "type": "address" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "assetID", "type": "string32" }, { "name": "verifier", "type": "address" }, { "name": "type", "type": "uint256" }], "name": "requestVerification", "outputs": [{ "name": "dummyForLayout", "type": "bool" }], "type": "function" }, { "constant": true, "inputs": [{ "name": "", "type": "address" }], "name": "assetsByOwner", "outputs": [{ "name": "assetCount", "type": "uint256" }], "type": "function" }, { "constant": true, "inputs": [], "name": "ownerCount", "outputs": [{ "name": "", "type": "uint256" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "ownerAddress", "type": "address" }, { "name": "assetID", "type": "string32" }], "name": "getAssetIndex", "outputs": [{ "name": "assetIndex", "type": "uint256" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "assetID", "type": "string32" }], "name": "getAssetByID", "outputs": [{ "name": "id", "type": "string32" }, { "name": "name", "type": "string32" }, { "name": "verificationCount", "type": "uint256" }], "type": "function" }, { "constant": false, "inputs": [], "name": "cleanTransferRequests", "outputs": [{ "name": "dummyForLayout", "type": "bool" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "ownerAddress", "type": "address" }, { "name": "assetIndex", "type": "uint256" }], "name": "getAssetID", "outputs": [{ "name": "id", "type": "string32" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "assetID", "type": "string32" }], "name": "requestTransfer", "outputs": [{ "name": "dummyForLayout", "type": "bool" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "id", "type": "string32" }, { "name": "name", "type": "string32" }], "name": "createAsset", "outputs": [{ "name": "dummyForLayout", "type": "bool" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "assetID", "type": "string32" }, { "name": "newOwner", "type": "address" }, { "name": "confirm", "type": "bool" }], "name": "processTransfer", "outputs": [{ "name": "dummyForLayout", "type": "bool" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "ownerAddress", "type": "address" }, { "name": "assetID", "type": "string32" }, { "name": "verifier", "type": "address" }, { "name": "type", "type": "uint256" }], "name": "getVerificationIndex", "outputs": [{ "name": "verificationIndex", "type": "uint256" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "assetID", "type": "string32" }, { "name": "verificationIndex", "type": "uint256" }], "name": "getVerification", "outputs": [{ "name": "verifier", "type": "address" }, { "name": "type", "type": "uint256" }, { "name": "isConfirmed", "type": "bool" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "assetID", "type": "string32" }, { "name": "type", "type": "uint256" }, { "name": "confirm", "type": "bool" }], "name": "processVerification", "outputs": [{ "name": "processedCorrectly", "type": "bool" }], "type": "function" }, { "constant": true, "inputs": [{ "name": "", "type": "string32" }], "name": "ownerByAssetID", "outputs": [{ "name": "", "type": "address" }], "type": "function" }, { "constant": true, "inputs": [], "name": "transferRequestCount", "outputs": [{ "name": "", "type": "uint256" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "ownerAddress", "type": "address" }, { "name": "assetIndex", "type": "uint256" }], "name": "getAsset", "outputs": [{ "name": "id", "type": "string32" }, { "name": "name", "type": "string32" }, { "name": "verificationCount", "type": "uint256" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "ownerAddress", "type": "address" }, { "name": "assetIndex", "type": "uint256" }], "name": "getAssetName", "outputs": [{ "name": "name", "type": "string32" }], "type": "function" }]);

        // TODO: make address configurable
        this.assetVaultContract = AssetVault("0xb1249d6712059401c618abf4f15a17cdd920b8d3");
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
            
            // Real URL to the Etherapps block explorer. However since we use a local testchain, the blocks don't match up.
            peg.transactionUrl = "http://etherapps.info/block/" + web3.eth.number;

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

    getIncomingVerificationRequests(): Array<VerificationRequest> {
        return this.getVerificationRequests(this.config.currentAddress);
    }

    /**
     * Returns a list of all verification requests where the given address is the 
     * requested verifier. To be called with the own ethereum address, to get
     * incoming verification requests.
     */
    getVerificationRequests(verifierAddress: string): Array<VerificationRequest> {
        var verifications = new Array<VerificationRequest>();

        // Loop through all owners, all assets, all verifications.
        // Find the verifications that are unconfirmed and have the target address as the verifier.
        // Create minimal Asset and Verification objects.
        var ownerCount = this.assetVaultContract.call().ownerCount().toNumber();
        for (var oi = 0; oi < ownerCount; oi++) {
            var ownerAddress = this.assetVaultContract.owners(oi);

            if (ownerAddress != "0x0000000000000000000000000000000000000000") { // empty
                var assetCount = this.assetVaultContract.call().assetsByOwner(ownerAddress).toNumber();
                for (var ai = 0; ai < assetCount; ai++) {
                    var assetID = this.assetVaultContract.call().getAssetID(ownerAddress, ai);
                    if (assetID != "") {

                        var assetInfo = this.assetVaultContract.call().getAsset(ownerAddress, ai);
                        var verificationCount = assetInfo[2].toNumber();
                        if (verificationCount > 0) {
                            for (var vi = 0; vi < verificationCount; vi++) {
                                var verificationInfo = this.assetVaultContract.call().getVerification(assetID, vi);

                                var verifier = verificationInfo[0];
                                var verificationType = verificationInfo[1].toNumber();
                                var confirmed = verificationInfo[2];

                                if (verifier == verifierAddress && !confirmed) {
                                    // This is an incoming verification for the requested address.

                                    var vr = new VerificationRequest();
                                    verifications.push(vr);
                                    vr.ownerAddress = ownerAddress;

                                    var asset = new Asset();
                                    vr.asset = asset;
                                    asset.id = assetID;
                                    asset.name = this.assetVaultContract.call().getAssetName(ownerAddress, ai);

                                    // TODO: realize some way so the verifier can see (a selection of) the images.
                                    // This requires encrypting them with their public key. Is that possible in 
                                    // Eth / Tendermint / Thelonious crypto?

                                    var verification = new Verification();
                                    vr.verification = verification;
                                    verification.verificationType = verificationType;
                                    verification.verifierAddress = verifier;
                                    verification.isPending = true;
                                    
                                    // TODO: load other properties of the verification request (comments, defects, ...). Currently
                                    // these are not stored in the backend.
                                }
                            }
                        }
                    }
                }
            }
        }
        this.assetVaultContract

        return verifications;
    }

    /**
     * Save a verification request.
     */
    //requestVerification(asset: Asset, verification: Verification): ng.IPromise<number> {
    requestVerification(asset: Asset, verification: Verification) {
        //var resultPromise = this.$q.defer<number>();
        var t = this;

        //try {
        this.assetVaultContract.requestVerification(
            asset.id,
            verification.verifierAddress,
            verification.verificationType
            );

        // The currently used version of web3 doesn't support callbacks.
        // The latest does:
        // https://github.com/ethereum/wiki/wiki/JavaScript-API#using-callbacks
        // When using that version, a callback and promise should be used.

        //        function (data) {
        //            // Get the index of the new verification.
        //            // TODO: handle exceptions.
        //            var verificationIndex = t.assetVaultContract.getVerificationIndex(
        //                t.config.currentAddress,
        //                asset.id,
        //                verification.verifierAddress,
        //                verification.verificationType);
        //            resultPromise.resolve(verificationIndex);
        //        }
        //        );
        //}
        //catch (e) {
        //    resultPromise.reject(e);
        //}
        //return resultPromise.promise;
    }
}

/**
 * Service for communicating with the CoinPrism API for security pegs.
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

/**
 * Service for communicating with the Atë layer of the Decerver Dapp
 */
class DecerverApiService {
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

    _ledgerName = "thelonious";

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