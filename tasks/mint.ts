import { task } from 'hardhat/config';
import '@nomiclabs/hardhat-ethers';

task("mint", "Create NFT token on the address")
  .addParam("to", "Address which to transfer NFT")
  .setAction(async (taskArgs, hre) => {
    const marketplace = await hre.ethers.getContractAt("Marketplace", process.env.MARKETPLACE_CONTRACT_ADDR!);
    await marketplace.createItem(taskArgs.to);
    console.log(`NFT was minted to ${taskArgs.to}!`);
  });