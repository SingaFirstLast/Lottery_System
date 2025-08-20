// src/App.js
// src/App.jsx
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import web3 from 'web3';
import LottoABI from './contract/LottoABI.json'; // Import the provided ABI

export default function LotteryApp() {
  // State variables
  const [connected, setConnected] = useState(false);
  const [contract, setContract] = useState(null);
  const [balance, setBalance] = useState('0');
  const [players, setPlayers] = useState([]);
  const [lotteryId, setLotteryId] = useState(1);
  const [isOwner, setIsOwner] = useState(false);
  const [txStatus, setTxStatus] = useState({ active: false, message: '' });
  const [winners, setWinners] = useState({});
  const [playerCount, setPlayerCount] = useState(0);
  const [currentAccount, setCurrentAccount] = useState('');

  // Contract address (replace with your actual deployed address)
  const contractAddress = "0x23C592A24FcEd38b9B18b0169772b36e3EE373d1";

  // Connect to wallet
  const connectWallet = useCallback(async () => {
    if (window.ethereum) {
      try {
        setTxStatus({ active: true, message: 'Connecting wallet...' });
        
        // Request account access
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        
        const account = accounts[0];
        setCurrentAccount(account);
        
        // Set up provider and signer
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        
        // Initialize contract
        const lotteryContract = new ethers.Contract(
          contractAddress, 
          LottoABI, 
          signer
        );
        
        setContract(lotteryContract);
        
        // Check if user is owner
        const ownerAddress = await lotteryContract.owner();
        setIsOwner(account.toLowerCase() === ownerAddress.toLowerCase());
        
        // Load initial contract data
        await loadContractData(lotteryContract);
        
        // Set up event listeners
        setupEventListeners(lotteryContract);
        
        setConnected(true);
        setTxStatus({ active: false, message: 'Wallet connected!' });
        setTimeout(() => setTxStatus({ active: false, message: '' }), 3000);
      } catch (error) {
        console.error('Connection error:', error);
        setTxStatus({ active: false, message: `Error: ${error.message}` });
      }
    } else {
      setTxStatus({ active: false, message: 'Please install MetaMask!' });
    }
  }, [contractAddress]);

  // Load contract data
  const loadContractData = useCallback(async (contract) => {
    try {
      setTxStatus({ active: true, message: 'Loading contract data...' });
      
      // Get contract balance
      const contractBalance = await contract.getBalance();
      setBalance(ethers.formatEther(contractBalance));
      
      // Get current lottery ID
      const id = await contract.lotteryId();
      setLotteryId(Number(id));
      
      // Get player count
      const playersArray = await contract.getPlayers();
      setPlayers(playersArray);
      setPlayerCount(playersArray.length);
      
      // Load last 5 winners
      const winnersData = {};
      const startId = Math.max(1, Number(id) - 5);
      
      for (let i = startId; i < Number(id); i++) {
        const winner = await contract.getWinnerByLottery(i);
        winnersData[i] = winner;
      }
      
      setWinners(winnersData);
      
      setTxStatus({ active: false, message: '' });
    } catch (error) {
      console.error('Data load error:', error);
      setTxStatus({ active: false, message: `Error loading data: ${error.message}` });
    }
  }, []);

  // Set up event listeners
  const setupEventListeners = useCallback((contract) => {
    // Listen for new players
    contract.on('enter', (player) => {
      setPlayers(prev => [...prev, player]);
      setPlayerCount(prev => prev + 1);
      setTxStatus({ active: false, message: `New player entered: ${player.substring(0, 6)}...` });
      setTimeout(() => setTxStatus({ active: false, message: '' }), 3000);
    });

    // Listen for winner picked events
    contract.on('pickWinner', (winner, id) => {
      setWinners(prev => ({
        ...prev,
        [id]: winner
      }));
      setPlayers([]);
      setPlayerCount(0);
      setLotteryId(prev => Number(prev) + 1);
      setTxStatus({ active: false, message: `Winner picked: ${winner.substring(0, 6)}...` });
      setTimeout(() => setTxStatus({ active: false, message: '' }), 5000);
    });
  }, []);

  // Enter lottery
  const enterLottery = useCallback(async () => {
    if (!contract) return;
    
    try {
      setTxStatus({ active: true, message: 'Processing entry...' });
      
      // Send transaction with slightly more than minimum to cover gas fluctuations
      const tx = await contract.enter({
        value: ethers.parseEther('0.0011')
      });
      
      await tx.wait();
      setTxStatus({ active: false, message: 'Successfully entered lottery!' });
      setTimeout(() => setTxStatus({ active: false, message: '' }), 3000);
    } catch (error) {
      console.error('Entry error:', error);
      setTxStatus({ active: false, message: `Error: ${error.message}` });
    }
  }, [contract]);

  // Pick winner (owner only)
  const pickWinner = useCallback(async () => {
    if (!contract || !isOwner) return;
    
    try {
      setTxStatus({ active: true, message: 'Selecting winner...' });
      const tx = await contract.pickWinner();
      await tx.wait();
      setTxStatus({ active: false, message: 'Winner selected successfully!' });
      setTimeout(() => setTxStatus({ active: false, message: '' }), 3000);
    } catch (error) {
      console.error('Winner selection error:', error);
      setTxStatus({ active: false, message: `Error: ${error.message}` });
    }
  }, [contract, isOwner]);

  // Auto-connect wallet if previously connected
  useEffect(() => {
    if (window.ethereum?.selectedAddress) {
      connectWallet();
    }
    
    // Clean up event listeners
    return () => {
      if (contract) {
        contract.removeAllListeners('enter');
        contract.removeAllListeners('pickWinner');
      }
    };
  }, [connectWallet, contract]);

  // Format address for display
  const formatAddress = (address) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-center py-6 gap-4">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">
            Blockchain Lottery
          </h1>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {!connected ? (
              <button 
                onClick={connectWallet}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-2 px-6 rounded-full transition shadow-lg"
              >
                Connect Wallet
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="bg-blue-500 text-xs px-2 py-1 rounded-full">
                  {formatAddress(currentAccount)}
                </div>
                {isOwner && (
                  <button 
                    onClick={pickWinner}
                    disabled={playerCount === 0}
                    className={`${
                      playerCount > 0 
                        ? 'bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700' 
                        : 'bg-gray-500 cursor-not-allowed'
                    } text-white font-bold py-2 px-4 rounded-full transition shadow-lg`}
                  >
                    Pick Winner
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Status Messages */}
        {txStatus.message && (
          <div className={`p-4 rounded-lg mb-6 text-center ${
            txStatus.active 
              ? 'bg-blue-500 flex items-center justify-center' 
              : 'bg-green-500'
          }`}>
            {txStatus.active && (
              <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {txStatus.message}
          </div>
        )}

        {/* Main Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Lottery Info Card */}
          <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm p-6 rounded-xl shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-yellow-400">Current Lottery</h2>
            <div className="space-y-4">
              <div className="bg-gray-700 p-4 rounded-lg">
                <p className="text-gray-400">Lottery ID</p>
                <p className="text-2xl font-bold">#{lotteryId}</p>
              </div>
              
              <div className="bg-gray-700 p-4 rounded-lg">
                <p className="text-gray-400">Prize Pool</p>
                <p className="text-2xl font-bold flex items-center">
                  {balance} 
                  <span className="text-yellow-400 ml-2">ETH</span>
                </p>
              </div>
              
              <div className="bg-gray-700 p-4 rounded-lg">
                <p className="text-gray-400">Players</p>
                <p className="text-2xl font-bold">{playerCount}</p>
              </div>
            </div>
          </div>

          {/* Entry Card */}
          <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm p-6 rounded-xl shadow-xl lg:col-span-2">
            <h2 className="text-xl font-bold mb-4 text-yellow-400">Enter Lottery</h2>
            
            <div className="bg-gray-900 p-6 rounded-lg mb-6">
              <p className="text-lg mb-4">Enter with 0.001 ETH for a chance to win!</p>
              
              <button
                onClick={enterLottery}
                disabled={!connected}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-all transform hover:scale-[1.02] ${
                  connected 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600' 
                    : 'bg-gray-600 cursor-not-allowed'
                } shadow-lg`}
              >
                {connected ? 'Enter Lottery (0.0011 ETH)' : 'Connect Wallet to Enter'}
              </button>
            </div>
            
            <div>
              <h3 className="font-bold mb-3 text-lg">Recent Winners</h3>
              <div className="bg-gray-900 p-4 rounded-lg max-h-40 overflow-y-auto">
                {Object.entries(winners).length > 0 ? (
                  Object.entries(winners).map(([id, winner]) => (
                    <div 
                      key={id} 
                      className="flex justify-between py-3 border-b border-gray-700 last:border-0"
                    >
                      <span className="font-medium">Lottery #{id}</span>
                      <span className="text-amber-400 font-medium">
                        {formatAddress(winner)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-center py-4">No winners yet. Be the first!</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Players Card */}
        <div className="bg-gray-800 bg-opacity-70 backdrop-blur-sm p-6 rounded-xl shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-yellow-400">Current Players</h2>
            <span className="bg-blue-500 text-xs px-2 py-1 rounded-full">
              {playerCount} players
            </span>
          </div>
          
          <div className="bg-gray-900 p-4 rounded-lg">
            {playerCount > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {players.map((player, index) => (
                  <div 
                    key={index}
                    className="bg-gray-800 p-4 rounded-lg flex items-center transition-transform hover:scale-[1.02]"
                  >
                    <div className="bg-yellow-500 text-gray-900 font-bold rounded-full w-8 h-8 flex items-center justify-center mr-3">
                      {index + 1}
                    </div>
                    <span className="font-mono">
                      {formatAddress(player)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">No players have entered yet</p>
                <button
                  onClick={enterLottery}
                  disabled={!connected}
                  className={`px-4 py-2 rounded-lg ${
                    connected 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
                      : 'bg-gray-600'
                  }`}
                >
                  Be the first player!
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Info Footer */}
        <footer className="mt-8 text-center text-gray-400 text-sm">
          <p>Built on Ethereum | All prizes distributed automatically by smart contract</p>
          {isOwner && (
            <div className="mt-2 p-2 bg-emerald-900 rounded-lg inline-block">
              <span className="font-medium">Owner Mode Active</span>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
