/// <reference path="_all-references.ts" />

module AssetChain {
    'use strict';

    var assetChainApp = angular.module('assetChainApp', ['ngResource', 'ngRoute', 'ngSanitize', 'angularMoment' ])
        .controller('NavigationController', NavigationController)
        .controller('NotificationController', NotificationController)

    assetChainApp.config(function ($routeProvider, $locationProvider) {
        $routeProvider
            .when('/', { controller: AssetListController, templateUrl: 'views/asset-list.html' })
            .when('/asset/list', { controller: AssetListController, templateUrl: 'views/asset-list.html' })
            .when('/asset/register', { controller: RegisterAssetController, templateUrl: '/views/register-asset.html' })
            .when('/user/notifications', { controller: NotificationController, templateUrl: '/views/notifications.html' })
            .when('/not-found', { templateUrl: '/views/not-found.html' })
            .otherwise({ redirectTo: 'not-found' })
        $locationProvider.html5Mode(false)
    })

    // TODO: implement connection to backend
    assetChainApp.factory('AssetsService', function ($resource) {
        return $resource('/api/assets/:id', { id: '@id' }, { update: { method: 'PUT' } })
    })

}