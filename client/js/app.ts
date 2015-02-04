/// <reference path="_all-references.ts" />

module AssetChain {
    'use strict';

    var assetChainApp = angular.module('assetChainApp', ['ngResource', 'ngRoute'])
        .controller('NavigationController', NavigationController)

    assetChainApp.config(function ($routeProvider, $locationProvider) {
        $routeProvider
            .when('/', { controller: AssetListController, templateUrl: 'partials/asset-list.html' })
            .when('/asset/list', { controller: AssetListController, templateUrl: 'partials/asset-list.html' })
            .when('/asset/register', { controller: RegisterAssetController, templateUrl: '/partials/register-asset.html' })
            .when('/not-found', { templateUrl: '/partials/not-found.html' })
            .otherwise({ redirectTo: 'not-found' })
        $locationProvider.html5Mode(false)
    })

    // TODO: implement connection to backend
    assetChainApp.factory('AssetsService', function ($resource) {
        return $resource('/api/assets/:id', { id: '@id' }, { update: { method: 'PUT' } })
    })

}