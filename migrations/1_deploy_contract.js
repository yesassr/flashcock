const DelayedTransfer = artifacts.require("DelayedTransfer");

module.exports = function(deployer) {
  deployer.deploy(DelayedTransfer);
}; 