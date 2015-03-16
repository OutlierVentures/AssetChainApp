class Credentials {
    password: string;
}

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
            return identityService.IsAuthenticated();
        }

        $scope.login = function () {
            // TODO: move to IsValidPassword function, check whether it's a valid wallet password (mnemonic)
            if ($scope.credentials.password == null || $scope.credentials.password.length < 20)
                return;

            var provider = new AssetChainIdentityProvider();

            provider.SetPassword($scope.credentials.password);
            identityService.Logon(provider);
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
    verificationID: string;
}

interface IVerificationScope extends ng.IScope {
    AssetID: string;
    VerificationID: string;
    Asset: Asset;
    // TODO: define classes for experts and a dictionary of them.
    ExpertsByLocation: any;
    Location: ng.ILocationService;
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
        private $routeParams: IAssetRouteParameters,
        private assetsService: AssetsService,
        private expertsService: ExpertsService) {
        $scope.AssetID = $routeParams.id;
        $scope.VerificationID = $routeParams.verificationID;
        $scope.vm = this;
        $scope.Location = $location;

        assetsService.get($scope.AssetID, function (resp) {
            $scope.Asset = resp;

            if ($scope.VerificationID != null) {
                // Load the verification we worked on in an earlier step.
                var verificationsWithId = _($scope.Asset.Verifications).select(v => v.id == $scope.VerificationID);
                $scope.verification = verificationsWithId[0];
            }

            $scope.ExpertsByLocation = expertsService.GetExperts("London", $scope.Asset.category);
        });
    }

    Save() {
        // Provide the callback below access to the scope.
        // TODO: refactor.
        var s = this.$scope;

        this.assetsService.save(this.$scope.Asset, function (resp) {
            if (s.Location.path() == "/verify/expert/" + s.AssetID) {
                // Step 1
                s.verification.id = guid();
                s.verification.date = moment().toISOString();
                s.verification.IsPending = true;
                if (s.Asset.Verifications == null)
                    s.Asset.Verifications = [];
                s.Asset.Verifications.push(s.verification);
                s.Location.path("/verify/expert/" + s.AssetID + "/" + s.verification.id);
            } else {
                // Step 2
                // Finished.
                // TODO: show "finished" message.
                // TODO: add item to notifications.
                
                s.Location.path("/");
            }
        });
    }
}

function OwnershipVerificationController($scope, $location, $http, $routeParams, assetsService: AssetsService, expertsService: ExpertsService) {
    var asset_id = $routeParams.id;

    assetsService.get(asset_id, function (resp) {
        $scope.asset = resp;

        $scope.expertsByLocation = expertsService.GetExperts("London", $scope.asset.category);
    });
}

function TransferAssetController($scope, $location, $http, $routeParams, assetsService: AssetsService) {
    var asset_id = $routeParams.id;
    assetsService.get(asset_id, function (resp) {
        $scope.asset = resp;
    });
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
        return identityService.IsAuthenticated();
    }
}

function SingleAssetController($scope, $location, $http, $routeParams, assetsService: AssetsService) {
    var asset_id = $routeParams.id;
    assetsService.get(asset_id, function (resp) {
        $scope.asset = resp;
    });
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
                $scope.$apply();
            });
        }, 5000);
    }
}


function IdentityController($scope, identityService: IdentityService) {

}

/**
 * Controller for the navigation bars.
 */
function NavigationController($scope, $location, $http, $routeParams, assetsService: AssetsService, identityService: IdentityService) {
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
            name: "Verify assets",
            url: "verify",
            icon: "check",
        },
        {
            name: "Transfer assets",
            url: "transfer",
            icon: "mail-forward",
        },
    ];

    $scope.isAuthenticated = function (): boolean {
        return identityService.IsAuthenticated();
    }
}

class Notification {
    title: string;
    date: string;
    details: string;
    url: string;
    icon: string;
    seen: boolean;
}

interface NotificationScope {
    notifications: Notification[];
    latestNotifications: Notification[];
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
    Address: string;
    Balance: string;
}


class EthereumAccountController {
    public static $inject = [
        "$scope",
        "$location"];

    constructor(
        private $scope: IEthereumAccountScope,
        private $location: ng.ILocationService) {
        $scope.vm = this;

        this.Connect();
    }

    Connect() {
        // We'll be using JSON-RPC to talk to eth.
        //var rpcUrl = getUrlParameterByName("jsonRpcUrl");
        var rpcUrl;

        if (rpcUrl == null) {
            // AlethZero local
            //web3.setProvider(new web3.providers.HttpSyncProvider('http://localhost:8080'));
            // go-ethereum in VM
            //web3.setProvider(new web3.providers.HttpSyncProvider('http://192.168.1.47:8081'));
            // cpp-ethereum in VM
            //rpcUrl = "http://192.168.1.40:8082";
            // Virtualbox, NAT / port forwarding
            // Node 1
            //rpcUrl = "http://192.168.56.101:8081";
            // Node 2
            rpcUrl = "http://192.168.56.102:8082";
        }

        web3.setProvider(new web3.providers.HttpSyncProvider(rpcUrl));

        try {
            this.$scope.Address = web3.eth.coinbase;
            this._IsActive = true;
        }
        catch (e) {
            console.log("Exception while trying to connect to Ethereum node: " + e);
        }

        if (this._IsActive) {
            // For callback closure
            var s = this.$scope;

            // 'pending' is called on load, pending transactions and blocks.
            web3.eth.watch('pending').changed(function () {
                // Some update from the Ethereum chain. Update the scope variables
                // to reflect this.
                s.Address = web3.eth.coinbase;

                // Display address balance.
                // TODO: display nicely ("40 Ether", "981 Finney", etc)
                s.Balance = web3.toDecimal(web3.eth.balanceAt(s.Address));

                s.$apply();
            });
        }
    }

    _IsActive: boolean;

    IsActive(): boolean {
        return this._IsActive;
    }
}

interface IAccountScope extends ng.IScope {
    vm: UserAccountController;
}

/**
 * Controller for all things account-related. For example vault password, connected ledger accounts, 
 * etc.
 */
class UserAccountController {
    public static $inject = [
        "$scope",
        "$location",
        "$routeParams",
        "assetsService",
        "expertsService"];

    constructor(
        private $scope: IAccountScope,
        private $location: ng.ILocationService) {
        $scope.vm = this;
    }

}
