contract AssetVault {
    // Data structure to hold information about a single asset.
    struct Asset {
        // Unique AssetChain ID as used in cryptoledgers where it has been registered.
        string32 ID;
        // Descriptive name of the asset.
        // Could be removed once this is purely used as a secure data store.
        string32 Name;
    }

    // Collection of assets and their count, to be used for one individual owner.
    struct AssetCollection {
        mapping (uint => Asset) Assets;
        uint AssetCount;
    }

    // The collection that stores all assets by owner address.
    mapping (address => AssetCollection) public AssetsByOwner;

    // Mapping from owner address to asset ID, to ensure that assets have only one owner.
    mapping (string32 => address) public OwnerByAssetID;

    // List of all owners, for iteration.
    // TODO: replace by array so OwnerCount can be removed.
    mapping (uint => address) public Owners;

    // Total owners stored in Owners, for iteration.
    uint public OwnerCount;

    struct TransferRequest{
        // TODO: add request date / block height so they can expire
        string32 AssetID;
        address Requester;
    }

    // Collection of requests for transfer
    mapping (uint => TransferRequest) public TransferRequests;
    uint public TransferRequestCount;

    // Constructor
    function AssetVault() {
    }

    // Register an asset.
    function CreateAsset(string32 id, string32 name) {
        // Check: has the asset already been registered?
        if(OwnerByAssetID[id] != 0x0)
            // Asset with this ID has already been registered. No action.
            return;

        // Good to go. Register the asset.
        AssetCollection ac = AssetsByOwner[tx.origin];

        // Add a new owner if the owner wasn't registered before.
        if(ac.AssetCount == 0)
            Owners[OwnerCount++] = tx.origin;
		
        OwnerByAssetID[id] = tx.origin;

        Asset a = ac.Assets[ac.AssetCount++];
        a.ID = id;
        a.Name = name;
    }

    // BEGIN plumbing functions to access properties of mappings that contain structs that 
    // contain mappings.
    function GetAssetID(address ownerAddress, uint assetIndex) returns (string32 id){
        AssetCollection ac = AssetsByOwner[ownerAddress];

        return ac.Assets[assetIndex].ID;
    }
	
    function GetAssetName(address ownerAddress, uint assetIndex) returns (string32 name){
        AssetCollection ac = AssetsByOwner[ownerAddress];

        return ac.Assets[assetIndex].Name;
    }
    // END plumbing functions to access properties of mappings that contain structs that 
    // contain mappings.
	
    // Transfer ownership of an asset to a new owner. To be called by the prospective new owner.
    function RequestTransfer(string32 assetID) {
        // Check: is the asset ID valid?
        if(OwnerByAssetID[assetID] == 0x0) {
            return;
        }

        // Check: is the requester the current owner? Then no request. They already own it.
        if(OwnerByAssetID[assetID] == tx.origin) {
            return;
        }

        // Check: prevent duplicate requests.
        // Is there already a transfer request for this asset by the same requester? Then don't create 
        // a new one.
        // TODO

        // Create TransferRequest
        TransferRequest tr = TransferRequests[TransferRequestCount++];
        tr.AssetID = assetID;
        tr.Requester = tx.origin;
    }

    // Confirm ownership transfer of an asset to a new owner. To be called by the current owner.
    function ConfirmTransfer(string32 assetID, address newOwner) {
        // Check: is the asset ID valid?
        if(OwnerByAssetID[assetID] == 0x0) {
            return;
        }

        // Check: is the sender the current owner of the asset? If not, the sender is not authorized to confirm.
        if(OwnerByAssetID[assetID] != tx.origin) {
            return;
        }	    
        
        // Find a TransferRequest for this asset and newOwner address.
        uint i = 0;        
        while(i <= TransferRequestCount) {
            TransferRequest tr = TransferRequests[i];

            if (tr.AssetID == assetID && tr.Requester == newOwner) {
                // Correct request found. Effectuate transfer and clear it.
                // TODO: refactor to private function TransferAsset(assetID, currentOwner, newOwner).

                // Remove it from the current owners assets.
                AssetCollection acOwner = AssetsByOwner[tx.origin];
                uint j = 0;
                while(j <= acOwner.AssetCount) {
                    Asset a = acOwner.Assets[j];
                    if(a.ID == tr.AssetID){
                        // Add it to the newOwners assets.
                        AssetCollection acRequester = AssetsByOwner[newOwner];
                        if(acRequester.AssetCount==0)
                            // New owner, store it.
                            Owners[OwnerCount++] = newOwner;

                        Asset transferredAsset = acRequester.Assets[acRequester.AssetCount++];
                        transferredAsset.ID = a.ID;
                        transferredAsset.Name = a.Name;

                        // Clear the values of the asset. This is the closest we get to deleting it.
                        a.ID = "";
                        a.Name = "";

                        // Update OwnerByAssetID
                        OwnerByAssetID[assetID] = newOwner;

                        // Delete transfer request
                        tr.AssetID = "";
                        tr.Requester = 0x0;

                        // COULD DO: remove previous owner from Owners if they don't have any assets left.

                        // Transfer completed, done.
                        return;
                    }
                    j++;
                }
            }

            i++;
        }


        // Check: clean up any other transfer requests
        // TODO

    }

    // Remove expired transfer requests
    function CleanTransferRequests(){
        // TODO: add a block number to TransferRequest so we can see when it expires.
        // TODO: implement
    }
	
}