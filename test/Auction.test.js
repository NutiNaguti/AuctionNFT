const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Auction tests", () => {
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

    describe("sell, cancel and buy tokens on auction", async () => {
        it("successful place token on auction", async () => {
            let content = "First mint!";
            let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
            let sellPrice = BASE_PRICE.mul(2);
            await assets.connect(address2).mint(address2.address, content, {value: mintPrice});
    
            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
    
            await auction.connect(address2).sellAsset(tokenId, sellPrice);
            expect(await auction.getAllAssetIds()).eql([ethers.BigNumber.from(1)]);
            expect(await auction.getOwnerOfAsset(tokenId)).eql(address2.address);
            expect(await assets.isLocked(tokenId)).eql(true);
            expect(await auction.tokensAmount()).eql(ethers.BigNumber.from(1));

            let bid = await auction.getLastBid(tokenId);
            let blockNumBefore = await ethers.provider.getBlockNumber();
            let blockBefore = await ethers.provider.getBlock(blockNumBefore);
            let timestampBefore = blockBefore.timestamp;
            
            expect(bid).eql([ethers.BigNumber.from(timestampBefore), sellPrice, address2.address]);
        });
    
        it("try place one token on auction twice", async () => {
            let content = "First mint!";
            let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
            let sellPrice = BASE_PRICE.mul(2);
            await assets.connect(address2).mint(address2.address, content, {value: mintPrice});
    
            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
    
            await auction.connect(address2).sellAsset(tokenId, sellPrice);
            await expect(auction.connect(address2).sellAsset(tokenId, sellPrice)).revertedWith("Auction: this token already placed");
        });

        it("try place token by not owner", async () => {
            let content = "First mint!";
            let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
            let sellPrice = BASE_PRICE.mul(2);
            await assets.connect(address2).mint(address2.address, content, {value: mintPrice});
    
            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
    
            await expect(auction.connect(address3).sellAsset(tokenId, sellPrice)).revertedWith("Auction: you are not the owner of token");
        });

        it("try place token by blacklisted user", async () => {
            let content = "First mint!";
            let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
            let sellPrice = BASE_PRICE.mul(2);
            await assets.connect(address2).mint(address2.address, content, {value: mintPrice});
    
            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
    
            await blacklist.addToBlacklist(address2.address);
            await expect(auction.connect(address2).sellAsset(tokenId, sellPrice)).revertedWith("Auction: blacklisted user cannot sell");

        });

        it("successful cancel token", async () => {
            let content = "First mint!";
            let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
            let sellPrice = BASE_PRICE.mul(2);
            await assets.connect(address2).mint(address2.address, content, {value: mintPrice});
    
            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);

            await auction.connect(address2).sellAsset(tokenId, sellPrice);
            await auction.connect(address2).cancelAsset(tokenId);
            expect(await auction.tokensAmount()).eql(ethers.BigNumber.from(0));
            expect(await auction.getAllAssetIds()).eql([]);
            expect(await auction.getOwnerOfAsset(tokenId)).eql(ethers.constants.AddressZero);
            expect(await assets.isLocked(tokenId)).eql(false);
            expect(await auction.getLastBid(tokenId)).eql([ethers.BigNumber.from(0), ethers.BigNumber.from(0), ethers.constants.AddressZero]);
        });

        it("try cancel token by not owner of token", async () => {
            let content = "First mint!";
            let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
            let sellPrice = BASE_PRICE.mul(2);
            await assets.connect(address2).mint(address2.address, content, {value: mintPrice});
    
            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);

            await auction.connect(address2).sellAsset(tokenId, sellPrice);
            await expect(auction.connect(address1).cancelAsset(tokenId)).revertedWith("Auction: you are not the owner of token");
        });

        it("try cancel not traded token", async () => {
            let content = "First mint!";
            let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
            await assets.connect(address2).mint(address2.address, content, {value: mintPrice});
    
            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
            await expect(auction.connect(address2).cancelAsset(tokenId)).revertedWith("Auction: this token is not for sale on the auction");
        });

        it("successful place bid", async () => {
            let content = "First mint!";
            let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
            let sellPrice = BASE_PRICE.mul(2);
            await assets.connect(address2).mint(address2.address, content, {value: mintPrice});
    
            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
            
            await auction.connect(address2).sellAsset(tokenId, sellPrice);

            await auction.connect(address1).placeBid(tokenId, sellPrice.mul(2));

            let bid = await auction.getLastBid(tokenId);
            let blockNumBefore = await ethers.provider.getBlockNumber();
            let blockBefore = await ethers.provider.getBlock(blockNumBefore);
            let timestampBefore = blockBefore.timestamp;
            
            expect(bid).eql([ethers.BigNumber.from(timestampBefore), sellPrice.mul(2), address1.address]);
        });

        it("try place bid by blacklisted user", async () => {
            let content = "First mint!";
            let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
            let sellPrice = BASE_PRICE.mul(2);
            await assets.connect(address2).mint(address2.address, content, {value: mintPrice});
    
            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
            
            await auction.connect(address2).sellAsset(tokenId, sellPrice);

            await blacklist.addToBlacklist(address1.address);
            await expect(auction.connect(address1).placeBid(tokenId, sellPrice.mul(2))).rejectedWith("Auction: blacklisted user cannot buy");
        });

        it("try place bid with step less than 3%", async () => {
            let content = "First mint!";
            let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
            let sellPrice = BASE_PRICE.mul(2);
            await assets.connect(address2).mint(address2.address, content, {value: mintPrice});
    
            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
            
            await auction.connect(address2).sellAsset(tokenId, sellPrice);

            await expect(auction.connect(address1).placeBid(tokenId, sellPrice.add(1))).rejectedWith("Auction: the next bet must be greater than than the previous one + 3%");
        });

        it("successful accept trade offer", async () => {
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

            expect(await assets.balanceOf(address2.address)).eql(ethers.BigNumber.from(0));
            expect(await assets.balanceOf(treasury.address)).eql(ethers.BigNumber.from(1));
            expect(await auction.tokensAmount()).eql(ethers.BigNumber.from(0));
            expect(await auction.getAllAssetIds()).eql([]);
            expect(await auction.getOwnerOfAsset(tokenId)).eql(ethers.constants.AddressZero);
            expect(await assets.isLocked(tokenId)).eql(false);
            expect(await auction.getLastBid(tokenId)).eql([ethers.BigNumber.from(0), ethers.BigNumber.from(0), ethers.constants.AddressZero]);
        });

        it("try accept trade offer by not owner of token", async () => {
            let content = "First mint!";
            let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
            let sellPrice = BASE_PRICE.mul(2);
            let bidPrice = sellPrice.mul(2);
            await assets.connect(address2).mint(address2.address, content, {value: mintPrice});
    
            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
            
            await auction.connect(address2).sellAsset(tokenId, sellPrice);
            await auction.connect(address1).placeBid(tokenId, bidPrice);

            await assets.connect(address2).approve(auction.address, tokenId);
            await expect(auction.connect(address1).acceptOffer(tokenId)).revertedWith("Auction: you are not the owner of token");
        });

        it("try accept trade offer for yourself", async () => {
            let content = "First mint!";
            let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
            let sellPrice = BASE_PRICE.mul(2);
            await assets.connect(address2).mint(address2.address, content, {value: mintPrice});
    
            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
            
            await auction.connect(address2).sellAsset(tokenId, sellPrice);
            await assets.connect(address2).approve(auction.address, tokenId);

            await expect(auction.connect(address2).acceptOffer(tokenId)).revertedWith("Auction: you tried to buy your token");
        });

        it("try accept trade offer by blacklisted user", async () => {
            let content = "First mint!";
            let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
            let sellPrice = BASE_PRICE.mul(2);
            let bidPrice = sellPrice.mul(2);
            await assets.connect(address2).mint(address2.address, content, {value: mintPrice});
    
            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
            
            await assets.connect(address2).approve(auction.address, tokenId);
            await auction.connect(address2).sellAsset(tokenId, sellPrice);
            await auction.connect(address1).placeBid(tokenId, bidPrice);

            await blacklist.addToBlacklist(address2.address);
            await expect(auction.connect(address2).acceptOffer(tokenId)).revertedWith("Auction: blacklisted user cannot sell");
        });

        it("succesful instant purchase", async () => {
            let content = "First mint!";
            let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
            let sellPrice = BASE_PRICE.mul(2);
            await assets.connect(address2).mint(address2.address, content, {value: mintPrice});
    
            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
            await assets.connect(address2).approve(auction.address, tokenId);
            
            await auction.connect(address2).sellAsset(tokenId, sellPrice);

            let sellerBalanceBefore = await ethers.provider.getBalance(address2.address);
            let buyerBalanceBefore = await ethers.provider.getBalance(address1.address);

            let txResponce = await auction.connect(address1).buyAsset(tokenId, {value: sellPrice});
            let tx = await txResponce.wait();
            let gasUsed = ethers.BigNumber.from(tx.cumulativeGasUsed).mul(ethers.BigNumber.from(tx.effectiveGasPrice));

            expect(await assets.balanceOf(address2.address)).eql(ethers.BigNumber.from(0));
            expect(await assets.balanceOf(address1.address)).eql(ethers.BigNumber.from(1));
            expect(await ethers.provider.getBalance(address2.address)).eql(sellerBalanceBefore.add(sellPrice.sub(sellPrice.div(100).mul(3))));
            expect(await ethers.provider.getBalance(address1.address)).eql(buyerBalanceBefore.sub(sellPrice.add(gasUsed)));
        });

        it("try instant purchase by blacklisted user", async () => {
            let content = "First mint!";
            let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
            let sellPrice = BASE_PRICE.mul(2);
            await assets.connect(address2).mint(address2.address, content, {value: mintPrice});
    
            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
            
            await assets.connect(address2).approve(auction.address, tokenId);            
            await auction.connect(address2).sellAsset(tokenId, sellPrice);

            await blacklist.addToBlacklist(address1.address);
            await expect(auction.connect(address1).buyAsset(tokenId, {value: sellPrice})).revertedWith("Auction: blacklisted user cannot buy");
        });

        it("try instant purchase own token", async () => {
            let content = "First mint!";
            let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
            let sellPrice = BASE_PRICE.mul(2);
            await assets.connect(address2).mint(address2.address, content, {value: mintPrice});
    
            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
            
            await assets.connect(address2).approve(auction.address, tokenId);   
            await auction.connect(address2).sellAsset(tokenId, sellPrice);
         
            await expect(auction.connect(address2).buyAsset(tokenId, {value: sellPrice})).revertedWith("Auction: you tried to buy your token");
        });
    });

    describe("transfer locked tokens", async () => {
        it("try transfer locked token", async () => {
            let content = "First mint!";
            let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
            let sellPrice = BASE_PRICE.mul(2);
            await assets.connect(address2).mint(address2.address, content, {value: mintPrice});
    
            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
    
            await auction.connect(address2).sellAsset(tokenId, sellPrice);
            await expect(assets.connect(address2).transferFrom(address2.address, address1.address, tokenId)).revertedWith("Assets: token is at auction");
        });

        it("successful transfer token after cancel on auction", async () => {
            let content = "First mint!";
            let mintPrice = BASE_PRICE.add(ADDITIONAL_PRICE);
            let sellPrice = BASE_PRICE.mul(2);
            await assets.connect(address2).mint(address2.address, content, {value: mintPrice});
    
            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);

            await auction.connect(address2).sellAsset(tokenId, sellPrice);

            await auction.connect(address2).cancelAsset(tokenId);
            await assets.connect(address2).transferFrom(address2.address, address1.address, tokenId);
            expect(await assets.balanceOf(address1.address)).eql(ethers.BigNumber.from(1));
        });
    });
});