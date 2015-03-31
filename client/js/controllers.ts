interface ILoginScope extends ng.IScope {
    credentials: Credentials;
    isAuthenticated();
    login();
}

class LoginController {
    public static $inject = [
        "$scope",
        "$location",
        "$route",
        "identityService"];

    constructor(
        private $scope: ILoginScope,
        private $location: ng.ILocationService,
        private $route: ng.route.IRouteService,
        private identityService: IdentityService) {

        $scope.isAuthenticated = function (): boolean {
            return identityService.isAuthenticated();
        }

        $scope.login = function () {
            // TODO: move to IsValidPassword function, check whether it's a valid wallet password (mnemonic)
            if ($scope.credentials.password == null || $scope.credentials.password.length < 20)
                return;

            var provider = new AssetChainIdentityProvider();

            provider.setPassword($scope.credentials.password);
            identityService.logon(provider);

            $route.reload();
        }
    }
}

function DashboardController($scope, $location, $http, $routeParams, assetsService: AssetsService) {
    // Get latest notifications

    // Get all assets (not only current user)

    // Get some stats/charts
}

interface IAssetRouteParameters extends ng.route.IRouteParamsService {
    id: string;
}

interface IVerifyAssetRouteParameters extends IAssetRouteParameters {
    verificationID: string;
}

interface IVerificationScope extends ng.IScope {
    assetID: string;
    verificationID: string;
    asset: Asset;
    expertsByLocation: Array<ExpertCollection>;
    location: ng.ILocationService;
    vm: ExpertVerificationController;
    verification: Verification;
}

class ExpertVerificationController {

    public static $inject = [
        "$scope",
        "$location",
        "$routeParams",
        "assetsService",
        "expertsService"];

    constructor(
        private $scope: IVerificationScope,
        private $location: ng.ILocationService,
        private $routeParams: IVerifyAssetRouteParameters,
        private assetsService: AssetsService,
        private expertsService: ExpertsService) {
        $scope.assetID = $routeParams.id;
        $scope.verificationID = $routeParams.verificationID;
        $scope.vm = this;
        $scope.location = $location;

        assetsService.get($scope.assetID, function (resp) {
            $scope.asset = resp;

            if ($scope.verificationID != null) {
                // Load the verification we worked on in an earlier step.
                var verificationsWithId = _($scope.asset.verifications).select(v => v.id == $scope.verificationID);
                $scope.verification = verificationsWithId[0];
            }

            $scope.expertsByLocation = expertsService.getExperts("London", $scope.asset.category);
        });
    }

    save() {
        // Provide the callback below access to the scope.
        // TODO: refactor.
        var s = this.$scope;

        this.assetsService.save(this.$scope.asset, function (resp) {
            if (s.location.path() == "/verify/expert/" + s.assetID) {
                // Step 1
                s.verification.id = guid(true);
                s.verification.date = moment().toISOString();
                s.verification.isPending = true;
                if (s.asset.verifications == null)
                    s.asset.verifications = [];
                s.asset.verifications.push(s.verification);
                s.location.path("/verify/expert/" + s.assetID + "/" + s.verification.id);
            } else {
                // Step 2
                // Finished.
                // TODO: show "finished" message.
                // TODO: add item to notifications.
                
                s.location.path("/");
            }
        });
    }
}

function OwnershipVerificationController($scope, $location, $http, $routeParams, assetsService: AssetsService, expertsService: ExpertsService) {
    var assetID = $routeParams.id;

    assetsService.get(assetID, function (resp) {
        $scope.asset = resp;

        $scope.expertsByLocation = expertsService.getExperts("London", $scope.asset.category);
    });
}


interface ITransferRequestScope extends ng.IScope {
    vm: TransferRequestController;
    transferRequest: TransferRequest;
    asset: Asset;
}

interface ITransferRequestRouteParameters extends ng.route.IRouteParamsService {
    assetID: string;
    requesterAddress: string;
}

