/// <reference path="_all-references.ts" />

var CryptoJS;


// For lack of a complete type definition, stub type definitions so we can call web3 functions from TypeScript 
// without compile errors.
// TODO: make more complete and move to eth.d.ts.
interface web3 {
    eth: any;

    toDecimal(value: string): string;
    toAscii(value: string): string;

    setProvider: any;
    providers: any;
}

var web3: web3;

// Generate a guid.
// TODO: move this to some general toolbox.
// TODO: make it possible to call without parameter or with it.
function guid(skipDashes: boolean) {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    var separator = "";
    if (!skipDashes)
        separator = '-';

    return s4() + s4() + separator + s4() + separator + s4() + separator +
        s4() + separator + s4() + s4() + s4();
};


interface AssetChainRootScope extends ng.IRootScopeService {
    isLoggedIn: boolean;
}

module AssetChain {
    'use strict';

    // All controllers are registered here.
    var assetChainApp = angular.module('assetChainApp', ['ngResource', 'ngRoute', 'ngSanitize', 'angularMoment', 'flow'])
        .controller('NavigationController', NavigationController)
        .controller('NotificationController', NotificationController)
        .controller('LoginController', LoginController)
        .controller('EthereumAccountController', EthereumAccountController)
        .controller('SecureAssetController', SecureAssetController)
        .controller('UserAccountController', UserAccountController)

    assetChainApp.config(function ($routeProvider: ng.route.IRouteProvider, $locationProvider: ng.ILocationProvider) {
        $routeProvider
            .when('/', { controller: AssetListController, templateUrl: 'views/asset-list.html' })
            .when('/asset/list', { controller: AssetListController, templateUrl: 'views/asset-list.html' })
            .when('/asset/register', { controller: RegisterAssetController, templateUrl: '/views/register-asset.html' })
            .when('/asset/:id', { controller: SingleAssetController, templateUrl: '/views/asset-details.html' })
            .when('/transfer/create', { controller: TransferRequestController, templateUrl: '/views/transfer-request-start.html' })
            .when('/transfer/process/:assetID/:requesterAddress', { controller: TransferRequestController, templateUrl: '/views/transfer-request-process.html' })
            .when('/verify/expert/:id', { controller: ExpertVerificationController, templateUrl: '/views/verify-expert.html' })
            .when('/secure/:id', { controller: SecureAssetController, templateUrl: '/views/secure-asset-start.html' })
            .when('/verify/expert/:id/:verificationID', { controller: ExpertVerificationController, templateUrl: '/views/verify-expert-step2.html' })
            .when('/verify/ownership/:id', { controller: OwnershipVerificationController, templateUrl: '/views/verify-ownership.html' })
            .when('/user/notifications', { controller: NotificationController, templateUrl: '/views/notifications.html' })
            .when('/user/settings/accounts', { controller: UserAccountController, templateUrl: '/views/account-list.html' })
            .when('/not-found', { templateUrl: '/views/not-found.html' })
            .otherwise({ redirectTo: 'not-found' })
        $locationProvider.html5Mode(false)
    })

    // Note: the string name provided to angular has to match the parameter names as used in the controllers,
    // case-sensitive. E.g. we can't use 'AssetsService' here and use 'assetsService' in the controllers.
    assetChainApp.service('identityService', IdentityService);
    assetChainApp.service('assetsService', AssetsService);
    assetChainApp.service('expertsService', ExpertsService);
    assetChainApp.service('configurationService', ConfigurationService);
    assetChainApp.service('ethereumService', EthereumService);
}

/**
 * Shorthand method for getting an Angular service from the debug console.
 */
function angularGetService(serviceName: string) {
    return angular.element(document.querySelector('.ng-scope')).injector().get(serviceName);
}