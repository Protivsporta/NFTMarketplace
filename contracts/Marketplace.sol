//SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ERC721Example.sol";

contract Marketplace is AccessControl{

    using SafeERC20 for IERC20;

    IERC20 public tradeToken;
    ERC721Example public nfToken;

    uint256 public auctionDuration;
    uint256 public minimalNumberOfBids;
    uint256 itemID;
    bytes32 public constant ADMIN = keccak256(abi.encodePacked("ADMIN"));

    constructor(
        address _tradeTokenContract, 
        address _nfTokenContract, 
        uint256 _auctionDuration, 
        uint256 _minimalNumberOfBids) {
        tradeToken = IERC20(_tradeTokenContract);
        nfToken = ERC721Example(_nfTokenContract);
        auctionDuration = _auctionDuration;
        minimalNumberOfBids = _minimalNumberOfBids;
        _grantRole(ADMIN, msg.sender);
    }

    // enum for item market status
    enum Status { HOLD, OnSale, OnAuction}
    Status public status;

    struct marketItem {
        uint256 initialPrice;
        uint256 lastBid;
        address lastBidder;
        uint256 numberOfBids;
        Status status;
        address owner;
        uint256 auctionStartTimestamp;
    }

    // map itemID to item struct
    mapping (uint256 => marketItem) public itemsList;

    // Functions

    function createItem(address _to) public {
        itemsList[itemID].owner = _to;
        itemsList[itemID].status = Status.HOLD;
        itemID ++;
        nfToken.createCollectible(_to);
    }

    function listItem(uint256 _itemID, uint256 _price) public onlyItemOwner(_itemID) onlyItemExists(_itemID) { 
        itemsList[_itemID].status = Status.OnSale;
        itemsList[_itemID].initialPrice = _price;
    }

    function buyItem(uint256 _itemID) public onlyOnSale(_itemID) onlyItemExists(_itemID) { 
        require(tradeToken.balanceOf(msg.sender) >= itemsList[_itemID].initialPrice, "Not enough funds to buy");
        itemsList[_itemID].status = Status.HOLD;
        tradeToken.transferFrom(msg.sender, itemsList[_itemID].owner, itemsList[_itemID].initialPrice);
        nfToken.transferFrom(itemsList[_itemID].owner, msg.sender, _itemID);
        emit Sold(itemsList[_itemID].owner, msg.sender, _itemID);
        itemsList[_itemID].owner = msg.sender;

    }

    function cancel(uint256 _itemID) public onlyItemOwner(_itemID) onlyOnSale(_itemID) onlyItemExists(_itemID) { 
        itemsList[_itemID].status = Status.HOLD;
    }

    function listItemOnAuction(uint256 _itemID, uint256 _initialPrice) public onlyItemOwner(_itemID) onlyItemExists(_itemID) { 
        require(itemsList[_itemID].status == Status.HOLD, "This item has already listed");
        itemsList[_itemID].numberOfBids = 0;
        itemsList[_itemID].status = Status.OnAuction;
        itemsList[_itemID].auctionStartTimestamp = block.timestamp;
        itemsList[_itemID].initialPrice = _initialPrice;
        itemsList[_itemID].lastBid = _initialPrice;
    }

    function makeBid(uint256 _itemID, uint256 _bidAmount) public onlyItemExists(_itemID) onlyOnAuction(_itemID) { 
        require(_bidAmount > itemsList[_itemID].lastBid, "Your bid is less then last bid");
        require(block.timestamp > itemsList[_itemID].auctionStartTimestamp, "Too early, auction is not started");
        require(block.timestamp < itemsList[_itemID].auctionStartTimestamp + auctionDuration, "Too late, auction ended");
        tradeToken.transferFrom(msg.sender, address(this), _bidAmount);
        if (itemsList[_itemID].numberOfBids > 0) {
            tradeToken.transfer(itemsList[_itemID].lastBidder, itemsList[_itemID].lastBid); // refund tokens to previous bidder
        }
        itemsList[_itemID].numberOfBids ++;
        itemsList[_itemID].lastBid = _bidAmount;
        itemsList[_itemID].lastBidder = msg.sender;
    }

    function finishAuction(uint256 _itemID) public onlyItemExists(_itemID) onlyOnAuction(_itemID) { 
        require(block.timestamp > itemsList[_itemID].auctionStartTimestamp + auctionDuration);
        itemsList[_itemID].status = Status.HOLD;
        if(itemsList[_itemID].numberOfBids >= minimalNumberOfBids) {
            nfToken.transferFrom(itemsList[_itemID].owner, itemsList[_itemID].lastBidder, _itemID);
            emit Sold(itemsList[_itemID].owner, itemsList[_itemID].lastBidder, _itemID);
            itemsList[_itemID].owner = itemsList[_itemID].lastBidder;
            itemsList[_itemID].numberOfBids = 0;
        } else {
            tradeToken.transfer(itemsList[_itemID].lastBidder, itemsList[_itemID].lastBid); // refund tokens to last bidder
            itemsList[_itemID].numberOfBids = 0;
        }
    }

    function changeAuctionSettings(uint256 _auctionDuration, uint256 _minimalNumberOfBids) public onlyRole(ADMIN) {
        auctionDuration = _auctionDuration;
        minimalNumberOfBids = _minimalNumberOfBids; 
    }

    // Modifiers

    modifier onlyItemOwner(uint256 _itemID) {
        require(msg.sender == itemsList[_itemID].owner, "This action is available only to item owner");
        _;
    }

    modifier onlyOnSale(uint256 _itemID) {
        require(itemsList[_itemID].status == Status.OnSale, "This item is not on sale now");
        _;
    }

    modifier onlyOnAuction(uint256 _itemID) {
        require(itemsList[_itemID].status == Status.OnAuction, "This item is not on auction sale now");
        _;
    }

    modifier onlyItemExists(uint256 _itemID) {
        require(itemsList[_itemID].owner != address(0), "This item does not exist");
        _;
    }

    // Events

    event Sold(address indexed _oldOwner, address indexed _newOwner, uint256 _itemID);

}