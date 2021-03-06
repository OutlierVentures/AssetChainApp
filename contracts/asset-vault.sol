﻿contract AssetVault {
    // TODO: update to recent Solidity developments
    // - replace string32 by bytes32
    // - replace mappings with counter by arrays as much as possible
    // - (if possible) replace clumsy "find this or that" logic by functions, for
    //  example getAsset(assetID).

    // Data structure to hold information about a single asset.
    struct Asset {
        // Unique AssetChain ID as used in cryptoledgers where it has been registered.
        string32 id;
        // Descriptive name of the asset.
        // Could be removed once this is purely used as a secure data store.
        string32 name;

        // List of verifications confirmed for this asset.
        mapping (uint => Verification) verifications;
        // Counter for access to the mapping.
        uint verificationCount;
    }

    // Collection of assets and their count, to be used for one individual owner.
    struct AssetCollection {
        mapping (uint => Asset) assets;
        uint assetCount;
    }

    struct Verification {
        // The user who verified the asset.
        address verifier;
        
        // 1 = ownership
        // 2 = quality
        // ...
        uint type;

        // Whether the verification has been confirmed. Set to true after processing the verification.
        bool isConfirmed;
        
        // Further data could include date of verification, state of the asset as it was at that point,
        // etc. However these can all be retracted from the blockchain, assuming we can read the 
        // contract storage history.
    }

    // The collection that stores all assets by owner address.
    mapping (address => AssetCollection) public assetsByOwner;

    // Mapping from owner address to asset ID, to ensure that assets have only one owner.
    mapping (string32 => address) public ownerByAssetID;

    // List of all owners, for iteration.
    // TODO: replace by array so OwnerCount can be removed.
    mapping (uint => address) public owners;

    // Total owners stored in Owners, for iteration.
    uint public ownerCount;

    struct TransferRequest{
        // TODO: add request date / block height so they can expire
        string32 assetID;
        address requester;
    }

    // Collection of requests for transfer
    mapping (uint => TransferRequest) public transferRequests;
    uint public transferRequestCount;

    // Constructor
    function AssetVault() {
    }

    // Register an asset.
    function createAsset(string32 id, string32 name) returns (bool dummyForLayout) {
        // Check: has the asset already been registered?
        if(ownerByAssetID[id] != 0x0)
        // Asset with this ID has already been registered. No action.
        return;

        // Good to go. Register the asset.
        AssetCollection ac = assetsByOwner[tx.origin];

        // Add a new owner if the owner wasn't registered before.
        if(ac.assetCount == 0)
            owners[ownerCount++] = tx.origin;
		
        ownerByAssetID[id] = tx.origin;

        Asset a = ac.assets[ac.assetCount++];
        a.id = id;
        a.name = name;
    }

    // BEGIN plumbing functions to access properties of mappings that contain structs that 
    // contain mappings.
    function getAssetID(address ownerAddress, uint assetIndex) returns (string32 id){
        AssetCollection ac = assetsByOwner[ownerAddress];

        return ac.assets[assetIndex].id;
    }
	
    function getAssetName(address ownerAddress, uint assetIndex) returns (string32 name){
        AssetCollection ac = assetsByOwner[ownerAddress];

        return ac.assets[assetIndex].name;
    }

    // Get the index of an asset in its owner's mapping.
    function getAssetIndex(address ownerAddress, string32 assetID) returns (uint assetIndex){
        AssetCollection ac = assetsByOwner[ownerAddress];

        assetIndex = 0;
        while(assetIndex < ac.assetCount){
            Asset asset = ac.assets[assetIndex];
            if(asset.id == assetID)
                return;
            assetIndex++;
        }

        // TODO: signal situation that the asset wasn't found (return bool isFound?)
    }

    // Plumbing function to get all properties of an asset.
    // Currently not possible because return type must be a primitive type.
    function getAsset(address ownerAddress, uint assetIndex) returns (string32 id, string32 name, uint verificationCount) {
        AssetCollection ac = assetsByOwner[ownerAddress];

        Asset a  = ac.assets[assetIndex];
        id = a.id;
        name = a.name;
        verificationCount = a.verificationCount;
    }

    // Get an asset by its ID only. Convenience function.
    //function getAssetByID(string32 assetID) returns (string32 id, string32 name, uint verificationCount) {
    //}

    // END plumbing functions to access properties of mappings that contain structs that 
    // contain mappings.
	
    // Transfer ownership of an asset to a new owner. To be called by the prospective new owner.
    function requestTransfer(string32 assetID) returns (bool dummyForLayout) {
        // Check: is the asset ID valid?
        if(ownerByAssetID[assetID] == 0x0) {
            return;
        }

        // Check: is the requester the current owner? Then no request. They already own it.
        if(ownerByAssetID[assetID] == tx.origin) {
            return;
        }

        // Check: prevent duplicate requests.
        // Is there already a transfer request for this asset by the same requester? Then don't create 
        // a new one.
        // TODO

        // Create TransferRequest
        TransferRequest tr = transferRequests[transferRequestCount++];
        tr.assetID = assetID;
        tr.requester = tx.origin;
    }

    // Confirm ownership transfer of an asset to a new owner. To be called by the current owner.
    function processTransfer(string32 assetID, address newOwner, bool confirm) returns (bool dummyForLayout) {
        // Check: is the asset ID valid?
        if(ownerByAssetID[assetID] == 0x0) {
            return;
        }

        // Check: is the sender the current owner of the asset? If not, the sender is not authorized to confirm.
        if(ownerByAssetID[assetID] != tx.origin) {
            return;
        }	    
        
        // Find a TransferRequest for this asset and newOwner address.
        // TODO: refactor this loop to getTransferRequestIndex(assetID, requesterAddress);

        uint trIndex = 0;        
        while(trIndex <= transferRequestCount) {
            TransferRequest tr = transferRequests[trIndex];

            if (tr.assetID == assetID && tr.requester == newOwner) {
                // Correct request found. Effectuate transfer and clear it.

                // Remove it from the current owners assets.
                AssetCollection acOwner = assetsByOwner[tx.origin];
                uint aIndex = getAssetIndex(tx.origin, assetID);
                
                Asset a = acOwner.assets[aIndex];
                // If the owner confirms the request, transfer it. In any case delete the request after processing.
                if(confirm) {
                    // TODO: refactor to private function transferAsset(assetID, currentOwner, newOwner).

                    // Add it to the newOwners assets.
                    AssetCollection acRequester = assetsByOwner[newOwner];
                    if(acRequester.assetCount==0)
                        // New owner, store it.
                        owners[ownerCount++] = newOwner;

                    // Transfer the whole asset by assigning it to the new mapping.
                    acRequester.assets[acRequester.assetCount++] = a;

                    // BEGIN WORKAROUND
                    // This way of assigning includes the mapping of verifications. However, all properties 
                    // of the verifications are set to null. This is likely a bug in Solidity PoC8. 
                    // We work around this by deep copying the individual properties.
                    Asset newAsset = acRequester.assets[acRequester.assetCount - 1];

                    uint verificationIndex = 0;
                    while(verificationIndex < newAsset.verificationCount){
                        newAsset.verifications[verificationIndex].verifier = a.verifications[verificationIndex].verifier;
                        newAsset.verifications[verificationIndex].type = a.verifications[verificationIndex].type;
                        newAsset.verifications[verificationIndex].isConfirmed = a.verifications[verificationIndex].isConfirmed;
                        verificationIndex++;
                    }
                    // END WORKAROUND
                                                        
                    // Delete the asset of the old owner.                            
                    delete acOwner.assets[aIndex];

                    // Update OwnerByAssetID
                    ownerByAssetID[assetID] = newOwner;
                }
                
                // Delete transfer request
                delete transferRequests[trIndex];
                
                // COULD DO: remove previous owner from Owners if they don't have any assets left.

                // Transfer completed, done.
                return;
            }

            trIndex++;
        }


        // Check: clean up any other transfer requests for this asset
        // TODO
    }

    // Remove expired transfer requests
    function cleanTransferRequests() returns (bool dummyForLayout) {
        // TODO: add a block number to TransferRequest so we can see when it expires.
        // TODO: implement
    }


    // VERIFICATIONS

    // Request verification of an asset.
    function requestVerification(string32 assetID, address verifier, uint type) returns (bool dummyForLayout) {
        // Check: is the asset ID valid?
        if(ownerByAssetID[assetID] == 0x0) {
            return;
        }

        // Check: is the verifier the current owner? That's not allowed.
        if(tx.origin == verifier) {
            return;
        }

        // Check: is the requester the current owner?
        if(ownerByAssetID[assetID] != tx.origin) {
            return;
        }

        // Get the asset. Because functions can't return structs (yet) we need various
        // function calls and access the mapping directly. Still better than having a while loop 
        // everywhere though.
        uint aIndex = getAssetIndex(tx.origin, assetID);
        AssetCollection acOwner = assetsByOwner[ownerByAssetID[assetID]];
        Asset a = acOwner.assets[aIndex];
            
        // Add it to the asset verifications
        Verification v = a.verifications[a.verificationCount++];
        v.verifier = verifier;
        v.type = type;
    }

    // Get the index of a specific verification of an asset.
    function getVerificationIndex(address ownerAddress, string32 assetID, address verifier, uint type) returns (uint verificationIndex) {
        uint assetIndex = getAssetIndex(ownerAddress, assetID);

        Asset a = assetsByOwner[ownerAddress].assets[assetIndex];

        verificationIndex = 0;
        while(verificationIndex < a.verificationCount){
            Verification v = a.verifications[verificationIndex];
            if(v.verifier == verifier && v.type == type)
                return;

            verificationIndex++;           
        }

        // TODO: distinguish between "not found" and "index = 0". Now both give the same result.
    }

    // Get info about a Verification of an asset.
    function getVerification(string32 assetID, uint verificationIndex) returns (address verifier, uint type, bool isConfirmed) {
        address ownerAddress = ownerByAssetID[assetID];
        uint assetIndex = getAssetIndex(ownerAddress, assetID);

        Asset a = assetsByOwner[ownerAddress].assets[assetIndex];

        Verification v = a.verifications[verificationIndex];

        verifier = v.verifier;
        type = v.type;
        isConfirmed = v.isConfirmed;
    }

    // Process a pending verification. To be called by the verifier.
    function processVerification(string32 assetID, uint type, bool confirm) returns (bool processedCorrectly) {
        address ownerAddress = ownerByAssetID[assetID];

        // Check: is the asset ID valid?
        if(ownerAddress == 0x0) {
            return;
        }

        // Find the verification.
        uint assetIndex = getAssetIndex(ownerAddress, assetID);

        Asset a = assetsByOwner[ownerAddress].assets[assetIndex];

        // Try to find a verification request where the caller is the verifier. If not, the caller is not allowed
        // to process.
        uint verificationIndex = getVerificationIndex(ownerAddress, assetID, tx.origin, type);

        // TODO: distinguish between "no such verification" and "index == 0".
        //if(notExisting)
        //    return;

        // Get the verificationIndex
        Verification v = a.verifications[verificationIndex];

        // Check: is this a valid verification? (does it exist?)
        if(v.verifier == 0x0)
            return;

        // Check: is the caller the verifier? Only then they may process it.
        if(v.verifier != tx.origin)
            return;

        // Check: already confirmed? Then no action.
        if(v.isConfirmed)
            return;

        if(confirm) {
            // Want to confirm? Set isConfirm to true.
            v.isConfirmed = true;
        } else {
            // Want to deny? Delete it.
            delete a.verifications[verificationIndex];
        }

        processedCorrectly = true;
    }

	
}