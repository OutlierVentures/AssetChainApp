/// <reference path="_all-references.ts" />

module AssetChain {
    'use strict';

    var assetChainApp = angular.module('assetChainApp', ['ngResource', 'ngRoute'])

    assetChainApp.config(function ($routeProvider, $locationProvider) {
        $routeProvider
            .when('/', { controller: AssetListController, templateUrl: 'partials/asset-list.html?1' })
        //.when('/page/:pageNum', { controller: ListCtrl, templateUrl: '/partials/list.html' })
        //.when('/edit/:id', { controller: EditCtrl, templateUrl: '/partials/details.html' })
        //.when('/new', { controller: CreateCtrl, templateUrl: '/partials/details.html' })
            .otherwise({ redirectTo: '/' })
        $locationProvider.html5Mode(true)
    })

    // TODO: implement
    assetChainApp.factory('AssetsService', function ($resource) {
        return $resource('/api/assets/:id', { id: '@id' }, { update: { method: 'PUT' } })
    })

    //AssetChainApp.directive('formfield', function () {
    //    return {
    //        restrict: 'E', //could be E, A, C (class), M (comment)
    //        scope: {
    //            prop: '@'
    //            , data: '=ngModel'
    //        },
    //        templateUrl: 'formfield.html',
    //    }
    //})

    //AssetChainApp.directive('formfield2', function () {
    //    return {
    //        restrict: 'E', //could be E, A, C (class), M (comment)
    //        scope: {
    //            prop: '@'
    //        },
    //        transclude: true,
    //        templateUrl: 'formfield2.html',
    //        replace: true
    //    }
    //})

    //AssetChainApp.directive('paginator', function () {
    //    return {
    //        restrict: 'E', //could be E, A, C (class), M (comment)
    //        scope: {
    //            numpages: '@',
    //            loadfn: '&'
    //        },
    //        templateUrl: 'paginator.html',
    //    }
    //})

}