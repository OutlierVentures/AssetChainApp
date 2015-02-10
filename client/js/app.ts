/// <reference path="_all-references.ts" />

module AssetChain {
    'use strict';

    var assetChainApp = angular.module('assetChainApp', ['ngResource', 'ngRoute', 'ngSanitize', 'angularMoment'])
        .controller('NavigationController', NavigationController)
        .controller('NotificationController', NotificationController)

    assetChainApp.config(function ($routeProvider, $locationProvider) {
        $routeProvider
            .when('/', { controller: AssetListController, templateUrl: 'views/asset-list.html' })
            .when('/asset/list', { controller: AssetListController, templateUrl: 'views/asset-list.html' })
            .when('/asset/register', { controller: RegisterAssetController, templateUrl: '/views/register-asset.html' })
            .when('/asset/:id', { controller: SingleAssetController, templateUrl: '/views/asset-details.html' })
            .when('/user/notifications', { controller: NotificationController, templateUrl: '/views/notifications.html' })
            .when('/not-found', { templateUrl: '/views/not-found.html' })
            .otherwise({ redirectTo: 'not-found' })
        $locationProvider.html5Mode(false)
    })

    // TODO: implement connection to backend
    assetChainApp.service('AssetsService', function () {
        var assets;

        this.ensureAssets = function () {
            if (assets != null)
                return;
            // Initialize with dummy data.
            // TODO: get from server-side storage if available, cached in local storage.
            assets = [
                {
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
                    id: "4",
                    name: "Diamond 1ct",
                    category: "Jewelry/Precious stones",
                }
            ];
        };

        /**
         * Get all assets for the user
         */
        this.getAll = function () {
            this.ensureAssets();
            return assets;
        };

        /**
         * Get a specific asset by ID.
         * cb: a callback taking a response object. The return value is in property "content" like $resource.
         */
        this.get = function (params, cb) {
            this.ensureAssets();

            // TODO: replace by $resource.
            cb({
                content: _(assets).find(function (asset) {
                    return asset.id === params["id"]
                })
            });
        }
    });

}