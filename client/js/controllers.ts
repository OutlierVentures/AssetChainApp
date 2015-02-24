
function LoginController($scope, $route, $location, $http, $routeParams, assetsService: AssetsService, identityService: IdentityService) {

    $scope.isAuthenticated = function (): boolean {
        return identityService.IsAuthenticated();
    }

    $scope.login = function () {
        var provider = new AssetChainIdentityProvider();
        
        // TODO: check whether it's a valid wallet password (mnemonic)
        provider.SetPassword($scope.credentials.password);
        identityService.Logon(provider);
        $route.reload();
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

function RegisterAssetController($scope, $location, $http, $routeParams, assetsService: AssetsService) {
    $scope.save = function () {
        assetsService.save($scope.asset, function (resp) {
            // Redirect to the new asset page.
            $location.path('/asset/' + resp.id);
        });

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