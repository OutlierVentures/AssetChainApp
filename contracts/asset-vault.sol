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
    mapping (address => AssetCollection) AssetsByOwner;

    // Mapping from owner address to asset ID, to ensure that assets have only one owner.
    mapping (string32 => address) OwnerByAssetID;

    uint AssetCount;

    // List of all owners, for iteration.
    mapping (uint => address) Owners;

    // Total owners stored in Owners, for iteration.
    uint public OwnerCount;

    struct TransferRequest{
        // TODO: add request date / block height so the requests can expire
        string32 AssetID;
        address Requester;
    }

    // Collection of requests for transfer
    mapping (uint => TransferRequest) public TransferRequests;
    uint TransferRequestCount;

    // Constructor
    function AssetVault() {
    }

    // Returns the address of an owner by index.
    function GetOwnerAt(uint index) returns (address ownerAddress){
		if (index >= OwnerCount)
        return;

        return Owners[index];
    }

    // Register an asset.
    function CreateAsset(string32 id, string32 name) {
        // Check if the asset isn't already registered.
        uint i = 0;

        AssetCollection ac = AssetsByOwner[tx.origin];

        // Only add new owner if they don't have a collection yet.
        // TODO: use built-in function of mappings if/once it exists.
        bool isExistingOwner = false;
		
        i = 0;
        while (i <= OwnerCount) {
            // Check existing asset ID. Don't allow registering it twice.
            uint j = 0;
            AssetCollection assetsForOwner = AssetsByOwner[Owners[i]];
            while (j < assetsForOwner.AssetCount) {
                mapping (uint => Asset) assetList = assetsForOwner.Assets;
                if(assetList[j].ID == id) {
                    // Asset with this ID has already been registered. No action.
                    return;
                }
                j++;
            }

            // Check existing owner
            if (Owners[i] == tx.origin) {
                isExistingOwner = true;
                // TODO: break loop, if possible
            }

            i++;
        }

        if(!isExistingOwner)
            Owners[OwnerCount++] = tx.origin;
		
        OwnerByAssetID[id] = tx.origin;
        AssetCount++;

        Asset a = ac.Assets[ac.AssetCount++];
        a.ID = id;
        a.Name = name;
    }

    function GetOwnerOf(string32 assetID) returns (address ownerAddress)
    {
        return OwnerByAssetID[assetID];
    }

    // Get a specific asset for an owner.
    // Currently not usable because the JS inteface doesn't handle structs.
    function GetAsset(address ownerAddress, uint assetIndex) returns (Asset b) {
        AssetCollection ac = AssetsByOwner[ownerAddress];

        return ac.Assets[assetIndex];
    }

    // Plumbing functions as workaround for functions that return structs.
    function GetAssetCount(address ownerAddress) returns (uint assetCount){
        AssetCollection ac = AssetsByOwner[ownerAddress];

        return ac.AssetCount;
    }
	
    function GetAssetID(address ownerAddress, uint assetIndex) returns (string32 id){
        AssetCollection ac = AssetsByOwner[ownerAddress];

        return ac.Assets[assetIndex].ID;
    }
	
    function GetAssetName(address ownerAddress, uint assetIndex) returns (string32 name){
        AssetCollection ac = AssetsByOwner[ownerAddress];

        return ac.Assets[assetIndex].Name;
    }

    // Transfer ownership of an asset to a new owner. To be called by the prospective new owner.
    function RequestTransfer(string32 assetID, address newOwner) returns (bool ok){
        // TODO: implement
        // Check: is the asset ID valid?
        return 1;
    }

    // Confirm ownership transfer of an asset to a new owner. To be called by the current owner.
    function ConfirmTransfer(string32 assetID) {
        // TODO: implement
    }
}