import { ethers, network } from 'hardhat';
import { expect } from 'chai';
import { Marketplace, ERC20Mock, ERC721Example } from '../typechain';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

const ADMIN = "0xdf8b4c520ffe197c5343c6f5aec59570151ef9a492f2c624fd45ddde6135ec42";

describe("Marketplace", function() {
    const auctionDuration: number = 259200;  // 3 days in seconds
    const minimalNumberOfBids: number = 3;
    const erc20InitialSupply: number = 100000000000;

    let marketplace: Marketplace;
    let erc20token: ERC20Mock;
    let erc721token: ERC721Example;
    let seller: SignerWithAddress;
    let bidder: SignerWithAddress;

    beforeEach(async function() {
        [seller, bidder] = await ethers.getSigners();

        const ERC20Token = await ethers.getContractFactory("ERC20Mock", bidder);
        erc20token = await ERC20Token.deploy("StakingToken", "STK", erc20InitialSupply);
        await erc20token.deployed();

        const ERC721Token = await ethers.getContractFactory("ERC721Example", seller);
        erc721token = await ERC721Token.deploy();
        await erc721token.deployed();

        const Marketplace = await ethers.getContractFactory("Marketplace");
        marketplace = await Marketplace.deploy(erc20token.address, erc721token.address, auctionDuration, minimalNumberOfBids);
        await marketplace.deployed();
    })

    it("Should be deployed", async function() {
        expect(marketplace.address).to.be.properAddress;
    })

    describe("Create item", function() {

        it("Should create NFT to seller address", async function() {
            await marketplace.createItem(seller.address);
            const sellerBalance = await erc721token.balanceOf(seller.address);

            expect(sellerBalance).to.equal(1);
        })
    })

    describe("Basic market functionality", function() {

        it("Should list NFT to market with price 100 tokens", async function() {
            await marketplace.createItem(seller.address);
            await marketplace.connect(seller).listItem(0, 100);
            
            expect ((await marketplace.itemsList(0)).initialPrice).to.equal(100);
        })

        it("Should buy NFT from market and transfer ERC721 token", async function() {

            await marketplace.createItem(seller.address);
            await marketplace.connect(seller).listItem(0, 100);

            await erc20token.approve(marketplace.address, 600);
            await erc721token.approve(marketplace.address, 0);

            await marketplace.connect(bidder).buyItem(0);

            expect((await marketplace.itemsList(0)).owner).to.equal(bidder.address);
        })

        it("Should transfer 100 ERC20 tokens to seller in buying process", async function() {

            await marketplace.createItem(seller.address);
            await marketplace.connect(seller).listItem(0, 100);

            await erc20token.approve(marketplace.address, 600);
            await erc721token.approve(marketplace.address, 0);

            await expect(() => marketplace.connect(bidder).buyItem(0))
            .to.changeTokenBalance(erc20token, seller, 100);
        })

        it("Should emit Sold event when someone buy NFT", async function() {

            await marketplace.createItem(seller.address);
            await marketplace.connect(seller).listItem(0, 100);

            await erc20token.approve(marketplace.address, 600);
            await erc721token.approve(marketplace.address, 0);

            await expect(marketplace.connect(bidder).buyItem(0))
            .to.emit(marketplace, "Sold")
            .withArgs(seller.address, bidder.address, 0);
        })

        it("Should cancel the item sell", async function() {

            await marketplace.createItem(seller.address);
            await marketplace.connect(seller).listItem(0, 100);

            await marketplace.cancel(0);

            expect((await marketplace.itemsList(0)).onSale)
            .to.equal(false);
        })
    })

    describe("Advanced market functionality", function() {

        it("Should list item on auction", async function() {
            await marketplace.createItem(seller.address);
            await marketplace.listItemOnAuction(0, 100);

            expect ((await marketplace.itemsList(0)).initialPrice).to.equal(100);
        })

        it("Should make bid to auction", async function() {
            await erc20token.approve(marketplace.address, 600);

            await marketplace.createItem(seller.address);
            await marketplace.listItemOnAuction(0, 100);

            await network.provider.send("evm_increaseTime", [500]);
            await network.provider.send("evm_mine");

            await marketplace.connect(bidder).makeBid(0, 200);

            expect((await marketplace.itemsList(0)).numberOfBids)
            .to.equal(1)
        })

        it("Should refund tokens to previous bidder in make bid process", async function() {
            await erc20token.approve(marketplace.address, 600); 

            await marketplace.createItem(seller.address);
            await marketplace.listItemOnAuction(0, 100);

            await network.provider.send("evm_increaseTime", [500]);
            await network.provider.send("evm_mine");

            await marketplace.connect(bidder).makeBid(0, 200);
            
            await expect(() => marketplace.connect(bidder).makeBid(0, 300))
            .to.changeTokenBalance(erc20token, bidder, -100);
        })

        it("Should transfer 200 erc20 tokens to contract address", async function() {
            await erc20token.approve(marketplace.address, 600); 

            await marketplace.createItem(seller.address);
            await marketplace.listItemOnAuction(0, 100);

            await network.provider.send("evm_increaseTime", [500]);
            await network.provider.send("evm_mine");
            
            await expect(() => marketplace.connect(bidder).makeBid(0, 300))
            .to.changeTokenBalance(erc20token, marketplace, 300);
        })
    })

    describe("Finish auction functionality", function() {

        it("Should finish auction and send NFT to last bidder", async function() {

            await marketplace.createItem(seller.address);
            await marketplace.listItemOnAuction(0, 100);

            await erc20token.approve(marketplace.address, 6000); 
            await erc721token.approve(marketplace.address, 0);

            await network.provider.send("evm_increaseTime", [500]);
            await network.provider.send("evm_mine");

            await marketplace.connect(bidder).makeBid(0, 200);
            await marketplace.connect(bidder).makeBid(0, 300);
            await marketplace.connect(bidder).makeBid(0, 400);

            await network.provider.send("evm_increaseTime", [300000]);
            await network.provider.send("evm_mine");

            await marketplace.finishAuction(0);
            const sellerBalance = await erc721token.balanceOf(seller.address);

            expect(await erc721token.balanceOf(bidder.address))
            .to.equal(1);
        })

        it("Should finish auction and refund tokens to last bidder", async function() {
            await marketplace.createItem(seller.address);
            await marketplace.listItemOnAuction(0, 100);

            await erc20token.approve(marketplace.address, 6000); 
            await erc721token.approve(marketplace.address, 0);

            await network.provider.send("evm_increaseTime", [500]);
            await network.provider.send("evm_mine");

            await marketplace.connect(bidder).makeBid(0, 200);
            await marketplace.connect(bidder).makeBid(0, 300);

            await network.provider.send("evm_increaseTime", [300000]);
            await network.provider.send("evm_mine");

            await expect(() => marketplace.finishAuction(0))
            .to.changeTokenBalance(erc20token, bidder, 300);
        })
    })

    describe("Change auction settings", function() {

        it("Should change auction settings", async function() {
            await marketplace.changeAuctionSettings(1000, 5);

            expect(await marketplace.auctionDuration())
            .to.equal(1000);

            expect(await marketplace.minimalNumberOfBids())
            .to.equal(5);
        })

        it("Should revert error because bidder don't have admin role", async function() {
            await expect(marketplace.connect(bidder).changeAuctionSettings(1000, 5))
            .to.be.reverted;
        })
    })

})