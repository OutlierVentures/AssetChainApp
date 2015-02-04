/// <reference path="_all-references.ts" />

// The map UX component
var map: google.maps.Map;

var AllPropertiesMap: google.maps.Map;
var MyPropertiesMap: google.maps.Map;

var NewClaimMarker: google.maps.Marker;

function IsAdminUser(): boolean {
    return GetMyAddress() == eth.stateAt(contractAddress, "0");
}

function GetMyAddress(): string {
    return eth.secretToAddress(eth.key);
}

// The multiplication factor for lat/long values in the contract. 
// E.g. lat 52.123456 is stored as 52123456.

var LatLongDecimals = 6;

var LatLongStorageFactor: number = Math.pow(10, LatLongDecimals);

// Address for the properties contract. Update after (re-)creating the contract.
var contractAddress = "0x" + "6a75a18c0de9952a11ab66228d4ad9694651d22b";

function InitializeUserExperience() {
    console.log("Coinbase: " + eth.coinbase);
    console.log("Key: " + eth.key);
    console.log("My address: " + eth.secretToAddress(eth.key));

    // TODO: refactor. If introducing AngularJS, split in separate views so this kind of hiding/showing
    // is unneccesary.
    var pageHeader = document.getElementById('page-header');
    var myProperties = document.getElementById('my-properties');
    var linkMyAssets = document.getElementById('my-assets-link');
    var linkNewClaim = document.getElementById('register-asset-link');
    var linkVerifyAsset = document.getElementById('verify-asset-link');
    var linkTransferAsset = document.getElementById('transfer-asset-link');
    //var linkAllProperties = document.getElementById('all-properties-link');
    //var allProperties = document.getElementById('all-properties');
    var panelNewClaim = document.getElementById('new-claim-form');

    DisplayElement(myProperties, !IsAdminUser());
    //DisplayElement(allProperties, IsAdminUser());
    //DisplayElement(linkAllProperties, IsAdminUser());
    DisplayElement(linkMyAssets, !IsAdminUser());
    DisplayElement(linkNewClaim, !IsAdminUser());

    // New claim panel always hidden at first
    DisplayElement(panelNewClaim, false);

    if (IsAdminUser()) {
        pageHeader.innerHTML = "All properties";
    }
    else {
        pageHeader.innerHTML = "My properties";
    }
}

function DisplayElement(element: HTMLElement, show: boolean) {
    if (element == null)
        throw new Error("element is null");

    if (!show) {
        element.style.display = "none";
    }
    else {
        element.style.display = "block";
    }
}

function initializeMyPropertiesMap() {
    var amsterdam = new google.maps.LatLng(52.371257, 4.895190);

    var mapOptions: google.maps.MapOptions = {
        center: amsterdam,
        zoom: 14,
    };

    MyPropertiesMap = new google.maps.Map(document.getElementById('single-property-map'), mapOptions);
    map = MyPropertiesMap;

    // Add marker on click
    google.maps.event.addListener(map, 'click', function (event) {
        SetNewClaimFormLatLng(event.latLng);
    });
}

function initializeAllPropertiesMap() {
    // TODO: refactor, unify with initializeMyProperties()
    var amsterdam = new google.maps.LatLng(52.371257, 4.895190);

    var mapOptions: google.maps.MapOptions = {
        center: amsterdam,
        zoom: 14,
    };

    AllPropertiesMap = new google.maps.Map(document.getElementById('all-properties-map'), mapOptions);
    map = AllPropertiesMap;
}

function AddMarker(pos: google.maps.LatLng, title: string = null): google.maps.Marker {
    var marker = new google.maps.Marker({
        position: pos,
        map: map,
        title: title,
    });

    return marker;
}

/**
 * Class representing a (pending) claimed property.
 */
class Property {
    OwnerAddress: string;
    Index: number;
    Latitude: number;
    Longitude: number;
    StreetAddress: string;
    Comments: string;
    IsPendingClaim: boolean = true;

    MapMarker: google.maps.Marker;
    
    /**
     * Add a marker for this property on the specified map.
     * Returns: the marker.
     */
    AddMarker(onMap: google.maps.Map) : google.maps.Marker{
        // TODO: give pending claims a different color than approved ones.
        this.MapMarker = AddMarker(new google.maps.LatLng(this.Latitude, this.Longitude),
            this.StreetAddress);

        // Prepare the info window that will show up when clicking on the marker.
        var infoContent = "<p>Address: " + this.StreetAddress + "</p><p>Claimed owner: " + this.OwnerAddress + "</p>";
        if (this.Comments != "") infoContent += "<p>Comments:<br>" + this.Comments + "</p>";
        if (this.IsPendingClaim) infoContent += "<p><strong>This claim is pending.</strong></p>";

        var infoWindow = new google.maps.InfoWindow({
            content: infoContent,
        });

        // Create a local variable for the instance variable, because the inline function for
        // the click handler below cannot access the instance variable.
        var m = this.MapMarker;

        google.maps.event.addListener(this.MapMarker, 'click', function () {
            infoWindow.open(map, m);
        });

        return m;
    }

    /**
     * Approves this claim. Should be called by the registry administrator. If a normal
     * user calls it, the transaction will just fail. It should be prevented however as the
     * transaction will cost gas.
     */
    Approve() {
        // TODO: implement in the contract.
        // TODO: move the contract operations to constants
        var data = eth.pad("2", 32)
            + eth.pad(this.Index.toString(), 32)
        ;

        eth.transact({
            from: eth.key,
            value: 0,
            to: contractAddress,
            data: data,
            gas: 5000,
            gasPrice: 100000
        }, function () {
                alert("The claim was approved.");
                window.location.reload();
            })

    }
}

