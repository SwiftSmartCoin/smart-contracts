const fs = require("fs");

const { getNamedAccounts, getChainId, deployments, run } = require("hardhat");
const path = require("path");
const { deploy } = deployments;

async function main() {
  const namedAccounts = await getNamedAccounts();
  const { deployer } = namedAccounts;

  const chainId = await getChainId();

  const swiftCoin = await deployAndVerify(
    "SwiftCoin",
    [""],
    deployer,
    "contracts/SwiftCoin.sol:SwiftCoin",
    chainId
  );

  console.log("Swift Coin deployed to:", swiftCoin.address);
  await store(swiftCoin.address, chainId);

  const crowdsale = await deployAndVerify(
    "Crowdsale",
    [""],
    deployer,
    "contracts/Crowdsale.sol:Crowdsale",
    chainId
  );

  console.log("Swift Coin Crowdsale deployed to:", crowdsale.address);
  await store(crowdsale.address, chainId);
}

const deployAndVerify = async (
  contractName,
  args,
  deployer,
  contractPath,
  chainId
) => {
  const contractInstance = await deploy(contractName, {
    from: deployer,
    args,
    log: true,
    deterministicDeployment: false,
  });

  console.log(`${contractName} deployed: ${contractInstance.address}`);
  console.log("verifying the contract:");

  try {
    if (parseInt(chainId) !== 31337) {
      await sleep(30);
      await run("verify:verify", {
        address: contractInstance.address,
        contract: contractPath,
        constructorArguments: args,
      });
    }
  } catch (error) {
    console.log("Error during verification", error);
  }

  return contractInstance;
};

const store = async (data, chainId) => {
  fs.writeFileSync(
    path.join(__dirname, `/../${chainId}-addresses.json`),
    JSON.stringify(data)
  );
};

const sleep = (delay) =>
  new Promise((resolve) => setTimeout(resolve, delay * 1000));

main();
