// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FaltricToken (FAL)
 * @notice ERC-20 energy token on Ethereum Sepolia Testnet.
 *         Tokenomics: 1 FAL = 100 Units = 400 INR (1 Unit = 4 INR)
 *         Only authorized minters (the backend oracle / owner) can mint.
 */
contract FaltricToken is ERC20, Ownable {
    // ─────────────────────────────────────────────────
    //  Tokenomics constants
    // ─────────────────────────────────────────────────

    /// @notice Units of electricity required to earn 1 FAL token
    uint256 public constant UNITS_PER_TOKEN = 100;

    /// @notice INR value per unit (stored as paise: 4 INR = 400 paise for precision)
    uint256 public constant INR_PER_UNIT = 4;

    // ─────────────────────────────────────────────────
    //  Authorized minters (e.g., backend oracle)
    // ─────────────────────────────────────────────────

    mapping(address => bool) public authorizedMinters;

    // ─────────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────────

    event MinterAuthorized(address indexed minter);
    event MinterRevoked(address indexed minter);
    event TokensMinted(address indexed to, uint256 units, uint256 tokens);

    // ─────────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────────

    modifier onlyMinter() {
        require(
            authorizedMinters[msg.sender] || msg.sender == owner(),
            "FaltricToken: caller is not authorized to mint"
        );
        _;
    }

    // ─────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────

    /**
     * @param initialOwner Wallet address of the deployer (used for Ownable)
     */
    constructor(address initialOwner)
        ERC20("Faltric", "FAL")
        Ownable(initialOwner)
    {
        // Authorize the deployer as the first minter
        authorizedMinters[initialOwner] = true;
        emit MinterAuthorized(initialOwner);
    }

    // ─────────────────────────────────────────────────
    //  Core Tokenomics Function
    // ─────────────────────────────────────────────────

    /**
     * @notice Mint FAL tokens from verified renewable energy generation.
     * @param to      Address of the energy producer receiving tokens
     * @param units   Number of electricity units (kWh) generated
     *
     * Formula: tokens = units / UNITS_PER_TOKEN
     * Minimum: at least UNITS_PER_TOKEN units must be provided to earn 1 FAL
     * Remainder units are tracked off-chain for future accumulation.
     */
    function mintFromGeneration(address to, uint256 units)
        external
        onlyMinter
    {
        require(to != address(0), "FaltricToken: mint to zero address");
        require(units >= UNITS_PER_TOKEN, "FaltricToken: insufficient units for 1 FAL");

        uint256 tokensToMint = units / UNITS_PER_TOKEN;
        // Mint with 18 decimals (standard ERC-20)
        _mint(to, tokensToMint * (10 ** decimals()));

        emit TokensMinted(to, units, tokensToMint);
    }

    // ─────────────────────────────────────────────────
    //  Admin: Minter Management
    // ─────────────────────────────────────────────────

    function authorizeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = true;
        emit MinterAuthorized(minter);
    }

    function revokeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
        emit MinterRevoked(minter);
    }

    // ─────────────────────────────────────────────────
    //  View Helpers
    // ─────────────────────────────────────────────────

    /**
     * @notice How many FAL tokens would be minted for a given number of units?
     */
    function calculateTokens(uint256 units) external pure returns (uint256) {
        return units / UNITS_PER_TOKEN;
    }

    /**
     * @notice INR value of a given token amount
     */
    function calculateINRValue(uint256 tokenAmount) external pure returns (uint256) {
        // 1 FAL = 100 units * 4 INR/unit = 400 INR
        return tokenAmount * UNITS_PER_TOKEN * INR_PER_UNIT;
    }
}
