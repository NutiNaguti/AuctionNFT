const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

describe("Assets tests", () => {
    let Blacklist;
    let Assets;

    let blacklist;
    let assets;

    const BASE_URI = "ipfs://test/";
    const BASE_PRICE = ethers.BigNumber.from("10000000000000000");
    const ADDITIONAL_PRICE = BASE_PRICE.div(2);

    let leafNodes;
    let merkleTree;

    beforeEach(async () => {
        Blacklist = await ethers.getContractFactory("Blacklist");
        blacklist = await Blacklist.deploy();

        Assets = await ethers.getContractFactory("Assets");
        assets =  await upgrades.deployProxy(Assets, ["Assets", "ASSETS", BASE_URI, BASE_PRICE, ADDITIONAL_PRICE, blacklist.address]);
    
        [owner, address1, address2, address3, address4, address5, address6, address7] = await ethers.getSigners();
        const whitelist = [address2.address, address3.address, address4.address, address5.address, address6.address, address7.address]

        // =============== Creating whitelist ===============
        leafNodes = whitelist.map(addr => keccak256(addr));
        merkleTree = new MerkleTree(leafNodes, keccak256, {sortPairs: true});
        await assets.setMerkeleRoot(merkleTree.getRoot());
    });

    describe("mint for whitelisted user", async () => {
        it("successful mint", async () => {
            let content = "First mint!";
            let hashedAddress = keccak256(address2.address);
            let merkleProof = merkleTree.getHexProof(hashedAddress);
            await assets.connect(address2).whitelistMint(address2.address, merkleProof, content, {value: BASE_PRICE});
            expect(await assets.balanceOf(address2.address)).eql(ethers.BigNumber.from(1));

            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
            expect(await assets.getContent(address2.address, tokenId)).eql(content);

            let uri = await assets.tokenURI(tokenId);
            expect(uri).eql(BASE_URI + 1 + ".json");
        });

        it("try mint for not whitelisted user", async () => {
            let content = "First mint!";
            let hashedAddress = keccak256(address1.address);
            let merkleProof = merkleTree.getHexProof(hashedAddress);
            await expect(assets.connect(address2).whitelistMint(address2.address, merkleProof, content, {value: BASE_PRICE})).revertedWith("Assets: Incorrect proof");
        });

        it("try mint whith insufficient balance", async () => {
            let content = "First mint!";
            let hashedAddress = keccak256(address2.address);
            let merkleProof = merkleTree.getHexProof(hashedAddress);
            await expect(assets.connect(address2).whitelistMint(address2.address, merkleProof, content, {value: ADDITIONAL_PRICE})).revertedWith("Assets: not enougth ETH");
        });

        it("try mint for already claimed user", async () => {
            let content = "First mint!";
            let hashedAddress = keccak256(address2.address);
            let merkleProof = merkleTree.getHexProof(hashedAddress);
            await assets.connect(address2).whitelistMint(address2.address, merkleProof, content, {value: BASE_PRICE});
            await expect(assets.connect(address2).whitelistMint(address2.address, merkleProof, content, {value: BASE_PRICE})).revertedWith("Assets: this user already claimed token");
        });

        it("try mint for user in blacklist", async () => {
            await blacklist.addToBlacklist(address2.address);

            let content = "First mint!";
            let hashedAddress = keccak256(address2.address);
            let merkleProof = merkleTree.getHexProof(hashedAddress);
            await expect(assets.connect(address2).whitelistMint(address2.address, merkleProof, content, {value: BASE_PRICE})).revertedWith("Assets: cannot mint for user in blacklist");
        });
    })

    describe("mint for not whitelisted user", async () => {
        it("successful mint", async () => {
            let content = "First mint!";
            await assets.connect(address2).mint(address2.address, content, {value: BASE_PRICE.add(ADDITIONAL_PRICE)});
            expect(await assets.balanceOf(address2.address)).eql(ethers.BigNumber.from(1));

            let tokenId = await assets.tokenOfOwnerByIndex(address2.address, 0);
            expect(await assets.getContent(address2.address, tokenId)).eql(content);

            let uri = await assets.tokenURI(tokenId);
            expect(uri).eql(BASE_URI + 1 + ".json");
        });

        it("try mint whith insufficient balance", async () => {
            let content = "First mint!";
            await expect(assets.connect(address2).mint(address2.address, content, {value: BASE_PRICE})).revertedWith("Assets: not enougth ETH");
        });

        it("try mint for already claimed user", async () => {
            let content = "First mint!";
            await assets.connect(address2).mint(address2.address, content, {value: BASE_PRICE.add(ADDITIONAL_PRICE)});
            await expect(assets.connect(address2).mint(address2.address, content, {value:  BASE_PRICE.add(ADDITIONAL_PRICE)})).revertedWith("Assets: this user already claimed token");
        });

        it("try mint for user in blacklist", async () => {
            await blacklist.addToBlacklist(address2.address);

            let content = "First mint!";
            await expect(assets.connect(address2).mint(address2.address, content, {value:  BASE_PRICE.add(ADDITIONAL_PRICE)})).revertedWith("Assets: cannot mint for user in blacklist");
        });
    });

    describe("transfer tokens", async () => {
        it("try transfer token from blacklisted user", async () => {
            let content = "First mint!";
            await assets.connect(address2).mint(address2.address, content, {value: BASE_PRICE.add(ADDITIONAL_PRICE)});

            await blacklist.addToBlacklist(address2.address);
            await expect(assets.connect(address2).transferFrom(address2.address, address1.address, 1)).revertedWith("Assets: cannot transfer token from blacklisted user");
        });

        it("try transfer to blacklisted user", async () => {
            let content = "First mint!";
            await assets.connect(address2).mint(address2.address, content, {value: BASE_PRICE.add(ADDITIONAL_PRICE)});

            await blacklist.addToBlacklist(address1.address);
            await expect(assets.connect(address2).transferFrom(address2.address, address1.address, 1)).revertedWith("Assets: cannot transfer token to blacklisted user");
        });

        it("check if content transfered with token", async () => {
            let content = "First mint!";
            await assets.connect(address2).mint(address2.address, content, {value: BASE_PRICE.add(ADDITIONAL_PRICE)});
            await assets.connect(address2).transferFrom(address2.address, address1.address, 1);
            expect(await assets.getContent(address2.address, 1)).eql("");
            expect(await assets.getContent(address1.address, 1)).eql(content);
        });
    });
});