class TransferRequestController {
    public static $inject = [
        "$scope",
        "$location",
        "$routeParams",
        "assetsService"];

    constructor(
        private $scope: ITransferRequestScope,
        private $location: ng.ILocationService,
        private $routeParams: ITransferRequestRouteParameters,
        private assetsService: AssetsService) {
        $scope.vm = this;

        // Load asset data
        if ($routeParams.assetID != undefined) {
            assetsService.get($routeParams.assetID, function (resp) {
                $scope.asset = resp;

                // And the transfer request
                var requests = assetsService.getTransferRequests($scope.asset);

                // TODO: handle case that TR can't be found, is non-existing etc.                
                $scope.transferRequest = _(requests).findWhere(function (tr: TransferRequest) {
                    return tr.assetID == $routeParams.assetID
                        && tr.requesterAddress == $routeParams.requesterAddress;
                });
            });
        }
    }

    create() {
        this.assetsService.createTransferRequest(this.$scope.transferRequest);
        // TODO: show notification
        this.$location.path("/asset/list");
    }

    hasLedgers(): boolean {
        return this.assetsService.hasLedgers();
    }

    confirm() {
        this.assetsService.confirmTransferRequest(this.$scope.transferRequest);
            
        // TODO: show notification

        // Go to asset details to show current status.
        this.$location.path("/asset/" + this.$scope.transferRequest.assetID);
    }

    ignore() {
        this.assetsService.ignoreTransferRequest(this.$scope.transferRequest);
            
        // TODO: show notification

        // Go to asset details to show current status.
        this.$location.path("/asset/" + this.$scope.transferRequest.assetID);
    }

}

function AssetListController($scope, $location, $http, $routeParams, assetsService: AssetsService, identityService: IdentityService) {
    assetsService.getAll(function (res) {
        $scope.assets = res;
    });

    $scope.reload = function () {
        assetsService.reload();
    }

    $scope.clearData = function () {
        localStorage.clear();
    }

    $scope.isAuthenticated = function (): boolean {
        return identityService.isAuthenticated();
    }
}


interface ISingleAssetScope extends ng.IScope {
    vm: SingleAssetController;
    asset: Asset;
    transferRequests: Array<TransferRequest>;
}

class SingleAssetController {
    public static $inject = [
        "$scope",
        "$routeParams",
        "$location",
        "assetsService"];

    constructor(
        private $scope: ISingleAssetScope,
        private $routeParams: IAssetRouteParameters,
        private $location: ng.ILocationService,
        private assetsService: AssetsService) {
        $scope.vm = this;

        // Load asset data
        var asset_id = $routeParams.id;
        assetsService.get(asset_id, function (resp) {
            $scope.asset = resp;
        });

        // Check for any incoming TransferRequests for this asset.
        $scope.transferRequests = assetsService.getTransferRequests($scope.asset);
    }
}

function RegisterAssetController($scope, $location: ng.ILocationService, $http, $routeParams, assetsService: AssetsService) {
    $scope.save = function () {
        // Load the photo data.
        $scope.asset.images = [];

        _.each($scope.assetform.flow.files, function (file: any) {
            var fileReader = new FileReader();
            fileReader.readAsDataURL(file.file);

            fileReader.onload = function (event: any) {
                $scope.asset.images.push({
                    location: "dataUrl",
                    fileName: file.name,
                    dataUrl: event.target.result
                });
            };
        });

        // The data arrives asynchronously.
        // Poor man's solution: wait 5 seconds.
        // TODO: solve properly using async().
        setTimeout(function () {
            assetsService.save($scope.asset, function (resp) {
                // Redirect to the new asset page.
                $location.path('/asset/' + resp.id);
                // Apply scope changes to effect the redirect.
                $scope.$apply();
            });
        }, 5000);
    }
}


function IdentityController($scope, identityService: IdentityService) {

}

interface INavigationScope extends ng.IScope {
    menuItems: Array<MenuItem>;
    isAuthenticated(): boolean;
    logoff();
}

