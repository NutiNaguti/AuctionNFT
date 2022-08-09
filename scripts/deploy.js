// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
require("dotenv").config();

async function main() {
  let Blacklist = await ethers.getContractFactory("Blacklist");
  let blacklist = await Blacklist.deploy();

  let Assets = await ethers.getContractFactory("Assets");
  let assets =  await upgrades.deployProxy(Assets, ["Assets", "ASSETS", process.env.BASE_URI, process.env.BASE_PRICE, process.env.ADDITIONAL_PRICE, blacklist.address]);
  
  let Treasury = await ethers.getContractFactory("Treasury");
  let treasury = await Treasury.deploy(assets.address);

  let Auction = await ethers.getContractFactory("Auction");
  let auction = await upgrades.deployProxy(Auction, [assets.address, treasury.address, blacklist.address]);

  console.log("blacklist address: ", blacklist.address);
  console.log("assets address: ", assets.address);
  console.log("treasury address: ", treasury.address);
  console.log("auction address: ", auction.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
