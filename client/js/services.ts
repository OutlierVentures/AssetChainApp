interface SingleAssetCallback {
    (asset: Asset);
}

interface MultipleAssetCallback {
    (asset: Asset[]);
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

        // TODO: inject and pass identityService
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

        if (this.assets != null)
            return;

        // Initialize with dummy data.
        // TODO: get from server-side storage if available, cached in local storage.
        this.assets = [
            {
                comments: "",
                IsPendingClaim: false,
                id: "3",
                name: "Rolex Platinum Pearlmaster",
                category: "Jewelry/Watch",
                images: [
                    {
                        location: "local",
                        fileName: "rolex-platinum-pearlmaster.jpg",
                    },
                    {
                        location: "local",
                        fileName: "rolex-platinum-pearlmaster-closeup.png",
                    },
                ],
                securedOn: {
                    name: "Premium security",
                    ledgers:
                    [
                        {
                            name: "Counterparty",
                            logoImageFileName: "counterparty-logo.png",
                            transactionUrl: "http://blockscan.com/txInfo/11570794"
                        },
                        {
                            name: "Ethereum",
                            logoImageFileName: "ethereum-logo.png",
                        }
                    ]
                },
                Verifications: [],
            },
            {
                id: "2",
                name: "Rolex Submariner for Cartier",
                category: "Jewelry/Watch",
                comments: null,
                IsPendingClaim: false,
                images: [
                    {
                        location: "local",
                        fileName: "rolex-submariner-for-cartier.jpg",
                    }
                ],
                securedOn: {
                    name: "Premium security",
                    ledgers:
                    [
                        {
                            name: "Counterparty",
                            logoImageFileName: "counterparty-logo.png",
                            transactionUrl: "http://blockscan.com/txInfo/11545830"
                        }
                    ]
                },
                Verifications: [
                    {
                        id: "89489489485456",
                        name: "Watches of Switzerland",
                        address: "61 Brompton Road, London, London, SW3 1B, United Kingdom",
                        date: '2015-01-13 15:34',
                        comments: "",
                        defects: "",
                        IsPending: false,
                    }
                ]

            },
            {
                id: "4",
                name: "Diamond 1ct",
                category: "Jewelry/Precious stones",
                comments: null,
                IsPendingClaim: false,
                Verifications: [],
            }
        ];
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
        // Provide dummy data.
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