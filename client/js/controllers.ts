
function DashboardController($scope, $location, $http, $routeParams, AssetsService) {

}

function AssetListController($scope, $location, $http, $routeParams, AssetsService) {
    // Local example data.
    // TODO: get from backend
    $scope.assets = [
        {
            id: 3,
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
            }
        },
        {
            id: 2,
            name: "Rolex Submariner for Cartier",
            category: "Jewelry/Watch",
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
            }
        },
        {
            id: 4,
            name: "Diamond 1ct",
            category: "Jewelry/Precious stones",
        }
    ];
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
            url: "asset/verify",
            icon: "check",
        },
        {
            name: "Transfer assets",
            url: "asset/transfer",
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