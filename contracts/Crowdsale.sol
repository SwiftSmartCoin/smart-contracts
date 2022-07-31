// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.15;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Crowdsale Smart Contract
contract Crowdsale is Pausable, Ownable {
    using SafeERC20 for IERC20;

    uint256 private constant ICO_SUPPLY_PER_PHASE = 40000000 ether;
    uint256 private constant PHASES = 5;
    uint256 private constant PHASE_DURATION = 48 hours;
    uint256 private constant SOFT_CAP = 96500 ether;

    struct PhaseDetails {
        uint256 busdReceived;
        uint256 tokensSold;
        uint256 startTimestamp;
    }

    mapping(uint256 => PhaseDetails) public phases;
    mapping(uint256 => uint256) public tokenPrices;

    error InvalidPhase();
    error MinCap();
    error NotActive();
    error RefundNotActive();
    error NoRefundAvailable();

    // Token contract
    IERC20 public swft;
    IERC20 public busd;
    // treasury that will receive the BUSD
    address public treasury;
    uint256 public currentPhase;

    uint256 public totalBUSDRaised;

    mapping(address => uint256) public tokensBought;
    mapping(address => uint256) public busdSpent;

    modifier isRefundActive() {
        if (currentPhase != 5) revert RefundNotActive();

        PhaseDetails memory phase = phases[currentPhase];
        if (
            totalBUSDRaised > SOFT_CAP &&
            block.timestamp - (phase.startTimestamp) < PHASE_DURATION
        ) revert RefundNotActive();
        _;
    }

    // Events
    event Purchase(
        address indexed investor,
        uint256 tokenAmount,
        uint256 busdSpent
    );
    event Refund(
        address indexed investor,
        uint256 tokenAmount,
        uint256 busdSpent
    );

    constructor(address _swft, address _treasury) {
        swft = IERC20(_swft);
        treasury = _treasury;

        busd = IERC20(0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56);

        tokenPrices[1] = 1300000 gwei; // 0.0013 BUSD
        tokenPrices[2] = 2600000 gwei; // 0.0026 BUSD
        tokenPrices[3] = 3900000 gwei; // 0.0039 BUSD
        tokenPrices[4] = 5400000 gwei; // 0.0054 BUSD
        tokenPrices[5] = 6500000 gwei; // 0.0065 BUSD
    }

    function getPhaseDetails()
        external
        view
        returns (
            uint256 phaseNumber,
            uint256 busdReceived,
            uint256 tokensSold,
            uint256 tokenPrice,
            uint256 totalBUSDRaisedTillNow
        )
    {
        PhaseDetails memory phase = phases[currentPhase];

        phaseNumber = currentPhase;
        busdReceived = phase.busdReceived;
        tokensSold = phase.tokensSold;
        tokenPrice = tokenPrices[currentPhase];
        totalBUSDRaisedTillNow = totalBUSDRaised;
    }

    function _beforePurchase(uint256 tokenAmount) internal {
        PhaseDetails memory phase = phases[currentPhase];

        // solhint-disable
        if (block.timestamp - (phase.startTimestamp) > PHASE_DURATION) {
            uint256 incrementBy = (block.timestamp - phase.startTimestamp) /
                (PHASE_DURATION);

            updatePhase(
                currentPhase + (incrementBy),
                phase.startTimestamp * (incrementBy)
            );
            return;
        }

        if (phase.tokensSold + (tokenAmount) > ICO_SUPPLY_PER_PHASE) {
            updatePhase(currentPhase + (1), block.timestamp);
            return;
        }
    }

    function getCurrentTokenPrice() public view returns (uint256) {
        return tokenPrices[currentPhase];
    }

    function purchase(uint256 amount) external whenNotPaused {
        _beforePurchase(amount);
        uint256 tokenPrice = getCurrentTokenPrice();
        uint256 busdNeeded = (amount * tokenPrice) / 1 ether;

        if (busdNeeded < 50 ether) revert MinCap();

        PhaseDetails storage phase = phases[currentPhase];

        phase.busdReceived = phase.busdReceived + busdNeeded;
        phase.tokensSold = phase.tokensSold + amount;

        tokensBought[msg.sender] = tokensBought[msg.sender] + amount;
        busdSpent[msg.sender] = busdSpent[msg.sender] + busdNeeded;

        totalBUSDRaised += busdNeeded;

        IERC20(busd).safeTransferFrom(msg.sender, treasury, busdNeeded);
        IERC20(swft).safeTransferFrom(treasury, msg.sender, amount);

        emit Purchase(msg.sender, amount, busdNeeded);
    }

    // @notice this function updates the phase and start timestamp
    function updatePhase(uint256 _to, uint256 _startTimestamp) internal {
        if (_to <= currentPhase) return;
        if (_to < 1 || _to > PHASES) revert InvalidPhase();

        currentPhase = currentPhase + 1;
        PhaseDetails storage phase = phases[currentPhase];
        phase.startTimestamp = _startTimestamp;
    }

    // @notice treasury needs to approve busd tokens to the contract in case sale
    // does not reach hard cap.
    function refund() external isRefundActive {
        if (tokensBought[msg.sender] == 0 && totalBUSDRaised > 0)
            revert NoRefundAvailable();

        uint256 tokensToReturn = tokensBought[msg.sender];
        uint256 busdToReturn = busdSpent[msg.sender];

        tokensBought[msg.sender] = 0;
        busdSpent[msg.sender] = 0;

        totalBUSDRaised -= busdToReturn;

        IERC20(swft).safeTransferFrom(msg.sender, treasury, tokensToReturn);
        IERC20(busd).safeTransferFrom(treasury, msg.sender, busdToReturn);

        emit Refund(msg.sender, tokensToReturn, busdToReturn);
    }

    // @dev this function can be used to remove tokens and eth sent to the
    // contract by mistake.
    function inCaseTokensGetStuck(address token) external onlyOwner {
        if (token == address(0))
            return payable(owner()).transfer(address(this).balance);

        IERC20(token).safeTransfer(
            owner(),
            IERC20(token).balanceOf(address(this))
        );
    }
}
