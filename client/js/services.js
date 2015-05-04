String.prototype.capitalizeFirstLetter = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
};
var AssetsService = (function () {
    function AssetsService($http, $q, $window, identityService, ethereumService, configurationService) {
        this.$http = $http;
        this.$q = $q;
        this.$window = $window;
        this.identityService = identityService;
        this.ethereumService = ethereumService;
        this.configurationService = configurationService;
        this.backend = new EncryptedLocalStorageService(identityService);
        this.binaryBackend = new EncryptedIpfsStorageService(identityService, $http, $q, configurationService);
        this.ensureAssets();
    }
    AssetsService.prototype.ensureAssets = function () {
        if (!this.identityService.isAuthenticated())
            return;
        if (this.assets == null) {
            this.loadDB();
            if (this.assets == null)
                this.assets = [];
        }
        this.processDanglingAssets();
        this.checkAssets();
    };
    AssetsService.prototype.checkAssets = function () {
        var t = this;
        _(this.assets).each(function (a) {
            t.ethereumService.checkAssetStatus(a);
        });
    };
    AssetsService.prototype.processDanglingAssets = function () {
        if (this.ethereumService.connect()) {
            if (this.loadDanglingAssets())
                this.saveDB();
        }
    };
    AssetsService.prototype.loadDanglingAssets = function () {
        var allPegs = this.ethereumService.getAllSecurityPegs();
        var t = this;
        var newPegs = _(allPegs).filter(function (p) {
            var assetWithID = _(t.assets).find(function (a) {
                return a.id == p.details.asset.id;
            });
            return assetWithID == null;
        });
        var anyNew = false;
        _(newPegs).each(function (p) {
            var newAsset = new Asset();
            newAsset.id = p.details.asset.id;
            newAsset.name = p.details.asset.name;
            var sec = new AssetSecurity();
            sec.name = "Premium";
            var pegs = new Array();
            pegs.push(p);
            sec.securityPegs = pegs;
            newAsset.securedOn = sec;
            t.assets.push(newAsset);
            anyNew = true;
        });
        return anyNew;
    };
    AssetsService.prototype.unload = function () {
        this.assets = null;
    };
    AssetsService.prototype.saveAssetBinary = function (asset, data, name) {
    };
    AssetsService.prototype.saveDB = function () {
        var t = this;
        var imageSavePromises = new Array();
        _(this.assets).each(function (asset) {
            _(asset.images).each(function (image) {
                if (image.location == "dataUrl") {
                    var saveImage = t.$q.defer();
                    imageSavePromises.push(saveImage.promise);
                    t.binaryBackend.setItem(image.fileName, image.dataUrl).then(function (data) {
                        var hash = data;
                        image.hash = hash;
                        image.location = "ipfs";
                        saveImage.resolve(image);
                    }, function (reason) {
                        saveImage.reject();
                    });
                }
            });
        });
        this.$q.all(imageSavePromises).then(function (data) {
            var arrayForSave = angular.copy(t.assets);
            _(arrayForSave).each(function (asset) {
                _(asset.images).each(function (image) {
                    if (image.location == "ipfs")
                        image.dataUrl = null;
                });
            });
            t.backend.setItem("assets", arrayForSave);
        });
    };
    AssetsService.prototype.loadDB = function () {
        this.assets = this.backend.getItem("assets");
        var t = this;
        _(this.assets).each(function (asset) {
            _(asset.images).each(function (image) {
                var protoImage = new AssetImage();
                image.isLoaded = protoImage.isLoaded;
                if (!image.isLoaded()) {
                    if (image.location === "ipfs" && image.hash) {
                        t.binaryBackend.getItem(image.hash).then(function (data) {
                            image.dataUrl = data;
                        }, function (reason) {
                        });
                    }
                }
            });
        });
    };
    AssetsService.prototype.reload = function () {
        this.loadDB();
    };
    AssetsService.prototype.getAll = function (cb) {
        this.ensureAssets();
        cb(this.assets);
    };
    AssetsService.prototype.get = function (id, cb) {
        this.ensureAssets();
        cb(_(this.assets).find(function (asset) {
            return asset.id === id;
        }));
    };
    AssetsService.prototype.save = function (asset, cb) {
        this.ensureAssets();
        if (asset.id === undefined)
            this.create(asset, cb);
        else
            this.update(asset, cb);
        this.saveDB();
    };
    AssetsService.prototype.create = function (asset, cb) {
        asset.id = guid(true);
        this.assets.push(asset);
        cb(asset);
    };
    AssetsService.prototype.update = function (updatedAsset, cb) {
        this.get(updatedAsset.id, function (currentAsset) {
            currentAsset = _(currentAsset).extend(updatedAsset);
            cb(updatedAsset);
        });
    };
    AssetsService.prototype.hasLedgers = function () {
        return this.ethereumService.isActive();
    };
    AssetsService.prototype.createTransferRequest = function (request) {
        this.ethereumService.createTransferRequest(request.assetID);
    };
    AssetsService.prototype.confirmTransferRequest = function (request) {
        this.ethereumService.confirmTransferRequest(request);
    };
    AssetsService.prototype.ignoreTransferRequest = function (request) {
        this.ethereumService.ignoreTransferRequest(request);
    };
    AssetsService.prototype.getTransferRequests = function (asset) {
        return this.ethereumService.getTransferRequests(asset);
    };
    AssetsService.$inject = [
        '$http',
        '$q',
        '$window',
        'identityService',
        'ethereumService',
        'configurationService'
    ];
    return AssetsService;
})();
var AssetChainIdentityProvider = (function () {
    function AssetChainIdentityProvider() {
    }
    AssetChainIdentityProvider.prototype.getIdentifier = function () {
        return this._passwordHash;
    };
    AssetChainIdentityProvider.prototype.setPassword = function (password) {
        this._passwordHash = CryptoJS.SHA256(password);
        this._password = password;
    };
    AssetChainIdentityProvider.prototype.isAuthenticated = function () {
        return this._passwordHash != null;
    };
    AssetChainIdentityProvider.prototype.logon = function () {
        return this._passwordHash != null;
    };
    AssetChainIdentityProvider.prototype.getPrivateKey = function () {
        return this._password;
    };
    AssetChainIdentityProvider.prototype.encrypt = function (unencryptedData) {
        return CryptoJS.AES.encrypt(unencryptedData, this.getPrivateKey()).toString();
    };
    AssetChainIdentityProvider.prototype.decrypt = function (encryptedData) {
        return CryptoJS.AES.decrypt(encryptedData, this.getPrivateKey()).toString(CryptoJS.enc.Utf8);
    };
    return AssetChainIdentityProvider;
})();
var EncryptedLocalStorageService = (function () {
    function EncryptedLocalStorageService(identityService) {
        this._identityService = identityService;
    }
    EncryptedLocalStorageService.prototype.getFullKey = function (key) {
        this._keyPrefix = this._identityService.primaryProvider.getIdentifier();
        return this._keyPrefix + "_" + key;
    };
    EncryptedLocalStorageService.prototype.setItem = function (key, val) {
        var stringVar = JSON.stringify(val);
        stringVar = this._identityService.primaryProvider.encrypt(stringVar);
        localStorage.setItem(this.getFullKey(key), stringVar);
    };
    EncryptedLocalStorageService.prototype.getItem = function (key) {
        var stringVar = localStorage.getItem(this.getFullKey(key));
        if (stringVar === null)
            return null;
        stringVar = this._identityService.primaryProvider.decrypt(stringVar);
        return JSON.parse(stringVar);
    };
    return EncryptedLocalStorageService;
})();
var EncryptedIpfsStorageService = (function () {
    function EncryptedIpfsStorageService(identityService, $http, $q, configurationService) {
        this.identityService = identityService;
        this.$http = $http;
        this.$q = $q;
        this.configurationService = configurationService;
    }
    EncryptedIpfsStorageService.prototype.setItem = function (key, val) {
        var stringVar = JSON.stringify(val);
        stringVar = this.identityService.primaryProvider.encrypt(stringVar);
        var ipfsHash;
        var defer = this.$q.defer();
        var jsonObj = { name: key, data: stringVar };
        this.$http({
            method: "POST",
            url: this.configurationService.configuration.decerver.apiUrl() + '/files',
            data: JSON.stringify(jsonObj)
        }).success(function (data) {
            var ipfsHash = data["ipfsHash"];
            defer.resolve(ipfsHash);
        }).error(function (error) {
            defer.reject('$http call failed');
        });
        return defer.promise;
    };
    EncryptedIpfsStorageService.prototype.getItem = function (key) {
        var defer = this.$q.defer();
        var t = this;
        this.$http({
            method: "GET",
            url: this.configurationService.configuration.decerver.apiUrl() + '/ipfs/' + key,
        }).success(function (data) {
            var stringVar = data["data"];
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
    };
    return EncryptedIpfsStorageService;
})();
var IdentityService = (function () {
    function IdentityService($rootScope) {
        this.$rootScope = $rootScope;
        this.$inject = ['$rootScope'];
        this.providers = [];
    }
    IdentityService.prototype.logon = function (provider) {
        if (!provider.logon())
            return false;
        this.providers.push(provider);
        if (!this.primaryProvider)
            this.primaryProvider = provider;
        this.$rootScope.isLoggedOn = true;
        this.$rootScope.$emit('loggedOn');
        return true;
    };
    IdentityService.prototype.logoff = function () {
        this.primaryProvider = null;
        this.providers = new Array();
    };
    IdentityService.prototype.isAuthenticated = function () {
        return this.primaryProvider && this.primaryProvider.isAuthenticated();
    };
    return IdentityService;
})();
var ExpertsService = (function () {
    function ExpertsService() {
    }
    ExpertsService.prototype.getExperts = function (location, category) {
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
                    }
                ]
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
                    }
                ]
            }];
        }
        else {
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
                    }
                ]
            }];
        }
    };
    return ExpertsService;
})();
var ConfigurationService = (function () {
    function ConfigurationService(identityService, $location, $rootScope) {
        this.identityService = identityService;
        this.$location = $location;
        this.$rootScope = $rootScope;
        this.backend = new EncryptedLocalStorageService(identityService);
        var t = this;
        this.$rootScope.$on('loggedOn', function (event, data) {
            t.load();
        });
    }
    ConfigurationService.prototype.load = function () {
        this.configuration = this.backend.getItem("configuration");
        if (this.configuration == null)
            this.configuration = new Configuration();
        if (this.configuration.decerver == null)
            this.configuration.decerver = new DecerverConfiguration();
        if (this.configuration.decerver.baseUrl == undefined) {
            this.configuration.decerver.baseUrl = this.$location.protocol() + "://" + this.$location.host() + ":" + this.$location.port();
        }
    };
    ConfigurationService.prototype.save = function () {
        this.backend.setItem("configuration", this.configuration);
    };
    ConfigurationService.$inject = [
        'identityService',
        '$location',
        '$rootScope'
    ];
    return ConfigurationService;
})();
var EthereumService = (function () {
    function EthereumService(configurationService) {
        this.configurationService = configurationService;
        this._ledgerName = "ethereum";
    }
    EthereumService.prototype.connect = function () {
        try {
            this.configurationService.load();
            this.config = this.configurationService.configuration.ethereum;
            var rpcUrl = this.configurationService.configuration.ethereum.jsonRpcUrl;
            if (rpcUrl == null || rpcUrl == "")
                return false;
            web3.setProvider(new web3.providers.HttpSyncProvider(rpcUrl));
            var coinbase;
            var firstAddress;
            coinbase = web3.eth.coinbase;
            this._isActive = true;
        }
        catch (e) {
            console.log("Exception while trying to connect to Ethereum node: " + e);
        }
        if (this._isActive) {
            if (this.config.currentAddress == null || this.config.currentAddress == "") {
                this.config.currentAddress = coinbase;
            }
            if (!_(web3.eth.accounts).contains(this.config.currentAddress)) {
                console.log("Configured address '" + this.config.currentAddress + "' is not present in the current Ethereum node. Switching to default.");
                this.config.currentAddress = coinbase;
                this.configurationService.save();
            }
            this.loadContract();
            return true;
        }
        return false;
    };
    EthereumService.prototype.disconnect = function () {
        web3.setProvider(null);
    };
    EthereumService.prototype.loadContract = function () {
        var AssetVault = web3.eth.contractFromAbi([{ "constant": true, "inputs": [{ "name": "", "type": "uint256" }], "name": "owners", "outputs": [{ "name": "", "type": "address" }], "type": "function" }, { "constant": true, "inputs": [{ "name": "", "type": "uint256" }], "name": "transferRequests", "outputs": [{ "name": "assetID", "type": "string32" }, { "name": "requester", "type": "address" }], "type": "function" }, { "constant": true, "inputs": [{ "name": "", "type": "address" }], "name": "assetsByOwner", "outputs": [{ "name": "assetCount", "type": "uint256" }], "type": "function" }, { "constant": true, "inputs": [], "name": "ownerCount", "outputs": [{ "name": "", "type": "uint256" }], "type": "function" }, { "constant": false, "inputs": [], "name": "cleanTransferRequests", "outputs": [], "type": "function" }, { "constant": false, "inputs": [{ "name": "ownerAddress", "type": "address" }, { "name": "assetIndex", "type": "uint256" }], "name": "getAssetID", "outputs": [{ "name": "id", "type": "string32" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "assetID", "type": "string32" }], "name": "requestTransfer", "outputs": [], "type": "function" }, { "constant": false, "inputs": [{ "name": "id", "type": "string32" }, { "name": "name", "type": "string32" }], "name": "createAsset", "outputs": [], "type": "function" }, { "constant": false, "inputs": [{ "name": "assetID", "type": "string32" }, { "name": "newOwner", "type": "address" }, { "name": "confirm", "type": "bool" }], "name": "processTransfer", "outputs": [], "type": "function" }, { "constant": true, "inputs": [{ "name": "", "type": "string32" }], "name": "ownerByAssetID", "outputs": [{ "name": "", "type": "address" }], "type": "function" }, { "constant": true, "inputs": [], "name": "transferRequestCount", "outputs": [{ "name": "", "type": "uint256" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "ownerAddress", "type": "address" }, { "name": "assetIndex", "type": "uint256" }], "name": "getAssetName", "outputs": [{ "name": "name", "type": "string32" }], "type": "function" }]);
        this.assetVaultContract = AssetVault("0x9254f061b65cbef1b0908f2882babe6f654e5765");
    };
    EthereumService.prototype.isActive = function () {
        return this._isActive;
    };
    EthereumService.prototype.isEnabled = function () {
        return true;
    };
    EthereumService.prototype.ensureConnect = function () {
        if (this._isActive)
            return true;
        return this.connect();
    };
    EthereumService.prototype.secureAsset = function (asset, cb) {
        var t = this;
        var blockAtStart = web3.eth.number;
        var maxWaitBlocks = 5;
        var waitingForTransactionFilter = web3.eth.watch('pending');
        waitingForTransactionFilter.changed(function () {
            if (blockAtStart == web3.eth.number)
                return;
            if (!t.isSecured(asset)) {
                if (blockAtStart + maxWaitBlocks > web3.eth.number) {
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
            };
            peg.logoImageFileName = "ethereum-logo.png";
            peg.transactionUrl = "http://ether.fund/block/" + web3.eth.number;
            peg.isOwned = true;
            if (web3.eth.blockNumber !== undefined)
                peg.details.blockNumber = web3.eth.blockNumber;
            else
                peg.details.blockNumber = web3.eth.number;
            waitingForTransactionFilter.uninstall();
            cb(peg);
        });
        this.assetVaultContract.createAsset(asset.id, asset.name);
    };
    EthereumService.prototype.getOwnerAddress = function (asset) {
        var ownerAddress = this.assetVaultContract.call().ownerByAssetID(asset.id);
        if (ownerAddress == "0x0000000000000000000000000000000000000000")
            ownerAddress = null;
        return ownerAddress;
    };
    EthereumService.prototype.isSecured = function (asset) {
        var ownerAddress = this.getOwnerAddress(asset);
        return ownerAddress != null;
    };
    EthereumService.prototype.getSecurityPeg = function (asset) {
        var peg = new SecurityPeg();
        peg.name = this._ledgerName.capitalizeFirstLetter();
        peg.details = {
            address: this.getOwnerAddress(asset),
            asset: {
                id: asset.id,
                name: asset.name
            }
        };
        peg.logoImageFileName = "ethereum-logo.png";
        peg.transactionUrl = "http://ether.fund/block/" + 1507;
        this.checkStatus(peg);
        return peg;
    };
    EthereumService.prototype.checkAssetStatus = function (a) {
        var t = this;
        if (a.securedOn) {
            _(a.securedOn.securityPegs).each(function (p) {
                if (p.name.toLowerCase() == t._ledgerName.toLowerCase())
                    ;
                var newPeg = t.getSecurityPeg(a);
                if (newPeg == null) {
                    p.isOwned = false;
                }
                else {
                    p.details.address = newPeg.details.address;
                    t.checkStatus(p);
                }
            });
        }
    };
    EthereumService.prototype.checkStatus = function (peg) {
        if (peg.details.address == this.config.currentAddress) {
            peg.isOwned = true;
        }
        else {
            peg.isOwned = false;
        }
    };
    EthereumService.prototype.getAllSecurityPegs = function () {
        var assetCount = this.assetVaultContract.call().assetsByOwner(this.config.currentAddress);
        var pegs = new Array();
        for (var i = 0; i < assetCount; i++) {
            var assetID = this.assetVaultContract.call().getAssetID(this.config.currentAddress, i);
            if (assetID != "") {
                var assetName = this.assetVaultContract.call().getAssetName(this.config.currentAddress, i);
                var asset = new Asset();
                asset.id = assetID;
                asset.name = assetName;
                var peg = this.getSecurityPeg(asset);
                pegs.push(peg);
            }
        }
        return pegs;
    };
    EthereumService.prototype.createTransferRequest = function (assetID) {
        this.assetVaultContract.requestTransfer(assetID);
    };
    EthereumService.prototype.confirmTransferRequest = function (request) {
        this.assetVaultContract.processTransfer(request.assetID, request.requesterAddress, true);
    };
    EthereumService.prototype.ignoreTransferRequest = function (request) {
        this.assetVaultContract.processTransfer(request.assetID, request.requesterAddress, false);
    };
    EthereumService.prototype.getTransferRequests = function (asset) {
        if (!this.connect())
            return null;
        var transferRequestCount = this.assetVaultContract.call().transferRequestCount().toNumber();
        var transferRequests = new Array();
        for (var i = 0; i < transferRequestCount; i++) {
            var transferRequestData = this.assetVaultContract.transferRequests(i);
            var assetID = transferRequestData[0];
            if (assetID == asset.id) {
                var requesterAddress = transferRequestData[1];
                var tr = {
                    assetID: assetID,
                    requesterAddress: requesterAddress,
                };
                transferRequests.push(tr);
            }
        }
        return transferRequests;
    };
    EthereumService.$inject = [
        'configurationService'
    ];
    return EthereumService;
})();
var CoinPrismService = (function () {
    function CoinPrismService(configurationService) {
        this.configurationService = configurationService;
        this._ledgerName = "coloredcoins";
    }
    CoinPrismService.prototype.connect = function () {
        return false;
    };
    CoinPrismService.prototype.disconnect = function () {
    };
    CoinPrismService.prototype.isActive = function () {
        return this._isActive;
    };
    CoinPrismService.prototype.isEnabled = function () {
        return true;
    };
    CoinPrismService.prototype.ensureConnect = function () {
        if (this._isActive)
            return true;
        return this.connect();
    };
    CoinPrismService.prototype.secureAsset = function (asset, cb) {
    };
    CoinPrismService.prototype.getOwnerAddress = function (asset) {
        return null;
    };
    CoinPrismService.prototype.isSecured = function (asset) {
        return false;
    };
    CoinPrismService.prototype.getSecurityPeg = function (asset) {
        return null;
    };
    CoinPrismService.prototype.checkAssetStatus = function (a) {
    };
    CoinPrismService.prototype.checkStatus = function (peg) {
    };
    CoinPrismService.prototype.getAllSecurityPegs = function () {
        return null;
    };
    CoinPrismService.prototype.createTransferRequest = function (assetID) {
    };
    CoinPrismService.prototype.confirmTransferRequest = function (request) {
    };
    CoinPrismService.prototype.ignoreTransferRequest = function (request) {
    };
    CoinPrismService.prototype.getTransferRequests = function (asset) {
        return null;
    };
    CoinPrismService.$inject = [
        'configurationService'
    ];
    return CoinPrismService;
})();
var DecerverApiService = (function () {
    function DecerverApiService(configurationService) {
        this.configurationService = configurationService;
        this._ledgerName = "thelonious";
    }
    DecerverApiService.prototype.connect = function () {
        return false;
    };
    DecerverApiService.prototype.disconnect = function () {
    };
    DecerverApiService.prototype.isActive = function () {
        return this._isActive;
    };
    DecerverApiService.prototype.isEnabled = function () {
        return true;
    };
    DecerverApiService.prototype.ensureConnect = function () {
        if (this._isActive)
            return true;
        return this.connect();
    };
    DecerverApiService.prototype.secureAsset = function (asset, cb) {
    };
    DecerverApiService.prototype.getOwnerAddress = function (asset) {
        return null;
    };
    DecerverApiService.prototype.isSecured = function (asset) {
        return false;
    };
    DecerverApiService.prototype.getSecurityPeg = function (asset) {
        return null;
    };
    DecerverApiService.prototype.checkAssetStatus = function (a) {
    };
    DecerverApiService.prototype.checkStatus = function (peg) {
    };
    DecerverApiService.prototype.getAllSecurityPegs = function () {
        return null;
    };
    DecerverApiService.prototype.createTransferRequest = function (assetID) {
    };
    DecerverApiService.prototype.confirmTransferRequest = function (request) {
    };
    DecerverApiService.prototype.ignoreTransferRequest = function (request) {
    };
    DecerverApiService.prototype.getTransferRequests = function (asset) {
        return null;
    };
    DecerverApiService.$inject = [
        'configurationService'
    ];
    return DecerverApiService;
})();
//# sourceMappingURL=services.js.map