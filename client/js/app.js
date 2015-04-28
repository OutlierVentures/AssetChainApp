var CryptoJS;
var web3;
function guid(skipDashes) {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    var separator = "";
    if (!skipDashes)
        separator = '-';
    return s4() + s4() + separator + s4() + separator + s4() + separator + s4() + separator + s4() + s4() + s4();
}
;
var AssetChain;
(function (AssetChain) {
    'use strict';
    var assetChainApp = angular.module('assetChainApp', ['ngResource', 'ngRoute', 'ngSanitize', 'angularMoment', 'flow']).controller('NavigationController', NavigationController).controller('NotificationController', NotificationController).controller('LoginController', LoginController).controller('EthereumAccountController', EthereumAccountController).controller('SecureAssetController', SecureAssetController).controller('UserAccountController', UserAccountController);
    assetChainApp.config(function ($routeProvider, $locationProvider) {
        $routeProvider.when('/', { controller: AssetListController, templateUrl: 'views/asset-list.html' }).when('/asset/list', { controller: AssetListController, templateUrl: 'views/asset-list.html' }).when('/asset/register', { controller: RegisterAssetController, templateUrl: 'views/register-asset.html' }).when('/asset/:id', { controller: SingleAssetController, templateUrl: 'views/asset-details.html' }).when('/transfer/create', { controller: TransferRequestController, templateUrl: 'views/transfer-request-start.html' }).when('/transfer/process/:assetID/:requesterAddress', { controller: TransferRequestController, templateUrl: 'views/transfer-request-process.html' }).when('/verify/expert/:id', { controller: ExpertVerificationController, templateUrl: 'views/verify-expert.html' }).when('/secure/:id', { controller: SecureAssetController, templateUrl: 'views/secure-asset-start.html' }).when('/verify/expert/:id/:verificationID', { controller: ExpertVerificationController, templateUrl: 'views/verify-expert-step2.html' }).when('/verify/ownership/:id', { controller: OwnershipVerificationController, templateUrl: 'views/verify-ownership.html' }).when('/user/notifications', { controller: NotificationController, templateUrl: 'views/notifications.html' }).when('/user/settings/accounts', { controller: UserAccountController, templateUrl: 'views/account-list.html' }).when('/user/profile', { controller: UserAccountController, templateUrl: 'views/user-profile.html' }).when('/not-found', { templateUrl: 'views/not-found.html' }).otherwise({ redirectTo: 'not-found' });
        $locationProvider.html5Mode(false);
    });
    assetChainApp.service('identityService', IdentityService);
    assetChainApp.service('assetsService', AssetsService);
    assetChainApp.service('expertsService', ExpertsService);
    assetChainApp.service('configurationService', ConfigurationService);
    assetChainApp.service('ethereumService', EthereumService);
})(AssetChain || (AssetChain = {}));
function angularGetService(serviceName) {
    return angular.element(document.querySelector('.ng-scope')).injector().get(serviceName);
}
//# sourceMappingURL=app.js.map