/**
 * Controller for the navigation bars.
 */
function NavigationController($scope: INavigationScope, $location: ng.ILocationService, $http, $routeParams,
    assetsService: AssetsService,
    identityService: IdentityService,
    $window: ng.IWindowService) {

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
        // Disabled here, verification is initiated from asset detail page.
        //{
        //    name: "Verify assets",
        //    url: "verify",
        //    icon: "check",
        //},
        {
            name: "Transfer assets",
            url: "transfer/create",
            icon: "mail-forward",
        },
    ];

    $scope.isAuthenticated = function (): boolean {
        return identityService.isAuthenticated();
    }

    $scope.logoff = function () {
        // Reset path to the front page.
        $location.path("/");

        // Do a hard reload of the browser so all state data is cleared. This includes Angular controllers, services etc.
        $window.location.reload();
    }
}

interface NotificationScope {
    notifications: Array<Notification>;
    latestNotifications: Array<Notification>;
}

function NotificationController($scope: NotificationScope, $location, $http, $routeParams, assetsService: AssetsService) {
    var exampleDate: string;
    // Use a recent date to test moment display ("... minutes ago")
    exampleDate = moment().subtract(Math.random() * 600, 'seconds').toISOString();

    // Note: using object initializers like this requires all properties to be set.
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
        }];

    // Latest notifications: get first N items.
    $scope.latestNotifications = $scope.notifications.slice(0, 3);
}


interface IEthereumAccountScope extends ng.IScope {
    vm: EthereumAccountController;
    address: string;
    balance: string;
}

/**
 * Controller for connecting to Ethereum and managing accounts.
 */
class EthereumAccountController {
    public static $inject = [
        "$scope",
        "$location",
        "configurationService",
        "ethereumService"];

    constructor(
        private $scope: IEthereumAccountScope,
        private $location: ng.ILocationService,
        private configurationService: ConfigurationService,
        private ethereumService: EthereumService) {
        $scope.vm = this;

        // The controller is constructed on application load. At that point we don't have the configuration yet.
        // So we can't connect; connections are manually started atm.
        //ethereumService.Connect();
    }

    connect() {
        this.ethereumService.connect();
        this.ensureWatch();
    }

    /**
     * Variable that indicates whether the main watch for pending changes has been configured.
     */
    private _watchConfigured: boolean;

    ensureWatch() {
        if (this._watchConfigured)
            return;

        if (!this.ethereumService.isActive())
            return;

        this.$scope.address = this.ethereumService.config.currentAddress;

        // For callback closure
        var s = this.$scope;
        var t = this;

        // 'pending' is called on load, pending transactions and blocks.
        web3.eth.watch('pending').changed(function () {
            // This code is called on any update from the Ethereum chain. Update 
            // the scope variables to reflect this.
            s.address = t.ethereumService.config.currentAddress;

            // Display address balance.
            // TODO: display nicely ("40 Ether", "981 Finney", etc)
            s.balance = web3.toDecimal(web3.eth.balanceAt(s.address));

            s.$apply();
        });

        this._watchConfigured = true;
    }

    isActive() {
        // Call ensureWatch to ensure update of the scope data even when connection is made in another place.
        this.ensureWatch();
        return this.ethereumService.isActive();
    }
}

interface IAccountScope extends ng.IScope {
    vm: UserAccountController;
    ethereumJsonRpcUrl: string;
}

/**
 * Controller for all things account-related. For example vault password, connected ledger accounts, 
 * etc.
 */
class UserAccountController {
    public static $inject = [
        "$scope",
        "$location",
        "configurationService",
        "identityService",
        "ethereumService"];

    constructor(
        private $scope: IAccountScope,
        private $location: ng.ILocationService,
        private configurationService: ConfigurationService,
        private identityService: IdentityService,
        private ethereumService: EthereumService) {
        $scope.vm = this;

        this.configurationService.load();

        this.$scope.ethereumJsonRpcUrl = this.configurationService.configuration.ethereum.jsonRpcUrl;
    }

