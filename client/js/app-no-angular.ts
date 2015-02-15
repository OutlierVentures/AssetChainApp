/// <reference path="_all-references.ts" />

if (eth == null) {
    // if we're running outside of Ethereum, create stub object eth for code to still work.
    var eth: ethereum.eth = {
        toDecimal: function (s) { return 0; },
        toAscii: function (value) { return ""; },
        stateAt: function (contractAddress, stateAddress) {
            return "";
        },
        transact: function (parameters, callback) {

        },
        coinbase: "",
        key: "",
        secretToAddress: function (secret) {
            return "exampleAddress";
        },
        pad: function (dataString, length) { return ""; }
    }
}

function IsAdminUser(): boolean {
    return GetMyAddress() == eth.stateAt(contractAddress, "0");
}

function GetMyAddress(): string {
    return eth.secretToAddress(eth.key);
}

// Address for the assets contract. Update after (re-)creating the contract.
var contractAddress = "0x" + "6a75a18c0de9952a11ab66228d4ad9694651d22b";

// Extend the basic Number type with a pad() function for use with Ethereum contract interaction.
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
function GetPropertyAt(stateIndex: number): Asset {
    var p = new Asset();

    p.category = GetPropertyStateValue(stateIndex, 1);
    if (p.category == null)
        return null; // No property exists at this index.

    p.id = stateIndex.toString();
    p.name = eth.toAscii(GetPropertyStateValue(stateIndex, 4));
    //p.Comments = eth.toAscii(GetPropertyStateValue(stateIndex, 5));
    p.IsPendingClaim = ToBoolean(GetPropertyStateValue(stateIndex, 6));

    return p;
}


function SubmitNewClaim() {
    /** TODO: refactor. Introduce Angular **/
    var addressInput: HTMLInputElement = <HTMLInputElement> document.getElementById('street-address-input');
    var commentsInput: HTMLInputElement = <HTMLInputElement> document.getElementById('comments-input');

    var data = eth.pad("1", 32)
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
            // TODO: Save intermediate data; go to next step. 
            window.location.reload();
        })
}

