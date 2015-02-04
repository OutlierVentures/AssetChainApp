
function DashboardController($scope, $location, $http, $routeParams, AssetsService) {

}

function AssetListController($scope, $location, $http, $routeParams, AssetsService) {
    // TODO: get from backend
    $scope.assets = [
        {
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
            name: "Diamond 1ct",
            category: "Jewelry/Precious stones",
        }
    ];
}