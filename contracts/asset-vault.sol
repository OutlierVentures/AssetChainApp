contract AssetVault {
    // Data structure to hold information about a single asset.
    struct Asset {
        // Unique AssetChain ID as used in cryptoledgers where it has been registered.
        string32 id;
        // Descriptive name of the asset.
        // Could be removed once this is purely used as a secure data store.
        string32 name;
    }

    // Collection of assets and their count, to be used for one individual owner.
    struct AssetCollection {
        mapping (uint => Asset) assets;
        uint assetCount;
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
    function createAsset(string32 id, string32 name) {
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
    // END plumbing functions to access properties of mappings that contain structs that 
    // contain mappings.
	
    // Transfer ownership of an asset to a new owner. To be called by the prospective new owner.
    function requestTransfer(string32 assetID) {
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
    function processTransfer(string32 assetID, address newOwner, bool confirm) {
        // Check: is the asset ID valid?
        if(ownerByAssetID[assetID] == 0x0) {
            return;
        }

        // Check: is the sender the current owner of the asset? If not, the sender is not authorized to confirm.
        if(ownerByAssetID[assetID] != tx.origin) {
            return;
        }	    
        
        // Find a TransferRequest for this asset and newOwner address.
        uint trIndex = 0;        
        while(trIndex <= transferRequestCount) {
            TransferRequest tr = transferRequests[trIndex];

            if (tr.assetID == assetID && tr.requester == newOwner) {
                // Correct request found. Effectuate transfer and clear it.
                // TODO: refactor to private function transferAsset(assetID, currentOwner, newOwner).

                // Remove it from the current owners assets.
                AssetCollection acOwner = assetsByOwner[tx.origin];
                uint aIndex = 0;
                while(aIndex <= acOwner.assetCount) {
                    Asset a = acOwner.assets[aIndex];
                    if(a.id == tr.assetID){
                        // If the owner confirms the request, transfer it. Otherwise just delete the request.
                        if(confirm) {
                            // Add it to the newOwners assets.
                            AssetCollection acRequester = assetsByOwner[newOwner];
                            if(acRequester.assetCount==0)
                                // New owner, store it.
                                owners[ownerCount++] = newOwner;

                            Asset transferredAsset = acRequester.assets[acRequester.assetCount++];
                            transferredAsset.id = a.id;
                            transferredAsset.name = a.name;

                            // Clear the values of the asset. This is the closest we get to deleting it.
                            a.id = "";
                            a.name = "";

                            // Update OwnerByAssetID
                            ownerByAssetID[assetID] = newOwner;
                        }

                        // Delete transfer request
                        tr.assetID = "";
                        tr.requester = 0x0;

                        // COULD DO: remove previous owner from Owners if they don't have any assets left.

                        // Transfer completed, done.
                        return;
                    }
                    aIndex++;
                }
            }

            trIndex++;
        }


        // Check: clean up any other transfer requests
        // TODO
    }

    // Remove expired transfer requests
    function cleanTransferRequests(){
        // TODO: add a block number to TransferRequest so we can see when it expires.
        // TODO: implement
    }
	
}