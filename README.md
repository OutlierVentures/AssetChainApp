*State of this readme:* **_DRAFT_**

# AssetChain client app

This is the frontend for [AssetChain](http://assetcha.in).

Current status: prototype.

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