    isAuthenticated(): boolean {
        return this.identityService.isAuthenticated();
    }

    isEnabled(ledgerId: string) {
        return true;
    }

    saveConfiguration() {
        this.configurationService.configuration.ethereum.jsonRpcUrl = this.$scope.ethereumJsonRpcUrl;
        this.configurationService.save();

        // TODO: give EthereumController / -Service a notification to connect.

        
    }
}


interface ISecureAssetScope extends ng.IScope {
    vm: SecureAssetController;
    assetID: string;
    asset: Asset;
    level: string;
    //securityPeg: SecurityPeg;
}

/**
 * Controller for securing an asset on one or more ledgers. The controller is ledger-agnostic
 * and delegates any specifics of the underlying ledgers to their specific controllers.
 */
class SecureAssetController {
    public static $inject = [
        "$scope",
        "$location",
        "$route",
        "$routeParams",
        "configurationService",
        "identityService",
        "assetsService",
        "ethereumService"];

    constructor(
        private $scope: ISecureAssetScope,
        private $location: ng.ILocationService,
        private $route: ng.route.IRouteProvider,
        private $routeParams: IAssetRouteParameters,
        private configurationService: ConfigurationService,
        private identityService: IdentityService,
        private assetsService: AssetsService,
        private ethereumService: EthereumService) {
        $scope.vm = this;
        $scope.assetID = $routeParams.id;

        assetsService.get($scope.assetID, function (resp) {
            $scope.asset = resp;
        });
    }

    /**
     * Returns whether the user has any security ledgers configured and active.
     */
    hasLedgers(): boolean {
        return this.ethereumService.isActive();
    }

    /**
     * Create a security peg for the asset. To be called from the view.
     */
    save() {
        // Currently the only security level we support is "premium".
        // TODO: support multiple security levels, storing data in different ways.
        if (this.$scope.level != "premium")
            return false;

        var t = this;

        if (this.ethereumService.ensureConnect()) {
            var asset = this.$scope.asset;

            // Check: do we have a SecurityPeg for the asset on this ledger already?
            if (asset.securedOn)
                for (var i = 0; i < asset.securedOn.securityPegs.length; i++) {
                    var peg = asset.securedOn.securityPegs[i];
                    if (peg.name.toLowerCase() == this.ethereumService._ledgerName) {
                        // Already secured on this ledger.

                        // Redirect to the new asset page. We don't need a second apply() here because we're not in a callback.
                        t.$location.path('/asset/' + this.$scope.asset.id);
                        return;
                    }
                }

            var savePeg = function (pegResp) {
                // TODO: handle errors from Ethereum. No ether, etc.
                // TODO: add notification that registering was completed.
                if (asset.securedOn == null)
                    asset.securedOn = new AssetSecurity();

                asset.securedOn.name = "Premium";
                if (asset.securedOn.securityPegs == null)
                    asset.securedOn.securityPegs = [];

                asset.securedOn.securityPegs.push(pegResp);
                t.assetsService.save(asset, function (assetResp) {
                    // TODO: handle any errors

                    // Redirect to the new asset page.
                    t.$location.path('/asset/' + assetResp.id);
                    t.$location.replace();
                });
            };

            // Check: already secured on this ledger?
            if (this.ethereumService.isSecured(asset)) {
                // Already secured.
                // TODO: show message
                var peg = this.ethereumService.getSecurityPeg(asset);

                savePeg(peg);
                return;
            }

            this.ethereumService.secureAsset(asset, function (peg) {
                savePeg(peg);
                // When changing location from a callback, scope has to be applied. When calling it 
                // synchronously, scope may NOT be applied, so we can't include it in savePeg(). Hence
                // include it here.
                t.$scope.$apply();
            });

        }
        else {
            // No connection
            // TODO: show error message.
        }



    }

}