const Web3 = require('web3');
const contractABI = require('../build/contracts/DelayedTransfer.json').abi;

class DelayedTransferService {
    constructor(providerUrl, contractAddress) {
        // Initialize Web3 with your preferred provider (Infura/Alchemy/Ankr)
        this.web3 = new Web3(providerUrl);
        this.contract = new this.web3.eth.Contract(contractABI, contractAddress);
    }

    async scheduleTransfer(params) {
        const {
            senderAddress,
            recipientAddress,
            amount,
            delayInHours,
            isToken,
            tokenAddress
        } = params;

        const releaseTime = Math.floor(Date.now() / 1000) + (delayInHours * 3600);

        if (isToken) {
            // For ERC20 tokens, first approve the contract
            const tokenContract = new this.web3.eth.Contract(
                [
                    {
                        "constant": false,
                        "inputs": [
                            {"name": "spender", "type": "address"},
                            {"name": "amount", "type": "uint256"}
                        ],
                        "name": "approve",
                        "outputs": [{"name": "", "type": "bool"}],
                        "payable": false,
                        "stateMutability": "nonpayable",
                        "type": "function"
                    }
                ],
                tokenAddress
            );

            await tokenContract.methods.approve(this.contract.options.address, amount)
                .send({ from: senderAddress });
        }

        // Schedule the transfer
        const tx = await this.contract.methods.scheduleTransfer(
            recipientAddress,
            releaseTime,
            isToken,
            tokenAddress || '0x0000000000000000000000000000000000000000'
        ).send({
            from: senderAddress,
            value: isToken ? 0 : amount,
            gas: 200000
        });

        return tx;
    }

    async executeTransfer(transferId, executorAddress) {
        return await this.contract.methods.executeTransfer(transferId)
            .send({
                from: executorAddress,
                gas: 200000
            });
    }

    async cancelTransfer(transferId, senderAddress) {
        return await this.contract.methods.cancelTransfer(transferId)
            .send({
                from: senderAddress,
                gas: 200000
            });
    }

    async getTransfer(transferId) {
        const transfer = await this.contract.methods.getTransfer(transferId).call();
        return {
            sender: transfer[0],
            recipient: transfer[1],
            amount: transfer[2],
            releaseTime: transfer[3],
            isToken: transfer[4],
            tokenAddress: transfer[5],
            executed: transfer[6],
            cancelled: transfer[7]
        };
    }
}

// Example usage:
async function example() {
    // Replace with your provider URL (Infura/Alchemy/Ankr)
    const providerUrl = "https://goerli.infura.io/v3/YOUR-PROJECT-ID";
    // Replace with your deployed contract address
    const contractAddress = "YOUR-CONTRACT-ADDRESS";
    
    const service = new DelayedTransferService(providerUrl, contractAddress);

    // Example: Schedule an ETH transfer
    const transfer = await service.scheduleTransfer({
        senderAddress: "0xYourAddress",
        recipientAddress: "0xRecipientAddress",
        amount: web3.utils.toWei("0.1", "ether"),
        delayInHours: 24,
        isToken: false
    });

    console.log("Transfer scheduled:", transfer);
}

module.exports = DelayedTransferService; 