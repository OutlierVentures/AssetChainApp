var Asset = (function () {
    function Asset() {
        this.isPendingClaim = true;
    }
    return Asset;
})();
var AssetImage = (function () {
    function AssetImage() {
    }
    AssetImage.prototype.isLoaded = function () {
        if (this.dataUrl === undefined || this.dataUrl === null)
            return false;
        if (this.dataUrl.length < 5)
            return false;
        if (this.dataUrl.substr(0, 5) !== "data:")
            return false;
        return true;
    };
    return AssetImage;
})();
var AssetSecurity = (function () {
    function AssetSecurity() {
    }
    return AssetSecurity;
})();
var SecurityPeg = (function () {
    function SecurityPeg() {
    }
    return SecurityPeg;
})();
var ExpertCollection = (function () {
    function ExpertCollection() {
    }
    return ExpertCollection;
})();
var Expert = (function () {
    function Expert() {
    }
    return Expert;
})();
var Verification = (function () {
    function Verification() {
    }
    return Verification;
})();
var VerificationRequest = (function () {
    function VerificationRequest() {
    }
    return VerificationRequest;
})();
var TransferRequest = (function () {
    function TransferRequest() {
    }
    return TransferRequest;
})();
var EthereumConfiguration = (function () {
    function EthereumConfiguration() {
    }
    return EthereumConfiguration;
})();
var CoinPrismConfiguration = (function () {
    function CoinPrismConfiguration() {
    }
    return CoinPrismConfiguration;
})();
var DecerverConfiguration = (function () {
    function DecerverConfiguration() {
    }
    DecerverConfiguration.prototype.apiUrl = function () {
        return this.baseUrl + "/apis/assetchain";
    };
    return DecerverConfiguration;
})();
var Configuration = (function () {
    function Configuration() {
        this.ethereum = new EthereumConfiguration();
        this.coinPrism = new CoinPrismConfiguration();
        this.decerver = new DecerverConfiguration();
    }
    return Configuration;
})();
var Credentials = (function () {
    function Credentials() {
    }
    return Credentials;
})();
var MenuItem = (function () {
    function MenuItem() {
    }
    return MenuItem;
})();
var Notification = (function () {
    function Notification() {
    }
    return Notification;
})();
//# sourceMappingURL=models.js.map