import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const Marketplace = await ethers.getContractFactory("Marketplace", signer);
  const marketplace = await Marketplace.deploy("0x17E117Ed9929Ed8e37B369c87dE1613377Ca07c6", "0x6E6471B661a1f1A21Dd342b6BA98b60EbDB9F24C", 259200, 3);

  await marketplace.deployed();

  console.log("Marketplace contract deployed to:", marketplace.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});