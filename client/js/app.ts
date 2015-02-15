/// <reference path="_all-references.ts" />

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

    /**
     * Ensure that initial data is loaded.
     */
    ensureAssets(): void {
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
                }
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
                verifications: [
                    {
                        name: "Watches of Switzerland",
                        address: "61 Brompton Road, London, London, SW3 1B, United Kingdom",
                        date: '2015-01-13 15:34',
                    }
                ]

            },
            {
                id: "4",
                name: "Diamond 1ct",
                category: "Jewelry/Precious stones",
                comments: null,
                IsPendingClaim: false,
            }
        ];
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
    save(asset: Asset, cb) {
        if (asset.id === undefined)
            this.create(asset, cb);
        else
            this.update(asset, cb);
    }

    create(asset: Asset, cb) {
        asset.id = guid();
        this.assets.push(asset)
        cb({ content: asset });
    }

    update(updatedAsset: Asset, cb) {
        var currentAsset = _(this.assets).find(function (asset: Asset) { return asset.id === updatedAsset.id });
        currentAsset = _(currentAsset).extend(updatedAsset);
        cb({ content: updatedAsset });
    }
}

module AssetChain {
    'use strict';

    var assetChainApp = angular.module('assetChainApp', ['ngResource', 'ngRoute', 'ngSanitize', 'angularMoment'])
        .controller('NavigationController', NavigationController)
        .controller('NotificationController', NotificationController)

    assetChainApp.config(function ($routeProvider: ng.route.IRouteProvider, $locationProvider: ng.ILocationProvider) {
        $routeProvider
            .when('/', { controller: AssetListController, templateUrl: 'views/asset-list.html' })
            .when('/asset/list', { controller: AssetListController, templateUrl: 'views/asset-list.html' })
            .when('/asset/register', { controller: RegisterAssetController, templateUrl: '/views/register-asset.html' })
            .when('/asset/:id', { controller: SingleAssetController, templateUrl: '/views/asset-details.html' })
            .when('/transfer/:id', { controller: TransferAssetController, templateUrl: '/views/transfer-asset.html' })
            .when('/verify/expert/:id', { controller: ExpertVerificationController, templateUrl: '/views/verify-expert.html' })
            .when('/user/notifications', { controller: NotificationController, templateUrl: '/views/notifications.html' })
            .when('/not-found', { templateUrl: '/views/not-found.html' })
            .otherwise({ redirectTo: 'not-found' })
        $locationProvider.html5Mode(false)
    })

    // Note: the string name provided to angular has to match the parameter names as used in the controllers,
    // case-sensitive. E.g. we can't use 'AssetsService' here and use 'assetsService' in the controllers.
    assetChainApp.service('assetsService', AssetsService);
}


var guid = (function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return function () {
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    };
})();

/**
 * Class representing an asset (to be) registered on AssetChain.
 */
class Asset {
    id: string;
    name: string;
    category: string;
    comments: string;
    IsPendingClaim: boolean = true;
}
