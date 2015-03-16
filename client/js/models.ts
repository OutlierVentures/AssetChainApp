
/**
 * Class representing an asset (to be) registered on AssetChain.
 */
class Asset {
    id: string;
    name: string;
    category: string;
    comments: string;
    IsPendingClaim: boolean = true;
    Verifications: Verification[];
}

class Verification {
    id: string;
    name: string;
    address: string;
    date: string;
    comments: string;
    IsPending: boolean;
    defects: string;
}
