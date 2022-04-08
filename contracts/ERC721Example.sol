//SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
contract ERC721Example is ERC721URIStorage {

    uint256 public tokenId;
    string baseTokenURI = "ipfs://QmUtXDnnuyopcC66jeCJgbvXZEsakqXXYsfyLbwdUNbHqw";

    constructor () ERC721 ("Valera", "VGCG") {}

    function createCollectible(address _to) public {
        _safeMint(_to, tokenId);
        _setTokenURI(tokenId, baseTokenURI);
        tokenId += 1;
    }

    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        return super.tokenURI(_tokenId);
    }
}
