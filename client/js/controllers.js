var LoginController = (function () {
    function LoginController($scope, $location, $route, identityService) {
        this.$scope = $scope;
        this.$location = $location;
        this.$route = $route;
        this.identityService = identityService;
        $scope.isAuthenticated = function () {
            return identityService.isAuthenticated();
        };
        $scope.login = function () {
            if ($scope.credentials.password == null || $scope.credentials.password.length < 20)
                return;
            var provider = new AssetChainIdentityProvider();
            provider.setPassword($scope.credentials.password);
            identityService.logon(provider);
            $route.reload();
        };
    }
    LoginController.$inject = [
        "$scope",
        "$location",
        "$route",
        "identityService"
    ];
    return LoginController;
})();
function DashboardController($scope, $location, $http, $routeParams, assetsService) {
}
var ExpertVerificationController = (function () {
    function ExpertVerificationController($scope, $location, $routeParams, assetsService, expertsService) {
        this.$scope = $scope;
        this.$location = $location;
        this.$routeParams = $routeParams;
        this.assetsService = assetsService;
        this.expertsService = expertsService;
        $scope.assetID = $routeParams.id;
        $scope.verificationID = $routeParams.verificationID;
        $scope.vm = this;
        $scope.location = $location;
        assetsService.get($scope.assetID, function (resp) {
            $scope.asset = resp;
            if ($scope.verificationID != null) {
                var verificationsWithId = _($scope.asset.verifications).select(function (v) { return v.id == $scope.verificationID; });
                $scope.verification = verificationsWithId[0];
            }
            $scope.expertsByLocation = expertsService.getExperts("London", $scope.asset.category);
        });
    }
    ExpertVerificationController.prototype.save = function () {
        var s = this.$scope;
        this.assetsService.save(this.$scope.asset, function (resp) {
            if (s.location.path() == "/verify/expert/" + s.assetID) {
                s.verification.id = guid(true);
                s.verification.date = moment().toISOString();
                s.verification.isPending = true;
                if (s.asset.verifications == null)
                    s.asset.verifications = [];
                s.asset.verifications.push(s.verification);
                s.location.path("/verify/expert/" + s.assetID + "/" + s.verification.id);
            }
            else {
                s.location.path("/");
            }
        });
    };
    ExpertVerificationController.$inject = [
        "$scope",
        "$location",
        "$routeParams",
        "assetsService",
        "expertsService"
    ];
    return ExpertVerificationController;
})();
function OwnershipVerificationController($scope, $location, $http, $routeParams, assetsService, expertsService) {
    var assetID = $routeParams.id;
    assetsService.get(assetID, function (resp) {
        $scope.asset = resp;
        $scope.expertsByLocation = expertsService.getExperts("London", $scope.asset.category);
    });
}
var TransferRequestController = (function () {
    function TransferRequestController($scope, $location, $routeParams, assetsService) {
        this.$scope = $scope;
        this.$location = $location;
        this.$routeParams = $routeParams;
        this.assetsService = assetsService;
        $scope.vm = this;
        if ($routeParams.assetID != undefined) {
            assetsService.get($routeParams.assetID, function (resp) {
                $scope.asset = resp;
                var requests = assetsService.getTransferRequests($scope.asset);
                $scope.transferRequest = _(requests).findWhere(function (tr) {
                    return tr.assetID == $routeParams.assetID && tr.requesterAddress == $routeParams.requesterAddress;
                });
            });
        }
    }
    TransferRequestController.prototype.create = function () {
        this.assetsService.createTransferRequest(this.$scope.transferRequest);
        this.$location.path("/asset/list");
    };
    TransferRequestController.prototype.hasLedgers = function () {
        return this.assetsService.hasLedgers();
    };
    TransferRequestController.prototype.confirm = function () {
        this.assetsService.confirmTransferRequest(this.$scope.transferRequest);
        this.$location.path("/asset/" + this.$scope.transferRequest.assetID);
    };
    TransferRequestController.prototype.ignore = function () {
        this.assetsService.ignoreTransferRequest(this.$scope.transferRequest);
        this.$location.path("/asset/" + this.$scope.transferRequest.assetID);
    };
    TransferRequestController.$inject = [
        "$scope",
        "$location",
        "$routeParams",
        "assetsService"
    ];
    return TransferRequestController;
})();
function AssetListController($scope, $location, $http, $routeParams, assetsService, identityService) {
    assetsService.getAll(function (res) {
        $scope.assets = res;
    });
    $scope.reload = function () {
        assetsService.reload();
    };
    $scope.clearData = function () {
        localStorage.clear();
    };
    $scope.isAuthenticated = function () {
        return identityService.isAuthenticated();
    };
}
var SingleAssetController = (function () {
    function SingleAssetController($scope, $routeParams, $location, assetsService) {
        this.$scope = $scope;
        this.$routeParams = $routeParams;
        this.$location = $location;
        this.assetsService = assetsService;
        $scope.vm = this;
        var asset_id = $routeParams.id;
        assetsService.get(asset_id, function (resp) {
            $scope.asset = resp;
        });
        $scope.transferRequests = assetsService.getTransferRequests($scope.asset);
    }
    SingleAssetController.$inject = [
        "$scope",
        "$routeParams",
        "$location",
        "assetsService"
    ];
    return SingleAssetController;
})();
function RegisterAssetController($scope, $location, $http, $routeParams, assetsService) {
    $scope.save = function () {
        $scope.asset.images = [];
        _.each($scope.assetform.flow.files, function (file) {
            var fileReader = new FileReader();
            fileReader.readAsDataURL(file.file);
            fileReader.onload = function (event) {
                var img = new AssetImage();
                img.location = "dataUrl";
                img.fileName = file.name;
                img.dataUrl = event.target.result;
                $scope.asset.images.push(img);
            };
        });
        setTimeout(function () {
            assetsService.save($scope.asset, function (resp) {
                $location.path('/asset/' + resp.id);
                $scope.$apply();
            });
        }, 5000);
    };
}
function IdentityController($scope, identityService) {
}
function NavigationController($scope, $location, $http, $routeParams, assetsService, identityService, $window) {
    $scope.menuItems = [
        {
            name: "My assets",
            url: "asset/list",
            icon: "list",
        },
        {
            name: "Register new asset",
            url: "asset/register",
            icon: "plus-circle",
        },
        {
            name: "Transfer assets",
            url: "transfer/create",
            icon: "mail-forward",
        },
    ];
    $scope.isAuthenticated = function () {
        return identityService.isAuthenticated();
    };
    $scope.logoff = function () {
        $location.path("/");
        $window.location.reload();
    };
}
function NotificationController($scope, $location, $http, $routeParams, assetsService) {
    var exampleDate;
    exampleDate = moment().subtract(Math.random() * 600, 'seconds').toISOString();
    $scope.notifications = [
        {
            title: "Asset secured",
            date: exampleDate,
            details: "Your asset <strong>Rolex Platinum Pearlmaster</strong> has been secured with <strong>Premium security</strong>.",
            url: "asset/3",
            icon: "lock",
            seen: true,
        },
        {
            title: "Asset transferred to you",
            date: '2015-01-16 03:43',
            details: "The asset <strong>Diamond 1ct</strong> has been transferred to you.",
            url: "asset/4",
            icon: "mail-forward",
            seen: false,
        },
        {
            title: "New asset registered",
            date: '2015-01-13 12:43',
            details: "Your asset <strong>Rolex Platinum Pearlmaster</strong> has been registered.",
            url: "asset/3",
            icon: "plus-circle",
            seen: true,
        },
        {
            title: "Entered on AssetChain",
            date: '2015-01-13 19:01',
            details: "You became an AssetChain user. Be welcome!",
            url: '',
            icon: "home",
            seen: false,
        }
    ];
    $scope.latestNotifications = $scope.notifications.slice(0, 3);
}
var EthereumAccountController = (function () {
    function EthereumAccountController($scope, $location, configurationService, ethereumService) {
        this.$scope = $scope;
        this.$location = $location;
        this.configurationService = configurationService;
        this.ethereumService = ethereumService;
        $scope.vm = this;
    }
    EthereumAccountController.prototype.connect = function () {
        this.ethereumService.connect();
        this.ensureWatch();
    };
    EthereumAccountController.prototype.ensureWatch = function () {
        if (this._watchConfigured)
            return;
        if (!this.ethereumService.isActive())
            return;
        this.$scope.address = this.ethereumService.config.currentAddress;
        var s = this.$scope;
        var t = this;
        web3.eth.watch('pending').changed(function () {
            s.address = t.ethereumService.config.currentAddress;
            s.balance = web3.toDecimal(web3.eth.balanceAt(s.address));
            s.$apply();
        });
        this._watchConfigured = true;
    };
    EthereumAccountController.prototype.isActive = function () {
        this.ensureWatch();
        return this.ethereumService.isActive();
    };
    EthereumAccountController.$inject = [
        "$scope",
        "$location",
        "configurationService",
        "ethereumService"
    ];
    return EthereumAccountController;
})();
var UserAccountController = (function () {
    function UserAccountController($scope, $location, configurationService, identityService, ethereumService) {
        this.$scope = $scope;
        this.$location = $location;
        this.configurationService = configurationService;
        this.identityService = identityService;
        this.ethereumService = ethereumService;
        $scope.vm = this;
        this.configurationService.load();
        this.$scope.ethereumJsonRpcUrl = this.configurationService.configuration.ethereum.jsonRpcUrl;
        this.$scope.coinPrismConfiguration = this.configurationService.configuration.coinPrism;
    }
    UserAccountController.prototype.isAuthenticated = function () {
        return this.identityService.isAuthenticated();
    };
    UserAccountController.prototype.isEnabled = function (ledgerId) {
        return true;
    };
    UserAccountController.prototype.saveConfiguration = function () {
        this.configurationService.configuration.ethereum.jsonRpcUrl = this.$scope.ethereumJsonRpcUrl;
        this.configurationService.configuration.coinPrism = this.$scope.coinPrismConfiguration;
        this.configurationService.save();
    };
    UserAccountController.$inject = [
        "$scope",
        "$location",
        "configurationService",
        "identityService",
        "ethereumService"
    ];
    return UserAccountController;
})();
var SecureAssetController = (function () {
    function SecureAssetController($scope, $location, $route, $routeParams, configurationService, identityService, assetsService, ethereumService) {
        this.$scope = $scope;
        this.$location = $location;
        this.$route = $route;
        this.$routeParams = $routeParams;
        this.configurationService = configurationService;
        this.identityService = identityService;
        this.assetsService = assetsService;
        this.ethereumService = ethereumService;
        $scope.vm = this;
        $scope.assetID = $routeParams.id;
        assetsService.get($scope.assetID, function (resp) {
            $scope.asset = resp;
        });
    }
    SecureAssetController.prototype.hasLedgers = function () {
        return this.ethereumService.isActive();
    };
    SecureAssetController.prototype.save = function () {
        if (this.$scope.level != "premium")
            return false;
        var t = this;
        if (this.ethereumService.ensureConnect()) {
            var asset = this.$scope.asset;
            if (asset.securedOn)
                for (var i = 0; i < asset.securedOn.securityPegs.length; i++) {
                    var peg = asset.securedOn.securityPegs[i];
                    if (peg.name.toLowerCase() == this.ethereumService._ledgerName) {
                        t.$location.path('/asset/' + this.$scope.asset.id);
                        return;
                    }
                }
            var savePeg = function (pegResp) {
                if (asset.securedOn == null)
                    asset.securedOn = new AssetSecurity();
                asset.securedOn.name = "Premium";
                if (asset.securedOn.securityPegs == null)
                    asset.securedOn.securityPegs = [];
                asset.securedOn.securityPegs.push(pegResp);
                t.assetsService.save(asset, function (assetResp) {
                    t.$location.path('/asset/' + assetResp.id);
                    t.$location.replace();
                });
            };
            if (this.ethereumService.isSecured(asset)) {
                var peg = this.ethereumService.getSecurityPeg(asset);
                savePeg(peg);
                return;
            }
            this.ethereumService.secureAsset(asset, function (peg) {
                savePeg(peg);
                t.$scope.$apply();
            });
        }
        else {
        }
    };
    SecureAssetController.$inject = [
        "$scope",
        "$location",
        "$route",
        "$routeParams",
        "configurationService",
        "identityService",
        "assetsService",
        "ethereumService"
    ];
    return SecureAssetController;
})();
//# sourceMappingURL=controllers.js.map