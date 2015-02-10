
function DashboardController($scope, $location, $http, $routeParams, AssetsService) {

}

function AssetListController($scope, $location, $http, $routeParams, AssetsService) {
    $scope.assets = AssetsService.getAll();
}

function SingleAssetController($scope, $location, $http, $routeParams, AssetsService) {
    var asset_id = $routeParams.id;
    AssetsService.get({ id: asset_id }, function (resp) {
        $scope.asset = resp.content;
    });
}

function RegisterAssetController() {
}

/**
 * Controller for the navigation bar (top and left).
 */
function NavigationController($scope, $location, $http, $routeParams, AssetsService) {
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
}


function NotificationController($scope, $location, $http, $routeParams, AssetsService) {
    var exampleDate: string;
    // Use a recent date to test moment display ("... minutes ago")
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
            icon: "home",
        },
    ];

    $scope.latestNotifications = $scope.notifications.slice(0, 3);
}