*State of this readme:* **_DRAFT_**

# AssetChain Distributed Application (DApp)

This is the frontend for [AssetChain](http://assetcha.in).

Current status: prototype.

## Installation

The web app works primarily client side, making calls to blockchain nodes when required.

For purely client-side usage:

1. Make the files available on a webserver, for example http://localhost:1234/
2. Open the URL in a browser http://localhost:1234

For usage with Ethereum:

1. Ensure that an Ethereum node is running. The code has been tested with cpp-ethereum PoC8.
2. Deploy the contract AssetVault.sol has been deployed.

TODO


## Usage

### Opening a vault
On opening the application, supply a password. If no vault with this password existed, a new one is created and saved in the local storage. If a vault with the given password did exist on your machine, the existing contents are shown.

### Registering an asset

A new asset can be registered with the option *Register asset*. Supply asset details and optionally images of the assets. Data is stored in the local storage of the browser.

### Securing an asset

Assets can be secured on blockchains, which results in *Security pegs*. These pegs are controlled by the user through private keys on the specific ledgers.

### Transferring ownership

For transferring ownership, the asset has to be secured on a blockchain ledger. Transfer works in two phases:

1. The user who wants the asset creates a *Transfer request*
1. The owner of the asset confirms or denies this request

On confirmation, ownership is transferred to the new owner, including all security pegs.



## Technologies used
* AngularJS
* TypeScript
* Bootstrap
* ethereum.js (now [web3.js](https://github.com/ethereum/web3.js/))

For details see the  [Technology Stack Description](https://docs.google.com/document/d/1_wngicJ7PwaiTnXtJ2PvQABcCKqrrhiZIffTBaZ0q3g/).

## Package management

Bower

## Development guidelines

See also the [Development Process Description](https://docs.google.com/document/d/1NFjOb6fBUDFURHYRJnRE0o7buNS5oKIuBmrXo-CT9Kk/).

* Services and controllers are TypeScript classes
* Scopes defined as TypeScript interfaces
* CSS: no framework like LESS is used as there has been no necessity for it. All styles are basic Bootstrap. Might be useful in the future.

## Deployment

Currently the ```client/``` tree is deployed in its entirety. Grunt is not used.
