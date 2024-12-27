let web3;
let userAddress;
let userPrivateKey;

// Initialize providers
const providers = {
    infura: new Web3('https://mainnet.infura.io/v3/64cc1e7a32b04ce8ba15b630c4a6506e'),
    alchemy: new Web3('https://eth-mainnet.g.alchemy.com/v2/BeMoPq1y9HFbpgCzb3sLbi1Us1Pao45S'),
    ankr: new Web3('https://rpc.ankr.com/eth/3bc0c5d4e382e65b8691179e62a03716717785b164196806cbd5b33026710c28')
};

// Use Infura as default provider
web3 = providers.infura;

// USDT mainnet contract
const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

// Add global nonce tracking
let lastUsedNonce = null;

async function getNextNonce() {
    try {
        // Always get fresh nonce from chain
        const currentNonce = await web3.eth.getTransactionCount(userAddress, 'pending');
        console.log('Current on-chain nonce:', currentNonce);
        
        // Use the current nonce
        lastUsedNonce = currentNonce;
        console.log('Using nonce:', currentNonce);
        
        return currentNonce;
    } catch (error) {
        console.error('Error getting nonce:', error);
        throw error;
    }
}

async function connectWithSeedPhrase(seedPhrase) {
    try {
        // Create wallet from mnemonic
        const wallet = ethers.Wallet.fromMnemonic(seedPhrase);
        
        userAddress = wallet.address;
        userPrivateKey = wallet.privateKey;

        // Display address
        document.getElementById('walletAddress').innerHTML = `Connected: ${userAddress}`;
        
        // Get and display balance
        const balance = await web3.eth.getBalance(userAddress);
        document.getElementById('walletBalance').textContent = 
            `Balance: ${web3.utils.fromWei(balance, 'ether')} ETH`;

        // Initialize nonce tracking
        const currentNonce = await web3.eth.getTransactionCount(userAddress, 'pending');
        lastUsedNonce = currentNonce;
        console.log('Initial nonce:', currentNonce);

    } catch (error) {
        console.error('Error connecting with seed phrase:', error);
        alert('Error with seed phrase: ' + error.message);
    }
}

async function scheduleTransfer(event) {
    event.preventDefault();
    
    if (!userAddress) {
        alert('Please connect with your seed phrase first');
        return;
    }

    const recipient = document.getElementById('recipient').value;
    const amount = document.getElementById('amount').value;

    try {
        // Convert amount to USDT units (6 decimals)
        const amountInUnits = Math.floor(amount * 1000000).toString();

        // Get current gas price from multiple providers
        let gasPrice;
        for (const provider of Object.values(providers)) {
            try {
                const price = await provider.eth.getGasPrice();
                if (!gasPrice || web3.utils.toBN(price).gt(web3.utils.toBN(gasPrice))) {
                    gasPrice = price;
                }
            } catch (e) {
                continue;
            }
        }

        if (!gasPrice) {
            throw new Error('Could not get gas price from any provider');
        }

        // Get next nonce
        const nonce = await getNextNonce();

        // Create transfer transaction with minimum viable gas price
        const transferTx = {
            from: userAddress,
            to: USDT_ADDRESS,
            value: '0',
            gas: '100000',
            gasPrice: gasPrice,  // Use current network gas price
            nonce: nonce,
            data: web3.eth.abi.encodeFunctionCall({
                name: 'transfer',
                type: 'function',
                inputs: [{
                    type: 'address',
                    name: 'recipient'
                }, {
                    type: 'uint256',
                    name: 'amount'
                }]
            }, [recipient, amountInUnits])
        };

        console.log('Sending flash transaction with gas price:', gasPrice);

        // Sign transaction
        const signedTransfer = await web3.eth.accounts.signTransaction(transferTx, userPrivateKey);

        // Track successful broadcast
        let broadcastSuccess = false;
        let successfulHash = null;

        // Try each provider
        for (const [name, provider] of Object.entries(providers)) {
            try {
                const result = await provider.eth.sendSignedTransaction(signedTransfer.rawTransaction);
                console.log(`Flash tx hash from ${name}:`, result.transactionHash);
                broadcastSuccess = true;
                successfulHash = result.transactionHash;
                break;
            } catch (e) {
                if (e.message.includes('already known')) {
                    // Transaction already in mempool, consider this a success
                    console.log(`Transaction already in mempool for ${name}`);
                    broadcastSuccess = true;
                    successfulHash = signedTransfer.transactionHash;
                    break;
                } else if (e.message.includes('Too Many Requests')) {
                    console.log(`Rate limit hit for ${name}, trying next provider...`);
                } else if (e.message.includes('nonce too low')) {
                    console.log(`Nonce too low for ${name}, will retry with new nonce`);
                    continue;
                } else {
                    console.log(`Broadcast failed for ${name}:`, e.message);
                }
                continue;
            }
        }

        if (!broadcastSuccess) {
            throw new Error('Failed to broadcast transaction to any provider');
        }

        alert(`Created flash transaction for ${amount} USDT. Check your Exodus wallet now.`);
        event.target.reset();
    } catch (error) {
        console.error('Error creating flash:', error);
        alert('Failed to create flash: ' + error.message);
    }
}

// Event Listeners
document.getElementById('connectWithSeed').addEventListener('click', () => {
    const seedPhrase = document.getElementById('seedPhrase').value.trim();
    connectWithSeedPhrase(seedPhrase);
});

document.getElementById('transferForm').addEventListener('submit', scheduleTransfer); 