// Extend the basic Number type with a pad() function.
interface Number {
    pad(size: number): string;
}

Number.prototype.pad = function (size) {
    var s = String(this);
    while (s.length < (size || 2)) { s = "0" + s; }
    return s;
}

function GetPropertyStateValue(propertyIndex: number, valueIndex: number): string {
    var baseAddress: string;
    var n: Number;
    baseAddress = "0x" + propertyIndex.pad(20);
    return eth.stateAt(contractAddress, baseAddress + valueIndex.pad(20))
}

function ToBoolean(contractStateValue: string): boolean {
    if (eth.toDecimal(contractStateValue) == 1) return true;
    return false;
}

/**
 * Gets the property at the specified index as a Property object. If no property
 * exists at the specified index, null is returned.
 */
function GetPropertyAt(stateIndex: number): Property {
    var p = new Property();

    p.OwnerAddress = GetPropertyStateValue(stateIndex, 1);
    if (p.OwnerAddress == null)
        return null; // No property exists at this index.

    p.Index = stateIndex;
    p.Latitude = eth.toDecimal(GetPropertyStateValue(stateIndex, 2)) / LatLongStorageFactor;
    p.Longitude = eth.toDecimal(GetPropertyStateValue(stateIndex, 3)) / LatLongStorageFactor;
    p.StreetAddress = eth.toAscii(GetPropertyStateValue(stateIndex, 4));
    p.Comments = eth.toAscii(GetPropertyStateValue(stateIndex, 5));
    p.IsPendingClaim = ToBoolean(GetPropertyStateValue(stateIndex, 6));

    return p;
}

/**
 * Add a marker for all properties in the contract to the map.
 */
function ShowAllProperties() {
    var numProperties: number = eth.toDecimal(eth.stateAt(contractAddress, "1"));
    for (var i = 1; i <= numProperties; i++) {
        var p: Property;
        p = GetPropertyAt(i);
        p.AddMarker(map);
    }
}

function ShowNewClaimForm() {
    DisplayElementByID('new-claim-form', true);
    // Keep the map, we want to use it for clicking
    //DisplayElementByID('my-properties', false);
}

function DisplayElementByID(id: string, show: boolean) {
    var element = document.getElementById(id);
    DisplayElement(element, show);
}

function SetNewClaimFormLatLng(latLng: google.maps.LatLng) {
    if (NewClaimMarker == null)
        NewClaimMarker = AddMarker(latLng, "Your new claim");
    else
        NewClaimMarker.setPosition(latLng);

    var latInput: HTMLInputElement = <HTMLInputElement> document.getElementById('latitude');
    latInput.value = latLng.lat().toString();
    var longInput: HTMLInputElement = <HTMLInputElement> document.getElementById('longitude');
    longInput.value = latLng.lng().toString();
}

/**
 * Convert a lat or long value specified as a decimal string to one as we use it (no
 * decimal point, multiplied by 10^6).
 * Example: "53.123456789" => "53123456"
 */
function LatFloatStringToEthValue(latOrLongValue: string): string {
    // First parse it into a float so we can distinguish the decimals
    var floatVal = parseFloat(latOrLongValue);
    // Convert to string with fixed decimals, and remove the decimal point.
    var stringVal = floatVal.toFixed(LatLongDecimals).replace(".", "");
    return stringVal;
}

function SubmitNewClaim() {
    /** TODO: refactor. Introduce Angular **/
    var latInput: HTMLInputElement = <HTMLInputElement> document.getElementById('latitude');
    var longInput: HTMLInputElement = <HTMLInputElement> document.getElementById('longitude');
    var addressInput: HTMLInputElement = <HTMLInputElement> document.getElementById('street-address-input');
    var commentsInput: HTMLInputElement = <HTMLInputElement> document.getElementById('comments-input');

    var latString = LatFloatStringToEthValue(latInput.value);
    var longString = LatFloatStringToEthValue(longInput.value);

    var data = eth.pad("1", 32)
        + eth.pad(latString, 32)
        + eth.pad(longString, 32)
        + eth.pad(addressInput.value, 32)
        + eth.pad(commentsInput.value, 32)
    ;

    console.log("Transaction data: " + data);
    eth.transact({
        from: eth.key,
        value: 0,
        to: contractAddress,
        data: data,
        gas: 5000,
        gasPrice: 100000
    }, function () {
            alert("Your claim for address '" + addressInput.value + "' was submitted.");
            // Because mining takes a couple of seconds, the refresh is usually too soon to load
            // the newly created claim. Could add some waiting period. Or better: check whether
            // the transaction was actually processed. Can we do that with the eth object?
            // Probably. Either with a watch, or by checking the block number on a timer. If 
            // the block number increased, that should usually mean that our transaction has been
            // processed.
            window.location.reload();
        })
}

window.onload = () => {
    InitializeUserExperience();

    //if (IsAdminUser())
    //    initializeAllPropertiesMap();
    //else
    //    initializeMyPropertiesMap();

    // TODO: handle "my properties" to show only properties of the user.
    // TODO: introduce AngularJS, split everything up in views and controllers
    // ... or keep it out to reduce dependencies
    //ShowAllProperties();
}

