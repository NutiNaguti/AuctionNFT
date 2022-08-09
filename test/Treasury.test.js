const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Treasury tests", () => {
    let Blacklist;
    let Assets;
    let Auction;
    let Treasury;

    let blacklist;
    let assets;
    let auction;
    let treasury;

    const BASE_URI = "ipfs://test/";
    const BASE_PRICE = ethers.BigNumber.from("10000000000000000");
    const ADDITIONAL_PRICE = BASE_PRICE.div(2);

    beforeEach(async () => {
        Blacklist = await ethers.getContractFactory("Blacklist");
        blacklist = await Blacklist.deploy();

        Assets = await ethers.getContractFactory("Assets");
        assets =  await upgrades.deployProxy(Assets, ["Assets", "ASSETS", BASE_URI, BASE_PRICE, ADDITIONAL_PRICE, blacklist.address]);
        
        Treasury = await ethers.getContractFactory("Treasury");
        treasury = await Treasury.deploy(assets.address);

        Auction = await ethers.getContractFactory("Auction");
        auction = await upgrades.deployProxy(Auction, [assets.address, treasury.address, blacklist.address]);
    
        [owner, address1, address2, address3, address4, address5, address6, address7] = await ethers.getSigners();

        await treasury.setAuctionAddress(auction.address);
        await assets.setAuctionAddress(auction.address);
    });

    it("succesful pay and recive token", async () => {
        let content = "First mint!";
        let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
        let sellPrice = BASE_PRICE.mul(2);
        let bidPrice = sellPrice.mul(2);
        await assets.connect(address2).mint(address2.address, content, {value: mintPrice});

        let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
        
        await auction.connect(address2).sellAsset(tokenId, sellPrice);
        await auction.connect(address1).placeBid(tokenId, bidPrice);

        await assets.connect(address2).approve(auction.address, tokenId);
        await auction.connect(address2).acceptOffer(tokenId);

        let buyerBalanceBefore = await ethers.provider.getBalance(address1.address);

        let txResponce = await treasury.connect(address1).pay(tokenId, {value: bidPrice});
        let tx = await txResponce.wait();
        let gasUsed = ethers.BigNumber.from(tx.cumulativeGasUsed).mul(ethers.BigNumber.from(tx.effectiveGasPrice));

        txResponce = await treasury.connect(address1).checkTrade(tokenId);
        tx = await txResponce.wait();
        gasUsed = gasUsed.add(ethers.BigNumber.from(tx.cumulativeGasUsed).mul(ethers.BigNumber.from(tx.effectiveGasPrice)));

        await treasury.connect(address2).checkTrade(tokenId);

        expect(await assets.balanceOf(address1.address)).eql(ethers.BigNumber.from(1));
        expect(await assets.balanceOf(address2.address)).eql(ethers.BigNumber.from(0));
        expect(await ethers.provider.getBalance(address1.address)).eql(buyerBalanceBefore.sub(bidPrice.add(gasUsed)));
    });

    it("try pay and recive when time expired", async () => {
        let content = "First mint!";
        let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
        let sellPrice = BASE_PRICE.mul(2);
        let bidPrice = sellPrice.mul(2);
        await assets.connect(address2).mint(address2.address, content, {value: mintPrice});

        let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
        
        await auction.connect(address2).sellAsset(tokenId, sellPrice);
        await auction.connect(address1).placeBid(tokenId, bidPrice);

        await assets.connect(address2).approve(auction.address, tokenId);
        await auction.connect(address2).acceptOffer(tokenId);
        
        await network.provider.send("evm_increaseTime", [3601])
        await network.provider.send("evm_mine")
        await expect(treasury.connect(address1).pay(tokenId, {value: bidPrice})).revertedWith("Trasury: trade time expired");
        await expect(treasury.connect(address1).checkTrade(tokenId)).revertedWith("Treasury: trade time expired");
       
        await treasury.connect(address2).checkTrade(tokenId);
       
        expect(await assets.balanceOf(address2.address)).eql(ethers.BigNumber.from(1));
        expect(await assets.balanceOf(address1.address)).eql(ethers.BigNumber.from(0));
    })
});